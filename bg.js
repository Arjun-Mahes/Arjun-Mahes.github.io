// Background: topographic contour lines, like a trail map, slowly shifting.
// The cursor is a hill: the terrain rises under it, so the lines ring around it and follow it.
// Drawn with marching squares over Perlin noise; every fifth line is a darker "index contour".
// Liquid glass: under any element with data-glass, the terrain is sampled through a lens, so the
// lines bend at the panel's rim like light through thick glass. Done here (not with an SVG
// backdrop filter) so it works in every browser, Firefox and Safari included.
(function () {
    const SETTINGS = {
        cell: 10,            // grid spacing in px; smaller = smoother lines, more work
        scale: 0.0028,       // noise zoom: lower = broader hills
        step: 0.1,           // elevation between contour lines
        speed: 0.02,         // how fast the terrain morphs
        fps: 60,
        hillHeight: 0.9,     // how tall the cursor hill is
        hillSize: 95,        // px: how wide it is
        follow: 0.25,        // 0..1: how quickly the hill catches up with the cursor
        glassReach: 1.0,     // how far toward the centre the bending reaches (fraction of the panel's half-size;
                             // 1 = right to the centre line, where the push fades to exactly 0, so no tearing)
        glassReachMax: 420,  // px cap on that reach for big panels
        glassPush: 240,      // px: how far lines are displaced right at the edge (eases to 0 at the reach)
        glassFalloff: 1.0,   // how quickly the bending fades inward (lower = stays strong deeper in; keep >= 1 or the centre tears)
        glassClear: 0.3,     // 0..1: how much the lines fade across the middle of the glass
        textClear: 0.92,     // 0..1: how much the lines fade right behind words on the glass
        textPad: 7,          // px of soft clearing around each line of text
        // Line colours come from the CSS variables --topo-line / --topo-index, so they follow the theme
    };

    const canvas = document.getElementById('bg');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    // ─── Perlin noise (Ken Perlin's improved noise, fixed seed so the map is the same every visit) ───
    const perm = new Uint8Array(512);
    {
        const p = Array.from({ length: 256 }, (_, i) => i);
        let seed = 43472;
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    }
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    function grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    function noise(x, y, z) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = fade(x), v = fade(y), w = fade(z);
        const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
        const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
        return lerp(
            lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
                 lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
            lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
                 lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
            w);
    }

    // ─── Marching squares ───
    // Corners: a = top-left, b = top-right, c = bottom-right, d = bottom-left.
    // Each case lists the cell edges (T, R, B, L) the contour crosses, in pairs.
    const CASES = [
        [], ['L', 'B'], ['B', 'R'], ['L', 'R'], ['T', 'R'], ['L', 'T', 'B', 'R'], ['T', 'B'], ['L', 'T'],
        ['L', 'T'], ['T', 'B'], ['L', 'B', 'T', 'R'], ['T', 'R'], ['L', 'R'], ['B', 'R'], ['L', 'B'], []
    ];

    function point(edge, a, b, c, d, l, x0, y0, s) {
        switch (edge) {
            case 'T': return [x0 + s * (l - a) / (b - a), y0];
            case 'R': return [x0 + s, y0 + s * (l - b) / (c - b)];
            case 'B': return [x0 + s * (l - d) / (c - d), y0 + s];
            default: return [x0, y0 + s * (l - a) / (d - a)];
        }
    }

    let width = 0, height = 0, cols = 0, rows = 0, field = new Float32Array(0);

    // Re-read the line colours whenever the theme changes
    const colours = { line: '', index: '' };
    function readColours() {
        const css = getComputedStyle(document.documentElement);
        colours.line = css.getPropertyValue('--topo-line').trim() || 'rgba(168, 72, 37, 0.2)';
        colours.index = css.getPropertyValue('--topo-index').trim() || 'rgba(168, 72, 37, 0.38)';
    }
    readColours();
    new MutationObserver(readColours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const low = -1.3;

    // The hill eases toward the cursor and sinks away when the cursor leaves the page
    const target = { x: 0, y: 0, on: 0 };
    const hill = { x: 0, y: 0, h: 0 };

    function resize() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        width = innerWidth;
        height = innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(width / SETTINGS.cell) + 1;
        rows = Math.ceil(height / SETTINGS.cell) + 1;
        field = new Float32Array(cols * rows);
    }

    // Visible glass panels as rounded rectangles
    function glassPanels() {
        const list = [];
        for (const el of document.querySelectorAll('[data-glass]')) {
            if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 40 || r.height < 40) continue;
            const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
            const reach = Math.min(SETTINGS.glassReachMax, Math.min(r.width, r.height) / 2 * SETTINGS.glassReach);
            list.push({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2, radius, reach });
        }
        return list;
    }

    // Where to sample the terrain for a point that may sit under glass. The sample is pushed
    // outward along the edge normal: hardest at the edge, easing off toward the centre, and
    // reaching most of the way in, so the whole panel warps like a lens of liquid glass.
    function lens(px, py, panels) {
        const { glassPush, glassFalloff } = SETTINGS;
        // Innermost glass wins (tiles sit inside the gallery panel), so check the last ones first
        for (let n = panels.length - 1; n >= 0; n--) {
            const g = panels[n];
            const ox = px - g.cx, oy = py - g.cy;
            const qx = Math.abs(ox) - (g.hw - g.radius), qy = Math.abs(oy) - (g.hh - g.radius);
            const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
            const sdf = outside + Math.min(Math.max(qx, qy), 0) - g.radius;   // < 0 inside the panel
            if (sdf >= 0) continue;
            const depth = -sdf;
            const rim = g.reach;
            if (depth >= rim) return [px, py];
            // Edge normal: from the nearest point of the panel's inner rectangle
            let nx, ny;
            if (qx > 0 && qy > 0) { nx = qx * Math.sign(ox); ny = qy * Math.sign(oy); const n = Math.hypot(nx, ny); nx /= n; ny /= n; }
            else if (qx > qy) { nx = Math.sign(ox); ny = 0; }
            else { nx = 0; ny = Math.sign(oy); }
            const push = glassPush * (1 - depth / rim) ** glassFalloff;
            return [px + nx * push, py + ny * push];
        }
        return [px, py];
    }

    function draw(time) {
        const { cell, scale, step, hillHeight, hillSize, follow } = SETTINGS;
        const z = time * SETTINGS.speed;

        hill.x += (target.x - hill.x) * follow;
        hill.y += (target.y - hill.y) * follow;
        hill.h += (target.on * hillHeight - hill.h) * 0.16;
        const twoSigma2 = 2 * hillSize * hillSize;
        const panels = glassPanels();

        // Terrain: two octaves of noise, plus the cursor hill, seen through any glass
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const [px, py] = panels.length ? lens(i * cell, j * cell, panels) : [i * cell, j * cell];
                const x = px * scale, y = py * scale;
                let e = noise(x, y, z) + 0.45 * noise(x * 2.1 + 17, y * 2.1 + 5, z * 1.3);
                if (hill.h > 0.01) {
                    const dx = px - hill.x, dy = py - hill.y;
                    e += hill.h * Math.exp(-(dx * dx + dy * dy) / twoSigma2);
                }
                field[j * cols + i] = e;
            }
        }

        const minor = new Path2D();
        const major = new Path2D();
        for (let j = 0; j < rows - 1; j++) {
            for (let i = 0; i < cols - 1; i++) {
                const a = field[j * cols + i], b = field[j * cols + i + 1];
                const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
                const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
                const x0 = i * cell, y0 = j * cell;

                // Only the levels that actually pass through this cell
                for (let k = Math.ceil((lo - low) / step); k * step + low <= hi; k++) {
                    const l = k * step + low;
                    const idx = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0);
                    const edges = CASES[idx];
                    if (!edges.length) continue;
                    const path = k % 5 === 0 ? major : minor;
                    for (let e = 0; e < edges.length; e += 2) {
                        const p1 = point(edges[e], a, b, c, d, l, x0, y0, cell);
                        const p2 = point(edges[e + 1], a, b, c, d, l, x0, y0, cell);
                        path.moveTo(p1[0], p1[1]);
                        path.lineTo(p2[0], p2[1]);
                    }
                }
            }
        }

        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';
        ctx.lineWidth = 1;
        ctx.strokeStyle = colours.line;
        ctx.stroke(minor);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = colours.index;
        ctx.stroke(major);

        if (panels.length) {
            clearGlassCentres(panels);
            clearBehindText();
        }
    }

    // Fade the lines tightly behind each line of text on the glass, so the glass can stay clear
    // everywhere else. Uses the text's own line boxes, padded and softened in layers.
    const range = document.createRange();
    function clearBehindText() {
        const layers = 3;
        const alpha = 1 - Math.pow(1 - SETTINGS.textClear, 1 / layers);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        for (const el of document.querySelectorAll('[data-glass] :is(h1, h2, p, li, .link-pill)')) {
            if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
            range.selectNodeContents(el);
            for (const box of range.getClientRects()) {
                if (box.width < 1) continue;
                for (let k = 0; k < layers; k++) {
                    const pad = SETTINGS.textPad * (1 - k / layers);
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(box.left - pad, box.top - pad / 2, box.width + pad * 2, box.height + pad, pad);
                    else ctx.rect(box.left - pad, box.top - pad / 2, box.width + pad * 2, box.height + pad);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    // Fade the lines across the middle of each glass panel so text on it stays readable.
    // Layered insets give a soft edge, so the bent lines in the rim fade smoothly into clear glass.
    function clearGlassCentres(panels) {
        const layers = 6;
        const alpha = 1 - Math.pow(1 - SETTINGS.glassClear, 1 / layers);   // layers add up to glassClear
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        for (const g of panels) {
            for (let k = 0; k < layers; k++) {
                const inset = 36 + k * 8;
                const w = g.hw * 2 - inset * 2, h = g.hh * 2 - inset * 2;
                if (w <= 0 || h <= 0) break;
                const x = g.cx - g.hw + inset, y = g.cy - g.hh + inset;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, g.radius - inset));
                else ctx.rect(x, y, w, h);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', e => {
        target.x = e.clientX;
        target.y = e.clientY;
        if (!target.on) { hill.x = target.x; hill.y = target.y; }   // rise in place, don't slide in from 0,0
        target.on = 1;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { target.on = 0; });

    resize();

    // "Reduce motion": the terrain holds still, but the cursor hill still follows the mouse
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    (function loop(now) {
        requestAnimationFrame(loop);
        if (now - last < 1000 / SETTINGS.fps) return;
        last = now;
        draw(still ? 0 : now / 1000);
    })(0);
})();

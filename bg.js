// Background: topographic contour lines, like a trail map, slowly shifting.
// The cursor is a hill: the terrain rises under it, so the lines ring around it and follow it.
// Drawn with marching squares over Perlin noise; every fifth line is a darker "index contour".
// Elements marked data-magnify (the gallery tiles) act as magnifying lenses over the map.
(function () {
    const SETTINGS = {
        cell: 10,            // grid spacing in px; smaller = smoother lines, more work
        scale: 0.0028,       // noise zoom: lower = broader hills
        terrain: 'smooth',   // starting terrain: 'smooth' rolling hills or jagged 'mountains'.
        jagSteps: 4,         // double-clicks from smooth to fully jagged; one more goes back to smooth
        morphSpeed: 0.09,    // 0..1 per frame: how quickly a double-click morphs the terrain (~0.5 s)
        step: 0.1,           // elevation between contour lines
        speed: 0.02,         // how fast the terrain morphs
        fps: 60,
        hillHeight: 0.9,     // how tall the cursor hill is
        hillSize: 95,        // px: how wide it is
        follow: 0.25,        // 0..1: how quickly the hill catches up with the cursor
        magnify: 1.8,        // how much the tiles enlarge the map beneath them
        lensCurve: 0.45,     // 0 = flat zoom; higher = more convex (strongest in the middle, easing at the edges)
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

    // Line colours follow the theme. When it changes they blend over ~0.5 s instead of jumping.
    const parse = c => (c.match(/[\d.]+/g) || [168, 72, 37, 0.2]).map(Number).concat(1).slice(0, 4);
    const colours = { line: '', index: '' };
    const colourNow = { line: null, index: null };
    const colourGoal = { line: null, index: null };
    function readColours() {
        const css = getComputedStyle(document.documentElement);
        colourGoal.line = parse(css.getPropertyValue('--topo-line').trim() || 'rgba(168, 72, 37, 0.2)');
        colourGoal.index = parse(css.getPropertyValue('--topo-index').trim() || 'rgba(168, 72, 37, 0.38)');
        if (!colourNow.line) { colourNow.line = [...colourGoal.line]; colourNow.index = [...colourGoal.index]; }
        blendColours(1);
    }
    function blendColours(amount) {
        for (const k of ['line', 'index']) {
            colourNow[k] = colourNow[k].map((v, i) => v + (colourGoal[k][i] - v) * amount);
            const [r, g, b, a] = colourNow[k];
            colours[k] = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a.toFixed(3)})`;
        }
    }
    readColours();
    new MutationObserver(() => {
        const css = getComputedStyle(document.documentElement);
        colourGoal.line = parse(css.getPropertyValue('--topo-line').trim());
        colourGoal.index = parse(css.getPropertyValue('--topo-index').trim());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const low = -1.3;

    // The hill eases toward the cursor and sinks away when the cursor leaves the page
    const target = { x: 0, y: 0, on: 0 };
    const hill = { x: 0, y: 0, h: 0 };

    // The terrain drifts slowly, so its heights are cached and rebuilt ~20x a second (or straight
    // away if the lenses move); only the cursor hill is added fresh every frame.
    let base = new Float32Array(0), sampleX = new Float32Array(0), sampleY = new Float32Array(0);
    let baseTime = -1, baseKey = '', driftRow = 0;
    const DRIFT_FRAMES = 6;

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
        base = new Float32Array(cols * rows);
        sampleX = new Float32Array(cols * rows);
        sampleY = new Float32Array(cols * rows);
        baseTime = -1;
    }

    // Visible magnifying tiles as rectangles. Measuring them forces a layout, so it's only done
    // for a second after something could have moved them (scroll, click, key, resize, the gallery's
    // rise animation), plus a slow safety refresh; the rest of the time the last measurement is reused.
    let lensCache = [], lensUntil = 0, lensAt = -1e9;
    const lensesMoved = () => { lensUntil = performance.now() + 1000; };
    for (const type of ['scroll', 'wheel', 'click', 'keydown', 'resize', 'hashchange', 'animationend'])
        addEventListener(type, lensesMoved, { capture: true, passive: true });
    function lenses(now) {
        if (now > lensUntil && now - lensAt < 500) return lensCache;
        lensAt = now;
        return (lensCache = measureLenses());
    }
    function measureLenses() {
        const list = [];
        for (const el of document.querySelectorAll('[data-magnify]')) {
            if (el.hidden || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 20 || r.height < 20 || r.bottom < 0 || r.top > height) continue;
            list.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom,
                        cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2,
                        rad: Math.hypot(r.width, r.height) / 2 });
        }
        return list;
    }

    // Inside a lens, sample the map closer to the lens centre, so it shows up enlarged.
    // The zoom is strongest in the middle and eases toward the rim, like a convex lens.
    function magnified(px, py, list) {
        for (const l of list) {
            if (px < l.x0 || px > l.x1 || py < l.y0 || py > l.y1) continue;
            const dx = px - l.cx, dy = py - l.cy;
            const q = Math.hypot(dx, dy) / l.rad;                       // 0 at centre, ~1 at the corners
            const f = (1 + SETTINGS.lensCurve * q * q) / SETTINGS.magnify;
            return [l.cx + dx * f, l.cy + dy * f];
        }
        return [px, py];
    }

    // Terrain height at a point.
    // 'smooth': two octaves of plain noise (rolling hills).
    // 'mountains': ridged multifractal noise. Each octave is folded (1 - |n|) so it peaks in sharp
    // crests, squared to sharpen them, and weighted by the octave above so detail piles up on the
    // ridges, which is what makes contour lines bunch on steep slopes and turn jagged.
    // A double-click blends between them: jag goes 0 (smooth) .. 1 (mountains).
    let jag = SETTINGS.terrain === 'mountains' ? 1 : 0;
    let jagGoal = jag;

    function smoothHeight(x, y, z) {
        return noise(x, y, z) + 0.45 * noise(x * 2.1 + 17, y * 2.1 + 5, z * 1.3);
    }

    function elevation(x, y, z) {
        if (jag <= 0.001) return smoothHeight(x, y, z);
        if (jag >= 0.999) return mountainHeight(x, y, z);
        return smoothHeight(x, y, z) * (1 - jag) + mountainHeight(x, y, z) * jag;
    }

    function mountainHeight(x, y, z) {
        let sum = 0, amp = 0.62, freq = 0.9, weight = 1;
        for (let o = 0; o < 5; o++) {
            let ridge = 1 - Math.abs(noise(x * freq + o * 17.3, y * freq + o * 31.7, z * (1 + o * 0.35)) * 1.4);
            ridge = Math.max(0, ridge);
            ridge *= ridge * weight;
            weight = Math.min(1, ridge * 1.8);
            sum += ridge * amp;
            freq *= 2.05;
            amp *= 0.5;
        }
        return sum * 2.3 - 1.15;    // map into the contour range
    }

    let lastHill = '', lastColour = '';
    function draw(time, now) {
        const { cell, scale, step, hillHeight, hillSize, follow } = SETTINGS;
        const z = time * SETTINGS.speed;

        hill.x += (target.x - hill.x) * follow;
        hill.y += (target.y - hill.y) * follow;
        hill.h += (target.on * hillHeight - hill.h) * 0.16;
        const twoSigma2 = 2 * hillSize * hillSize;
        const glass = lenses(now);
        const morphing = Math.abs(jagGoal - jag) > 0.001;
        if (morphing) jag += (jagGoal - jag) * SETTINGS.morphSpeed;
        else jag = jagGoal;

        // Terrain heights (cached), seen through any lenses. A full rebuild takes ~10 ms, so the slow
        // drift is refreshed a band of rows per frame instead (the whole map every DRIFT_FRAMES
        // frames), which keeps every frame cheap. Lens moves and terrain morphs still rebuild at once.
        const key = glass.map(l => `${l.x0 | 0},${l.y0 | 0},${l.x1 | 0},${l.y1 | 0}`).join(';');
        const full = morphing || baseTime < 0 || key !== baseKey || time < baseTime;
        const drifting = !full && time !== baseTime;

        // Nothing moved since the last frame (terrain still, hill and colours settled): leave the canvas as is
        const hillNow = hill.h > 0.01 ? `${hill.x.toFixed(1)},${hill.y.toFixed(1)},${hill.h.toFixed(3)}` : '';
        blendColours(0.12);   // ease toward the theme's colours
        const colourNow = colours.line + colours.index;
        if (!full && !drifting && hillNow === lastHill && colourNow === lastColour) return;
        lastHill = hillNow;
        lastColour = colourNow;

        if (full || drifting) {
            const band = Math.ceil(rows / DRIFT_FRAMES);
            const j0 = full ? 0 : driftRow, j1 = full ? rows : Math.min(rows, driftRow + band);
            for (let j = j0, k = j0 * cols; j < j1; j++) {
                for (let i = 0; i < cols; i++, k++) {
                    const [px, py] = glass.length ? magnified(i * cell, j * cell, glass) : [i * cell, j * cell];
                    sampleX[k] = px;
                    sampleY[k] = py;
                    base[k] = elevation(px * scale, py * scale, z);
                }
            }
            driftRow = full || j1 >= rows ? 0 : j1;
            baseTime = time;
            baseKey = key;
        }

        // Plus the cursor hill, every frame
        for (let k = 0; k < field.length; k++) {
            let e = base[k];
            if (hill.h > 0.01) {
                const dx = sampleX[k] - hill.x, dy = sampleY[k] - hill.y;
                e += hill.h * Math.exp(-(dx * dx + dy * dy) / twoSigma2);
            }
            field[k] = e;
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
    }

    addEventListener('resize', resize);

    // Each double-click (except on links and buttons) makes the terrain one step more jagged;
    // after the last step the next one eases it back to smooth
    const interactive = 'a, button, input, select, textarea, label, [contenteditable], .tile';
    document.addEventListener('dblclick', e => {
        if (e.target.closest(interactive)) return;
        jagGoal = jagGoal >= 0.999 ? 0 : Math.min(1, Math.round(jagGoal * SETTINGS.jagSteps + 1) / SETTINGS.jagSteps);
        window.getSelection()?.removeAllRanges();
    });
    // Stop double-clicks from highlighting words on the page
    document.addEventListener('mousedown', e => {
        if (e.detail > 1 && !e.target.closest(interactive)) e.preventDefault();
    });
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
        // A couple of ms of slack: frames on a 60 Hz screen arrive every ~16.6 ms, and a strict
        // check would randomly skip some of them
        if (now - last < 1000 / SETTINGS.fps - 2) return;
        last = now;
        draw(still ? 0 : now / 1000, now);
    })(0);
})();

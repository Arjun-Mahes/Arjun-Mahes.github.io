// Background: topographic contour lines, like a trail map, slowly shifting.
// The cursor is a hill: the terrain rises under it, so the lines ring around it and follow it.
// Drawn with marching squares over Perlin noise; every fifth line is a darker "index contour".
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

    function draw(time) {
        const { cell, scale, step, hillHeight, hillSize, follow } = SETTINGS;
        const z = time * SETTINGS.speed;

        hill.x += (target.x - hill.x) * follow;
        hill.y += (target.y - hill.y) * follow;
        hill.h += (target.on * hillHeight - hill.h) * 0.16;
        const twoSigma2 = 2 * hillSize * hillSize;

        // Terrain: two octaves of noise, plus the cursor hill
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const px = i * cell, py = j * cell;
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

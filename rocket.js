// The game behind the 👋: a rocket dodging jagged asteroids on the flooded screen.
// Steer with the mouse / a finger / ←→ (or A D); click, tap or Space to launch.
// One canvas, drawn only while the Random screen is open (app.js calls rocketGame.open / close).
(function () {
    const canvas = document.getElementById('rocket');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;
    const hint = document.getElementById('rocket-hint');

    const TUNING = {
        speed: 320, speedGain: 9, maxSpeed: 900,       // px/s the world falls at, and how it ramps up
        spawnEvery: 0.85, spawnMin: 0.26,               // s between asteroids, shrinking as you go
        steer: 12, keySpeed: 760,                       // how fast the rocket follows the pointer / keys
    };

    let W = 0, H = 0, dpr = 1, ink = '#fafaf8', paint = '#a84825', mono = 'monospace';
    let state = 'off';            // off | ready | flying | crashed
    let raf = 0, last = 0, t = 0;
    let rocket, rocks, stars, sparks, score, best, speed, spawnIn, keys = 0;

    try { best = Number(localStorage.getItem('rocket-best')) || 0; } catch { best = 0; }

    function resize() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = innerWidth;
        H = innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (rocket) rocket.y = H * 0.8;
    }

    function reset() {
        rocket = { x: W / 2, tx: W / 2, y: H * 0.8, tilt: 0 };
        rocks = [];
        sparks = [];
        score = 0;
        speed = TUNING.speed;
        spawnIn = 0.6;
        if (!stars) stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.15 + Math.random() * 0.85 }));
    }

    // Jagged rock: an irregular polygon, like the terrain once you've waved at it enough
    function makeRock() {
        const r = 14 + Math.random() * 26;
        const n = 8 + (Math.random() * 4 | 0);
        const verts = Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            const d = r * (0.68 + Math.random() * 0.42);
            return [Math.cos(a) * d, Math.sin(a) * d];
        });
        return { x: r + Math.random() * (W - 2 * r), y: -r - 10, r, verts, rot: Math.random() * 6.3,
                 spin: (Math.random() - 0.5) * 2.4, fall: 0.8 + Math.random() * 0.5, drift: (Math.random() - 0.5) * 40 };
    }

    function explode() {
        for (let i = 0; i < 46; i++) {
            const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 380;
            sparks.push({ x: rocket.x, y: rocket.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.7, size: 1.5 + Math.random() * 3 });
        }
        state = 'crashed';
        const s = Math.floor(score);
        const record = s > best;
        if (record) {
            best = s;
            try { localStorage.setItem('rocket-best', String(best)); } catch {}
        }
        setHint(`💥 ${s}${record ? ' · new best!' : ` · best ${best}`}`, 'click or press space to fly again');
    }

    function setHint(big, small) {
        hint.innerHTML = `<strong>${big}</strong><span>${small}</span>`;
        document.documentElement.classList.toggle('rocket-playing', state === 'flying');
    }

    function launch() {
        if (state === 'flying') return;
        reset();
        state = 'flying';
        setHint('', '');
    }

    // ─── Frame ───
    function step(dt) {
        t += dt;
        const flying = state === 'flying';
        // The world keeps drifting even before launch, slowly, so the screen feels alive
        const v = flying ? speed : 60;
        if (flying) {
            score += dt * speed / 10;
            speed = Math.min(TUNING.maxSpeed, speed + TUNING.speedGain * dt);
            spawnIn -= dt;
            if (spawnIn <= 0) {
                rocks.push(makeRock());
                const ramp = Math.max(TUNING.spawnMin, TUNING.spawnEvery - (speed - TUNING.speed) / 900);
                spawnIn = ramp * (0.6 + Math.random() * 0.8);
            }
        }

        for (const s of stars) {
            s.y += v * s.z * 0.6 * dt;
            if (s.y > H) { s.y -= H + 10; s.x = Math.random() * W; }
        }

        if (state !== 'crashed') {
            if (keys) rocket.tx = Math.max(24, Math.min(W - 24, rocket.tx + keys * TUNING.keySpeed * dt));
            const dx = rocket.tx - rocket.x;
            rocket.x += dx * Math.min(1, dt * TUNING.steer);
            rocket.tilt += (Math.max(-0.5, Math.min(0.5, dx / 180)) - rocket.tilt) * Math.min(1, dt * 10);
        }

        for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];
            r.y += speed * r.fall * dt;
            r.x += r.drift * dt;
            r.rot += r.spin * dt;
            if (r.y - r.r > H) { rocks.splice(i, 1); continue; }
            // Hit test: the rocket as two circles (body and nose), the rock as a slightly forgiving circle
            if (flying) {
                for (const [ox, oy, rr] of [[0, 4, 12], [0, -14, 7]]) {
                    const cx = rocket.x + ox, cy = rocket.y + oy;
                    if (Math.hypot(r.x - cx, r.y - cy) < r.r * 0.82 + rr) { explode(); break; }
                }
            }
        }

        for (let i = sparks.length - 1; i >= 0; i--) {
            const p = sparks[i];
            p.life -= dt;
            if (p.life <= 0) { sparks.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 1 - 1.6 * dt;
            p.vy *= 1 - 1.6 * dt;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = ink;
        ctx.strokeStyle = ink;

        // Stars: nearer ones are brighter and streak more as you speed up
        const v = state === 'flying' ? speed : 60;
        ctx.lineCap = 'round';
        for (const s of stars) {
            ctx.globalAlpha = 0.2 + s.z * 0.5;
            ctx.lineWidth = 0.8 + s.z * 1.4;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x, s.y - Math.max(1, v * s.z * 0.035));
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        for (const r of rocks) {
            ctx.save();
            ctx.translate(r.x, r.y);
            ctx.rotate(r.rot);
            ctx.beginPath();
            r.verts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath();
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.restore();
        }

        if (state !== 'crashed') drawRocket();

        for (const p of sparks) {
            ctx.globalAlpha = Math.min(1, p.life * 1.6);
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        if (state === 'flying' || state === 'crashed') {
            ctx.font = `700 15px ${mono}`;
            ctx.textAlign = 'center';
            ctx.fillText(String(Math.floor(score)).padStart(5, '0'), W / 2, 34);
        }
    }

    function drawRocket() {
        const { x, y, tilt } = rocket;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);

        // Flame: flickers, longer when flying
        const flying = state === 'flying';
        const len = (flying ? 22 : 10) + Math.sin(t * 40) * 4 + Math.random() * (flying ? 8 : 3);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(-7, 18);
        ctx.quadraticCurveTo(0, 18 + len * 1.1, 7, 18);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Fins
        ctx.beginPath();
        ctx.moveTo(-11, 4); ctx.lineTo(-20, 22); ctx.lineTo(-10, 18); ctx.closePath();
        ctx.moveTo(11, 4); ctx.lineTo(20, 22); ctx.lineTo(10, 18); ctx.closePath();
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.bezierCurveTo(13, -18, 12, 2, 10, 20);
        ctx.lineTo(-10, 20);
        ctx.bezierCurveTo(-12, 2, -13, -18, 0, -30);
        ctx.fill();

        // Window, in the background colour
        ctx.fillStyle = paint;
        ctx.beginPath();
        ctx.arc(0, -8, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
        last = now;
        step(dt);
        draw();
    }

    // ─── Input ───
    const steerTo = e => { if (rocket) rocket.tx = Math.max(24, Math.min(W - 24, e.clientX)); };
    canvas.addEventListener('pointermove', steerTo);
    canvas.addEventListener('pointerdown', e => {
        steerTo(e);
        if (state !== 'flying') launch();
    });
    const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
    let held = new Set();
    addEventListener('keydown', e => {
        if (state === 'off') return;
        if (e.key in KEYS) { held.add(e.key); keys = Math.sign([...held].reduce((s, k) => s + KEYS[k], 0)); e.preventDefault(); }
        else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button')) {
            e.preventDefault();
            if (state !== 'flying') launch();
        }
    });
    addEventListener('keyup', e => {
        if (!(e.key in KEYS)) return;
        held.delete(e.key);
        keys = Math.sign([...held].reduce((s, k) => s + KEYS[k], 0));
    });
    addEventListener('resize', () => { if (state !== 'off') resize(); });

    window.rocketGame = {
        open() {
            const css = getComputedStyle(document.documentElement);
            ink = css.getPropertyValue('--bg').trim() || ink;
            paint = css.getPropertyValue('--accent').trim() || paint;
            mono = css.getPropertyValue('--mono').trim() || mono;
            resize();
            stars = null;
            reset();
            state = 'ready';
            held.clear();
            keys = 0;
            setHint(best ? `best ${best}` : '', 'click or press space to launch');
            last = performance.now();
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(frame);
        },
        close() {
            state = 'off';
            document.documentElement.classList.remove('rocket-playing');
            cancelAnimationFrame(raf);
            raf = 0;
        },
    };
})();

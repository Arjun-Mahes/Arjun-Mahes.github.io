// The game behind the 👋: a rocket in an asteroid field on the flooded screen.
// Steer with the mouse / a finger / ←→ (or A D). Hold the mouse button, a finger or Space to shoot;
// the first press launches. Asteroids (big ones split), comets, satellites and UFOs come at you;
// fly into ★ for triple shot or ⬡ for a shield that takes one hit. Photo orbs (info.md, "## Orbs")
// join the field once there are pictures for them. More and more things come down as the run goes on.
// One canvas, drawn only while the Random screen is open (app.js calls rocketGame.open / close).
(function () {
    const canvas = document.getElementById('rocket');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;
    const hint = document.getElementById('rocket-hint');

    const TUNING = {
        speed: 320, speedGain: 10, maxSpeed: 950,      // px/s the world falls at, and how it ramps up
        startCount: 3, countGain: 0.15, maxCount: 26,  // things on screen: 3 at launch, +1 every ~7 s, up to 26
        steer: 12, keySpeed: 760,                      // how fast the rocket follows the pointer / keys
        fireEvery: 0.11, bulletSpeed: 1000,            // shooting
        powerTime: 7,                                  // s of triple shot
    };

    // What can come down, when it starts appearing (s into the run) and how often (weight)
    const KINDS = [
        { kind: 'rock', from: 0, weight: 70 },
        { kind: 'comet', from: 6, weight: 10 },
        { kind: 'satellite', from: 4, weight: 9 },
        { kind: 'ufo', from: 12, weight: 6 },
        { kind: 'triple', from: 5, weight: 3, pickup: true },
        { kind: 'shield', from: 8, weight: 2, pickup: true },
        { kind: 'orb', from: 0, weight: 30, needs: () => orbArt.length > 0 },
    ];
    const POINTS = { rock: 10, comet: 25, satellite: 50, ufo: 100, orb: 30 };

    // Photo orbs: each picture is cut into a circle once, when it loads, so drawing one is a single
    // drawImage per frame
    const ORB_PX = 64;   // pre-rendered diameter in CSS px (drawn at 44-60 px)
    let orbUrls = [], orbArt = [], orbsLoading = false;
    function loadOrbs() {
        if (orbsLoading || !orbUrls.length) return;
        orbsLoading = true;
        for (const url of orbUrls) {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                const scale = 2;   // sharp on high-DPI screens
                const c = document.createElement('canvas');
                c.width = c.height = ORB_PX * scale;
                const g = c.getContext('2d');
                g.beginPath();
                g.arc(c.width / 2, c.height / 2, c.width / 2, 0, Math.PI * 2);
                g.clip();
                // Cover: crop the middle square of the picture
                const side = Math.min(img.naturalWidth, img.naturalHeight);
                g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
                orbArt.push(c);
            };
            img.src = url;
        }
    }

    let W = 0, H = 0, dpr = 1, ink = '#fafaf8', paint = '#a84825', mono = 'monospace';
    let state = 'off';            // off | ready | flying | crashed
    let raf = 0, last = 0, t = 0, runTime = 0;
    let rocket, things, bullets, stars, sparks, popups, score, best, speed, spawnIn, fireIn;
    let keys = 0, firing = false, triple = 0, shield = false, invulnerable = 0;

    try { best = Number(localStorage.getItem('rocket-best')) || 0; } catch { best = 0; }

    const rand = (a, b) => a + Math.random() * (b - a);

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
        things = [];
        bullets = [];
        sparks = [];
        popups = [];
        score = 0;
        runTime = 0;
        speed = TUNING.speed;
        spawnIn = 0.6;
        fireIn = 0;
        triple = 0;
        shield = false;
        invulnerable = 0;
        if (!stars) stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.15 + Math.random() * 0.85 }));
    }

    // ─── Things that come down ───
    function jagged(r, n) {
        return Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            const d = r * rand(0.68, 1.1);
            return [Math.cos(a) * d, Math.sin(a) * d];
        });
    }

    function rock(x, y, r, vx = rand(-20, 20), vy = 0) {
        return { kind: 'rock', x, y, r, hp: r > 30 ? 3 : r > 20 ? 2 : 1, verts: jagged(r, 8 + (Math.random() * 4 | 0)),
                 rot: rand(0, 6.3), spin: rand(-1.2, 1.2), fall: rand(0.8, 1.25), vx, vy, flash: 0 };
    }

    function spawn() {
        const open = KINDS.filter(k => runTime >= k.from && (!k.needs || k.needs()) && !(k.pickup && things.some(o => o.pickup)));
        let roll = Math.random() * open.reduce((s, k) => s + k.weight, 0);
        const pick = open.find(k => (roll -= k.weight) < 0) || open[0];
        const x = rand(40, W - 40), y = -50;
        switch (pick.kind) {
            case 'rock': return things.push(rock(x, y, rand(12, 40)));
            case 'comet': return things.push({ kind: 'comet', x, y, r: 9, hp: 1, vx: rand(-90, 90), fall: 1.9, rot: 0, spin: 0, flash: 0 });
            case 'satellite': return things.push({ kind: 'satellite', x, y, r: 20, hp: 3, vx: rand(60, 110) * (Math.random() < 0.5 ? -1 : 1),
                                                   fall: 0.55, rot: rand(-0.4, 0.4), spin: rand(-0.6, 0.6), flash: 0 });
            case 'ufo': return things.push({ kind: 'ufo', x, y, cx: x, r: 22, hp: 4, fall: 0.32, phase: rand(0, 6.3), amp: rand(80, 200), vx: 0, rot: 0, spin: 0, flash: 0 });
            case 'orb': return things.push({ kind: 'orb', x, y, r: rand(22, 30), hp: 2, art: orbArt[Math.random() * orbArt.length | 0],
                                             vx: rand(-30, 30), fall: rand(0.65, 0.95), rot: rand(-0.3, 0.3), spin: rand(-0.5, 0.5), flash: 0 });
            default: return things.push({ kind: pick.kind, pickup: true, x, y, r: 16, fall: 0.45, vx: 0, rot: 0, spin: 1.2, flash: 0 });
        }
    }

    function burst(x, y, n, power = 1) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = rand(60, 320) * power;
            sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.9), size: rand(1.5, 3.5) });
        }
    }

    function destroy(o, i) {
        things.splice(i, 1);
        burst(o.x, o.y, o.kind === 'ufo' ? 30 : 14 + o.r / 2);
        const pts = POINTS[o.kind] || 0;
        score += pts;
        popups.push({ x: o.x, y: o.y, text: `+${pts}`, life: 0.8 });
        // Big rocks break into two smaller ones that fly apart
        if (o.kind === 'rock' && o.r > 22) {
            for (const dir of [-1, 1]) things.push(rock(o.x + dir * o.r / 3, o.y, o.r * 0.55, dir * rand(90, 160), -60));
        }
    }

    function crash() {
        burst(rocket.x, rocket.y, 50, 1.3);
        state = 'crashed';
        firing = false;
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

    function fire() {
        const angles = triple > 0 ? [-0.16, 0, 0.16] : [0];
        for (const a of angles) {
            bullets.push({ x: rocket.x + Math.sin(rocket.tilt) * 26, y: rocket.y - 30,
                           vx: Math.sin(a + rocket.tilt * 0.4) * TUNING.bulletSpeed, vy: -Math.cos(a) * TUNING.bulletSpeed });
        }
    }

    // ─── Frame ───
    function step(dt) {
        t += dt;
        const flying = state === 'flying';
        // The world keeps drifting even before launch, slowly, so the screen feels alive
        const v = flying ? speed : 60;

        if (flying) {
            runTime += dt;
            score += dt * speed / 25;
            speed = Math.min(TUNING.maxSpeed, speed + TUNING.speedGain * dt);
            spawnIn -= dt;
            if (spawnIn <= 0) {
                spawn();
                // Aim for a number of things on screen that climbs steadily, so the field keeps getting
                // busier the longer you last. Things also fall faster over time, so the spawn rate
                // scales with the speed: rate = count / time to cross the screen.
                const count = Math.min(TUNING.maxCount, TUNING.startCount + runTime * TUNING.countGain);
                spawnIn = rand(0.5, 1.5) / (count * speed / (H + 100));
            }
            triple = Math.max(0, triple - dt);
            invulnerable = Math.max(0, invulnerable - dt);
            fireIn -= dt;
            if (firing && fireIn <= 0) { fire(); fireIn = TUNING.fireEvery; }
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

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y < -20 || b.x < -20 || b.x > W + 20) bullets.splice(i, 1);
        }

        for (let i = things.length - 1; i >= 0; i--) {
            const o = things[i];
            o.y += (speed * o.fall + (o.vy || 0)) * dt;
            if (o.vy) o.vy *= 1 - 2 * dt;
            if (o.kind === 'ufo') o.x = o.cx + Math.sin(t * 2.2 + o.phase) * o.amp;
            else o.x += o.vx * dt;
            if (o.kind === 'satellite' && (o.x < o.r || o.x > W - o.r)) o.vx = -o.vx;
            o.rot += o.spin * dt;
            o.flash = Math.max(0, o.flash - dt);
            if (o.y - o.r > H + 40) { things.splice(i, 1); continue; }
            if (!flying) continue;

            // Shot? (pickups can't be shot)
            if (!o.pickup) {
                let destroyed = false;
                for (let j = bullets.length - 1; j >= 0; j--) {
                    const b = bullets[j];
                    if (Math.abs(b.x - o.x) > o.r + 4 || Math.abs(b.y - o.y) > o.r + 12) continue;
                    if (Math.hypot(b.x - o.x, b.y - o.y) > o.r + 4) continue;
                    bullets.splice(j, 1);
                    o.flash = 0.08;
                    burst(b.x, b.y, 3, 0.5);
                    if (--o.hp <= 0) { destroy(o, i); destroyed = true; break; }
                }
                if (destroyed) continue;
            }

            // Hit the rocket? The rocket is two circles (body and nose)
            for (const [ox, oy, rr] of [[0, 4, 12], [0, -14, 7]]) {
                if (Math.hypot(o.x - (rocket.x + ox), o.y - (rocket.y + oy)) >= o.r * 0.82 + rr) continue;
                if (o.pickup) {
                    things.splice(i, 1);
                    if (o.kind === 'triple') triple = TUNING.powerTime;
                    else shield = true;
                    popups.push({ x: o.x, y: o.y, text: o.kind === 'triple' ? 'triple shot!' : 'shield!', life: 1 });
                    burst(o.x, o.y, 10, 0.6);
                } else if (invulnerable > 0) {
                    destroy(o, i);
                } else if (shield) {
                    shield = false;
                    invulnerable = 1;
                    destroy(o, i);
                } else {
                    crash();
                }
                break;
            }
            if (state === 'crashed') break;
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
        for (let i = popups.length - 1; i >= 0; i--) {
            const p = popups[i];
            p.life -= dt;
            p.y -= 40 * dt;
            if (p.life <= 0) popups.splice(i, 1);
        }
    }

    // ─── Drawing: everything in one ink colour, details cut out in the background colour ───
    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = ink;
        ctx.strokeStyle = ink;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Stars: nearer ones are brighter and streak more as you speed up
        const v = state === 'flying' ? speed : 60;
        for (const s of stars) {
            ctx.globalAlpha = 0.2 + s.z * 0.5;
            ctx.lineWidth = 0.8 + s.z * 1.4;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x, s.y - Math.max(1, v * s.z * 0.035));
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        for (const o of things) {
            ctx.save();
            ctx.translate(o.x, o.y);
            if (o.flash > 0) ctx.globalAlpha = 0.35;
            DRAW[o.kind](o);
            ctx.restore();
        }

        ctx.lineWidth = 3;
        for (const b of bullets) {
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
            ctx.stroke();
        }

        if (state !== 'crashed' && !(invulnerable > 0 && Math.floor(t * 12) % 2)) drawRocket();

        for (const p of sparks) {
            ctx.globalAlpha = Math.min(1, p.life * 1.6);
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }

        ctx.textAlign = 'center';
        ctx.font = `700 13px ${mono}`;
        for (const p of popups) {
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;

        if (state === 'flying' || state === 'crashed') {
            ctx.font = `700 15px ${mono}`;
            ctx.fillText(String(Math.floor(score)).padStart(5, '0'), W / 2, 34);
            const status = [triple > 0 && `★ triple ${Math.ceil(triple)}s`, shield && '⬡ shield'].filter(Boolean).join('   ');
            if (status) {
                ctx.font = `500 12px ${mono}`;
                ctx.fillText(status, W / 2, 54);
            }
        }
    }

    const DRAW = {
        orb(o) {
            // The picture, cut to a circle, with an ink rim
            ctx.rotate(o.rot);
            ctx.drawImage(o.art, -o.r, -o.r, o.r * 2, o.r * 2);
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, o.r, 0, 6.3);
            ctx.stroke();
        },
        rock(o) {
            ctx.rotate(o.rot);
            ctx.beginPath();
            o.verts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath();
            ctx.fill();
            // A couple of craters cut out
            ctx.fillStyle = paint;
            ctx.globalAlpha *= 0.5;
            ctx.beginPath();
            ctx.arc(o.r * 0.25, -o.r * 0.2, o.r * 0.18, 0, 6.3);
            ctx.arc(-o.r * 0.3, o.r * 0.25, o.r * 0.12, 0, 6.3);
            ctx.fill();
        },
        comet(o) {
            // A tail streaming back along its path
            const len = 70, ang = Math.atan2(-(speed * o.fall), -o.vx);
            for (let k = 0; k < 3; k++) {
                ctx.globalAlpha = 0.25 - k * 0.07;
                ctx.lineWidth = 14 - k * 4;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(ang) * len * (1 + k * 0.4), Math.sin(ang) * len * (1 + k * 0.4));
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(0, 0, o.r, 0, 6.3);
            ctx.fill();
        },
        satellite(o) {
            ctx.rotate(o.rot);
            // Solar panels with cell lines, a body and an antenna
            for (const side of [-1, 1]) {
                ctx.fillRect(side > 0 ? 9 : -27, -6, 18, 12);
                ctx.fillRect(side > 0 ? 6 : -9, -1, 3, 2);
            }
            ctx.fillRect(-7, -9, 14, 18);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(0, -17);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -18, 2.5, 0, 6.3);
            ctx.fill();
            ctx.strokeStyle = paint;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const x of [-21, -15, 15, 21]) { ctx.moveTo(x, -6); ctx.lineTo(x, 6); }
            ctx.stroke();
        },
        ufo(o) {
            // Dome, saucer and blinking lights
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -4, 10, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, 2, 24, 8, 0, 0, 6.3);
            ctx.fill();
            ctx.fillStyle = paint;
            for (let k = -2; k <= 2; k++) {
                if ((Math.floor(t * 6) + k) % 2) continue;
                ctx.beginPath();
                ctx.arc(k * 8, 3, 2, 0, 6.3);
                ctx.fill();
            }
        },
        triple(o) {
            // A pickup: outlined ring, pulsing, with a star in it
            ring(o);
            ctx.rotate(o.rot);
            ctx.beginPath();
            for (let k = 0; k < 10; k++) {
                const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 9;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
        },
        shield(o) {
            ring(o);
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = Math.PI / 6 + k * Math.PI / 3;
                ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            }
            ctx.closePath();
            ctx.stroke();
        },
    };

    function ring(o) {
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.arc(0, 0, o.r + Math.sin(t * 6) * 1.5, 0, 6.3);
        ctx.stroke();
        ctx.setLineDash([]);
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

        // Shield bubble
        if (shield) {
            ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.2;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -2, 36, 0, 6.3);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
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
        canvas.setPointerCapture?.(e.pointerId);
        if (state !== 'flying') launch();
        firing = true;
    });
    const stopFiring = () => { if (!held.has(' ')) firing = false; };
    canvas.addEventListener('pointerup', stopFiring);
    canvas.addEventListener('pointercancel', stopFiring);

    const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
    const held = new Set();
    const steerKeys = () => { keys = Math.sign([...held].reduce((s, k) => s + (KEYS[k] || 0), 0)); };
    addEventListener('keydown', e => {
        if (state === 'off') return;
        if (e.key in KEYS) { held.add(e.key); steerKeys(); e.preventDefault(); }
        else if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button')) {
            e.preventDefault();
            if (e.repeat) return;
            if (state !== 'flying') launch();
            held.add(' ');
            firing = true;
        }
    });
    addEventListener('keyup', e => {
        if (e.key === ' ' || e.key === 'Enter') { held.delete(' '); firing = false; return; }
        if (!(e.key in KEYS)) return;
        held.delete(e.key);
        steerKeys();
    });
    addEventListener('blur', () => { held.clear(); keys = 0; firing = false; });
    addEventListener('resize', () => { if (state !== 'off') resize(); });

    window.rocketGame = {
        // Pictures for the photo orbs (paths from info.md); loaded the first time the game opens
        setOrbs(urls) { orbUrls = urls || []; },
        open() {
            loadOrbs();
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
            firing = false;
            setHint(best ? `best ${best}` : '', 'click or press space to launch · hold to shoot');
            last = performance.now();
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(frame);
        },
        close() {
            state = 'off';
            firing = false;
            document.documentElement.classList.remove('rocket-playing');
            cancelAnimationFrame(raf);
            raf = 0;
        },
    };
})();

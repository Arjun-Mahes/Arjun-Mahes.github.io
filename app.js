// Arjun Mahes — landing card, project gallery and project deep dives.
// All content lives in info.md; this file only reads and renders it.
(function () {
    const FILTERS = [['all', '✨ All'], ['ongoing', '🚧 Ongoing'], ['completed', '✅ Completed']];
    // "Status: in progress" counts as ongoing; any other status (shipped, complete, prototype, 1st place) as completed
    const stage = status => /progress/i.test(status) ? 'ongoing' : 'completed';
    // Default mosaic rhythm for tiles without a "Size:" line; repeats every 8 projects
    const SIZES = ['big', 'tall', 'wide', '', '', 'wide', 'tall', ''];

    const state = { name: '', tagline: '', socials: [], about: [], projects: [], filter: 'all', current: -1 };

    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // ─── Tiny markdown: paragraphs, "- " lists, images, **bold**, *italic*, `code`, [links](url) ───
    function inline(text) {
        return esc(text)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) =>
                `<a href="${url}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`);
    }

    function markdown(src) {
        const html = [];
        let para = [], list = [];
        const flush = () => {
            if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
            if (list.length) html.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`);
            para = []; list = [];
        };
        for (const line of src.split('\n').map(l => l.trim())) {
            const item = line.match(/^[-*]\s+(.*)/);
            const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
            if (!line) flush();
            else if (img) { flush(); html.push(`<img class="detail-img" src="${esc(img[2])}" alt="${esc(img[1])}" loading="lazy">`); }
            else if (item) { if (para.length) flush(); list.push(item[1]); }
            else { if (list.length) flush(); para.push(line); }
        }
        flush();
        return html.join('');
    }

    // ─── info.md → state ───
    function parse(text) {
        const bodies = {};
        let section = null;
        for (const line of text.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
            if (!state.name && line.startsWith('# ')) state.name = line.slice(2).trim();
            else if (line.startsWith('## ')) bodies[section = line.slice(3).trim().toLowerCase()] = [];
            else if (section) bodies[section].push(line);
            else if (line.trim()) state.tagline += (state.tagline ? ' ' : '') + line.trim();
        }

        const socials = (bodies.socials || bodies.contact || []).join('\n');
        state.socials = [...socials.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(([, label, url]) => ({ label, url }));
        state.about = (bodies.home || []).map(l => l.trim().match(/^[-*]\s+(.*)/)).filter(Boolean).map(m => m[1]);
        state.projects = parseProjects((bodies.projects || []).join('\n'));
    }

    // Each "### Title" block: an image line, "Key: value" lines, then free markdown for the deep dive
    function parseProjects(body) {
        return body.split(/^### /m).filter(c => c.trim()).map(chunk => {
            const [title, ...lines] = chunk.split('\n');
            const p = { title: title.trim(), image: '', where: '', status: '', tags: [], tools: '', summary: '', size: '', link: '', details: [] };
            for (const line of lines) {
                const img = line.match(/^!\[[^\]]*\]\(([^)]+)\)/);
                const field = line.match(/^(where|status|tags|tools|summary|size|link):\s*(.*)$/i);
                if (img && !p.image) p.image = img[1];
                else if (field) {
                    const key = field[1].toLowerCase();
                    p[key] = key === 'tags' ? field[2].toLowerCase().split(',').map(t => t.trim()).filter(Boolean) : field[2].trim();
                }
                else p.details.push(line);
            }
            p.details = p.details.join('\n').trim();
            p.slug = slugify(p.title);
            return p;
        });
    }

    // ─── Small pieces ───
    function socialIcon(label) {
        const l = label.toLowerCase();
        const path = l.includes('github')
            ? '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>'
            : l.includes('linkedin')
                ? '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'
                : l.includes('mail')
                    ? '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
                    : '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>';
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    }

    function statusPill(status) {
        if (!status) return '';
        const kind = /progress/i.test(status) ? 'progress' : /place|win|award/i.test(status) ? 'win' : /proto/i.test(status) ? 'proto' : 'done';
        return `<span class="status status--${kind}"><i></i>${esc(status)}</span>`;
    }

    // ─── Landing card ───
    function renderLanding() {
        $('name').textContent = state.name;
        document.title = state.name;
        $('tagline').innerHTML = inline(state.tagline);
        // A leading emoji gets its own span so it can bounce on hover
        $('about').innerHTML = state.about.map(item => {
            const m = item.match(/^(\p{Extended_Pictographic}\S*)\s+(.*)$/u);
            return m ? `<li><span class="emoji" aria-hidden="true">${m[1]}</span>${inline(m[2])}</li>` : `<li>${inline(item)}</li>`;
        }).join('');
        $('links').innerHTML = state.socials.map(s => {
            const external = /^https?:/.test(s.url) ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a class="link-pill" href="${esc(s.url)}"${external}>${socialIcon(s.label)}<span>${esc(s.label)}</span></a>`;
        }).join('');
    }

    // ─── Gallery ───
    function renderGallery() {
        $('filters').innerHTML = FILTERS.map(([id, label]) =>
            `<button type="button" class="filter-btn" data-filter="${id}" aria-pressed="${state.filter === id}">${label}</button>`).join('');

        $('masonry').innerHTML = state.projects.map((p, i) => {
            const size = p.size || SIZES[i % SIZES.length];
            // Just the image; the title appears on hover, everything else is in the deep dive.
            // Not lazy: the gallery starts hidden, so lazy images would only start loading once it opens.
            return `
                <button type="button" class="tile${size ? ` tile--${size}` : ''}" data-magnify data-index="${i}"
                        data-stage="${stage(p.status)}" style="--d:${i}" aria-label="${esc(p.title)}">
                    ${p.image ? `<img src="${esc(p.image)}" alt="" decoding="async" onerror="retryImg(this)">` : ''}
                    <span class="tile-title" aria-hidden="true">${esc(p.title)}</span>
                </button>`;
        }).join('');
        applyFilter();
    }

    function applyFilter() {
        $('filters').querySelectorAll('.filter-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
        $('masonry').querySelectorAll('.tile').forEach(tile => {
            tile.hidden = state.filter !== 'all' && tile.dataset.stage !== state.filter;
        });
    }

    // ─── Overlays ───
    const isOpen = id => $(id).classList.contains(id === 'gallery' ? 'open' : 'modal-open');
    const syncLock = () => document.documentElement.classList.toggle('locked', isOpen('gallery') || isOpen('deep-dive'));

    function openGallery() {
        $('gallery').classList.add('open');
        $('gallery').setAttribute('aria-hidden', 'false');
        $('gallery').querySelector('.gallery-panel').scrollTop = 0;
        history.replaceState(null, '', '#projects');
        syncLock();
        $('gallery').querySelector('.close-btn').focus();
    }

    function closeGallery() {
        $('gallery').classList.remove('open');
        $('gallery').setAttribute('aria-hidden', 'true');
        history.replaceState(null, '', location.pathname + location.search);
        syncLock();
        $('open-gallery').focus();
    }

    function openDive(i) {
        const n = state.projects.length;
        const p = state.projects[(i + n) % n];
        state.current = (i + n) % n;

        $('dive-hero').innerHTML = p.image
            ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" onerror="retryImg(this)">`
            : '';
        $('dive-where').textContent = p.where;
        $('dive-title').textContent = p.title;
        $('dive-facts').innerHTML = [
            p.status && ['Status', statusPill(p.status)],
            p.tools && ['Tools', esc(p.tools)],
            p.tags.length && ['Areas', esc(p.tags.join(', '))]
        ].filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
        $('dive-summary').textContent = p.summary;
        // "Link: [Label](url)" shows as a button under the summary
        const link = p.link.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        $('dive-link').innerHTML = link
            ? `<a class="dive-link" href="${esc(link[2])}" target="_blank" rel="noopener">${esc(link[1])} <span aria-hidden="true">↗</span></a>`
            : '';
        $('dive-details').innerHTML = markdown(p.details);

        const prev = state.projects[(state.current - 1 + n) % n];
        const next = state.projects[(state.current + 1) % n];
        $('dive-prev').querySelector('span').textContent = prev.title;
        $('dive-next').querySelector('span').textContent = next.title;

        $('deep-dive').classList.add('modal-open');
        $('deep-dive').setAttribute('aria-hidden', 'false');
        $('dive-scroll').scrollTop = 0;
        history.replaceState(null, '', `#projects/${p.slug}`);
        syncLock();
        $('deep-dive').querySelector('.dive-close').focus();
    }

    function closeDive() {
        $('deep-dive').classList.remove('modal-open');
        $('deep-dive').setAttribute('aria-hidden', 'true');
        history.replaceState(null, '', isOpen('gallery') ? '#projects' : location.pathname + location.search);
        syncLock();
        $('masonry').querySelector(`.tile[data-index="${state.current}"]`)?.focus();
    }

    // ─── Light / dark theme ───
    let themeTimer = 0;
    function setTheme(next) {
        const root = document.documentElement;
        if (root.dataset.theme === next) return;
        // Cross-fade the page into the new theme, then tidy up
        root.classList.add('theme-fade');
        clearTimeout(themeTimer);
        themeTimer = setTimeout(() => root.classList.remove('theme-fade'), 650);
        root.dataset.theme = next;
        $('theme-toggle').setAttribute('aria-checked', String(next === 'dark'));
    }

    // The switch's knob is a damped spring driven every frame, not a CSS transition, so it
    // accelerates, overshoots a touch and settles. It stretches with its speed like a drop of
    // liquid, and the sky, sun, moon and stars all follow its position (--p, 0 = light, 1 = dark).
    // You can also drag or flick it.
    function initThemeSwitch() {
        const sw = $('theme-toggle');
        const TRAVEL = 32;                       // px the knob moves
        const STIFFNESS = 210, DAMPING = 19;     // spring: higher stiffness = snappier, lower damping = more wobble
        let p = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
        let v = 0, goal = p, raf = 0, last = 0;
        let drag = null;                         // { x, p, moved, lastX, lastT }

        const paint = () => {
            const speed = Math.min(Math.abs(v) / 9, 1);          // 0 at rest .. 1 at full flick
            const sx = 1 + 0.55 * speed, sy = 1 - 0.22 * speed;  // stretch along the travel, thin across it
            sw.style.setProperty('--p', p.toFixed(4));
            sw.style.setProperty('--sx', sx.toFixed(3));
            sw.style.setProperty('--sy', sy.toFixed(3));
        };

        const step = now => {
            const dt = Math.min((now - last) / 1000, 1 / 30);
            last = now;
            if (!drag) {
                v += (STIFFNESS * (goal - p) - DAMPING * v) * dt;
                p += v * dt;
            }
            paint();
            if (drag || Math.abs(goal - p) > 0.0005 || Math.abs(v) > 0.005) raf = requestAnimationFrame(step);
            else { p = goal; v = 0; paint(); raf = 0; }
        };
        const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };

        const settleTo = target => {
            goal = target;
            setTheme(target ? 'dark' : 'light');
            run();
        };

        sw.addEventListener('pointerdown', e => {
            sw.setPointerCapture(e.pointerId);
            drag = { x: e.clientX, p, moved: false, lastX: e.clientX, lastT: performance.now() };
            run();
        });
        sw.addEventListener('pointermove', e => {
            if (!drag) return;
            const dx = e.clientX - drag.x;
            if (Math.abs(dx) > 3) drag.moved = true;
            const now = performance.now();
            const next = Math.max(-0.08, Math.min(1.08, drag.p + dx / TRAVEL));   // a little give past the ends
            v = (next - p) / Math.max((now - drag.lastT) / 1000, 1 / 240);
            p = next;
            drag.lastX = e.clientX; drag.lastT = now;
        });
        const release = () => {
            if (!drag) return;
            const wasDrag = drag.moved;
            drag = null;
            // A tap flips it; a drag or flick lands on whichever side it's heading for
            if (!wasDrag) settleTo(goal ? 0 : 1);
            else settleTo(p + v * 0.12 > 0.5 ? 1 : 0);
        };
        sw.addEventListener('pointerup', release);
        sw.addEventListener('pointercancel', release);
        // Keyboard (Space / Enter) still works: those clicks have no pointer behind them
        sw.addEventListener('click', e => { if (e.detail === 0) settleTo(goal ? 0 : 1); });

        // Follow the system live: if it switches between light and dark while the page is open,
        // slide the switch over and change the theme with it. (The switch itself only lasts for this visit.)
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => settleTo(e.matches ? 1 : 0));

        sw.setAttribute('aria-checked', String(p === 1));
        paint();
    }

    // ─── Events ───
    function bind() {
        initThemeSwitch();
        $('open-gallery').addEventListener('click', openGallery);
        document.querySelectorAll('[data-close-gallery]').forEach(el => el.addEventListener('click', closeGallery));
        document.querySelectorAll('[data-close-dive]').forEach(el => el.addEventListener('click', closeDive));
        $('dive-prev').addEventListener('click', () => openDive(state.current - 1));
        $('dive-next').addEventListener('click', () => openDive(state.current + 1));

        $('filters').addEventListener('click', e => {
            const btn = e.target.closest('.filter-btn');
            if (btn) { state.filter = btn.dataset.filter; applyFilter(); }
        });
        $('masonry').addEventListener('click', e => {
            const tile = e.target.closest('.tile');
            if (tile) openDive(Number(tile.dataset.index));
        });

        window.addEventListener('keydown', e => {
            if (isOpen('deep-dive')) {
                if (e.key === 'Escape') closeDive();
                else if (e.key === 'ArrowLeft') openDive(state.current - 1);
                else if (e.key === 'ArrowRight') openDive(state.current + 1);
            } else if (isOpen('gallery') && e.key === 'Escape') closeGallery();
        });
    }

    // Links: /#projects opens the gallery, /#projects/<slug> opens that project
    function openFromHash() {
        const [section, slug] = location.hash.slice(1).split('/');
        if (section !== 'projects') return;
        openGallery();
        const i = state.projects.findIndex(p => p.slug === slug);
        if (i >= 0) openDive(i);
    }

    async function load() {
        bind();
        try {
            // index.html starts this request in <head>, so it downloads alongside the CSS and scripts
            const r = (await window.infoRequest) || await fetch('info.md', { cache: 'no-cache' });
            if (!r.ok) throw new Error(r.status);
            parse(await r.text());
        } catch {
            $('tagline').innerHTML = `Couldn't load <code>info.md</code>. Serve this folder over HTTP
                (<code>python -m http.server</code>) instead of opening the file directly.`;
            reveal();
            return;
        }
        renderLanding();
        renderGallery();
        // Wait for the web fonts too (at most ~0.8 s) so the name doesn't visibly swap fonts
        await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 800))]);
        reveal();
        openFromHash();
        // Decode the tile photos ahead of time, so opening the gallery doesn't stall on it
        const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
        idle(() => $('masonry').querySelectorAll('img').forEach(img => img.decode?.().catch(() => {})));
    }

    // The card stays hidden until its content and fonts are in, then fades in once
    function reveal() {
        document.documentElement.classList.add('ready');
    }

    document.addEventListener('DOMContentLoaded', load);
})();

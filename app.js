// Personal Website — Markdown Engine, Tabs & ReactBits CircularGallery
(function () {
    const DEFAULT_MARKDOWN = `# Arjun Mahes
Mechatronics engineering @UWaterloo.

## Socials
- [GitHub](https://github.com)
- [LinkedIn](https://linkedin.com)
- [Email](mailto:hello@example.com)

## Home
### Some things about me:
- 2A Mechatronics Engineering @UWaterloo
- I'm currently building an exoskeleton that helps retrain motion in stroke patients.
- I love to start endeavours I don't know anything about or don't have the skills to make and learn as I build. You learn so much more by figuring it out through the creative process rather than watching a course.
- I love biking and exploring the city and the trails that surround it.

## Projects
### Distributed Neural Engine
![Project photo](https://picsum.photos/id/1015/900/1200)
A lightweight inference runtime designed for low-power edge accelerators and WebGPU. Implements custom quantization kernels and zero-copy tensor streaming.
- [GitHub Repository](https://github.com) / [Live Demo](https://example.com) / [Read Writeup](https://example.com)

### Micro-Fluidics Simulation Sandbox
![Project photo](https://picsum.photos/id/1018/900/1200)
An interactive, GPU-accelerated simulation environment for modeling multi-phase laminar flow and droplet dynamics in real time.
- [GitHub Repository](https://github.com) / [Research Paper](https://example.com)

### Graphite & Monolith
![Project photo](https://picsum.photos/id/1039/900/1200)
A curated digital archive and visual essay exploring brutalist architecture, structural geometry, and graphite pencil studies.
- [View Gallery](https://example.com) / [Case Study](https://example.com)

### Latent Canvas
![Project photo](https://picsum.photos/id/1043/900/1200)
A minimal desktop application for fluid markdown note-taking with embedded mathematical notation and bidirectional linking.
- [GitHub Repository](https://github.com) / [Download App](https://example.com)

## Work
### Engineering Intern - Soneil Spark (May 2026 – August 2026)
- I helped build an assembly line and automate compliance testing for an AC/DC charger and battery manufacturing company. Also did a lot of R&D work with the cooling systems for their new battery trailer.

### Hardware Prototyping Engineer — Hackerfab (Jan 2026 – May 2026)
- I designed a custom PCB in KiCad to control the Argon gas flow for a home-built physical vapour deposition setup. I dug into the research and built the actual device using an ESP32, a stepper motor, and a pressure sensor.

### Software Engineer — DietIQ (July 2025 - August 2025)
- I formed datasets using public nutrition guidelines and implemented a RAG pipeline and a reinforcement fine tuned response grading system.
`;

    // Fallback curated gallery items
    const DEFAULT_GALLERY_ITEMS = [
        { image: 'https://picsum.photos/id/1015/900/1200', label: 'Canyon', link: '#' },
        { image: 'https://picsum.photos/id/1018/900/1200', label: 'Ridgeline', link: '#' },
        { image: 'https://picsum.photos/id/1039/900/1200', label: 'Falls', link: '#' },
        { image: 'https://picsum.photos/id/1043/900/1200', label: 'Harbour', link: '#' },
        { image: 'https://picsum.photos/id/1044/900/1200', label: 'Skyline', link: '#' }
    ];

    const state = {
        name: 'Arjun Mahes',
        tagline: '',
        socials: [],
        sections: {},
        tabs: [],
        activeTab: 'home',
        projects: []
    };

    // ─── Social Icons ───
    function getSocialIcon(label) {
        const lower = label.toLowerCase();
        if (lower.includes('github')) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
        if (lower.includes('twitter') || lower.includes('x')) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>`;
        if (lower.includes('linkedin')) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>`;
        if (lower.includes('mail') || lower.includes('email')) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`;
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`;
    }

    // ─── Markdown Parser ───
    function parseMarkdown(mdText) {
        // Strip HTML comments so commented out sections in info.md are ignored
        const cleanMd = mdText.replace(/<!--[\s\S]*?-->/g, '');
        const lines = cleanMd.split('\n');
        let currentSection = null;
        let sectionBuffer = [];
        let headerDone = false;

        state.sections = {};
        state.tabs = [];
        state.socials = [];
        state.projects = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('# ') && !headerDone) {
                state.name = line.replace('# ', '').trim();
                headerDone = true;
                continue;
            }
            if (line.startsWith('## ')) {
                if (currentSection) {
                    saveSection(currentSection, sectionBuffer.join('\n'));
                } else if (sectionBuffer.length > 0) {
                    state.tagline = sectionBuffer.join('\n').trim();
                }
                currentSection = line.replace('## ', '').trim();
                sectionBuffer = [];
                continue;
            }
            sectionBuffer.push(line);
        }
        if (currentSection) saveSection(currentSection, sectionBuffer.join('\n'));
    }

    function saveSection(title, rawContent) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle === 'socials' || lowerTitle === 'contact' || lowerTitle === 'find me on') {
            const re = /\[([^\]]+)\]\(([^)]+)\)/g;
            let m;
            while ((m = re.exec(rawContent)) !== null) state.socials.push({ label: m[1], url: m[2] });
        } else if (lowerTitle === 'skills') {
            // Ignore standalone skills section
        } else {
            const slug = lowerTitle.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            state.sections[slug] = { title, slug, content: rawContent.trim() };
            state.tabs.push(slug);
            if (slug === 'projects') state.projects = parseProjects(rawContent);
        }
    }

    function parseProjects(rawContent) {
        const projects = [];
        rawContent.split(/^### /m).filter(c => c.trim()).forEach(chunk => {
            const lines = chunk.split('\n');
            const title = lines[0].trim();
            let image = null;
            const bodyLines = [];
            for (let i = 1; i < lines.length; i++) {
                const imgMatch = lines[i].match(/^!\[([^\]]*)\]\(([^)]+)\)/);
                if (imgMatch && !image) image = imgMatch[2];
                else bodyLines.push(lines[i]);
            }
            projects.push({ title, image, body: bodyLines.join('\n').trim() });
        });
        return projects;
    }

    // ─── Frame Renderer ───
    function renderFrame() {
        document.getElementById('site-name').textContent = state.name;
        document.title = state.name;

        const taglineEl = document.getElementById('site-tagline');
        if (state.tagline) {
            taglineEl.innerHTML = marked.parse(state.tagline);
            taglineEl.style.display = 'block';
        } else taglineEl.style.display = 'none';

        const navList = document.getElementById('nav-list');
        navList.innerHTML = '';
        state.tabs.forEach(slug => {
            const sec = state.sections[slug];
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `#${slug}`;
            a.className = 'nav-link' + (state.activeTab === slug ? ' active' : '');
            a.textContent = sec.title;
            a.addEventListener('click', e => { e.preventDefault(); setActiveTab(slug); });
            li.appendChild(a);
            navList.appendChild(li);
        });

        const socialList = document.getElementById('social-list');
        socialList.innerHTML = '';
        state.socials.forEach(s => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.className = 'social-link'; a.setAttribute('aria-label', s.label); a.setAttribute('title', s.label);
            a.innerHTML = getSocialIcon(s.label);
            li.appendChild(a); socialList.appendChild(li);
        });

        renderActiveTabContent();
    }

    function setActiveTab(slug) {
        if (!state.sections[slug]) slug = state.tabs[0] || 'home';
        state.activeTab = slug;
        window.location.hash = `#${slug}`;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${slug}`);
        });
        renderActiveTabContent();
    }

    function renderActiveTabContent() {
        const container = document.getElementById('tab-content');
        const profileHeader = document.getElementById('profile-header');
        const section = state.sections[state.activeTab];
        if (profileHeader) profileHeader.style.display = (state.activeTab === 'home') ? 'block' : 'none';
        if (!section) { container.innerHTML = '<p>No content found.</p>'; return; }

        container.className = `tab-content ${state.activeTab}-view`;
        if (state.activeTab === 'projects') {
            renderCircularProjectsGallery(container);
            return;
        }

        // Clean up 3D scene if leaving projects
        disposeCircularGallery();

        container.innerHTML = marked.parse(section.content);
    }

    // ═══════════════════════════════════════════
    //  REACTBITS CIRCULAR GALLERY (Three.js WebGL)
    // ═══════════════════════════════════════════

    let galleryInstance = null;

    function disposeCircularGallery() {
        if (galleryInstance) {
            galleryInstance.destroy();
            galleryInstance = null;
        }
    }

    function renderCircularProjectsGallery(container) {
        disposeCircularGallery();

        // Extract items from markdown projects
        let galleryItems = state.projects.map((proj, idx) => {
            const fallback = DEFAULT_GALLERY_ITEMS[idx % DEFAULT_GALLERY_ITEMS.length];
            return {
                image: (proj.image && !proj.image.includes('placeholder.svg')) ? proj.image : fallback.image,
                label: proj.title,
                body: proj.body,
                project: proj
            };
        });

        if (galleryItems.length === 0) {
            galleryItems = DEFAULT_GALLERY_ITEMS.map((it) => ({
                ...it,
                body: `Detailed project information for ${it.label}.\n- [GitHub Repository](#) / [Live Demo](#)`,
                project: { title: it.label, image: it.image, body: `Project details for ${it.label}.` }
            }));
        }

        // If fewer than 6 items, repeat to form a rich continuous loop
        let items = [...galleryItems];
        if (items.length > 0 && items.length < 6) {
            items = [...items, ...items];
        }

        container.innerHTML = `
        <div class="circular-gallery-section">
            <div class="circular-gallery-wrapper" style="height: 580px; position: relative; margin: 0 auto;">
                <div class="circular-gallery-mount" id="circular-gallery-mount"></div>
                
                <!-- Enlarged Project Modal View -->
                <div class="project-modal" id="project-modal" aria-hidden="true">
                    <div class="modal-backdrop" id="modal-backdrop"></div>
                    <div class="modal-card" id="modal-card">
                        <button class="modal-close-btn" id="modal-close-btn" aria-label="Close details">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        
                        <div class="modal-scroll-area">
                            <div class="modal-image-container" id="modal-image-container">
                                <img src="" alt="" class="modal-hero-img" id="modal-hero-img" />
                            </div>
                            
                            <div class="modal-body-container">
                                <span class="modal-badge">PROJECT SPOTLIGHT</span>
                                <h3 class="modal-title" id="modal-title"></h3>
                                <div class="modal-description" id="modal-description"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        const mount = container.querySelector('#circular-gallery-mount');
        if (!mount || !window.THREE) return;

        // Initialize Circular Gallery with ReactBits Props
        galleryInstance = new CircularGallery(mount, {
            items: items,
            bend: 3,
            textColor: '#1C1917',
            borderRadius: 0.05,
            scrollEase: 0.02,
            fontUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap',
            font: 'bold 28px Orbitron, -apple-system, sans-serif',
            onItemClick: (item) => openProjectModal(item)
        });

        // Modal event handlers
        const closeBtn = container.querySelector('#modal-close-btn');
        const backdrop = container.querySelector('#modal-backdrop');
        if (closeBtn) closeBtn.addEventListener('click', closeProjectModal);
        if (backdrop) backdrop.addEventListener('click', closeProjectModal);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeProjectModal();
        });
    }

    function openProjectModal(item) {
        const modal = document.getElementById('project-modal');
        const heroImg = document.getElementById('modal-hero-img');
        const titleEl = document.getElementById('modal-title');
        const descEl = document.getElementById('modal-description');

        if (!modal) return;

        heroImg.src = item.image;
        heroImg.alt = item.label;
        titleEl.textContent = item.label;
        descEl.innerHTML = marked.parse(item.body || '');

        modal.classList.add('modal-open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeProjectModal() {
        const modal = document.getElementById('project-modal');
        if (modal) {
            modal.classList.remove('modal-open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    // ─── Circular Gallery Class (ReactBits Architecture) ───
    class CircularGallery {
        constructor(container, options = {}) {
            this.container = container;
            this.items = options.items || [];
            this.bend = options.bend !== undefined ? options.bend : 3;
            this.textColor = options.textColor || '#1C1917';
            this.borderRadius = options.borderRadius !== undefined ? options.borderRadius : 0.05;
            this.scrollEase = options.scrollEase || 0.02;
            this.font = options.font || 'bold 28px Orbitron';
            this.onItemClick = options.onItemClick || (() => {});

            this.scroll = { current: 0, target: 0, last: 0, velocity: 0 };
            this.isDragging = false;
            this.dragStart = { x: 0, scroll: 0 };
            this.dragDistance = 0;
            this.raycaster = new THREE.Raycaster();
            this.mouse = new THREE.Vector2();

            this.init();
        }

        init() {
            const width = this.container.clientWidth || 900;
            const height = this.container.clientHeight || 580;

            // 1. Scene & Camera
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
            this.camera.position.set(0, 0, 7.0);

            // 2. WebGL Renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.container.appendChild(this.renderer.domElement);

            // 3. Create Curved Gallery Meshes
            this.createMeshes();

            // 4. Attach Event Listeners
            this.bindEvents();

            // 5. Start Animation Loop
            this.animate = this.animate.bind(this);
            this.animId = requestAnimationFrame(this.animate);
        }

        createMeshes() {
            this.groups = [];
            const count = this.items.length;
            this.itemWidth = 2.15;
            this.itemHeight = 2.95;
            this.gap = 0.7;
            this.totalWidth = count * (this.itemWidth + this.gap);
            this.radius = (this.totalWidth / (Math.PI * 2)) * (3 / Math.max(0.5, Math.abs(this.bend)));

            // Custom Shader Material with Rounded Corners for the Card Image
            const vertexShader = `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;

            const fragmentShader = `
                uniform sampler2D uTexture;
                uniform float uRadius;
                uniform vec2 uAspect;
                varying vec2 vUv;

                // Signed distance field for rounded rectangle
                float roundedBox(vec2 p, vec2 b, float r) {
                    vec2 d = abs(p) - b + vec2(r);
                    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
                }

                void main() {
                    vec2 p = (vUv - 0.5) * uAspect;
                    vec2 b = 0.5 * uAspect;
                    float d = roundedBox(p, b, uRadius * min(uAspect.x, uAspect.y));
                    
                    // Smooth antialiased border alpha
                    float alpha = 1.0 - smoothstep(0.0, 0.008, d);
                    if (alpha < 0.01) discard;

                    vec4 texColor = texture2D(uTexture, vUv);
                    gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
                }
            `;

            const imageGeo = new THREE.PlaneGeometry(this.itemWidth, this.itemHeight, 32, 32);
            const labelGeo = new THREE.PlaneGeometry(this.itemWidth * 1.5, 0.55);

            this.items.forEach((item, index) => {
                const group = new THREE.Group();
                group.userData = { index: index, item: item };

                // ── 1. Image Mesh ──
                const textureLoader = new THREE.TextureLoader();
                textureLoader.setCrossOrigin('anonymous');
                const imageTexture = textureLoader.load(item.image, (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.generateMipmaps = false;
                });

                const imageMat = new THREE.ShaderMaterial({
                    vertexShader,
                    fragmentShader,
                    uniforms: {
                        uTexture: { value: imageTexture },
                        uRadius: { value: this.borderRadius },
                        uAspect: { value: new THREE.Vector2(this.itemWidth, this.itemHeight) }
                    },
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const imageMesh = new THREE.Mesh(imageGeo, imageMat);
                imageMesh.position.set(0, 0.32, 0); // elevated above label
                group.add(imageMesh);

                // ── 2. External Text Label Mesh (Outside & Beneath Card) ──
                const labelTexture = this.createLabelTexture(item.label);
                const labelMat = new THREE.MeshBasicMaterial({
                    map: labelTexture,
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const labelMesh = new THREE.Mesh(labelGeo, labelMat);
                labelMesh.position.set(0, -1.6, 0); // directly underneath card
                group.add(labelMesh);

                // ── 3. Raycast Hit Collider ──
                const hitGeo = new THREE.PlaneGeometry(this.itemWidth, this.itemHeight + 0.75);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.set(0, 0, 0.05);
                hitMesh.userData = { isHit: true };
                group.add(hitMesh);

                this.scene.add(group);
                this.groups.push(group);
            });
        }

        createLabelTexture(labelText) {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 140;
            const ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw label centered underneath card in crisp black / dark text
            ctx.fillStyle = this.textColor;
            ctx.font = this.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetY = 1;
            ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            return texture;
        }

        bindEvents() {
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseMove = this.onMouseMove.bind(this);
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onWheel = this.onWheel.bind(this);
            this.onResize = this.onResize.bind(this);

            const dom = this.renderer.domElement;
            dom.addEventListener('pointerdown', this.onMouseDown);
            window.addEventListener('pointermove', this.onMouseMove);
            window.addEventListener('pointerup', this.onMouseUp);
            dom.addEventListener('wheel', this.onWheel, { passive: false });
            window.addEventListener('resize', this.onResize);
        }

        onMouseDown(e) {
            this.isDragging = true;
            this.dragStart.x = e.clientX;
            this.dragStart.scroll = this.scroll.target;
            this.dragDistance = 0;
        }

        onMouseMove(e) {
            if (!this.isDragging) return;
            const deltaX = (e.clientX - this.dragStart.x) * 0.0075;
            this.scroll.target = this.dragStart.scroll - deltaX;
            this.dragDistance += Math.abs(e.clientX - this.dragStart.x);
        }

        onMouseUp(e) {
            if (this.isDragging) {
                if (this.dragDistance < 8) {
                    this.checkClick(e);
                }
            }
            this.isDragging = false;
        }

        checkClick(e) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj && !obj.userData.item && obj.parent) {
                    obj = obj.parent;
                }
                if (obj && obj.userData && obj.userData.item) {
                    this.onItemClick(obj.userData.item);
                }
            }
        }

        onWheel(e) {
            e.preventDefault();
            this.scroll.target += e.deltaY * 0.0022;
        }

        onResize() {
            if (!this.container || !this.renderer || !this.camera) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        animate() {
            if (!this.renderer) return;
            this.animId = requestAnimationFrame(this.animate);

            // Smooth Lerp on scroll
            this.scroll.current += (this.scroll.target - this.scroll.current) * this.scrollEase;
            this.scroll.velocity = this.scroll.current - this.scroll.last;
            this.scroll.last = this.scroll.current;

            // Update mesh positions along the curved 3D cylinder
            const count = this.groups.length;
            const spacing = this.itemWidth + this.gap;

            this.groups.forEach((group, i) => {
                let x = (i * spacing - this.scroll.current * spacing) % this.totalWidth;
                if (x < -this.totalWidth / 2) x += this.totalWidth;
                if (x > this.totalWidth / 2) x -= this.totalWidth;

                const theta = (x / this.totalWidth) * Math.PI * 2 * (this.bend / 3);

                group.position.x = Math.sin(theta) * this.radius;
                group.position.z = (Math.cos(theta) - 1.0) * this.radius;
                group.rotation.y = theta;
            });

            this.renderer.render(this.scene, this.camera);
        }

        destroy() {
            if (this.animId) cancelAnimationFrame(this.animId);
            const dom = this.renderer.domElement;
            dom.removeEventListener('pointerdown', this.onMouseDown);
            window.removeEventListener('pointermove', this.onMouseMove);
            window.removeEventListener('pointerup', this.onMouseUp);
            dom.removeEventListener('wheel', this.onWheel);
            window.removeEventListener('resize', this.onResize);

            if (dom.parentNode) dom.parentNode.removeChild(dom);
            this.renderer.dispose();
            this.renderer = null;
            this.scene = null;
            this.camera = null;
        }
    }

    // ─── Hash Sync & Load ───
    function syncFromHash() {
        const hash = window.location.hash.replace('#', '').toLowerCase();
        if (hash && state.sections[hash]) state.activeTab = hash;
        else if (state.tabs.length > 0) state.activeTab = state.tabs[0];
    }

    async function loadContent() {
        let mdText = DEFAULT_MARKDOWN;
        try {
            const r = await fetch('info.md?t=' + Date.now());
            if (r.ok) mdText = await r.text();
        } catch (e) { console.warn('Using bundled content.', e); }

        parseMarkdown(mdText);
        syncFromHash();
        renderFrame();
    }

    window.addEventListener('hashchange', () => { syncFromHash(); setActiveTab(state.activeTab); });
    window.addEventListener('DOMContentLoaded', loadContent);
})();

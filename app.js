/* ══════════════════════════════════════════════════════════════
   MR. & MISS. CULTURE INTERNATIONAL MAYA
   Motor de animación sin dependencias (vanilla JS).

   Estructura
   0. Configuración (EDITAR AQUÍ: WhatsApp y fechas del evento)
   1. Utilidades
   2. Polvo de luz (canvas de partículas)
   3. Motor de scroll (suavizado + bucle único de render)
   4. Preloader (el iris se abre)
   5. Navegación, menú y progreso
   6. Texto: separación en palabras y reveal
   7. Hero (rotador de palabras, inclinación 3D)
   8. Escenas ligadas al scroll (marquee, manifiesto, escena, pilares,
      categorías, galería, línea de tiempo)
   9. Globo del mundo maya
  10. Cuenta regresiva, video, visor de galería
  11. FAQ, formulario y enlaces de WhatsApp
  ══════════════════════════════════════════════════════════════ */
(() => {
    'use strict';

    /* ─────────────── 0. CONFIGURACIÓN ─────────────── */
    const CONFIG = {
        // TODO: número real con lada de país, sin "+" ni espacios (ej. 5219991234567)
        whatsapp: '520000000000',
        // Gran Final Internacional: 26 al 29 de noviembre (hora de Yucatán, UTC-6)
        eventStart: '2026-11-26T00:00:00-06:00',
        eventEnd: '2026-11-29T23:59:59-06:00',
        messages: {
            participar: 'Hola, quiero participar en Mr. & Miss. Culture International Maya. ¿Me comparten la convocatoria y los requisitos?',
            gala: 'Hola, me gustaría asistir a la Gran Final Internacional (26 al 29 de noviembre). ¿Me pueden dar información para reservar mi lugar?',
            categoria: 'Hola, quisiera saber en qué categoría (Kids, Teen, Miss o Mr.) puedo participar.',
            aliado: 'Hola, quiero ser aliado cultural de Mr. & Miss. Culture International Maya. ¿Me comparten las formas de colaborar?',
            duda: 'Hola, tengo una duda sobre el certamen Mr. & Miss. Culture International Maya.',
            listo: 'Hola, vengo de la página web del certamen y quiero platicar con ustedes.',
            flotante: 'Hola, vengo de la página web del certamen y me gustaría más información.'
        }
    };

    /* ─────────────── 1. UTILIDADES ─────────────── */
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => [...c.querySelectorAll(s)];
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const D2R = Math.PI / 180;

    const html = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isMobile = () => innerWidth < 760;

    const docTop = el => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };
    const waURL = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

    /* ─────────────── 2. POLVO DE LUZ ─────────────── */
    // Paleta: oro dominante y chispas del espectro del logo
    const DUST_COLORS = [
        [255, 226, 150], [255, 226, 150], [255, 240, 200], [255, 214, 120], [255, 214, 120],
        [255, 90, 170], [110, 150, 255], [170, 100, 235], [240, 90, 100]
    ];
    const spriteCache = new Map();
    const getSprite = rgb => {
        const key = rgb.join();
        if (spriteCache.has(key)) return spriteCache.get(key);
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, `rgba(${rgb},1)`);
        grd.addColorStop(.18, `rgba(${rgb},.75)`);
        grd.addColorStop(.5, `rgba(${rgb},.16)`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        spriteCache.set(key, c);
        return c;
    };

    class Dust {
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.o = Object.assign({ density: 1 / 9500, max: 150, link: false, interactive: false, shoot: false, speed: 1, sizeMul: 1 }, opts);
            this.parts = [];
            this.shots = [];
            this.nextShot = 2.5;
            this.visible = true;
            this.pointer = { x: -9999, y: -9999, nx: 0, ny: 0 };
            this.t = 0;
            this.resize();
            new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
            new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '80px' }).observe(canvas);
            if (this.o.interactive) {
                const host = this.o.host || canvas.parentElement;
                host.addEventListener('pointermove', e => {
                    const r = canvas.getBoundingClientRect();
                    this.pointer.x = e.clientX - r.left;
                    this.pointer.y = e.clientY - r.top;
                    this.pointer.nx = (this.pointer.x / r.width - .5) * 2;
                    this.pointer.ny = (this.pointer.y / r.height - .5) * 2;
                });
                host.addEventListener('pointerleave', () => { this.pointer.x = this.pointer.y = -9999; this.pointer.nx = this.pointer.ny = 0; });
            }
        }
        resize() {
            const r = this.canvas.parentElement.getBoundingClientRect();
            this.dpr = Math.min(devicePixelRatio || 1, isMobile() ? 1.5 : 1.8);
            this.w = Math.max(1, r.width);
            this.h = Math.max(1, r.height);
            this.canvas.width = Math.round(this.w * this.dpr);
            this.canvas.height = Math.round(this.h * this.dpr);
            const n = Math.min(this.o.max, Math.round(this.w * this.h * this.o.density * (isMobile() ? .7 : 1)));
            if (n > this.parts.length) { while (this.parts.length < n) this.parts.push(this.spawn(true)); }
            else this.parts.length = n;
        }
        spawn(anywhere) {
            const z = Math.random() * .85 + .15;
            const rgb = DUST_COLORS[(Math.random() * DUST_COLORS.length) | 0];
            return {
                x: Math.random() * this.w,
                y: anywhere ? Math.random() * this.h : this.h + 20,
                z, rgb, sprite: getSprite(rgb),
                s: (Math.random() * 7 + 3) * z * this.o.sizeMul,
                sp: (Math.random() * .35 + .12) * (.4 + z),
                ph: Math.random() * 6.28, tw: Math.random() * 1.6 + .5,
                ox: 0, oy: 0
            };
        }
        step(dt) {
            this.t += dt;
            const { ctx, w, h, dpr, o } = this;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            const px = this.pointer.x, py = this.pointer.y;
            const par = this.pointer.nx;
            for (const p of this.parts) {
                p.y -= p.sp * 38 * o.speed * dt;
                p.x += Math.sin(this.t * .3 + p.ph) * .12 * p.z;
                if (p.y < -24) { Object.assign(p, this.spawn(false)); p.x = Math.random() * w; }
                if (o.interactive) {
                    const dx = p.x + p.ox - px, dy = p.y + p.oy - py, d2 = dx * dx + dy * dy;
                    if (d2 < 22000) {
                        const d = Math.sqrt(d2) || 1, f = (1 - d / 148) * 190 * dt;
                        p.ox += (dx / d) * f; p.oy += (dy / d) * f;
                    }
                    p.ox *= .94; p.oy *= .94;
                }
                const x = p.x + p.ox + par * p.z * -22, y = p.y + p.oy;
                const a = (.45 + .55 * Math.sin(this.t * p.tw + p.ph)) * (.35 + .65 * p.z);
                ctx.globalAlpha = clamp(a);
                const s = p.s * 2.4;
                ctx.drawImage(p.sprite, x - s / 2, y - s / 2, s, s);
            }
            if (o.link && !isMobile()) {
                ctx.globalAlpha = 1;
                ctx.lineWidth = .6;
                const n = Math.min(this.parts.length, 56);
                for (let i = 0; i < n; i++) {
                    const a = this.parts[i];
                    if (a.z < .5) continue;
                    for (let j = i + 1; j < n; j++) {
                        const b = this.parts[j];
                        if (b.z < .5) continue;
                        const dx = a.x + a.ox - b.x - b.ox, dy = a.y + a.oy - b.y - b.oy, d = dx * dx + dy * dy;
                        if (d < 14400) {
                            ctx.strokeStyle = `rgba(255,226,150,${(1 - d / 14400) * .22})`;
                            ctx.beginPath();
                            ctx.moveTo(a.x + a.ox, a.y + a.oy);
                            ctx.lineTo(b.x + b.ox, b.y + b.oy);
                            ctx.stroke();
                        }
                    }
                }
            }
            if (o.shoot) this.stepShots(dt);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        stepShots(dt) {
            const { ctx, w, h } = this;
            this.nextShot -= dt;
            if (this.nextShot <= 0 && !reduced) {
                this.nextShot = 4 + Math.random() * 5;
                const ang = (22 + Math.random() * 18) * D2R;
                this.shots.push({ x: Math.random() * w * .7, y: Math.random() * h * .3, vx: Math.cos(ang) * 780, vy: Math.sin(ang) * 780, life: 0, max: .9 });
            }
            for (let i = this.shots.length - 1; i >= 0; i--) {
                const s = this.shots[i];
                s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
                const k = s.life / s.max;
                if (k >= 1) { this.shots.splice(i, 1); continue; }
                const tail = 150, len = Math.hypot(s.vx, s.vy);
                const tx = s.x - (s.vx / len) * tail, ty = s.y - (s.vy / len) * tail;
                const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
                g.addColorStop(0, 'rgba(255,226,150,0)');
                g.addColorStop(1, `rgba(255,244,214,${.9 * (1 - k)})`);
                ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.globalAlpha = 1;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
            }
        }
    }

    /* ─────────────── 3. MOTOR DE SCROLL ─────────────── */
    const S = {
        y: 0, target: 0, vel: 0, max: 0, vh: innerHeight, vw: innerWidth,
        smooth: !reduced && finePointer, locked: false,
        mods: [], tickers: []
    };
    if (S.smooth) html.classList.add('has-engine');

    const scrollTo = (y, immediate) => {
        y = clamp(y, 0, S.max);
        if (S.smooth && !immediate) { S.target = y; }
        else { window.scrollTo({ top: y, behavior: reduced || immediate ? 'auto' : 'smooth' }); if (immediate) S.y = S.target = y; }
    };
    const isFrozen = () => S.locked || html.classList.contains('is-loading');

    const measureAll = () => {
        S.vh = innerHeight; S.vw = innerWidth;
        S.max = Math.max(0, html.scrollHeight - innerHeight);
        S.mods.forEach(m => m.measure && m.measure());
        S.target = clamp(S.target, 0, S.max);
    };
    let measureTimer;
    const scheduleMeasure = () => { clearTimeout(measureTimer); measureTimer = setTimeout(measureAll, 120); };

    if (S.smooth) {
        addEventListener('wheel', e => {
            if (e.ctrlKey || e.defaultPrevented || isFrozen()) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            if (e.target.closest && e.target.closest('textarea, select, [data-native-scroll]')) return;
            e.preventDefault();
            let d = e.deltaY;
            if (e.deltaMode === 1) d *= 34; else if (e.deltaMode === 2) d *= S.vh;
            S.target = clamp(S.target + d * .9, 0, S.max);
        }, { passive: false });

        addEventListener('keydown', e => {
            if (isFrozen() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
            const ae = document.activeElement;
            if (ae && ae !== document.body && ae !== html) return;
            let d = 0;
            switch (e.key) {
                case 'ArrowDown': d = 90; break;
                case 'ArrowUp': d = -90; break;
                case 'PageDown': d = S.vh * .88; break;
                case 'PageUp': d = -S.vh * .88; break;
                case ' ': d = e.shiftKey ? -S.vh * .88 : S.vh * .88; break;
                case 'Home': S.target = 0; e.preventDefault(); return;
                case 'End': S.target = S.max; e.preventDefault(); return;
                default: return;
            }
            e.preventDefault();
            S.target = clamp(S.target + d, 0, S.max);
        });
    }

    // Anclas internas
    document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a || a.dataset.wa) return;
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const el = document.getElementById(id.slice(1));
        if (!el) return;
        e.preventDefault();
        closeMenu(true);
        const y = id === '#inicio' ? 0 : docTop(el);
        requestAnimationFrame(() => scrollTo(y));
        history.replaceState(null, '', id);
    });

    let lastT = performance.now(), prevY = 0;
    const frame = now => {
        const dt = Math.min(.05, (now - lastT) / 1000) || .016;
        lastT = now;
        const native = window.scrollY;
        if (S.smooth && !isFrozen()) {
            if (Math.abs(native - S.y) > 2.5) { S.y = S.target = native; }
            else {
                const diff = S.target - S.y;
                if (Math.abs(diff) > .06) { S.y += diff * (1 - Math.exp(-dt * 5.4)); window.scrollTo(0, S.y); }
                else if (diff !== 0) { S.y = S.target; window.scrollTo(0, S.y); }
            }
        } else { S.y = native; S.target = native; }
        S.vel = lerp(S.vel, (S.y - prevY) / dt, .18);
        prevY = S.y;
        for (const t of S.tickers) t(S, now, dt);
        requestAnimationFrame(frame);
    };

    /* ─────────────── 4. PRELOADER ─────────────── */
    const loader = $('#loader');
    const ldDust = loader && $('#ld-dust') ? new Dust($('#ld-dust'), { density: 1 / 14000, max: 60, speed: .8, sizeMul: .8 }) : null;
    let ldRaf;
    if (ldDust) {
        let lt = performance.now();
        const ldLoop = n => { const dt = Math.min(.05, (n - lt) / 1000); lt = n; ldDust.step(dt); ldRaf = requestAnimationFrame(ldLoop); };
        ldRaf = requestAnimationFrame(ldLoop);
    }

    const runLoader = () => new Promise(resolve => {
        if (!loader) return resolve();
        const pctEl = $('#ld-pct'), arc = $('#ld-arc'), iris = $('#ld-iris');
        const minMs = reduced ? 250 : 2400;
        const t0 = performance.now();
        let ready = false, p = 0;

        const emblem = $('.ld-emblem');
        Promise.all([
            document.fonts && document.fonts.ready,
            new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
            emblem && emblem.decode ? emblem.decode().catch(() => {}) : null
        ]).then(() => { ready = true; });
        setTimeout(() => { ready = true; }, 6500);

        const tick = now => {
            const t = (now - t0) / minMs;
            const goal = ready ? clamp(t) : Math.min(clamp(t), .9);
            p = Math.min(goal, p + .02);
            const shown = Math.round(easeOut(p) * 100);
            pctEl.textContent = shown;
            arc.style.strokeDashoffset = String(100 - easeOut(p) * 100);
            if (p >= 1) return open();
            requestAnimationFrame(tick);
        };

        const open = () => {
            const maxR = Math.hypot(innerWidth, innerHeight) / 2 + 80;
            loader.classList.add('is-opening');
            const dur = reduced ? 1 : 1500;
            const start = performance.now();
            html.classList.remove('is-loading');
            html.classList.add('is-ready');
            resolve();
            const grow = n => {
                const k = clamp((n - start) / dur);
                const r = easeInOut(k) * maxR;
                loader.style.setProperty('--r', r + 'px');
                iris.style.width = iris.style.height = (r * 2) + 'px';
                iris.style.opacity = String(Math.sin(k * Math.PI) * .95);
                if (k < 1) requestAnimationFrame(grow);
                else { cancelAnimationFrame(ldRaf); loader.remove(); }
            };
            requestAnimationFrame(grow);
        };
        requestAnimationFrame(tick);
    });

    /* ─────────────── 5. NAVEGACIÓN, MENÚ, PROGRESO ─────────────── */
    const nav = $('#nav'), menu = $('#menu'), burger = $('#burger');
    const progress = $('#progress');
    const inertTargets = $$('main, footer, .wa-float');

    const openMenu = () => {
        $$('.menu-link', menu).forEach((a, i) => a.style.setProperty('--k', i));
        menu.removeAttribute('inert');
        nav.classList.remove('is-hidden');
        html.classList.add('menu-open');
        menu.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Cerrar menú');
        inertTargets.forEach(el => el.setAttribute('inert', ''));
        S.locked = true; html.classList.add('is-locked');
    };
    function closeMenu(silent) {
        if (!menu.classList.contains('is-open')) return;
        menu.classList.remove('is-open');
        html.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menú');
        inertTargets.forEach(el => el.removeAttribute('inert'));
        setTimeout(() => menu.setAttribute('inert', ''), 900);
        S.locked = false; html.classList.remove('is-locked');
        S.target = S.y = window.scrollY;
        if (!silent) burger.focus({ preventScroll: true });
    }
    burger.addEventListener('click', () => (menu.classList.contains('is-open') ? closeMenu() : openMenu()));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    matchMedia('(min-width: 1040px)').addEventListener('change', () => closeMenu(true));

    // La barra se oculta al bajar y reaparece al subir (acumula distancia para ser estable con scroll suave)
    let navLastY = 0, navDir = 0, navAcc = 0;
    S.tickers.push(s => {
        const y = s.y, d = y - navLastY;
        nav.classList.toggle('is-scrolled', y > 24);
        if (Math.abs(d) > .05) {
            if (Math.sign(d) !== navDir) { navDir = Math.sign(d); navAcc = 0; }
            navAcc += Math.abs(d);
        }
        if (!menu.classList.contains('is-open')) {
            if (y < 520 || (navDir < 0 && navAcc > 28)) nav.classList.remove('is-hidden');
            else if (navDir > 0 && navAcc > 48) nav.classList.add('is-hidden');
        }
        navLastY = y;
        progress.style.setProperty('--p', s.max ? (y / s.max).toFixed(4) : 0);
    });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

    // Scrollspy
    const spyLinks = new Map($$('[data-spy]').map(a => [a.dataset.spy, a]));
    if (spyLinks.size) {
        const spy = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                spyLinks.forEach((a, id) => {
                    const on = id === en.target.id;
                    a.classList.toggle('is-active', on);
                    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        spyLinks.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
    }

    /* ─────────────── 6. TEXTO: PALABRAS Y REVEAL ─────────────── */
    const splitWords = (root, wrapCls, innerCls, hide = true) => {
        let idx = 0;
        const walk = node => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = wrapCls;
                        if (innerCls) {
                            const wi = document.createElement('span');
                            wi.className = innerCls;
                            wi.style.setProperty('--wi', idx);
                            wi.textContent = part;
                            w.appendChild(wi);
                        } else w.textContent = part;
                        if (hide) w.setAttribute('aria-hidden', 'true');
                        idx++;
                        frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
            });
        };
        if (hide) root.setAttribute('aria-label', root.textContent.replace(/\s+/g, ' ').trim());
        walk(root);
    };

    $$('[data-split]').forEach(el => { splitWords(el, 'w', 'wi'); el.classList.add('is-split'); });

    const revealIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            en.target.classList.add('in');
            revealIO.unobserve(en.target);
        });
    }, { threshold: .14, rootMargin: '0px 0px -6% 0px' });
    $$('[data-reveal], [data-split]').forEach(el => revealIO.observe(el));

    // Contadores
    const countIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            countIO.unobserve(en.target);
            const el = en.target, end = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0;
            if (reduced) { el.textContent = end.toFixed(dec); return; }
            const t0 = performance.now(), dur = 2000;
            const step = n => {
                const k = clamp((n - t0) / dur);
                el.textContent = (end * easeOutExpo(k)).toFixed(dec);
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }, { threshold: .6 });
    $$('[data-count]').forEach(el => { if (!reduced) el.textContent = (0).toFixed(+el.dataset.decimals || 0); countIO.observe(el); });

    /* ─────────────── 7. HERO ─────────────── */
    const hero = $('.hero');
    const emblem = $('#emblem');
    const heroVisual = $('.hero-visual');
    const heroCopy = $('.hero-copy');

    // Rotador de palabras
    const rot = $('[data-rotator]');
    if (rot) {
        const words = $$('.rot-w', rot);
        let cur = 0;
        const setWidth = el => rot.style.setProperty('--rw', el.offsetWidth + 'px');
        const prep = () => { rot.classList.add('is-js'); setWidth(words[cur]); };
        (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(prep);
        addEventListener('resize', () => setWidth(words[cur]));
        if (!reduced) {
            setInterval(() => {
                if (document.hidden || !rot.classList.contains('is-js')) return;
                const prev = words[cur];
                cur = (cur + 1) % words.length;
                const next = words[cur];
                prev.classList.remove('is-on'); prev.classList.add('is-out');
                next.classList.remove('is-out'); next.classList.add('is-on');
                setWidth(next);
                setTimeout(() => prev.classList.remove('is-out'), 1100);
            }, 3200);
        }
    }

    // Polvo del hero + inclinación 3D
    const heroDust = new Dust($('#hero-dust'), { density: 1 / 7000, max: 190, link: true, interactive: true, shoot: true, host: hero });
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer && !reduced) {
        hero.addEventListener('pointermove', e => {
            const r = hero.getBoundingClientRect();
            tilt.tx = ((e.clientX - r.left) / r.width - .5) * 2;
            tilt.ty = ((e.clientY - r.top) / r.height - .5) * 2;
        });
        hero.addEventListener('pointerleave', () => { tilt.tx = tilt.ty = 0; });
    }
    const raysEl = $('.hero .rays');
    S.tickers.push((s, now, dt) => {
        if (s.y > s.vh * 1.2) return;
        tilt.x = lerp(tilt.x, tilt.tx, 1 - Math.exp(-dt * 4));
        tilt.y = lerp(tilt.y, tilt.ty, 1 - Math.exp(-dt * 4));
        emblem.style.setProperty('--tx', (tilt.x * 11).toFixed(2) + 'deg');
        emblem.style.setProperty('--ty', (-tilt.y * 8).toFixed(2) + 'deg');
        const p = clamp(s.y / s.vh);
        heroVisual.style.translate = `0 ${(p * 90).toFixed(1)}px`;
        heroVisual.style.scale = (1 - p * .12).toFixed(3);
        heroCopy.style.translate = `0 ${(p * -40).toFixed(1)}px`;
        heroCopy.style.opacity = (1 - clamp(p * 1.5)).toFixed(3);
        if (raysEl) raysEl.style.translate = `${(tilt.x * -22).toFixed(1)}px ${(p * 60).toFixed(1)}px`;
    });

    // Magnético en botones
    if (finePointer && !reduced) {
        $$('[data-magnetic]').forEach(btn => {
            btn.addEventListener('pointermove', e => {
                const r = btn.getBoundingClientRect();
                btn.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px');
                btn.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .32).toFixed(1) + 'px');
            });
            btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', '0px'); btn.style.setProperty('--my', '0px'); });
        });
    }

    /* ─────────────── 8. ESCENAS LIGADAS AL SCROLL ─────────────── */

    /* 8.1 Marquee reactivo a la velocidad del scroll */
    (() => {
        const track = $('#marquee');
        if (!track) return;
        const group = track.firstElementChild;
        let x = 0, gw = 0, vis = true;
        new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(track.parentElement);
        S.mods.push({ measure() { gw = group.offsetWidth; } });
        S.tickers.push((s, now, dt) => {
            if (!vis || !gw) return;
            const boost = reduced ? 0 : Math.min(Math.abs(s.vel) * .55, 900);
            x -= (62 + boost) * dt;
            if (x <= -gw) x += gw;
            const skew = reduced ? 0 : clamp(-s.vel * .006, -7, 7);
            track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
        });
    })();

    /* 8.2 Manifiesto: las palabras se encienden al avanzar */
    (() => {
        const p = $('#manifesto');
        if (!p) return;
        splitWords(p, 'mw', null, false);
        const words = $$('.mw', p);
        let top = 0, h = 0;
        S.mods.push({ measure() { top = docTop(p); h = p.offsetHeight; } });
        S.tickers.push(s => {
            if (s.y + s.vh < top - 100 || s.y > top + h + 100) return;
            const k = clamp((s.y + s.vh * .84 - top) / (h + s.vh * .38));
            const n = words.length;
            words.forEach((w, i) => {
                const wp = reduced ? 1 : clamp((k * (n + 7) - i) / 7);
                w.style.opacity = (.16 + .84 * wp).toFixed(3);
            });
        });
    })();

    /* 8.3 Escena: la imagen se abre a pantalla completa */
    (() => {
        const sec = $('[data-stage]');
        if (!sec) return;
        const media = $('#stage-media'), caption = $('#stage-caption');
        const tl = $('.st-l', sec), tr = $('.st-r', sec);
        let top = 0, h = 0;
        S.mods.push({ measure() { top = docTop(sec); h = sec.offsetHeight; } });
        S.tickers.push(s => {
            if (s.y + s.vh < top || s.y > top + h) return;
            const p = clamp((s.y - top) / (h - s.vh));
            const e = reduced ? 1 : easeInOut(clamp(p / .5));
            media.style.setProperty('--e', e.toFixed(4));
            media.style.setProperty('--pan', lerp(.1, .9, easeInOut(clamp((p - .42) / .58))).toFixed(4));
            const fade = 1 - clamp((e - .45) / .4);
            const dx = e * (isMobile() ? 70 : 52);
            tl.style.transform = `translate3d(${-dx}vw,0,0)`;
            tr.style.transform = `translate3d(${dx}vw,0,0)`;
            tl.style.opacity = tr.style.opacity = fade.toFixed(3);
            const c = reduced ? 1 : clamp((p - .6) / .2);
            caption.style.opacity = c.toFixed(3);
            caption.style.transform = `translate3d(0,${((1 - c) * 36).toFixed(1)}px,0)`;
        });
    })();

    /* 8.4 Pilares: tarjetas apiladas con profundidad */
    (() => {
        const stack = $('#stack');
        if (!stack) return;
        const cards = $$('.pcard', stack);
        let nat = [], stickyTop = [], endY = 0;
        S.mods.push({
            measure() {
                const base = docTop(stack);
                let acc = 0;
                nat = cards.map(c => {
                    const t = base + acc;
                    acc += c.offsetHeight + parseFloat(getComputedStyle(c).marginBottom);
                    return t;
                });
                endY = base + stack.offsetHeight;
                stickyTop = cards.map(c => parseFloat(getComputedStyle(c).top) || 0);
            }
        });
        S.tickers.push(s => {
            const last = cards.length - 1;
            if (s.y + s.vh < nat[0] || s.y > endY + 200) return;
            const q = cards.map((_, j) => (j === 0 ? 0 : clamp((s.vh - (nat[j] - s.y)) / (s.vh - stickyTop[j]))));
            cards.forEach((c, i) => {
                let depth = 0;
                for (let j = i + 1; j < cards.length; j++) depth += q[j];
                c.style.transform = reduced ? '' : `scale(${(1 - depth * .045).toFixed(4)})`;
                c.style.setProperty('--dim', Math.min(.62, depth * .26).toFixed(3));
            });
        });
    })();

    /* 8.5 Categorías: pan horizontal anclado (escritorio) */
    (() => {
        const sec = $('[data-cats]');
        if (!sec) return;
        const track = $('#cats-track'), bar = $('.cats-bar', sec), fill = $('#cats-fill');
        const cards = $$('.ccard', sec);
        let pinned = false, top = 0, h = 0, dist = 0, centers = [];
        S.mods.push({
            measure() {
                const want = !reduced && innerWidth >= 1024;
                if (want !== pinned) {
                    pinned = want;
                    sec.classList.toggle('is-pinned', pinned);
                    track.style.transform = '';
                    if (!pinned) { sec.style.removeProperty('--cats-h'); cards.forEach(c => c.style.removeProperty('--a')); }
                }
                if (!pinned) return;
                dist = Math.max(0, track.offsetWidth - S.vw);
                sec.style.setProperty('--cats-h', (dist + S.vh) + 'px');
                top = docTop(sec); h = sec.offsetHeight;
                centers = cards.map(c => c.offsetLeft + c.offsetWidth / 2);
            }
        });
        S.tickers.push(s => {
            if (!pinned || s.y + s.vh < top || s.y > top + h) return;
            const p = clamp((s.y - top) / (h - s.vh));
            const x = -p * dist;
            track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
            fill.style.setProperty('--p', p.toFixed(4));
            bar.style.setProperty('--p', p.toFixed(4));
            cards.forEach((c, i) => {
                const d = Math.abs(centers[i] + x - s.vw / 2) / (s.vw * .5);
                c.style.setProperty('--a', clamp(1.12 - d).toFixed(3));
            });
        });
    })();

    /* 8.6 Galería: paralaje interno por imagen */
    (() => {
        const imgs = $$('.tile-btn img[data-par]');
        const data = imgs.map(img => ({ img, f: parseFloat(img.dataset.par), top: 0, h: 0 }));
        S.mods.push({ measure() { data.forEach(d => { const t = d.img.parentElement.parentElement; d.top = docTop(t); d.h = t.offsetHeight; }); } });
        S.tickers.push(s => {
            if (reduced) return;
            data.forEach(d => {
                if (s.y + s.vh < d.top - 50 || s.y > d.top + d.h + 50) return;
                const center = d.top + d.h / 2 - s.y - s.vh / 2;
                const max = d.h * .06;
                d.img.style.translate = `0 ${clamp(center * d.f * -1, -max, max).toFixed(1)}px`;
            });
        });
    })();

    /* 8.7 Línea de tiempo: el trazo dorado avanza con el scroll */
    (() => {
        const tlEl = $('#timeline');
        if (!tlEl) return;
        const line = $('.tl-line', tlEl);
        const steps = $$('.tl-step', tlEl);
        let top = 0, h = 0, tops = [];
        S.mods.push({ measure() { top = docTop(tlEl); h = tlEl.offsetHeight; tops = steps.map(st => docTop(st) + 23); } });
        S.tickers.push(s => {
            if (s.y + s.vh < top - 100 || s.y > top + h + 100) return;
            const mark = s.y + s.vh * .6;
            const first = tops[0], lastT = tops[tops.length - 1];
            const p = clamp((mark - first) / (lastT - first));
            line.style.setProperty('--p', p.toFixed(4));
            steps.forEach((st, i) => st.classList.toggle('is-on', mark >= tops[i]));
        });
    })();

    /* ─────────────── 9. GLOBO DEL MUNDO MAYA ─────────────── */
    (() => {
        const canvas = $('#globe');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const LAND = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf8Af/AAAAAAAAAAAAAAAAAAAAAAAA//////+AAAAAAAADgAAAAAAAAAAAABf+f///4AA+AAAAAB8AAAAAAAAAABwAz4f///wAAYAAAEAAGAAAAAAAAAAAPi/wAf//wAAAAADAAf/4AHAAAAAAAH4n38AP//gAAAAAMBD///8DAAAgDwACfw3/wP//gAAA4AMH///////wAf///////////////wAf2GwAAAAAAAAP///////////////gANAAgAAAAAAAAj////////////////////////////+AP/////4g4D4AAAH9/////////////Af/////gHgA4AAAP5///////////PwAHgP///gH0AAAAAH4/////////+CMAADAB///4H+AAAAGCx/////////8A8AAAAA////n/gAAAODj/////////wA4AAAAAf///v/wAAAbP///////////AwAAAAAP/////wAAAH////////////AAAAAAAH////8YAAAB///////////9AAAAAAAD////8EAAAB///////////9AAAAAAAD////+AAAAB//5fP//////4AAAAAAAD////gAAAAPxvwPP//////jAAAAAAAD////AAAAAfib//n/////+CAAAAAAAD///+AAAAAfADf/n////+MCAAAAAAAB///8AAAAAOeRP/3/////mOAAAAAAAA///8AAAAAH+AA///////E8AAAAAAAAf//wAAAAAP/gB///////hgAAAAAAAAP//gAAAAAf/7////////gAAAAAAAAAH/gwAAAAAf////f/////gAAAAAAAAAF+AQAAAAB///+/v/////AAAAAAAAAAC+AAAAAAD/////0X////AAAAAAAAAAAeAQAAAAD////f/D///8gAAAAAAAAAAfEEAAAAH////v/B/z/QAAAAAAAAAAAPMBgAAAD////v+A/B+gAAAAAAAAAAAD8AAAAAD////34AeB/AgAAAAAAAAAAAPAAAAAH////3wAcAfggAAAAAAAAAAADAAAAAD////+AAcAfgAAAAAAAAAAAABDwAAAD////9wAMATAYAAAAAAAAAAAA//AAAB/////gAOAQAIAAAAAAAAAAAAH/gAAA/////gACAIAIAAAAAAAAAAAAH/8AAAfH///AAAAsGAAAAAAAAAAAAAH/+AAAAB//+AAAAcOAAAAAAAAAAAAAP/+AAAAB//8AAAAc+gAAAAAAAAAAAAP//gAAAD//4AAAAMeggAAAAAAAAAAAP//8AAAB//wAAAAGdg+AAAAAAAAAAAf///AAAA//wAAAACAAPkAAAAAAAAAAP///gAAA//wAAAABwAHwAAAAAAAAAAP///AAAA//wAAAAAAIDYAAAAAAAAAAH///AAAAf/wAAAAAAAAAAAAAAAAAAAD//+AAAA//wgAAAAABxAAAAAAAAAAAD//+AAAA//xgAAAAAPxgAAAAAAAAAAA//+AAAA//zgAAAAAf/gAAAAAAAAAAAf/8AAAA//DgAAAAAf/wAAAAAAAAAAAf/8AAAAf/DAAAAAD//4CAAAAAAAAAAf/4AAAAf/DAAAAAH//8AAAAAAAAAAAf/AAAAAf+CAAAAAH//8AAAAAAAAAAA//AAAAAf8AAAAAAH//+AAAAAAAAAAA/+AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAD//+AAAAAAAAAAA/8AAAAAHwAAAAAADwf8AAAAAAAAAAA/4AAAAAAAAAAAAACAH4AAAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB/AAAAAAAAAAAAAAAAAAAGAAAAAAAAB+AAAAAAAAAAAAAAAAAQAMAAAAAAAAB8AAAAAAAAAAAAAAAAAQAYAAAAAAAAB4AAAAAAAAAAAAAAAAAAAwAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAA+AA//+//gAAAAAAAAAAAMAAAAAAADP/+H//////AAAAAAAAAAB+AAAAJf////8////////gAAAAAAPGB/AAAD///////////////gAAAf/////8AAAH//////////////+AABn/////+AAAH///////////////8AAE//////4ABw////////////////8AAAX//////nHg////////////////4AAAf/////////////////////////+AAAPgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        const bin = atob(LAND);
        const mask = new Uint8Array(180 * 90);
        for (let i = 0; i < mask.length; i++) mask[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
        const isLand = (lat, lon) => mask[Math.min(89, Math.floor((90 - lat) / 2)) * 180 + (Math.floor((lon + 180) / 2) % 180)] === 1;
        const vec = (lat, lon) => [Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.cos(lon * D2R)];

        // Puntos del globo
        const land = [], sea = [];
        const STEP = 2.3;
        for (let lat = -62; lat <= 84; lat += STEP) {
            const n = Math.max(1, Math.round(360 * Math.cos(lat * D2R) / STEP));
            const off = (Math.round(lat / STEP) & 1) * .5;
            for (let k = 0; k < n; k++) {
                const lon = -180 + (k + off) * 360 / n;
                (isLand(lat, lon) ? land : sea).push(vec(lat, lon));
            }
        }

        const SITES = [
            { name: 'Yucatán', lat: 20.9, lon: -89.6 },
            { name: 'Guatemala', lat: 14.64, lon: -90.51 },
            { name: 'Belice', lat: 17.25, lon: -88.77 },
            { name: 'El Salvador', lat: 13.69, lon: -89.19 }
        ].map(s => ({ ...s, v: vec(s.lat, s.lon) }));

        let size = 0, R = 0, cx = 0, cy = 0, dpr = 1, bodyGrad, glowGrad;
        const resize = () => {
            const r = canvas.getBoundingClientRect();
            dpr = Math.min(devicePixelRatio || 1, 2);
            size = r.width;
            canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
            cx = cy = size / 2; R = size * .385;
            glowGrad = ctx.createRadialGradient(cx, cy, R * .96, cx, cy, R * 1.32);
            glowGrad.addColorStop(0, 'rgba(233,194,92,.22)');
            glowGrad.addColorStop(.35, 'rgba(122,53,181,.14)');
            glowGrad.addColorStop(1, 'rgba(122,53,181,0)');
            bodyGrad = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
            bodyGrad.addColorStop(0, '#231a45');
            bodyGrad.addColorStop(.6, '#0e0a1f');
            bodyGrad.addColorStop(1, '#06040d');
        };
        new ResizeObserver(resize).observe(canvas);
        resize();

        let visible = false, active = 0;
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);

        // Interacción: arrastrar y selector
        const view = { lon: SITES[0].lon, lat: 16 };
        const target = { lon: SITES[0].lon, lat: 16 };
        const drag = { x: 0, y: 0, on: false, px: 0, py: 0, idle: 0 };
        canvas.addEventListener('pointerdown', e => { drag.on = true; drag.px = e.clientX; drag.py = e.clientY; canvas.setPointerCapture(e.pointerId); });
        canvas.addEventListener('pointermove', e => {
            if (!drag.on) return;
            drag.x -= (e.clientX - drag.px) * .28;
            drag.y += (e.clientY - drag.py) * .2;
            drag.x = clamp(drag.x, -70, 70); drag.y = clamp(drag.y, -30, 30);
            drag.px = e.clientX; drag.py = e.clientY; drag.idle = 0;
        });
        const end = () => { drag.on = false; };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

        const legend = $$('#legend button');
        const select = i => {
            active = i;
            legend.forEach((b, k) => b.classList.toggle('is-on', k === i));
            target.lon = SITES[i].lon + 4; target.lat = Math.max(8, SITES[i].lat - 2);
            drag.x = drag.y = 0;
        };
        legend.forEach((b, i) => b.addEventListener('click', () => select(i)));
        select(0);

        const project = (v, lon0, lat0) => {
            const cl = Math.cos(-lon0 * D2R), sl = Math.sin(-lon0 * D2R);
            const x1 = v[0] * cl + v[2] * sl, z1 = -v[0] * sl + v[2] * cl;
            const cp = Math.cos(lat0 * D2R), sp = Math.sin(lat0 * D2R);
            const y2 = v[1] * cp - z1 * sp, z2 = v[1] * sp + z1 * cp;
            return [cx + R * x1, cy - R * y2, z2];
        };

        let t = 0;
        S.tickers.push((s, now, dt) => {
            if (!visible) return;
            t += dt;
            if (!drag.on) { drag.idle += dt; if (drag.idle > 2.5) { drag.x *= 1 - Math.min(1, dt * .8); drag.y *= 1 - Math.min(1, dt * .8); } }
            const sway = reduced ? 0 : Math.sin(t * .22) * 11;
            view.lon += (target.lon + sway + drag.x - view.lon) * (1 - Math.exp(-dt * 4));
            view.lat += (target.lat + drag.y - view.lat) * (1 - Math.exp(-dt * 4));

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = glowGrad; ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();

            // Océano (puntos tenues)
            ctx.fillStyle = 'rgba(160,140,220,.22)';
            for (const v of sea) {
                const p = project(v, view.lon, view.lat);
                if (p[2] > 0) ctx.fillRect(p[0] - .6, p[1] - .6, 1.2, 1.2);
            }
            // Tierra
            for (const v of land) {
                const p = project(v, view.lon, view.lat);
                if (p[2] <= 0) continue;
                const a = .35 + .65 * p[2];
                ctx.fillStyle = `rgba(245,232,200,${a.toFixed(2)})`;
                const sz = 1.2 + p[2] * 1.1;
                ctx.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
            }
            // Borde luminoso
            ctx.strokeStyle = 'rgba(233,194,92,.45)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

            // Arcos desde Yucatán
            const a0 = SITES[0].v;
            for (let i = 1; i < SITES.length; i++) {
                const b = SITES[i].v;
                const seg = 26;
                let prev = null;
                for (let k = 0; k <= seg; k++) {
                    const u = k / seg;
                    let x = a0[0] * (1 - u) + b[0] * u, y = a0[1] * (1 - u) + b[1] * u, z = a0[2] * (1 - u) + b[2] * u;
                    const l = Math.hypot(x, y, z) || 1, lift = (1 + .22 * Math.sin(u * Math.PI)) / l;
                    const p = project([x * lift, y * lift, z * lift], view.lon, view.lat);
                    if (prev && p[2] > 0 && prev[2] > 0) {
                        ctx.strokeStyle = `rgba(255,226,150,${(.25 + .45 * Math.sin(u * Math.PI)).toFixed(2)})`;
                        ctx.lineWidth = 1.2;
                        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
                    }
                    prev = p;
                }
                // pulso viajero
                const u = ((t * .32 + i * .31) % 1);
                const x = a0[0] * (1 - u) + b[0] * u, y = a0[1] * (1 - u) + b[1] * u, z = a0[2] * (1 - u) + b[2] * u;
                const l = Math.hypot(x, y, z) || 1, lift = (1 + .22 * Math.sin(u * Math.PI)) / l;
                const p = project([x * lift, y * lift, z * lift], view.lon, view.lat);
                if (p[2] > 0) {
                    ctx.fillStyle = 'rgba(255,244,214,.95)';
                    ctx.shadowColor = 'rgba(255,226,150,.9)'; ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, 6.2832); ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            // Sedes
            SITES.forEach((site, i) => {
                const p = project(site.v, view.lon, view.lat);
                if (p[2] <= .02) return;
                const on = i === active;
                const pulse = (t * .9 + i * .25) % 1;
                ctx.strokeStyle = `rgba(233,194,92,${((1 - pulse) * (on ? .9 : .5)).toFixed(2)})`;
                ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.arc(p[0], p[1], 4 + pulse * (on ? 22 : 14), 0, 6.2832); ctx.stroke();
                ctx.fillStyle = on ? '#fff0bd' : '#e9c25c';
                ctx.shadowColor = 'rgba(233,194,92,.95)'; ctx.shadowBlur = on ? 18 : 10;
                ctx.beginPath(); ctx.arc(p[0], p[1], on ? 4.4 : 3.2, 0, 6.2832); ctx.fill();
                ctx.shadowBlur = 0;
                if (on) {
                    ctx.font = '600 13px Geist, system-ui, sans-serif';
                    const w = ctx.measureText(site.name).width;
                    const side = p[0] < cx ? -1 : 1;
                    const lx = p[0] + side * 22, ly = p[1] - 24;
                    ctx.strokeStyle = 'rgba(233,194,92,.7)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(p[0] + side * 4, p[1] - 4); ctx.lineTo(lx, ly); ctx.lineTo(lx + side * (w + 14), ly); ctx.stroke();
                    ctx.fillStyle = '#fbe9b0';
                    ctx.textAlign = side > 0 ? 'left' : 'right';
                    ctx.fillText(site.name, lx + side * 8, ly - 7);
                }
            });
        });
    })();

    /* ─────────────── 10. CUENTA REGRESIVA, VIDEO, VISOR ─────────────── */
    (() => {
        const box = $('[data-countdown]');
        if (!box) return;
        const status = $('[data-cd-status]');
        const els = { d: $('[data-cd="d"]', box), h: $('[data-cd="h"]', box), m: $('[data-cd="m"]', box), s: $('[data-cd="s"]', box) };
        const start = new Date(CONFIG.eventStart).getTime(), endT = new Date(CONFIG.eventEnd).getTime();
        const set = (key, val) => {
            const txt = String(val).padStart(2, '0');
            if (els[key].textContent !== txt) {
                els[key].textContent = txt;
                if (!reduced) { els[key].classList.remove('tick'); void els[key].offsetWidth; els[key].classList.add('tick'); }
            }
        };
        const update = () => {
            const now = Date.now();
            let diff = start - now;
            if (diff <= 0) {
                set('d', 0); set('h', 0); set('m', 0); set('s', 0);
                status.textContent = now <= endT ? 'La Gran Final Internacional ya está en marcha. Sigue el certamen en nuestras redes.' : 'Gracias por ser parte de esta edición. Escríbenos para conocer la próxima convocatoria.';
                return;
            }
            diff = Math.floor(diff / 1000);
            set('d', Math.floor(diff / 86400));
            set('h', Math.floor(diff % 86400 / 3600));
            set('m', Math.floor(diff % 3600 / 60));
            set('s', diff % 60);
        };
        update();
        setInterval(update, 1000);
    })();

    // Video de adelanto: se reproduce solo cuando está a la vista
    const teaser = $('#teaser'), sound = $('#sound');
    if (teaser) {
        const teaserIO = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !reduced) { teaser.preload = 'auto'; const pr = teaser.play(); if (pr && pr.catch) pr.catch(() => {}); }
            else teaser.pause();
        }, { threshold: .35 });
        teaserIO.observe(teaser);
        sound.addEventListener('click', () => {
            teaser.muted = !teaser.muted;
            sound.setAttribute('aria-pressed', String(!teaser.muted));
            sound.setAttribute('aria-label', teaser.muted ? 'Activar sonido del video' : 'Silenciar video');
            if (!teaser.muted && teaser.paused) teaser.play().catch(() => {});
        });
    }

    // Visor de galería
    (() => {
        const dlg = $('#lightbox');
        if (!dlg) return;
        const stage = $('#lb-stage'), cap = $('#lb-cap'), count = $('#lb-count');
        const items = $$('[data-lb]').map(btn => {
            const img = btn.querySelector('img');
            return { btn, img, src: btn.dataset.src, video: btn.dataset.video || null, alt: img ? img.alt : '' };
        });
        let idx = 0, opener = null;

        const render = (first) => {
            const it = items[idx];
            stage.innerHTML = '';
            let media;
            if (it.video) {
                media = document.createElement('video');
                media.src = it.video; media.controls = true; media.autoplay = true; media.playsInline = true;
                media.poster = it.src;
                media.setAttribute('aria-label', it.alt);
            } else {
                media = document.createElement('img');
                media.src = it.src; media.alt = it.alt; media.decoding = 'async';
            }
            media.className = 'lb-media';
            stage.appendChild(media);
            cap.textContent = it.alt;
            count.textContent = `${idx + 1} / ${items.length}`;
            if (first && it.img && !reduced && media.animate) {
                // Transición FLIP desde la miniatura
                const run = () => {
                    const a = it.img.getBoundingClientRect(), b = media.getBoundingClientRect();
                    if (!b.width) return;
                    media.style.animation = 'none';
                    media.animate([
                        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: .6 },
                        { transform: 'none', opacity: 1 }
                    ], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)' });
                };
                if (media.complete || it.video) run(); else media.addEventListener('load', run, { once: true });
            }
        };
        const go = d => { idx = (idx + d + items.length) % items.length; render(false); };
        const open = i => {
            idx = i; opener = items[i].btn;
            render(true);
            dlg.showModal();
            S.locked = true; html.classList.add('is-locked');
            if (teaser) teaser.pause();
        };
        const close = () => {
            const finish = () => {
                dlg.close(); stage.innerHTML = '';
                S.locked = false; html.classList.remove('is-locked');
                S.target = S.y = window.scrollY;
                if (opener) opener.focus({ preventScroll: true });
            };
            if (reduced || !dlg.animate) return finish();
            dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' }).finished.then(finish).catch(finish);
        };
        items.forEach((it, i) => it.btn.addEventListener('click', () => open(i)));
        $('#lb-close').addEventListener('click', close);
        $('#lb-prev').addEventListener('click', () => go(-1));
        $('#lb-next').addEventListener('click', () => go(1));
        dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
        dlg.addEventListener('click', e => { if (e.target === dlg || e.target === stage) close(); });
        dlg.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        });
        // Deslizar en pantallas táctiles
        let sx = 0, sy = 0;
        stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
        stage.addEventListener('pointerup', e => {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
        });
    })();

    /* ─────────────── 11. FAQ, FORMULARIO, WHATSAPP ─────────────── */
    // Enlaces de WhatsApp
    $$('[data-wa]').forEach(a => {
        a.href = waURL(CONFIG.messages[a.dataset.wa] || CONFIG.messages.flotante);
        a.target = '_blank';
        a.rel = 'noopener';
    });

    // Aviso del botón flotante
    const waFloat = $('#wa-float');
    if (waFloat) {
        setTimeout(() => { waFloat.classList.add('show-tip'); setTimeout(() => waFloat.classList.remove('show-tip'), 6000); }, 6500);
    }

    // FAQ con altura animada
    (() => {
        const list = $$('#faq-list details');
        const ease = 'cubic-bezier(.16,1,.3,1)';
        const toggle = (d, open) => {
            const body = $('.faq-body', d);
            if (d._a) d._a.cancel();
            if (open) {
                d.open = true;
                const h = body.offsetHeight;
                d._a = reduced ? null : body.animate({ height: ['0px', h + 'px'] }, { duration: 560, easing: ease });
            } else {
                const h = body.offsetHeight;
                if (reduced) { d.open = false; return; }
                d._a = body.animate({ height: [h + 'px', '0px'] }, { duration: 420, easing: ease });
                d._a.onfinish = () => { d.open = false; d._a = null; };
            }
        };
        list.forEach(d => {
            $('summary', d).addEventListener('click', e => {
                e.preventDefault();
                const willOpen = !d.open;
                if (willOpen) list.forEach(o => { if (o !== d && o.open) toggle(o, false); });
                toggle(d, willOpen);
            });
        });
    })();

    // Formulario -> WhatsApp
    (() => {
        const form = $('#wa-form');
        if (!form) return;
        const name = $('#f-name'), phone = $('#f-phone'), interest = $('#f-interest'), cat = $('#f-cat'), msg = $('#f-msg');
        const fieldCat = $('#field-cat'), btn = $('#f-submit'), note = $('#form-status');
        const NOTE = note.textContent;

        interest.addEventListener('change', () => { fieldCat.hidden = !/participar/i.test(interest.value); scheduleMeasure(); });

        const setErr = (input, text) => {
            const wrap = input.closest('.field'), err = $('.err', wrap);
            wrap.classList.toggle('has-err', !!text);
            if (err) err.textContent = text || '';
            input.setAttribute('aria-invalid', text ? 'true' : 'false');
        };
        [name, interest].forEach(i => i.addEventListener('input', () => setErr(i, '')));
        interest.addEventListener('change', () => setErr(interest, ''));

        form.addEventListener('submit', e => {
            e.preventDefault();
            let ok = true;
            if (name.value.trim().length < 2) { setErr(name, 'Escribe tu nombre para poder saludarte.'); ok = false; }
            if (!interest.value) { setErr(interest, 'Elige una opción para orientarte mejor.'); ok = false; }
            if (!ok) { (name.value.trim().length < 2 ? name : interest).focus(); return; }

            const lines = [
                `Hola, soy ${name.value.trim()}.`,
                `${interest.value}${!fieldCat.hidden && cat.value ? ` (categoría ${cat.value})` : ''}.`
            ];
            if (msg.value.trim()) lines.push('', msg.value.trim());
            if (phone.value.trim()) lines.push('', `Mi teléfono: ${phone.value.trim()}`);
            lines.push('', 'Te escribo desde la página web del certamen.');
            const url = waURL(lines.join('\n'));

            btn.classList.add('is-loading');
            note.textContent = 'Preparando tu mensaje...';
            setTimeout(() => {
                btn.classList.remove('is-loading'); btn.classList.add('is-ok');
                note.textContent = 'Listo. Se abrió WhatsApp con tu mensaje.';
                note.classList.add('is-ok');
                const a = document.createElement('a');
                a.href = url; a.target = '_blank'; a.rel = 'noopener';
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => { btn.classList.remove('is-ok'); note.textContent = NOTE; note.classList.remove('is-ok'); }, 4500);
            }, 800);
        });
    })();

    // Volver arriba y año
    $('#to-top').addEventListener('click', () => scrollTo(0));
    const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

    /* ─────────────── ARRANQUE ─────────────── */
    addEventListener('resize', scheduleMeasure);
    new ResizeObserver(scheduleMeasure).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
    addEventListener('load', measureAll);

    // Heartbeat del polvo del hero y del cierre
    const finalDust = $('#final-dust') ? new Dust($('#final-dust'), { density: 1 / 11000, max: 110, speed: .9 }) : null;
    S.tickers.push((s, now, dt) => {
        if (heroDust.visible) heroDust.step(dt);
        if (finalDust && finalDust.visible) finalDust.step(dt);
    });

    measureAll();
    S.y = S.target = prevY = window.scrollY;
    requestAnimationFrame(frame);
    runLoader().then(() => { setTimeout(measureAll, 200); });
})();

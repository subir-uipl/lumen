import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createGL } from './gl/scene.js';

gsap.registerPlugin(ScrollTrigger);

// ?snap: no smoothing, no curtain, everything already revealed (used for screenshots)
const SNAP = new URLSearchParams(location.search).has('snap');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- smooth scroll ----------
let lenis = null;
if (!SNAP && !REDUCED) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ---------- WebGL photos ----------
const gl = createGL({ canvas: $('#gl'), snap: SNAP });
if (gl) gsap.ticker.add(t => gl.render(t, lenis ? lenis.velocity : 0));

// ---------- split headings into words ----------
function split(el) {
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          w.append(inner);
          frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.matches('figure, img, [data-nosplit]')) {
        walk(child);
      }
    });
  };
  el.classList.add('split');
  walk(el);
}
$$('[data-split]').forEach(split);

// ---------- reveals ----------
function initReveals() {
  if (SNAP) return;
  $$('[data-split]').forEach(el => {
    gsap.from($$('.w > span', el), {
      yPercent: 110, duration: 1.2, stagger: 0.04, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  $$('[data-reveal]').forEach(el => {
    gsap.from(el, {
      y: 40, autoAlpha: 0, duration: 1.1, ease: 'expo.out', delay: Number(el.dataset.reveal) || 0,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });
  // gentle parallax for anything with data-speed (positive = slower than the page)
  $$('[data-speed]').forEach(el => {
    gsap.fromTo(el, { yPercent: -Number(el.dataset.speed) }, {
      yPercent: Number(el.dataset.speed), ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  // statement paragraph: words light up as you read down the page
  $$('[data-statement]').forEach(el => {
    gsap.fromTo($$('.w > span', el), { opacity: 0.14 }, {
      opacity: 1, stagger: 0.05, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 45%', scrub: true }
    });
  });
}

// ---------- horizontal gallery: the section pins and the track slides sideways ----------
function initHorizontal() {
  const wrap = $('[data-hscroll]');
  if (!wrap || matchMedia('(max-width: 767px)').matches) return;
  const track = $('[data-hscroll-track]', wrap);
  const distance = () => track.scrollWidth - window.innerWidth;
  gsap.to(track, {
    x: () => -distance(), ease: 'none',
    scrollTrigger: { trigger: wrap, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: SNAP ? true : 0.6, invalidateOnRefresh: true, anticipatePin: 1 }
  });
  const bar = $('[data-hscroll-bar]', wrap);
  if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top top', end: () => '+=' + distance(), scrub: true } });
}

// ---------- service list: a photo follows the pointer, just to the right of it ----------
function initHoverList() {
  const list = $('[data-hover-list]');
  const float = $('[data-hover-float]');
  if (!list || !float || TOUCH) return;
  const frame = $('[data-hover-frame]', float);
  const imgs = $$('[data-hover-img]', float);
  const OFFSET_X = 64;   // gap between the pointer / the name and the photo's left edge
  gsap.set(float, { xPercent: 0, yPercent: -50 });
  const xTo = gsap.quickTo(float, 'x', { duration: 0.7, ease: 'power3' });
  const yTo = gsap.quickTo(float, 'y', { duration: 0.7, ease: 'power3' });
  const rTo = gsap.quickTo(float, 'rotation', { duration: 0.9, ease: 'power3' });
  let lastX = null, current = -1, shown = false;

  const show = i => {
    if (i === current) return;
    imgs.forEach((img, j) => gsap.to(img, j === i
      ? { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out', overwrite: true }
      : { opacity: 0, scale: 1.1, duration: 0.5, ease: 'power2.out', overwrite: true }));
    current = i;
    if (!shown) {
      shown = true;
      gsap.set(float, { visibility: 'visible' });
      gsap.fromTo(frame, { clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 0.7, ease: 'expo.out', overwrite: true });
    }
  };
  const hide = () => {
    if (!shown) return;
    shown = false;
    current = -1;
    gsap.to(frame, { clipPath: 'inset(50% 0 50% 0)', duration: 0.45, ease: 'power3.in', overwrite: true,
      onComplete: () => { if (!shown) gsap.set(float, { visibility: 'hidden' }); } });
  };

  // keep the photo in the empty band between the hovered row's name and its note,
  // vertically centred on the row, so it never covers the words
  let row = null;
  const target = e => {
    const r = row.getBoundingClientRect();
    const name = $('[data-hover-name]', row).getBoundingClientRect();
    const note = $('[data-hover-note]', row)?.getBoundingClientRect();
    const fw = float.offsetWidth;
    const min = name.right + OFFSET_X;
    const max = (note && note.width ? note.left : window.innerWidth) - fw - OFFSET_X;
    const x = max > min ? gsap.utils.clamp(min, max, e.clientX + OFFSET_X) : Math.min(e.clientX + OFFSET_X, window.innerWidth - fw - 24);
    return { x, y: r.top + r.height / 2 };
  };
  list.addEventListener('pointermove', e => {
    if (!row) return;
    const { x, y } = target(e);
    if (lastX === null) gsap.set(float, { x, y });   // first move: appear in place
    xTo(x); yTo(y);
    rTo(lastX === null ? 0 : gsap.utils.clamp(-4, 4, (e.clientX - lastX) * 0.3));
    lastX = e.clientX;
  });
  $$('[data-hover-index]', list).forEach(li => li.addEventListener('pointerenter', e => {
    row = li;
    show(Number(li.dataset.hoverIndex));
    const { x, y } = target(e);
    xTo(x); yTo(y);
  }));
  list.addEventListener('pointerleave', () => { hide(); lastX = null; row = null; });

  // scrolling moves the rows under a still pointer without firing pointer events: re-check against
  // the pointer's last position, and either follow the row now beneath it or hide
  const pointer = { x: -1, y: -1 };
  window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  window.addEventListener('scroll', () => {
    if (!shown) return;
    const under = document.elementFromPoint(pointer.x, pointer.y)?.closest('[data-hover-index]');
    if (!under || !list.contains(under)) { hide(); lastX = null; row = null; return; }
    if (under !== row) { row = under; show(Number(under.dataset.hoverIndex)); }
    const { x, y } = target({ clientX: pointer.x });
    xTo(x); yTo(y);
  }, { passive: true });
}

// ---------- lightbox for the Recent frames gallery ----------
function initLightbox() {
  const box = $('#lightbox');
  const items = $$('[data-lb-item]');
  if (!box || !items.length) return;
  document.body.append(box);   // out of <main>'s stacking context, so it sits above the site nav
  const bg = $('[data-lb-bg]', box), img = $('[data-lb-img]', box), ui = $('[data-lb-ui]', box);
  const title = $('[data-lb-title]', box), meta = $('[data-lb-meta]', box), counter = $('[data-lb-index]', box);
  const pad = n => String(n).padStart(2, '0');
  let index = -1, busy = false;

  // the thumbnail's own size, centre and tilt (a tilted print's bounding box is larger than the photo)
  const thumbBox = item => {
    const f = $('figure', item), r = f.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: f.offsetWidth, h: f.offsetHeight, tilt: parseFloat(f.closest('[data-tilt]')?.dataset.tilt || 0) };
  };
  // the photo fitted inside the viewport with room for the caption bar
  const fit = item => {
    const thumb = thumbBox(item);
    const ratio = thumb.w / thumb.h;
    const mobile = window.innerWidth < 768;
    const maxW = window.innerWidth - (mobile ? 40 : 240), maxH = window.innerHeight - (mobile ? 220 : 210);
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2 - (mobile ? 20 : 10), width: w, height: h };
  };
  // transform that makes the (target-sized) image sit exactly on the thumbnail
  // (the image scales around its centre, so this lines the centres up and copies the print's tilt)
  const fromThumb = (item, target) => {
    const t = thumbBox(item);
    return {
      x: t.cx - (target.left + target.width / 2), y: t.cy - (target.top + target.height / 2),
      scaleX: t.w / target.width, scaleY: t.h / target.height, rotation: t.tilt
    };
  };
  const setInfo = i => {
    const it = items[i];
    title.textContent = it.dataset.lbTitle;
    meta.textContent = it.dataset.lbMeta;
    counter.textContent = pad(i + 1);
  };
  const setImage = i => {
    const it = items[i], thumbImg = $('img', it), target = fit(it);
    img.src = thumbImg.currentSrc || thumbImg.src;   // already cached; the hi-res copy replaces it once loaded
    img.alt = thumbImg.alt;
    const hi = new Image();
    hi.crossOrigin = 'anonymous';
    hi.onload = () => { if (index === i) img.src = hi.src; };
    hi.src = it.dataset.lbSrc;
    gsap.set(img, { left: target.left, top: target.top, width: target.width, height: target.height });
    return target;
  };

  function open(i) {
    if (busy) return;
    busy = true;
    index = i;
    box.style.display = 'block';
    document.documentElement.classList.add('lb-open');
    lenis?.stop();
    setInfo(i);
    const target = setImage(i);
    gsap.timeline({ onComplete: () => { busy = false; } })
      .fromTo(bg, { opacity: 0 }, { opacity: 0.97, duration: 0.6, ease: 'power2.out' }, 0)
      .fromTo(img, fromThumb(items[i], target), { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 1, ease: 'expo.inOut' }, 0)
      .fromTo(ui, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.45)
      .fromTo(title, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, 0.5);
    $('[data-lb-close]', box).focus({ preventScroll: true });
  }

  function close() {
    if (busy || index < 0) return;
    busy = true;
    const item = items[index], target = fit(item), r = $('figure', item).getBoundingClientRect();
    const onScreen = r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    document.documentElement.classList.remove('lb-open');
    gsap.timeline({ onComplete: () => { box.style.display = 'none'; busy = false; index = -1; lenis?.start(); } })
      .to(ui, { opacity: 0, duration: 0.25 }, 0)
      .to(img, onScreen ? { ...fromThumb(item, target), duration: 0.9, ease: 'expo.inOut' } : { opacity: 0, scale: 0.92, duration: 0.5 }, 0)
      .to(bg, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 0.25)
      .set(img, { opacity: 1, scale: 1 });
  }

  function go(dir) {
    if (busy || index < 0) return;
    busy = true;
    const next = (index + dir + items.length) % items.length;
    gsap.timeline({ onComplete: () => { busy = false; } })
      .to(img, { x: -60 * dir, opacity: 0, duration: 0.35, ease: 'power2.in' })
      .to(title, { yPercent: -100, duration: 0.3, ease: 'power2.in' }, 0)
      .add(() => { index = next; setInfo(next); setImage(next); gsap.set(img, { x: 60 * dir }); })
      .to(img, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out' })
      .fromTo(title, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, '<');
  }

  items.forEach((it, i) => $('[data-lb-open]', it).addEventListener('click', () => open(i)));
  $('[data-lb-close]', box).addEventListener('click', close);
  $('[data-lb-prev]', box).addEventListener('click', () => go(-1));
  $('[data-lb-next]', box).addEventListener('click', () => go(1));
  window.addEventListener('keydown', e => {
    if (index < 0) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  // swipe on touch screens
  let sx = null;
  box.addEventListener('pointerdown', e => { sx = e.clientX; });
  box.addEventListener('pointerup', e => {
    if (sx === null || e.pointerType === 'mouse') return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    sx = null;
  });
  window.addEventListener('resize', () => { if (index >= 0) setImage(index); });
}

// ---------- hand-drawn strokes (e.g. the underline under "keeping.") ----------
function initDraw() {
  $$('[data-draw]').forEach(path => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: SNAP ? 0 : len });
    if (SNAP) return;
    gsap.to(path, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', scrollTrigger: { trigger: path, start: 'top 80%', once: true } });
  });
}

// ---------- highlighter sweeps across key words as they scroll through the view ----------
function initHighlight() {
  $$('[data-hl]').forEach(el => {
    if (SNAP) { el.style.setProperty('--hl', 1); return; }
    gsap.fromTo(el, { '--hl': 0 }, { '--hl': 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 78%', end: 'top 48%', scrub: true } });
  });
}

// ---------- counters ----------
function initCounters() {
  $$('[data-count]').forEach(el => {
    const end = Number(el.dataset.count), o = { v: SNAP ? end : 0 };
    const set = () => (el.textContent = Math.round(o.v));
    set();
    if (SNAP) return;
    gsap.to(o, { v: end, duration: 2, ease: 'power2.out', onUpdate: set, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
}

// ---------- cursor: an inverting lens that replaces the system pointer ----------
function initCursor() {
  const cursor = $('#cursor'), disc = $('#cursorDisc'), label = $('#cursorLabel');
  if (!cursor || TOUCH || !matchMedia('(pointer: fine)').matches) return;
  document.documentElement.classList.add('has-cursor');
  cursor.style.display = 'block';
  gsap.set(cursor, { autoAlpha: 0 });

  // the disc is 140px; these are its scales for each state
  const SIZE = { idle: 0.32, link: 0.55, label: 1, text: 0.12 };
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
  let seen = false, state = 'idle', scale = SIZE.idle, pressed = false;

  const apply = () => gsap.to(disc, { scale: scale * (pressed ? 0.82 : 1), duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
  const setState = (next, text = '') => {
    if (next === state && label.textContent === text) return;
    state = next;
    scale = SIZE[next];
    label.textContent = text;
    gsap.to(label, { opacity: text ? 1 : 0, duration: text ? 0.4 : 0.15, delay: text ? 0.1 : 0, overwrite: true });
    apply();
  };

  window.addEventListener('pointermove', e => {
    if (!seen) { seen = true; gsap.set(cursor, { x: e.clientX, y: e.clientY }); gsap.to(cursor, { autoAlpha: 1, duration: 0.3 }); }
    xTo(e.clientX); yTo(e.clientY);
  });
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-cursor], a, button, summary, label, input, textarea');
    if (!t) return setState('idle');
    if (t.matches('input, textarea')) return setState('text');
    if (t.dataset.cursor === 'lens') return setState('label');   // full-size lens, no text
    if (t.dataset.cursor) return setState('label', t.dataset.cursor);
    setState('link');
  });
  window.addEventListener('pointerdown', () => { pressed = true; apply(); });
  window.addEventListener('pointerup', () => { pressed = false; apply(); });
  document.documentElement.addEventListener('pointerleave', () => gsap.to(cursor, { autoAlpha: 0, duration: 0.3 }));
  document.documentElement.addEventListener('pointerenter', () => seen && gsap.to(cursor, { autoAlpha: 1, duration: 0.3 }));
}

// ---------- local studio time ----------
function initClock() {
  $$('[data-clock]').forEach(el => {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.clock });
    const tick = () => (el.textContent = fmt.format(new Date()));
    tick();
    setInterval(tick, 15000);
  });
}

// ---------- nav: turns into a paper strip once the page has scrolled ----------
function initNav() {
  const nav = $('#nav');
  if (!nav) return;
  const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ---------- mobile menu ----------
function initMenu() {
  const btn = $('#menuBtn'), menu = $('#mobileMenu');
  if (!btn || !menu) return;
  let open = false;
  btn.addEventListener('click', () => {
    open = !open;
    btn.textContent = open ? 'close' : 'menu';
    btn.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    menu.style.pointerEvents = open ? 'auto' : 'none';
    gsap.to(menu, { opacity: open ? 1 : 0, duration: 0.5, ease: 'power2.out' });
    if (open) gsap.from($$('a', menu), { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.8, ease: 'expo.out' });
    open ? lenis?.stop() : lenis?.start();
  });
}

// ---------- contact form ----------
function initForm() {
  const form = $('[data-contact-form]');
  if (!form) return;
  // choice chips behave like radio buttons per group
  $$('[data-chips]', form).forEach(group => {
    group.addEventListener('click', e => {
      const chip = e.target.closest('button');
      if (!chip) return;
      $$('button', group).forEach(b => b.setAttribute('aria-pressed', b === chip));
      const hidden = $(`input[name="${group.dataset.chips}"]`, form);
      if (hidden) hidden.value = chip.textContent.trim();
    });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const done = $('[data-form-done]');
    gsap.to(form, { autoAlpha: 0, y: -20, duration: 0.5, ease: 'power2.in', onComplete: () => {
      form.hidden = true;
      done.hidden = false;
      gsap.from(done, { autoAlpha: 0, y: 30, duration: 0.9, ease: 'expo.out' });
    } });
  });
}

// ---------- page curtain: lift on arrival, drop before leaving ----------
function initCurtain() {
  const curtain = $('#curtain'), page = $('#curtainPage'), shade = $('.curtain-shade', curtain);
  if (SNAP) { curtain.remove(); return; }
  // turn the page: swing it open on its left edge, like the cover of a notebook
  const turnAway = () => gsap.timeline()
    .to(page, { rotateY: -105, duration: 1.25, ease: 'power3.inOut' })
    .to(shade, { opacity: 1, duration: 1.25, ease: 'power2.in' }, 0)
    .set(curtain, { autoAlpha: 0, pointerEvents: 'none' });
  let turning = false;
  try { turning = !!sessionStorage.getItem('lumen-turn'); sessionStorage.removeItem('lumen-turn'); } catch (e) {}
  if (turning) {
    // came from another page: it already shows the closed page, so just turn it
    gsap.delayedCall(0.15, turnAway);
  } else {
    gsap.timeline()
      .fromTo('#curtainWord', { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 0.8, ease: 'expo.out' })
      .to('#curtainLine', { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, '-=0.35')
      .fromTo('#curtainNote', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4')
      .add(turnAway(), '+=0.25');
  }
  // hero copy rises in as the page turns
  gsap.from('[data-hero-in]', { yPercent: 110, duration: 1.4, stagger: 0.08, ease: 'expo.out', delay: turning ? 0.5 : 1.9 });

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.href.startsWith('mailto:') || a.href.startsWith('tel:')) return;
    const samePage = url.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '');
    if (samePage && url.hash) {          // in-page anchor: smooth scroll instead
      e.preventDefault();
      const target = $(url.hash);
      if (target) lenis ? lenis.scrollTo(target, { duration: 1.6 }) : target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    e.preventDefault();
    // the page swings back shut over the content, then we leave
    gsap.timeline()
      .set(curtain, { autoAlpha: 1, pointerEvents: 'auto' })
      .fromTo(page, { rotateY: -105 }, { rotateY: 0, duration: 0.85, ease: 'power3.inOut' })
      .fromTo(shade, { opacity: 1 }, { opacity: 0, duration: 0.85, ease: 'power2.out' }, 0)
      .add(() => { try { sessionStorage.setItem('lumen-turn', '1'); } catch (err) {} location.href = url.href; });
  });
  // coming back via the browser's back button restores a cached page: make sure the curtain is gone
  window.addEventListener('pageshow', e => { if (e.persisted) gsap.set(curtain, { autoAlpha: 0, pointerEvents: 'none' }); });
}

// each feature starts on its own, so a failure in one never stops the others
[initCurtain, initReveals, initHorizontal, initHoverList, initLightbox, initDraw, initHighlight, initCounters, initCursor, initClock, initMenu, initNav, initForm].forEach(init => {
  try { init(); } catch (err) { console.error(`[lumen] ${init.name} failed`, err); }
});

// layout settles once the web fonts arrive
document.fonts.ready.then(() => ScrollTrigger.refresh());
if (location.hash && lenis) setTimeout(() => { const t = $(location.hash); if (t) lenis.scrollTo(t, { immediate: true }); }, 100);

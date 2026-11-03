import { LinearFilter, Mesh, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, ShaderMaterial, TextureLoader, Vector2, Vector4, WebGLRenderer } from 'three';
import { gsap } from 'gsap';
import { vertex, fragment, heroFragment } from './shaders.js';

const loader = new TextureLoader();
loader.setCrossOrigin('anonymous');

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, tex => {
      tex.colorSpace = SRGBColorSpace;
      tex.minFilter = LinearFilter;
      tex.generateMipmaps = false;
      resolve(tex);
    }, undefined, reject);
  });
}
const size = tex => new Vector2(tex.image.naturalWidth || tex.image.width, tex.image.naturalHeight || tex.image.height);

// Draws every [data-gl] photo as a plane that tracks its DOM box (1 unit = 1 CSS pixel).
export function createGL({ canvas, snap }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;   // no WebGL: the plain <img> fallbacks stay visible
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 10, 4000);
  const geometry = new PlaneGeometry(1, 1, 32, 32);
  let vw = 0, vh = 0;

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.position.z = 1200;
    camera.fov = 2 * Math.atan(vh / 2 / camera.position.z) * (180 / Math.PI);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const items = [];
  const time = { value: 0 };
  const SHADOW = 72;   // px of margin around a print for its soft shadow

  // uniforms every plane needs to draw its print: plane size, paper rect, photo rect, shadow strength
  const frameUniforms = () => ({
    uSize: { value: new Vector2(1, 1) }, uFrame: { value: new Vector4() },
    uPhoto: { value: new Vector4() }, uShadow: { value: 0 }
  });

  // a photo inside a .print is drawn together with its paper border and shadow
  function frameOf(el) {
    const box = el.closest('.print') || el;
    const cs = getComputedStyle(box);
    const b = k => parseFloat(cs[`border${k}Width`]) || 0;
    return { box, isPrint: box !== el, l: b('Left'), r: b('Right'), t: b('Top'), btm: b('Bottom') };
  }

  function place(item) {
    const { box, isPrint, l, r: br, t, btm } = item.frame;
    const r = box.getBoundingClientRect();
    item.visible = r.bottom > -150 && r.top < vh + 150 && r.right > -150 && r.left < vw + 150;
    item.mesh.visible = item.visible && item.ready;
    if (!item.visible) return r;
    // use the element's own size (a tilted print's bounding box is larger) and the box centre,
    // then rotate the plane to match (CSS rotates clockwise with y down; three.js counter-clockwise with y up)
    const w = box.offsetWidth, h = box.offsetHeight, m = isPrint ? SHADOW : 0;
    const u = item.uniforms;
    item.mesh.scale.set(w + 2 * m, h + 2 * m, 1);
    item.mesh.position.set(r.left + r.width / 2 - vw / 2, -(r.top + r.height / 2) + vh / 2, 0);
    item.mesh.rotation.z = -item.tilt * Math.PI / 180;
    u.uSize.value.set(w + 2 * m, h + 2 * m);
    u.uFrame.value.set(m, m, m + w, m + h);
    u.uPhoto.value.set(m + l, m + btm, m + w - br, m + h - t);
    u.uPlane.value.set(w - l - br, h - t - btm);
    u.uShadow.value = isPrint ? 0.26 : 0;
    return r;
  }

  // once WebGL draws the print, hide the DOM border and shadow underneath it
  function markReady(item) {
    item.ready = true;
    item.el.classList.add('is-gl');
    if (item.frame.isPrint) item.frame.box.classList.add('is-gl-print');
  }

  function reveal(item) {
    if (item.revealed || !item.ready) return;
    item.revealed = true;
    if (snap) item.uniforms.uReveal.value = 1;
    else gsap.to(item.uniforms.uReveal, { value: 1, duration: item.hero ? 2.2 : 1.6, ease: 'power2.out', delay: item.hero ? 0.4 : 0 });
  }

  // ---------- gallery photos ----------
  function addPhoto(el) {
    const img = el.querySelector('img');
    const uniforms = {
      uTex: { value: null }, uImage: { value: new Vector2(1, 1) }, uPlane: { value: new Vector2(1, 1) },
      uReveal: { value: 0 }, uHover: { value: 0 }, uVelocity: { value: 0 }, uTime: time, ...frameUniforms()
    };
    const mesh = new Mesh(geometry, new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, depthTest: false }));
    mesh.visible = false;
    scene.add(mesh);
    const tilt = parseFloat(el.closest('[data-tilt]')?.dataset.tilt || 0);
    const item = { el, mesh, uniforms, tilt, frame: frameOf(el), ready: false, revealed: false, loading: false, src: img.currentSrc || img.src };
    // planes don't use the depth buffer (their transparent shadow margins would cut into neighbours),
    // so the hovered print is simply drawn last, on top
    el.addEventListener('mouseenter', () => { mesh.renderOrder = 1; gsap.to(uniforms.uHover, { value: 1, duration: 0.8, ease: 'expo.out' }); });
    el.addEventListener('mouseleave', () => gsap.to(uniforms.uHover, { value: 0, duration: 0.8, ease: 'expo.out', onComplete: () => { mesh.renderOrder = 0; } }));
    item.load = async () => {
      item.loading = true;
      try {
        const tex = await loadTexture(item.src);
        uniforms.uTex.value = tex;
        uniforms.uImage.value.copy(size(tex));
        markReady(item);
      } catch { /* keep the <img> fallback */ }
    };
    items.push(item);
  }

  // ---------- hero slideshow ----------
  let hero = null;
  function addHero(el) {
    const srcs = JSON.parse(el.dataset.slides);
    const uniforms = {
      uTexA: { value: null }, uTexB: { value: null },
      uImageA: { value: new Vector2(1, 1) }, uImageB: { value: new Vector2(1, 1) },
      uPlane: { value: new Vector2(1, 1) }, uMouse: { value: new Vector2(0.5, 0.5) },
      uProgress: { value: 0 }, uReveal: { value: 0 }, uLight: { value: 0 }, uTime: time,
      uVelocity: { value: 0 }, uHover: { value: 0 }, ...frameUniforms()
    };
    const mesh = new Mesh(geometry, new ShaderMaterial({ vertexShader: vertex, fragmentShader: heroFragment, uniforms, transparent: true, depthWrite: false, depthTest: false }));
    mesh.visible = false;
    scene.add(mesh);
    const item = { el, mesh, uniforms, hero: true, tilt: 0, frame: frameOf(el), ready: false, revealed: false, loading: true, textures: [], index: 0 };
    hero = item;
    items.push(item);

    const mouse = { x: 0.5, y: 0.5 };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
    });
    el.addEventListener('pointerenter', () => gsap.to(uniforms.uLight, { value: 1, duration: 1 }));
    el.addEventListener('pointerleave', () => gsap.to(uniforms.uLight, { value: 0, duration: 1 }));
    item.tick = () => {
      uniforms.uMouse.value.x += (mouse.x - uniforms.uMouse.value.x) * 0.08;
      uniforms.uMouse.value.y += (mouse.y - uniforms.uMouse.value.y) * 0.08;
    };

    Promise.all(srcs.map(s => loadTexture(s).catch(() => null))).then(texs => {
      item.textures = texs.filter(Boolean);
      if (!item.textures.length) return;
      uniforms.uTexA.value = uniforms.uTexB.value = item.textures[0];
      uniforms.uImageA.value.copy(size(item.textures[0]));
      uniforms.uImageB.value.copy(size(item.textures[0]));
      markReady(item);
      if (!snap && item.textures.length > 1) startSlideshow(item);
    });
  }

  function startSlideshow(item) {
    const u = item.uniforms, counter = document.querySelectorAll('[data-hero-caption]');
    const next = () => {
      const from = item.textures[item.index];
      item.index = (item.index + 1) % item.textures.length;
      const to = item.textures[item.index];
      u.uTexA.value = from; u.uImageA.value.copy(size(from));
      u.uTexB.value = to; u.uImageB.value.copy(size(to));
      u.uProgress.value = 0;
      gsap.to(u.uProgress, { value: 1, duration: 2.2, ease: 'power2.inOut' });
      counter.forEach((c, i) => c.classList.toggle('is-on', i === item.index));
      item.el.dispatchEvent(new CustomEvent('slide', { detail: item.index }));
    };
    gsap.delayedCall(5.5, function loop() { next(); gsap.delayedCall(6, loop); });
  }

  document.querySelectorAll('[data-gl]').forEach(el => (el.dataset.slides ? addHero(el) : addPhoto(el)));

  // ---------- frame ----------
  let velocity = 0, drewLast = true;
  function render(t, scrollVelocity = 0) {
    time.value = t;
    velocity += (scrollVelocity - velocity) * 0.12;
    for (const item of items) {
      const r = place(item);
      // lazy-load textures a screen and a half ahead
      if (!item.loading && r.top < vh * 2.5 && r.bottom > -vh) item.load();
      if (item.visible && r.top < vh * 0.88) reveal(item);
      if (item.uniforms.uVelocity) item.uniforms.uVelocity.value = velocity;
      item.tick?.();
    }
    // nothing on screen (text-only stretches, the footer): skip the draw, after one frame to clear the canvas
    const anyVisible = items.some(i => i.mesh.visible);
    if (anyVisible || drewLast) renderer.render(scene, camera);
    drewLast = anyVisible;
  }

  return { render, hero: () => hero };
}

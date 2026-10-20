(() => {
const MODE = window.SPACE_MODE === "ring" ? "ring" : "wall";
const THREE = window.THREE;
const IMG = "../journey/img/";
// Work shown in the space, in order. Titles must match projects.js.
const PICK = [
  ["False Gods", "false-gods"], ["Oráculo Records", "oraculo"], ["Tristan Bejawn", "tristanbejawn"],
  ["The Monolith Project", "themonolithproject", "themonolithproject-scene-poster.webp"], ["Faih Bitrou", "faih-bitrou"],
  ["VIGOR", "vigorvigorous"], ["boy", "learnwithregrets"], ["Sina Golnoghreh", "sinawings"],
  ["Origins Inconclusive", "originsinconclusive"], ["Matthew Joseph", "matthewjoseph"], ["DJ Lofi", "dj-lofi"],
  ["instinkt lab", "instinktlab"], ["Dais Records", "daisrecords"], ["Nude Club Records", "nudeclubrecords"],
];
const NO_FRAME = ["vigorvigorous.com", "daisrecords.com", "brentfoster.com"];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = () => innerWidth < 761;
const portrait = () => innerWidth / innerHeight < .8;

const all = window.PROJECTS || [];
const items = [];
for (const [t, slug, img] of PICK) {
  const p = all.find(x => x.title === t); if (!p) continue;
  items.push({ p, src: IMG + (img || `${slug}-desktop.webp`), framable: !NO_FRAME.some(h => p.url.includes(h)) });
}
const N = items.length;

/* ---------- renderer, sky, dunes ---------- */
const canvas = $("space");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone() ? 1.6 : 1.75));
const scene = new THREE.Scene();
const HORIZON = new THREE.Color("#ffc9a0");
scene.fog = new THREE.Fog(HORIZON, 26, 150);
const camera = new THREE.PerspectiveCamera(45, 1, .1, 900);

const SUN = new THREE.Vector3(.4, .15, -1).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 uSun; uniform float uTime;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    // noise that repeats every P cells across, so the clouds wrap around the horizon without a seam
    float n(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      float x0 = mod(i.x, P), x1 = mod(i.x + 1., P);
      return mix(mix(h(vec2(x0, i.y)), h(vec2(x1, i.y)), f.x), mix(h(vec2(x0, i.y + 1.)), h(vec2(x1, i.y + 1.)), f.x), f.y); }
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 top = vec3(.27,.31,.86), lilac = vec3(.72,.47,.86), coral = vec3(1.,.55,.46), peach = vec3(1.,.8,.63);
      vec3 c = mix(peach, coral, smoothstep(-.02, .12, y));
      c = mix(c, lilac, smoothstep(.1, .3, y));
      c = mix(c, top, smoothstep(.28, .75, y));
      float s = max(dot(d, uSun), 0.);
      c += vec3(1., .86, .62) * (pow(s, 900.) * 1.6 + pow(s, 60.) * .45 + pow(s, 6.) * .18);
      // long soft clouds
      float az = atan(d.x, -d.z) / 6.2831853 + .5;
      float cl = n(vec2(az * 19. + uTime * .01, y * 22.), 19.) * n(vec2(az * 38. - uTime * .015, y * 37.4), 38.);
      cl = smoothstep(.25, .6, cl) * smoothstep(.05, .2, y) * (1. - smoothstep(.35, .55, y));
      c = mix(c, vec3(1., .9, .86), cl * .35);
      gl_FragColor = vec4(c, 1.);
    }`
}));
scene.add(sky);

// dunes: a wide field, flattened where the work stands
function duneH(x, z) {
  const r = Math.hypot(x, z);
  const big = 1.7 * Math.sin(x * .07 + z * .028) + 1.2 * Math.sin(z * .095 - x * .045 + 1.3) + .55 * Math.sin(x * .2 + z * .15 + .4);
  const flat = MODE === "ring" ? THREE.MathUtils.smoothstep(r, 14, 30) : THREE.MathUtils.smoothstep(Math.hypot(x, z - 2), 10, 28);
  return -1.2 + big * (.25 + .75 * flat) + Math.max(0, r - 60) * .05;
}
{
  const g = new THREE.PlaneGeometry(700, 700, 260, 260); g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, cols = new Float32Array(P.count * 3);
  const low = new THREE.Color("#d9775f"), mid = new THREE.Color("#f2a57d"), high = new THREE.Color("#ffd8b4"), tmp = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), y = duneH(x, z);
    P.setY(i, y);
    const t = clamp((y + 2.6) / 4.4, 0, 1);
    tmp.copy(low).lerp(mid, Math.min(1, t * 1.6)).lerp(high, Math.max(0, t - .55) * 1.6);
    cols[i*3] = tmp.r; cols[i*3+1] = tmp.g; cols[i*3+2] = tmp.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
}
scene.add(new THREE.HemisphereLight("#ffe3d0", "#b8607a", 1.15));
const sunLight = new THREE.DirectionalLight("#fff0dc", 1.6); sunLight.position.copy(SUN).multiplyScalar(50); scene.add(sunLight);

// warm dust drifting in the air
const dust = (() => {
  const n = phone() ? 260 : 520, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i*3] = (Math.random() - .5) * 60; pos[i*3+1] = Math.random() * 14; pos[i*3+2] = (Math.random() - .5) * 60; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff6ea", size: .06, transparent: true, opacity: .8, depthWrite: false }));
  scene.add(pts); return pts;
})();

/* ---------- the work ---------- */
const FW = 3.4, FH = FW / 1.6;
const roundTex = (() => { // rounded corners as an alpha map
  const c = document.createElement("canvas"); c.width = 320; c.height = 200; const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, 320, 200); x.fillStyle = "#fff";
  x.beginPath(); x.roundRect(2, 2, 316, 196, 12); x.fill();
  return new THREE.CanvasTexture(c);
})();
const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.45, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
const frames = [], hitMeshes = [];
const loader = new THREE.TextureLoader();
items.forEach((it, i) => {
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", alphaMap: roundTex, transparent: true, fog: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), mat);
  face.userData.i = i; face.renderOrder = 2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({ color: "#ffe2cf", alphaMap: roundTex, transparent: true, side: THREE.BackSide }));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(FW * 1.9, FH * 2.1), new THREE.MeshBasicMaterial({ map: glowTex, color: "#ffffff", transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.z = -.05; glow.renderOrder = 1;
  grp.add(glow, back, face);
  scene.add(grp);
  frames.push({ grp, face, back, glow, mat, base: new THREE.Vector3(), rot: 0, rise: 0, hover: 0, seed: Math.random() * 10 });
  hitMeshes.push(face);
});

/* ---------- layout ---------- */
let wall = { minX: 0, maxX: 0, minY: 0, maxY: 0, w: 1, h: 1, cy: 5 };
const R = () => portrait() ? 8.5 : 12.5;
function layout() {
  if (MODE === "wall") {
    const cols = portrait() ? 2 : (innerWidth / innerHeight > 1.9 ? 5 : 4), rows = Math.ceil(N / cols);
    const sx = FW + .9, sy = FH + .85;
    wall.cy = Math.max(5, (rows - 1) / 2 * sy + FH / 2 + .9); // the bottom row stands just above the sand
    frames.forEach((f, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const inRow = Math.min(cols, N - r * cols), off = (cols - inRow) / 2;
      const jx = Math.sin(f.seed * 7.1) * .35, jy = Math.cos(f.seed * 3.3) * .28, jz = Math.sin(f.seed * 5.7) * .9;
      f.base.set((c + off - (cols - 1) / 2) * sx + jx, wall.cy + ((rows - 1) / 2 - r) * sy + jy, jz);
      f.rot = Math.sin(f.seed * 2.3) * .07;
    });
    wall.w = cols * sx; wall.h = rows * sy;
    wall.minX = -wall.w / 2 + FW / 2; wall.maxX = -wall.minX; wall.minY = wall.cy - wall.h / 2 + FH / 2; wall.maxY = wall.cy + wall.h / 2 - FH / 2;
  } else {
    const r = R();
    frames.forEach((f, i) => {
      const a = i / N * Math.PI * 2;
      f.angle = a;
      f.base.set(Math.sin(a) * r, 3.3 + Math.sin(f.seed * 4.1) * .18, -Math.cos(a) * r);
    });
  }
}

/* ---------- camera state ---------- */
const S = { entered: 0, enterT: 0, open: -1 };
// wall
const W = { x: 0, y: 5, d: 30, tx: 0, ty: 5, td: 30, vx: 0, vy: 0 };
const fitDist = () => {
  const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(wall.w / (2 * v * camera.aspect), wall.h / (2 * v)) * 1.12;
};
// ring
const G = { yaw: 0, tyaw: 0, vyaw: 0, fov: 62, tfov: 62, pitch: 0, tpitch: 0, fly: 0 };
const baseFov = () => portrait() ? 74 : 62;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = MODE === "wall" ? (portrait() ? 55 : 42) : camera.fov;
  camera.updateProjectionMatrix();
  layout();
  if (MODE === "wall" && S.entered && S.open < 0) W.td = fitDist();
  if (MODE === "ring" && S.open < 0) G.tfov = baseFov();
}
addEventListener("resize", resize);

/* ---------- intro: the name first, then the work rises ---------- */
const h1 = $("name");
h1.innerHTML = [...h1.textContent].map((c, i) => c === " " ? " " : `<span class="ch" style="transition-delay:${i * 45}ms">${esc(c)}</span>`).join("");
function enter() {
  if (S.entered) return;
  S.entered = 1; S.enterT = performance.now();
  document.body.classList.add("entered");
  if (MODE === "wall") { W.tx = 0; W.ty = wall.cy; W.td = fitDist(); }
  frames.forEach((f, i) => f.delay = (MODE === "wall" ? i * 70 : i * 60) + 300);
}
$("enter").addEventListener("click", enter);
addEventListener("wheel", e => { if (!S.entered && e.deltaY > 0) enter(); }, { passive: true });
let introTouch = null;
addEventListener("touchstart", e => { if (!S.entered) introTouch = e.touches[0].clientY; }, { passive: true });
addEventListener("touchmove", e => { if (!S.entered && introTouch !== null && introTouch - e.touches[0].clientY > 40) { introTouch = null; enter(); } }, { passive: true });
$("home").addEventListener("click", e => { e.preventDefault(); closePanel(); if (MODE === "wall") { W.tx = 0; W.ty = wall.cy; W.td = fitDist(); } else { G.tfov = baseFov(); G.tpitch = 0; } });

/* ---------- pointer: drag to move, click a site ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let drag = null, hoverI = -1, pinch = null;
const pointers = new Map();
const tip = $("tip");
function pick(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hitMeshes, false)[0];
  return hit ? hit.object.userData.i : -1;
}
canvas.addEventListener("pointerdown", e => {
  if (!S.entered) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), td: W.td, fov: G.tfov }; drag = null; return; }
  drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now() };
  W.vx = W.vy = 0; G.vyaw = 0;
  document.body.classList.add("grabbing");
});
canvas.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (MODE === "wall") W.td = clamp(pinch.td * pinch.d / d, 4, fitDist() * 1.3); else G.tfov = clamp(pinch.fov * pinch.d / d, 30, 85);
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    drag.lx = e.clientX; drag.ly = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6 && S.open >= 0) closePanel(true);
    if (MODE === "wall") {
      const wpp = 2 * W.d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
      W.tx -= dx * wpp; W.ty += dy * wpp; W.vx = -dx * wpp; W.vy = dy * wpp;
    } else {
      const k = THREE.MathUtils.degToRad(camera.fov) / innerHeight;
      G.tyaw -= dx * k; G.vyaw = -dx * k; G.tpitch = clamp(G.tpitch + dy * k * .4, -.18, .18);
    }
    return;
  }
  if (e.pointerType === "mouse") { hoverAt = { x: e.clientX, y: e.clientY }; hover(); }
}, { passive: true });
// the space keeps moving under a still mouse, so the hover is checked again each frame
let hoverAt = null;
function hover() {
  if (!hoverAt || drag || !S.entered) return;
  const i = pick(hoverAt.x, hoverAt.y);
  if (i !== hoverI) {
    hoverI = i;
    if (i >= 0) { tip.innerHTML = `${esc(items[i].p.title)}<small>${esc(items[i].p.client)}</small>`; }
    tip.classList.toggle("on", i >= 0 && !phone());
    document.body.classList.toggle("point", i >= 0);
  }
  if (i >= 0) tip.style.left = hoverAt.x + "px", tip.style.top = hoverAt.y + "px";
}
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  document.body.classList.remove("grabbing");
  if (!drag) return;
  const d = drag; drag = null;
  if (d.moved < 7) { const i = pick(e.clientX, e.clientY); if (i >= 0) openPanel(i); else if (S.open >= 0) closePanel(); }
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", () => { tip.classList.remove("on"); document.body.classList.remove("point"); hoverI = -1; hoverAt = null; });
addEventListener("wheel", e => {
  if (!S.entered || document.body.classList.contains("listing")) return;
  if (MODE === "wall") {
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      // zoom toward the pointer
      const before = W.td;
      W.td = clamp(W.td * Math.exp(e.deltaY * .0012), 4, fitDist() * 1.3);
      const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const px = (e.clientX / innerWidth - .5) * 2, py = -(e.clientY / innerHeight - .5) * 2;
      W.tx += px * v * camera.aspect * (before - W.td); W.ty += py * v * (before - W.td);
    } else { W.tx += e.deltaX * .01; }
    if (S.open >= 0) closePanel(true);
  } else {
    G.tyaw += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * .0016;
    if (S.open >= 0) closePanel(true);
  }
}, { passive: true });
addEventListener("keydown", e => {
  if (e.key === "Escape") { closeLive(); closePanel(); document.body.classList.remove("listing"); return; }
  if (!S.entered && (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ")) { enter(); return; }
  if (S.open >= 0 && e.key === "ArrowRight") openPanel((S.open + 1) % N);
  else if (S.open >= 0 && e.key === "ArrowLeft") openPanel((S.open - 1 + N) % N);
  else if (MODE === "ring" && e.key === "ArrowRight") G.tyaw += Math.PI * 2 / N;
  else if (MODE === "ring" && e.key === "ArrowLeft") G.tyaw -= Math.PI * 2 / N;
});

/* ---------- the info card ---------- */
function openPanel(i) {
  S.open = i;
  const { p, framable } = items[i];
  $("pNum").textContent = `${pad(i + 1)} / ${pad(N)}`;
  $("pTitle").textContent = p.title;
  $("pClient").textContent = p.client;
  $("pTags").innerHTML = p.medium.split(",").map(m => `<li>${esc(m.trim())}</li>`).join("");
  $("pSum").textContent = p.summary;
  $("pInside").style.display = framable ? "" : "none";
  $("pVisit").href = p.url;
  $("pVisit").className = framable ? "btn ghost" : "btn solid";
  document.body.classList.add("open");
  tip.classList.remove("on");
  const f = frames[i];
  if (MODE === "wall") {
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    if (phone()) {
      W.td = (FW * 1.12) / (2 * v * camera.aspect);
      W.tx = f.base.x; W.ty = f.base.y - W.td * v * .42;
    } else {
      W.td = (FW * 2.3) / (2 * v * camera.aspect);
      W.tx = f.base.x + W.td * v * camera.aspect * .32; W.ty = f.base.y;
    }
  } else {
    const fovFit = phone() ? 46 : 36;
    G.tfov = fovFit;
    const off = phone() ? 0 : THREE.MathUtils.degToRad(fovFit) * camera.aspect * .2;
    let a = f.angle + off;
    G.tyaw = G.yaw + Math.atan2(Math.sin(a - G.yaw), Math.cos(a - G.yaw));
    G.tpitch = phone() ? -.13 : 0;
  }
}
function closePanel(keepView) {
  if (S.open < 0) return;
  S.open = -1; document.body.classList.remove("open");
  if (keepView) return;
  if (MODE === "wall") W.td = Math.min(fitDist(), W.td * 2.2);
  else { G.tfov = baseFov(); G.tpitch = 0; }
}
$("pClose").onclick = () => closePanel();
$("pPrev").onclick = () => openPanel((S.open - 1 + N) % N);
$("pNext").onclick = () => openPanel((S.open + 1) % N);
$("pInside").onclick = () => {
  const it = items[S.open];
  $("frame").src = it.p.url; $("ext").href = it.p.url;
  $("live").classList.add("open");
};
function closeLive() { if (!$("live").classList.contains("open")) return; $("live").classList.remove("open"); setTimeout(() => ($("frame").src = "about:blank"), 400); }
$("back").onclick = closeLive;

/* list of all work */
$("listItems").innerHTML = items.map((it, i) => `<li><button data-i="${i}"><span>${pad(i + 1)}</span><b>${esc(it.p.title)}</b></button></li>`).join("");
$("listItems").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; document.body.classList.remove("listing"); enter(); setTimeout(() => openPanel(+b.dataset.i), S.entered ? 0 : 900); });
$("openList").onclick = () => document.body.classList.add("listing");
$("closeList").onclick = () => document.body.classList.remove("listing");
$("list").addEventListener("click", e => { if (e.target === $("list")) document.body.classList.remove("listing"); });

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const look = new THREE.Vector3(), tmpV = new THREE.Vector3();
let mx = 0, my = 0, smx = 0, smy = 0;
addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
function tick() {
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime, now = performance.now();
  const k = reduce ? 1 : 1 - Math.exp(-dt * 5);
  smx += (mx - smx) * (1 - Math.exp(-dt * 2)); smy += (my - smy) * (1 - Math.exp(-dt * 2));
  sky.material.uniforms.uTime.value = t;
  dust.rotation.y = t * .01; dust.position.y = Math.sin(t * .2) * .3;

  frames.forEach((f, i) => {
    if (S.entered) { const p = (now - S.enterT - (f.delay || 0)) / 1400; f.rise = reduce ? 1 : clamp(p, 0, 1); }
    const r = ease(f.rise);
    const isHover = i === hoverI && !drag ? 1 : 0;
    f.hover += (isHover - f.hover) * (1 - Math.exp(-dt * 10));
    const bob = Math.sin(t * .7 + f.seed * 3) * .06;
    f.grp.position.set(f.base.x, f.base.y + bob - (1 - r) * (MODE === "wall" ? 9 : 6), f.base.z + f.hover * .35);
    if (MODE === "wall") f.grp.rotation.set(0, f.rot, 0);
    else { f.grp.lookAt(0, f.grp.position.y, 0); }
    const s = (1 + f.hover * .05) * (.7 + .3 * r);
    f.grp.scale.setScalar(s);
    // with a card open, the other sites step back
    const dimT = S.open >= 0 && S.open !== i ? .28 : 1;
    f.dim = (f.dim ?? 1) + (dimT - (f.dim ?? 1)) * (1 - Math.exp(-dt * 6));
    f.mat.opacity = f.dim; f.back.material.opacity = f.dim;
    f.glow.material.opacity = (.35 + f.hover * .4 + (S.open === i ? .35 : 0)) * r * f.dim;
  });

  if (MODE === "wall") {
    if (!drag) { W.tx += W.vx; W.ty += W.vy; W.vx *= .9; W.vy *= .9; }
    if (S.entered) {
      const pad_ = S.open >= 0 ? 4 : 1.5;
      W.tx = clamp(W.tx, wall.minX - pad_, wall.maxX + pad_); W.ty = clamp(W.ty, wall.minY - pad_, wall.maxY + pad_);
    }
    W.x += (W.tx - W.x) * k; W.y += (W.ty - W.y) * k; W.d += (W.td - W.d) * k;
    const intro = S.entered ? 0 : 1;
    camera.position.set(W.x + smx * .6, W.y - .3 + 1.4 * intro - smy * .4, W.d);
    look.set(W.x, W.y + 2.6 * intro, 0);
    camera.lookAt(look);
  } else {
    if (S.entered) G.fly = clamp((now - S.enterT) / 2600, 0, 1);
    const fl = reduce ? (S.entered ? 1 : 0) : ease(G.fly);
    if (!drag) { G.tyaw += G.vyaw; G.vyaw *= .92; if (S.open < 0 && S.entered && G.fly >= 1 && Math.abs(G.vyaw) < 1e-4) G.tyaw += dt * .035; }
    G.yaw += (G.tyaw - G.yaw) * k; G.fov += (G.tfov - G.fov) * k; G.pitch += (G.tpitch - G.pitch) * k;
    camera.fov = lerp(48, G.fov, fl); camera.updateProjectionMatrix();
    const out = tmpV.set(0, 7.5, 36);
    camera.position.set(lerp(out.x, 0, fl) + smx * .3 * (1 - fl), lerp(out.y, 3.3, fl), lerp(out.z, 0, fl));
    const ahead = new THREE.Vector3(Math.sin(G.yaw), Math.sin(G.pitch - smy * .04 * fl), -Math.cos(G.yaw)).multiplyScalar(10).add(camera.position);
    look.set(0, 4.2, 0).lerp(ahead, fl);
    camera.lookAt(look);
  }
  hover();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------- start ---------- */
resize();
if (MODE === "wall") { W.x = W.tx = 0; W.y = W.ty = wall.cy + 3; W.d = W.td = fitDist() * 1.9; }
else { G.yaw = G.tyaw = 0; G.fov = G.tfov = baseFov(); }
let loaded = 0;
const jobs = items.map((it, i) => new Promise(res => loader.load(it.src, tex => {
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const f = frames[i]; f.mat.map = tex; f.mat.needsUpdate = true;
  // the frame's light takes the colour of the site
  const c = document.createElement("canvas"); c.width = c.height = 4; const x = c.getContext("2d");
  x.drawImage(tex.image, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
  for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k+1]; b += d[k+2]; }
  const n = d.length / 4, col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.4 + .15), .62);
  f.glow.material.color.copy(col);
  loaded++; $("ln").textContent = String(Math.round(loaded / N * 100)).padStart(3, "0"); res();
}, undefined, () => { loaded++; res(); })));
requestAnimationFrame(tick);
Promise.all(jobs).then(() => {
  $("loader").classList.add("done");
  setTimeout(() => document.body.classList.add("ready"), 300);
  if (location.hash === "#work") setTimeout(enter, 900);
});
})();

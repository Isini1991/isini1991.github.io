import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
(() => {
const IMG = "../journey/img/";
// Work in the ring, in order. Titles must match projects.js.
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
const sstep = THREE.MathUtils.smoothstep;
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

/* ---------- renderer ---------- */
const canvas = $("space");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone() ? 1.5 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; // shadows are redrawn every few frames, not every frame
const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#ffc9a0", 26, 150);
const camera = new THREE.PerspectiveCamera(62, 1, .1, 900);

/* ---------- time of day: the sun's height sets every colour ---------- */
const COLS = ["top", "mid", "low", "hor", "fog", "sand", "hemiS", "hemiG", "sun"];
const KEYS = [
  { el: -.3, top: "#050927", mid: "#1b174c", low: "#36296a", hor: "#4a3a7c", fog: "#2a2355", sand: "#5d5cab", hemiS: "#8592ee", hemiG: "#2a1d4a", hemi: .8, sun: "#a9baff", sunI: .5, stars: 1 },
  { el: -.03, top: "#1f2a86", mid: "#7a4aa8", low: "#e0607a", hor: "#ff9070", fog: "#d98585", sand: "#e8a0aa", hemiS: "#ffc0c8", hemiG: "#7a3a6a", hemi: .95, sun: "#ffb08a", sunI: 1, stars: .3 },
  { el: .15, top: "#4550db", mid: "#b878db", low: "#ff8c75", hor: "#ffcca0", fog: "#ffc9a0", sand: "#ffffff", hemiS: "#ffe3d0", hemiG: "#b8607a", hemi: 1.15, sun: "#fff0dc", sunI: 1.6, stars: 0 },
  { el: .55, top: "#2f74ff", mid: "#84bdff", low: "#cbe4ff", hor: "#fff0dc", fog: "#ffe8d2", sand: "#fff4ea", hemiS: "#fff6ec", hemiG: "#d29a7a", hemi: 1.35, sun: "#fffaf0", sunI: 1.9, stars: 0 },
].map(k => { const o = { ...k }; COLS.forEach(n => (o[n] = new THREE.Color(k[n]))); return o; });
const SKY = { hemi: 1, sunI: 1, stars: 0 };
COLS.forEach(n => (SKY[n] = new THREE.Color()));
function sampleSky(el) {
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) { a = KEYS[i]; b = KEYS[i + 1]; if (el <= b.el) break; }
  const t = clamp((el - a.el) / (b.el - a.el), 0, 1);
  COLS.forEach(n => SKY[n].copy(a[n]).lerp(b[n], t));
  SKY.hemi = lerp(a.hemi, b.hemi, t); SKY.sunI = lerp(a.sunI, b.sunI, t); SKY.stars = lerp(a.stars, b.stars, t);
}
const EL_MIN = -.32, EL_MAX = .55;
const SUN = { az: .38, el: .15, taz: .38, tel: .15, touched: 0, x: -1, y: -1, on: 0 };
const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
const dirOf = (az, el, v) => v.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
let night = 0;

const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: sunDir }, uMoon: { value: moonDir }, uTime: { value: 0 }, uNight: { value: 0 }, uStars: { value: 0 },
    uTop: { value: SKY.top }, uMid: { value: SKY.mid }, uLow: { value: SKY.low }, uHor: { value: SKY.hor }, uSunCol: { value: SKY.sun } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    varying vec3 vDir; uniform vec3 uSun, uMoon, uTop, uMid, uLow, uHor, uSunCol; uniform float uTime, uNight, uStars;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    // noise that repeats every P cells across, so the clouds wrap around the horizon without a seam
    float n(vec2 p, float P){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      float x0 = mod(i.x, P), x1 = mod(i.x + 1., P);
      return mix(mix(h(vec2(x0, i.y)), h(vec2(x1, i.y)), f.x), mix(h(vec2(x0, i.y + 1.)), h(vec2(x1, i.y + 1.)), f.x), f.y); }
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 c = mix(uHor, uLow, smoothstep(-.02, .12, y));
      c = mix(c, uMid, smoothstep(.1, .3, y));
      c = mix(c, uTop, smoothstep(.28, .75, y));
      float s = max(dot(d, uSun), 0.), up = smoothstep(-.1, .02, uSun.y);
      c += uSunCol * (pow(s, 1400.) * 1.5 * up + pow(s, 90.) * .3 * up + pow(s, 6.) * .2 * (.25 + .75 * up));
      // the moon, opposite the sun
      float m = max(dot(d, uMoon), 0.);
      c += vec3(.95, .96, 1.) * (smoothstep(.99955, .9997, m) * 1.1 + pow(m, 90.) * .22) * uNight;
      // stars
      if (uStars > .001 && y > 0.) {
        vec3 p = d * 260., ci = floor(p); float r = h3(ci);
        if (r > .992) {
          float b = smoothstep(.5, 0., length(fract(p) - .5)) * (.55 + .45 * sin(uTime * (1.2 + r * 40.) + r * 90.));
          c += vec3(1., .95, .9) * b * uStars * smoothstep(0., .12, y) * (.3 + (r - .992) / .008) * 1.6;
        }
      }
      // long soft clouds
      float az = atan(d.x, -d.z) / 6.2831853 + .5;
      float cl = n(vec2(az * 19. + uTime * .01, y * 22.), 19.) * n(vec2(az * 38. - uTime * .015, y * 37.4), 38.);
      cl = smoothstep(.25, .6, cl) * smoothstep(.05, .2, y) * (1. - smoothstep(.35, .55, y));
      c = mix(c, mix(vec3(1., .9, .86), uMid * 1.15, uNight * .85), cl * .35);
      gl_FragColor = vec4(pow(max(c, 0.), vec3(2.2)), 1.);
    }`
}));
scene.add(sky);

/* ---------- sand: dunes that keep trails and writing ---------- */
function duneH(x, z) {
  const r = Math.hypot(x, z);
  const big = 1.7 * Math.sin(x * .07 + z * .028) + 1.2 * Math.sin(z * .095 - x * .045 + 1.3) + .55 * Math.sin(x * .2 + z * .15 + .4);
  return -1.2 + big * (.25 + .75 * sstep(r, 14, 30)) + Math.max(0, r - 60) * .05;
}
const TW = 48, TR = 768;           // trails cover 48 x 48 m around the centre
const WX0 = -8, WZ0 = -12, WS = 16; // the writing covers 16 x 16 m in front of the centre
const trailCv = document.createElement("canvas"); trailCv.width = trailCv.height = TR;
const tctx = trailCv.getContext("2d"); tctx.fillStyle = "#000"; tctx.fillRect(0, 0, TR, TR);
const trailTex = new THREE.CanvasTexture(trailCv); trailTex.flipY = false;
const writeCv = document.createElement("canvas"); writeCv.width = writeCv.height = 1024;
const wctx = writeCv.getContext("2d");
const writeTex = new THREE.CanvasTexture(writeCv); writeTex.flipY = false; writeTex.anisotropy = 8;
const sandMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const writeAmt = { value: 0 }; // the writing only shows in Services
const sandDay = { value: 1 };
sandMat.onBeforeCompile = sh => {
  sh.uniforms.uTrail = { value: trailTex }; sh.uniforms.uWrite = { value: writeTex }; sh.uniforms.uWriteAmt = writeAmt;
  sh.uniforms.uDay = sandDay;
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.)).xyz;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 vWP; uniform sampler2D uTrail, uWrite; uniform float uWriteAmt, uDay;
      float sh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(sh1(i), sh1(i+vec2(1,0)), f.x), mix(sh1(i+vec2(0,1)), sh1(i+vec2(1,1)), f.x), f.y); }
      // wind ripples: long wavy ridges across the sand
      float rip(vec2 p){ float u = p.x * .8 + p.y * .45 + 1.6 * sn(p * .12) + .5 * sin(p.y * .21); return sin(u * 5.2) * (.5 + .5 * sn(p * .35)); }`)
    .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      float rd = length(vWP - cameraPosition), ra = .11 * (1. - smoothstep(12., 48., rd));
      if (ra > .001) {
        float h0 = rip(vWP.xz), hx = rip(vWP.xz + vec2(.04, 0.)), hz = rip(vWP.xz + vec2(0., .04));
        normal = normalize(normal + (viewMatrix * vec4(-(hx - h0) / .04 * ra, 0., -(hz - h0) / .04 * ra, 0.)).xyz);
      }`)
    .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      vec2 cell = floor(vWP.xz * 34.); float sr = sh1(cell);
      float glint = step(.9985, sr) * (1. - smoothstep(2., 14., rd)) * max(0., sin(dot(cameraPosition.xz, vec2(2.1, 1.7)) * 1.5 + sr * 400.));
      totalEmissiveRadiance += vec3(1., .9, .75) * glint * glint * 1.3 * uDay;`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= .95 + .05 * rip(vWP.xz) + .06 * (sn(vWP.xz * .05) - .5);
      vec2 vW = vWP.xz;
      vec2 tu = vW / ${TW.toFixed(1)} + .5, wu = (vW - vec2(${WX0.toFixed(1)}, ${WZ0.toFixed(1)})) / ${WS.toFixed(1)};
      vec2 g = vec2(0.);
      if (tu.x > 0. && tu.x < 1. && tu.y > 0. && tu.y < 1.) g = max(g, texture2D(uTrail, tu).rg);
      if (wu.x > 0. && wu.x < 1. && wu.y > 0. && wu.y < 1.) g = max(g, texture2D(uWrite, wu).rg * uWriteAmt);
      diffuseColor.rgb *= 1. - g.r * .4;
      diffuseColor.rgb += g.g * .07 * (1. - g.r);`);
};
{
  const g = new THREE.PlaneGeometry(700, 700, 200, 200); g.rotateX(-Math.PI / 2);
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
  const sand = new THREE.Mesh(g, sandMat); sand.receiveShadow = true;
  scene.add(sand);
}
const hemi = new THREE.HemisphereLight("#ffe3d0", "#b8607a", 1.15); scene.add(hemi);
const sunLight = new THREE.DirectionalLight("#fff0dc", 1.6); scene.add(sunLight);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(phone() ? 1024 : 2048, phone() ? 1024 : 2048);
Object.assign(sunLight.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 170 });
sunLight.shadow.bias = -.0004; sunLight.shadow.normalBias = .05;

// the services, written in the sand in front of the centre
const WRITE = ["Art direction", "Web design", "Creative code", "Shops for makers", "Archives & CMS"];
function drawWriting() {
  const c = wctx, px = 1024 / WS, center = phone();
  c.globalCompositeOperation = "source-over"; c.fillStyle = "#000"; c.fillRect(0, 0, 1024, 1024);
  c.globalCompositeOperation = "lighten"; c.textBaseline = "middle"; c.textAlign = center ? "center" : "left";
  const x = ((center ? 0 : -4.6) - WX0) * px;
  WRITE.forEach((w, i) => {
    const y = (-9.6 + i * (center ? 1.25 : 1.55) - WZ0) * px;
    c.font = `600 ${center ? 62 : 88}px Caveat, "Segoe Print", cursive`;
    c.lineJoin = "round"; c.strokeStyle = "rgb(0,255,0)"; c.lineWidth = 12; c.strokeText(w, x, y);
    c.fillStyle = "rgb(255,0,0)"; c.fillText(w, x, y);
  });
  writeTex.needsUpdate = true;
}
(document.fonts ? document.fonts.load('600 88px "Caveat"').catch(() => {}) : Promise.resolve()).then(drawWriting);

const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.45, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();

/* ---------- wind: dust in the air and sand blowing low ---------- */
let gust = 0, wind = 1;
const dust = (() => {
  const n = phone() ? 260 : 520, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i*3] = (Math.random() - .5) * 60; pos[i*3+1] = Math.random() * 14; pos[i*3+2] = (Math.random() - .5) * 60; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff6ea", map: glowTex, size: .1, transparent: true, opacity: .8, depthWrite: false }));
  scene.add(pts); return pts;
})();
const drift = (() => {
  const n = phone() ? 180 : 380, pos = new Float32Array(n * 3), hgt = new Float32Array(n), spd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i*3] = (Math.random() - .5) * 60; pos[i*3+2] = (Math.random() - .5) * 60; hgt[i] = Math.random() * .7; spd[i] = .6 + Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffe2c4", map: glowTex, size: .08, transparent: true, opacity: .4, depthWrite: false }));
  pts.userData = { hgt, spd }; scene.add(pts); return pts;
})();
function blow(dt, t) {
  wind = 1 + .6 * Math.sin(t * .21) * Math.sin(t * .07 + 1);
  const v = (wind + gust * 7) * dt;
  for (const set of [dust, drift]) {
    const P = set.geometry.attributes.position, low = set === drift, { hgt, spd } = set.userData;
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i) + v * (low ? spd[i] * 1.6 : .35), z = P.getZ(i);
      if (x > 30) x -= 60;
      P.setX(i, x);
      if (low) P.setY(i, duneH(x, z) + hgt[i] + Math.sin(t * 2 + i) * .05 + gust * .3 * hgt[i]);
    }
    P.needsUpdate = true;
  }
  drift.material.opacity = .3 + gust * .5;
}

/* ---------- a campfire on a dune, where contact lives ---------- */
const camp = new THREE.Vector3(7.5, 0, 24); camp.y = duneH(camp.x, camp.z);

const fire = (() => {
  const grp = new THREE.Group(); grp.position.copy(camp);
  const wood = new THREE.MeshLambertMaterial({ color: "#6e3d2b" }), stone = new THREE.MeshLambertMaterial({ color: "#c08a7c" });
  for (let i = 0; i < 4; i++) { // logs leaning together
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 1.1, 7), wood);
    const a = i / 4 * Math.PI * 2; l.position.set(Math.cos(a) * .22, .38, Math.sin(a) * .22); l.rotation.set(Math.sin(a) * .55, 0, -Math.cos(a) * .55); grp.add(l);
  }
  for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(.15 + Math.random() * .06), stone); const a = i / 10 * Math.PI * 2; s.position.set(Math.cos(a) * .72, .05, Math.sin(a) * .72); grp.add(s); }
  for (const [x, z, r] of [[-1.7, -.6, .4], [1.5, -1.1, -.5]]) { const seat = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, 1.7, 9), wood); seat.position.set(x, .18, z); seat.rotation.set(0, r, Math.PI / 2); grp.add(seat); }
  const flames = [["#ffcf6a", .9, 1.5], ["#ff8a3a", 1.4, 2.1], ["#ff5a3a", 2.4, 3.2]].map(([c, w, h]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.userData = { w, h }; s.position.y = .7; grp.add(s); return s;
  });
  const n = 50, pos = new Float32Array(n * 3), life = new Float32Array(n);
  for (let i = 0; i < n; i++) life[i] = Math.random();
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ffc070", map: glowTex, size: .16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(sparks);
  const light = new THREE.PointLight("#ff9a4a", 3, 16, 1.6); light.position.y = 1; grp.add(light);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .8; hit.userData.fire = 1; grp.add(hit);
  grp.traverse(o => { if (o.isMesh && o !== hit) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(grp);
  return { grp, flames, sparks, life, light, hit };
})();
function burn(dt, t) {
  fire.flames.forEach((s, i) => {
    const f = 1 + Math.sin(t * (9 + i * 3)) * .08 + Math.sin(t * (23 + i * 5)) * .05;
    s.scale.set(s.userData.w * f, s.userData.h * (2 - f), 1); s.position.y = .55 + s.userData.h * .25;
    s.material.opacity = .55 + night * .35;
  });
  fire.light.intensity = (2.4 + Math.sin(t * 13) * .3 + Math.sin(t * 31) * .2) * (.6 + night * 1.2);
  const P = fire.sparks.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) {
    fire.life[i] += dt * (.35 + (i % 5) * .08);
    if (fire.life[i] > 1) fire.life[i] -= 1;
    const l = fire.life[i];
    P.setXYZ(i, Math.sin(i * 7.3 + t) * .25 * l + Math.sin(i) * .15 + gust * l * 1.2, .5 + l * 2.3, Math.cos(i * 3.1 + t) * .25 * l);
  }
  P.needsUpdate = true;
}

/* ---------- the land around: far mountains, rocks, dry grass, birds ---------- */
// whole-number frequencies only, so the range closes up seamlessly all the way round
const ridge = (a, seed) => { let v = 0, amp = 1; for (let o = 0, f = 3; o < 5; o++, f *= 2) { v += amp * Math.abs(Math.sin(a * f + seed * (o + 1) * 1.7 + Math.sin(a * (f / 3 + 1) + seed) * 1.2)); amp *= .5; } return v / 1.9; };
const mountains = [[230, 22, 1.3, .55], [320, 38, 4.1, .3]].map(([r, h, seed, mixv]) => {
  const n = 360, pos = new Float32Array((n + 1) * 6), tt = new Float32Array((n + 1) * 2), idx = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, x = Math.sin(a) * r, z = -Math.cos(a) * r, top = -4 + h * (.25 + .75 * ridge(a, seed));
    pos.set([x, -8, z, x, top, z], i * 6); tt.set([0, 1], i * 2);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("t", new THREE.BufferAttribute(tt, 1)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.DoubleSide, fog: false, uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } }, // uBot is the fog colour, so the foot melts into the haze
    vertexShader: `attribute float t; varying float vT; void main(){ vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uTop, uBot; varying float vT; void main(){ gl_FragColor = vec4(mix(uBot, pow(uTop, vec3(2.2)), smoothstep(.0, .55, vT)), 1.); }` }));
  m.userData.mix = mixv; m.renderOrder = -1; scene.add(m); return m;
});
const tintMountains = () => mountains.forEach(m => {
  const k = m.userData.mix; // the far range melts into the sky, the near one is darker
  m.material.uniforms.uTop.value.copy(SKY.hor).lerp(SKY.mid, .55 - k * .5).multiplyScalar(1 - k * .35);
  m.material.uniforms.uBot.value.copy(SKY.fog);
});
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
{
  const rockMat = new THREE.MeshStandardMaterial({ color: "#b0705f", roughness: .95, flatShading: true });
  for (let c = 0; c < 46; c++) {
    const a = rnd() * Math.PI * 2, r = 17 + Math.pow(rnd(), 1.6) * 95, cx = Math.sin(a) * r, cz = -Math.cos(a) * r;
    if (Math.hypot(cx - 7.5, cz - 24) < 6) continue; // keep the campfire clear
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const f = .75 + rnd() * .45; P.setXYZ(i, P.getX(i) * f, P.getY(i) * f, P.getZ(i) * f); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat), sc = (.35 + rnd() * 1.5) * (k ? .6 : 1);
      const x = cx + (rnd() - .5) * 2.4, z = cz + (rnd() - .5) * 2.4;
      m.scale.set(sc * (1 + rnd() * .6), sc * (.45 + rnd() * .4), sc); m.rotation.set(rnd(), rnd() * 6, rnd() * .4);
      m.position.set(x, duneH(x, z) - sc * .15, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    }
  }
  const blades = phone() ? 500 : 1000, grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.022, .7, 3).translate(0, .35, 0), new THREE.MeshLambertMaterial({ color: "#9a6a45" }), blades);
  const o = new THREE.Object3D(); let b = 0;
  while (b < blades) {
    const a = rnd() * Math.PI * 2, r = 15 + Math.pow(rnd(), 1.4) * 70, cx = Math.sin(a) * r, cz = -Math.cos(a) * r;
    for (let k = 0; k < 9 && b < blades; k++, b++) {
      const x = cx + (rnd() - .5) * .5, z = cz + (rnd() - .5) * .5;
      o.position.set(x, duneH(x, z) - .05, z); o.rotation.set((rnd() - .5) * .9, rnd() * 6, (rnd() - .5) * .9); o.scale.setScalar(.5 + rnd() * .9);
      o.updateMatrix(); grass.setMatrixAt(b, o.matrix);
    }
  }
  grass.castShadow = true; grass.receiveShadow = true; scene.add(grass);
}
const birds = (() => {
  const mat = new THREE.MeshBasicMaterial({ color: "#3a2440", side: THREE.DoubleSide }), list = [];
  const wing = s => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, .12, s * .75, 0, .02, 0, 0, -.18, s * .75, 0, .02, s * .3, 0, -.12, 0, 0, -.18]), 3)); return g; };
  const flock = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(), l = new THREE.Mesh(wing(-1), mat), r = new THREE.Mesh(wing(1), mat);
    b.add(l, r); const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    b.position.set(side * row * 1.1, Math.sin(i) * .4, row * 1.3); b.scale.setScalar(1.2);
    b.userData = { l, r, ph: i * .7 }; flock.add(b); list.push(b);
  }
  scene.add(flock); return { flock, list };
})();
function flyBirds(t) {
  const a = t * .035, r = 70;
  birds.flock.position.set(Math.sin(a) * r, 26 + Math.sin(t * .2) * 2, -Math.cos(a) * r - 20);
  birds.flock.rotation.y = -a - Math.PI / 2;
  birds.list.forEach(b => { const w = Math.sin(t * 7 + b.userData.ph) * .7; b.userData.l.rotation.z = w; b.userData.r.rotation.z = -w; });
}
// a lantern beside each site; they light up as the sun goes down
const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb46a") });
const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: "#ff9a50", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const lanterns = Array.from({ length: N }, () => {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .035, 1.6, 6).translate(0, .8, 0), new THREE.MeshStandardMaterial({ color: "#2a2033", roughness: .5, metalness: .5 }));
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .22, 6).translate(0, 1.7, 0), new THREE.MeshStandardMaterial({ color: "#2a2033", roughness: .5, metalness: .5, wireframe: true }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8).translate(0, 1.7, 0), lanternMat);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), poolMat); pool.position.y = .04;
  pole.castShadow = true; g.add(pole, cage, orb, pool); scene.add(g); return g;
});

/* ---------- the work ---------- */
const FW = 3.4, FH = FW / 1.6;
const roundTex = (() => { // rounded corners as an alpha map
  const c = document.createElement("canvas"); c.width = 320; c.height = 200; const x = c.getContext("2d");
  x.fillStyle = "#000"; x.fillRect(0, 0, 320, 200); x.fillStyle = "#fff";
  x.beginPath(); x.roundRect(2, 2, 316, 196, 12); x.fill();
  return new THREE.CanvasTexture(c);
})();
const bodyGeo = (() => { // a slim rounded slab behind each screen
  const w = FW + .1, h = FH + .1, r = .14, sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: .07, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 3, curveSegments: 8 });
  g.center(); return g;
})();
const frames = [], hitMeshes = [];
const loader = new THREE.TextureLoader();
items.forEach((it, i) => {
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", alphaMap: roundTex, transparent: true, fog: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), mat);
  face.userData.i = i; face.renderOrder = 2;
  const back = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: "#2a2033", roughness: .42, metalness: .55, transparent: true }));
  back.position.z = -.062; back.castShadow = true; // its front sits just behind the screen
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(FW * 1.9, FH * 2.1), new THREE.MeshBasicMaterial({ map: glowTex, color: "#ffffff", transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.z = -.05; glow.renderOrder = 1;
  grp.add(glow, back, face);
  scene.add(grp);
  frames.push({ grp, face, back, glow, mat, base: new THREE.Vector3(), angle: 0, rise: 0, hover: 0, dim: 1, seed: Math.random() * 10 });
  hitMeshes.push(face);
});
hitMeshes.push(fire.hit);
const R = () => portrait() ? 8.5 : 12.5;
function layout() {
  const r = R();
  frames.forEach((f, i) => {
    f.angle = i / N * Math.PI * 2;
    f.base.set(Math.sin(f.angle) * r, 3.3 + Math.sin(f.seed * 4.1) * .18, -Math.cos(f.angle) * r);
  });
  lanterns.forEach((l, i) => {
    const a = (i + .5) / N * Math.PI * 2, lr = r + (portrait() ? 2.4 : .4), x = Math.sin(a) * lr, z = -Math.cos(a) * lr;
    l.position.set(x, duneH(x, z) - .05, z);
  });
}

/* ---------- client stars: one above each site ---------- */
const stars = items.map((it, i) => {
  const b = document.createElement("button");
  b.className = "star"; b.type = "button"; b.innerHTML = `<i></i><span>${esc(it.p.title)}</span>`;
  b.setAttribute("aria-label", `${it.p.title}, ${it.p.client}`);
  b.addEventListener("click", () => openPanel(i));
  $("stars").appendChild(b);
  const el = .5 + Math.sin(i * 2.7) * .13;
  return { b, dir: dirOf(i / N * Math.PI * 2, el, new THREE.Vector3()), x: 0, y: 0, vis: false };
});

/* ---------- camera ---------- */
const S = { entered: 0, enterT: 0, open: -1 };
const G = { yaw: 0, tyaw: 0, vyaw: 0, fov: 62, tfov: 62, pitch: 0, tpitch: 0, fly: 0 };
const baseFov = () => portrait() ? 74 : 62;
const CAM = { pos: new THREE.Vector3(0, 7.5, 36), look: new THREE.Vector3(0, 4.2, 0), fov: 48 };
const TP = new THREE.Vector3(), TL = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
let place = "work", travel = false, travelT = 0, TF = 62;
function targetPose(fl) {
  if (place === "services") {
    const ph = phone();
    TP.set(smx * .4, ph ? 9 : 5.6, ph ? 4 : 3.4); TL.set(ph ? 0 : 1.7, -1.2, ph ? -1.5 : -4.8); TF = ph ? 72 : 55;
    return;
  }
  if (place === "contact") {
    const ph = phone();
    TP.set(camp.x - 2.6 + smx * .3, 0, camp.z - 6); TP.y = Math.max(camp.y + 2.4, duneH(TP.x, TP.z) + 1.4);
    TL.copy(camp).add(UP.clone().multiplyScalar(ph ? -.9 : .7));
    if (!ph) { const fwd = TL.clone().sub(TP).normalize(), right = fwd.cross(UP).normalize(); TL.addScaledVector(right, 2.1); }
    TF = ph ? 70 : 52;
    return;
  }
  // work and about: standing in the ring
  TP.set(lerp(0, 0, fl) + smx * .3 * (1 - fl), lerp(7.5, 3.3, fl), lerp(36, 0, fl));
  const p = G.pitch - smy * .04 * fl;
  const ahead = new THREE.Vector3(Math.sin(G.yaw) * Math.cos(p), Math.sin(p), -Math.cos(G.yaw) * Math.cos(p)).multiplyScalar(10).add(TP);
  TL.set(0, 4.2, 0).lerp(ahead, fl);
  TF = lerp(48, G.fov, fl);
}

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .42, .5, 1);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({ // a soft vignette and a little film grain
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - .5;
      c.rgb *= 1. - dot(q, q) * .5;
      c.rgb += (h(vUv * 917.3 + fract(uTime * 7.) * 31.) - .5) * .03;
      gl_FragColor = c; }` });
composer.addPass(finish);

/* ---------- quality: start sensibly, and step down if the device struggles ---------- */
const QUAL = [
  { dpr: 1, samples: 0, shadow: 0, bloom: false, grain: false, every: 0 },   // low
  { dpr: 1.25, samples: 0, shadow: 1024, bloom: true, grain: true, every: 4 }, // medium
  { dpr: 1.5, samples: 4, shadow: 2048, bloom: true, grain: true, every: 2 },  // high
];
let q = phone() ? 1 : 2;
function applyQuality() {
  const Q = QUAL[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.dpr));
  const shadows = !!Q.shadow;
  if (renderer.shadowMap.enabled !== shadows) { renderer.shadowMap.enabled = shadows; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => (m.needsUpdate = true)); }); }
  sunLight.castShadow = shadows;
  if (shadows && sunLight.shadow.mapSize.x !== Q.shadow) { sunLight.shadow.mapSize.set(Q.shadow, Q.shadow); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  renderer.shadowMap.needsUpdate = true;
  bloom.enabled = Q.bloom; finish.enabled = Q.grain;
  [composer.renderTarget1, composer.renderTarget2].forEach(r => { if (r.samples !== Q.samples) { r.samples = Q.samples; r.dispose(); } });
  if (typeof resize === "function") resize();
}
let frameNo = 0, lastNow = 0, ema = 16, slowFor = 0, lastQ = 0, lastInput = 0;
const poke = () => (lastInput = performance.now());
["pointermove", "pointerdown", "wheel", "keydown", "touchmove"].forEach(ev => addEventListener(ev, poke, { passive: true }));
// a hidden tab pauses frames; that gap is not a slow device
document.addEventListener("visibilitychange", () => { lastNow = 0; slowFor = 0; });
function watchSpeed(now, still) {
  const ms = lastNow ? Math.min(now - lastNow, 200) : 16; lastNow = now;
  // while idle at half rate the gaps are cheap skipped frames, so they say nothing
  if (still || !S.entered || G.fly < 1) { slowFor = 0; return; }
  ema += (ms - ema) * .08;
  slowFor = ema > 25 ? slowFor + ms : 0;
  if (slowFor > 1600 && q > 0 && now - lastQ > 2500) {
    q--; applyQuality(); lastQ = now; slowFor = 0;
  }
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  layout();
  if (S.open < 0) G.tfov = baseFov();
}
let wasPhone = phone();
addEventListener("resize", () => { resize(); if (phone() !== wasPhone) { wasPhone = phone(); drawWriting(); } });

/* ---------- places: work, about (the sky), services (the sand), contact (the fire) ---------- */
const HINTS = {
  work: () => phone() ? "Swipe or use the arrows · Tap a site" : "Drag or use the arrows · Click a site to open it",
  about: () => "Every star is someone I built for. Click one.",
  services: () => phone() ? "Draw in the sand with your finger" : "Draw in the sand with your mouse",
  contact: () => "Sit by the fire and say hello",
};
function setPlace(p) {
  if (!HINTS[p]) p = "work";
  // the first entry flies in on its own; later moves glide between places
  const first = !S.entered;
  if (first) enter();
  if (!first || p === "services" || p === "contact") { travel = true; travelT = performance.now(); }
  closePanel(true);
  place = p;
  document.body.dataset.place = p;
  if (p === "work") { G.tpitch = 0; G.tfov = baseFov(); }
  if (p === "about") { G.tpitch = phone() ? .02 : .8; G.tfov = phone() ? 88 : baseFov(); } // on phones the sheet covers the lower half, so the stars sit high
  document.querySelectorAll("[data-go]").forEach(b => b.classList.toggle("on", b.dataset.go === p));
  $("hint").textContent = HINTS[p]();
  $("where").textContent = p[0].toUpperCase() + p.slice(1);
  document.body.classList.remove("menu-open");
  try { history.replaceState(null, "", p === "work" ? location.pathname : "#" + p); } catch (_) {}
}
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); setPlace(b.dataset.go); }));
$("menuBtn").onclick = () => document.body.classList.toggle("menu-open");

/* ---------- intro: the name first, then the work rises ---------- */
const h1 = $("name");
h1.innerHTML = [...h1.textContent].map((c, i) => c === " " ? " " : `<span class="ch" style="transition-delay:${i * 45}ms">${esc(c)}</span>`).join("");
function enter() {
  if (S.entered) return;
  S.entered = 1; S.enterT = performance.now();
  document.body.classList.add("entered");
  frames.forEach((f, i) => (f.delay = i * 60 + 300));
}
$("enter").addEventListener("click", () => setPlace("work"));
const overUI = e => e.target.closest && e.target.closest(".panel, .place-sheet, .list, .menu, .live");
addEventListener("wheel", e => { if (!S.entered && e.deltaY > 0 && !overUI(e)) setPlace("work"); }, { passive: true });
let introTouch = null;
addEventListener("touchstart", e => { if (!S.entered && !overUI(e)) introTouch = e.touches[0].clientY; }, { passive: true });
addEventListener("touchmove", e => { if (!S.entered && introTouch !== null && introTouch - e.touches[0].clientY > 40) { introTouch = null; setPlace("work"); } }, { passive: true });
$("home").addEventListener("click", e => { e.preventDefault(); setPlace("work"); });

/* ---------- pointer: turn the ring, drag the sun, draw in the sand ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let lastWheel = 0, drag = null, sunDrag = null, hoverI = -1, pinch = null, lastSand = null, lastMove = null;
const pointers = new Map();
const tip = $("tip");
function aim(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pick(x, y) {
  aim(x, y);
  const hit = ray.intersectObjects(hitMeshes, false)[0];
  if (!hit) return -1;
  return hit.object.userData.fire ? -2 : hit.object.userData.i;
}
// where the pointer meets the sand (a few steps along the ray, no mesh test needed)
function sandAt(x, y) {
  aim(x, y);
  const o = ray.ray.origin, d = ray.ray.direction;
  if (d.y > -.02) return null;
  let t = (-1.2 - o.y) / d.y;
  for (let k = 0; k < 4; k++) { const px = o.x + d.x * t, pz = o.z + d.z * t; t = (duneH(px, pz) - o.y) / d.y; }
  if (t < 0 || t > 40) return null;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
let trailLive = 0;
function drawSand(x, y) {
  const p = sandAt(x, y);
  if (!p || Math.abs(p.x) > TW / 2 - 1 || Math.abs(p.z) > TW / 2 - 1) { lastSand = null; return; }
  const k = TR / TW, X = (p.x / TW + .5) * TR, Z = (p.z / TW + .5) * TR;
  if (lastSand && Math.hypot(p.x - lastSand.x, p.z - lastSand.z) < 3) {
    const lx = (lastSand.x / TW + .5) * TR, lz = (lastSand.z / TW + .5) * TR;
    tctx.globalCompositeOperation = "lighten"; tctx.lineCap = tctx.lineJoin = "round";
    tctx.strokeStyle = "rgb(0,255,0)"; tctx.lineWidth = .62 * k; tctx.beginPath(); tctx.moveTo(lx, lz); tctx.lineTo(X, Z); tctx.stroke();
    tctx.strokeStyle = "rgb(255,0,0)"; tctx.lineWidth = .28 * k; tctx.beginPath(); tctx.moveTo(lx, lz); tctx.lineTo(X, Z); tctx.stroke();
    trailLive = performance.now();
  }
  lastSand = p;
}
const ringPlace = () => place === "work" || place === "about";
canvas.addEventListener("pointerdown", e => {
  if (!S.entered) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: G.tfov }; drag = null; return; }
  if (SUN.on && Math.hypot(e.clientX - SUN.x, e.clientY - SUN.y) < (e.pointerType === "touch" ? 60 : 46)) {
    sunDrag = { lx: e.clientX, ly: e.clientY }; document.body.classList.add("grabbing"); return;
  }
  drag = { lx: e.clientX, ly: e.clientY, moved: 0 };
  G.vyaw = 0; lastSand = null;
  if (e.pointerType !== "mouse") drawSand(e.clientX, e.clientY);
  document.body.classList.add("grabbing");
});
canvas.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const now = performance.now();
  if (lastMove) { const sp = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / Math.max(8, now - lastMove.t); gust = Math.max(gust, clamp((sp - .6) / 3, 0, 1)); }
  lastMove = { x: e.clientX, y: e.clientY, t: now };
  if (!S.entered) return;
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (ringPlace()) G.tfov = clamp(pinch.fov * pinch.d / d, 30, 85);
    return;
  }
  const k = THREE.MathUtils.degToRad(camera.fov) / innerHeight;
  if (sunDrag) {
    const dx = e.clientX - sunDrag.lx, dy = e.clientY - sunDrag.ly; sunDrag.lx = e.clientX; sunDrag.ly = e.clientY;
    const moon = SUN.el < -.04; // below the horizon you are holding the moon, which moves the other way
    SUN.taz += dx * k; SUN.tel = clamp(SUN.tel + (moon ? dy / .9 : -dy) * k, EL_MIN, EL_MAX);
    sunTouched(); return;
  }
  if (e.pointerType === "mouse" || drag) drawSand(e.clientX, e.clientY);
  if (drag) {
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    drag.lx = e.clientX; drag.ly = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (ringPlace()) {
      if (drag.moved > 6 && S.open >= 0) closePanel(true);
      G.tyaw -= dx * k; G.vyaw = -dx * k; G.tpitch = clamp(G.tpitch + dy * k * .5, -.3, .85);
    }
    return;
  }
  if (e.pointerType === "mouse") { hoverAt = { x: e.clientX, y: e.clientY }; hover(); }
}, { passive: true });
// the ring keeps moving under a still mouse, so the hover is checked again each frame
let hoverAt = null;
function hover() {
  if (!hoverAt || drag || sunDrag || !S.entered) return;
  const onSun = SUN.on && Math.hypot(hoverAt.x - SUN.x, hoverAt.y - SUN.y) < 46;
  const i = onSun ? -1 : pick(hoverAt.x, hoverAt.y);
  if (i !== hoverI) {
    hoverI = i;
    if (i >= 0) tip.innerHTML = `${esc(items[i].p.title)}<small>${esc(items[i].p.client)}</small>`;
    if (i === -2) tip.innerHTML = `Contact<small>Sit by the fire</small>`;
    tip.classList.toggle("on", i !== -1 && !phone());
  }
  document.body.classList.toggle("point", i !== -1);
  document.body.classList.toggle("sunny", onSun);
  if (i !== -1) tip.style.left = hoverAt.x + "px", tip.style.top = hoverAt.y + "px";
}
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  document.body.classList.remove("grabbing");
  if (e.pointerType !== "mouse") lastSand = null;
  if (sunDrag) { sunDrag = null; return; }
  if (!drag) return;
  const d = drag; drag = null;
  if (d.moved < 7) {
    const i = pick(e.clientX, e.clientY);
    if (i === -2) setPlace("contact");
    else if (i >= 0) openPanel(i);
    else if (S.open >= 0) closePanel();
  }
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", () => { tip.classList.remove("on"); document.body.classList.remove("point", "sunny"); hoverI = -1; hoverAt = null; lastSand = null; });
addEventListener("wheel", e => {
  if (!S.entered || overUI(e) || !ringPlace()) return;
  G.tyaw += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * .0016; lastWheel = performance.now();
  if (S.open >= 0) closePanel(true);
}, { passive: true });
addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (e.key === "Escape") {
    if ($("live").classList.contains("open")) return closeLive();
    if (document.body.classList.contains("listing") || document.body.classList.contains("menu-open")) return document.body.classList.remove("listing", "menu-open");
    if (S.open >= 0) return closePanel();
    if (place !== "work") setPlace("work");
    return;
  }
  if (!S.entered && (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ")) { setPlace("work"); return; }
  if (S.open >= 0 && e.key === "ArrowRight") openPanel((S.open + 1) % N);
  else if (S.open >= 0 && e.key === "ArrowLeft") openPanel((S.open - 1 + N) % N);
  else if (ringPlace() && e.key === "ArrowRight") G.tyaw += Math.PI * 2 / N;
  else if (ringPlace() && e.key === "ArrowLeft") G.tyaw -= Math.PI * 2 / N;
});

/* ---------- the sun: drag it, or use the slider ---------- */
const timeIn = $("time");
function sunTouched() { if (!SUN.touched) { SUN.touched = 1; document.body.classList.add("sun-known"); } }
timeIn.addEventListener("input", () => { SUN.tel = timeIn.value / 100; sunTouched(); });
const sunTag = $("sunTag"), tmpV = new THREE.Vector3();
function placeSun() {
  const d = SUN.el < -.04 ? moonDir : sunDir;
  tmpV.copy(d).multiplyScalar(400).add(camera.position).project(camera);
  const front = camera.getWorldDirection(new THREE.Vector3()).dot(d) > .2;
  SUN.x = (tmpV.x + 1) / 2 * innerWidth; SUN.y = (1 - tmpV.y) / 2 * innerHeight;
  SUN.on = S.entered && front && ringPlace() && S.open < 0 && SUN.x > 0 && SUN.x < innerWidth && SUN.y > 60 && SUN.y < innerHeight - 60 && d.y > -.02 ? 1 : 0;
  sunTag.classList.toggle("on", !!SUN.on && !SUN.touched && G.fly >= 1);
  sunTag.textContent = d === moonDir ? "Drag the moon" : "Drag the sun";
  sunTag.style.transform = `translate(${SUN.x}px, ${SUN.y - 72}px) translateX(-50%)`;
  if (!sunDrag && document.activeElement !== timeIn) timeIn.value = Math.round(SUN.tel * 100);
}

/* ---------- the info card ---------- */
function openPanel(i) {
  if (!S.entered) enter();
  if (place !== "work") setPlace("work");
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
  const fovFit = phone() ? 46 : 36;
  G.tfov = fovFit;
  const off = phone() ? 0 : THREE.MathUtils.degToRad(fovFit) * camera.aspect * .2;
  const a = frames[i].angle + off;
  G.tyaw = G.yaw + Math.atan2(Math.sin(a - G.yaw), Math.cos(a - G.yaw));
  G.tpitch = phone() ? -.13 : 0;
}
function closePanel(keepView) {
  if (S.open < 0) return;
  const a = frames[S.open].angle;
  S.open = -1; document.body.classList.remove("open");
  if (!keepView) { G.tfov = baseFov(); G.tpitch = 0; G.tyaw = G.yaw + Math.atan2(Math.sin(a - G.yaw), Math.cos(a - G.yaw)); } // come back to the site, not its neighbour
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
$("listItems").innerHTML = items.map((it, i) => `<li><button data-i="${i}"><img src="${it.src}" alt="" loading="lazy"><span>${pad(i + 1)}</span><b>${esc(it.p.title)}</b><small>${esc(it.p.client)}</small></button></li>`).join("");
$("listItems").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; document.body.classList.remove("listing"); const was = S.entered; enter(); setTimeout(() => openPanel(+b.dataset.i), was ? 0 : 900); });
$("openList").onclick = () => document.body.classList.add("listing");
$("closeList").onclick = () => document.body.classList.remove("listing");
$("list").addEventListener("click", e => { if (e.target === $("list")) document.body.classList.remove("listing"); });
document.querySelectorAll(".place-sheet .back").forEach(b => (b.onclick = () => setPlace("work")));

/* ---------- the site in the middle: its name, a counter and arrows ---------- */
const STEP = Math.PI * 2 / N;
const cap = $("focus"), capNum = $("fNum"), capTitle = $("fTitle"), capClient = $("fClient");
let capI = -1;
const curIndex = () => ((Math.round(G.yaw / STEP) % N) + N) % N;
function step(d) { if (S.open >= 0) return openPanel((S.open + d + N) % N); G.vyaw = 0; G.tyaw = (Math.round(G.tyaw / STEP) + d) * STEP; }
$("prevW").onclick = () => step(-1);
$("nextW").onclick = () => step(1);
$("fOpen").onclick = () => openPanel(curIndex());
const capV = new THREE.Vector3();
function caption() {
  const i = curIndex(), f = frames[i];
  if (i !== capI) { capI = i; capNum.textContent = `${pad(i + 1)} / ${pad(N)}`; capTitle.textContent = items[i].p.title; capClient.textContent = items[i].p.client; }
  const settled = Math.abs(G.yaw - Math.round(G.yaw / STEP) * STEP) < .12;
  const show = S.entered && G.fly >= 1 && place === "work" && S.open < 0 && Math.abs(G.pitch) < .3 && f.rise >= 1;
  document.body.classList.toggle("ringing", show);
  cap.classList.toggle("on", show && settled && !drag);
  if (!show) return;
  capV.set(0, -FH / 2, 0).applyMatrix4(f.face.matrixWorld).project(camera);
  cap.style.transform = `translate(${((capV.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - capV.y) / 2 * innerHeight + 18).toFixed(1)}px) translateX(-50%)`;
}

/* ---------- the site you face plays live inside its frame ---------- */
// a CSS matrix3d that pins a 1280 x 800 iframe onto the frame's four corners on screen
function adj(m) { return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
function mm(a, b) { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[3*i+j] = a[3*i]*b[j] + a[3*i+1]*b[3+j] + a[3*i+2]*b[6+j]; return c; }
function mv(m, v) { return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]; }
function basis(p) { const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1], v = mv(adj(m), [p[6], p[7], 1]); return mm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
const LW = 1280, LH = 800, SRC = basis([0, 0, LW, 0, 0, LH, LW, LH]), SRC_ADJ = adj(SRC);
const livewin = $("livewin"), liveFrame = $("liveFrame");
const LV = { i: -1, cand: -1, since: 0, ready: 0, token: 0 };
const CORNERS = [[-FW / 2, FH / 2], [FW / 2, FH / 2], [-FW / 2, -FH / 2], [FW / 2, -FH / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0));
const cv = new THREE.Vector3();
liveFrame.addEventListener("load", () => { const tok = LV.token; if (LV.i >= 0) setTimeout(() => { if (tok === LV.token) LV.ready = 1; }, 700); });
function liveSite(now) {
  let cand = -1;
  const busy = document.body.classList.contains("listing") || $("live").classList.contains("open") || document.hidden;
  if (S.entered && G.fly >= 1 && place === "work" && !busy) {
    if (S.open >= 0) cand = S.open;
    else if (Math.abs(G.pitch) < .35) {
      let best = .32;
      frames.forEach((f, i) => { const d = Math.abs(Math.atan2(Math.sin(f.angle - G.yaw), Math.cos(f.angle - G.yaw))); if (d < best) { best = d; cand = i; } });
    }
  }
  if (cand >= 0 && !items[cand].framable) cand = -1;
  if (cand !== LV.cand) { LV.cand = cand; LV.since = now; }
  if (LV.cand !== LV.i && (now - LV.since > 1200 || LV.cand < 0)) {
    LV.i = LV.cand; LV.ready = 0; LV.token++;
    livewin.classList.remove("on");
    liveFrame.src = LV.i >= 0 ? items[LV.i].p.url : "about:blank";
  }
  if (LV.i < 0) return;
  const f = frames[LV.i], pts = [];
  f.face.updateMatrixWorld();
  for (const c of CORNERS) {
    cv.copy(c).applyMatrix4(f.face.matrixWorld);
    if (cv.clone().applyMatrix4(camera.matrixWorldInverse).z > -.2) { livewin.classList.remove("on"); return; }
    cv.project(camera);
    pts.push((cv.x + 1) / 2 * innerWidth, (1 - cv.y) / 2 * innerHeight);
  }
  const t = mm(basis(pts), SRC_ADJ);
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  livewin.style.transform = `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
  livewin.style.setProperty("--dim", f.dim * ease(f.rise));
  livewin.classList.toggle("on", !!LV.ready);
}
document.addEventListener("visibilitychange", () => { if (document.hidden && LV.i >= 0) { LV.i = LV.cand = -1; liveFrame.src = "about:blank"; livewin.classList.remove("on"); } });

/* ---------- wind sound, made on the fly (no audio files) ---------- */
let audio = null, soundOn = false;
function makeAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500; lp.Q.value = .8;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start();
  const cb = ac.createBuffer(1, ac.sampleRate * .04, ac.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cd.length, 3);
  return { ac, g, lp, cb };
}
function crackle() {
  const s = audio.ac.createBufferSource(); s.buffer = audio.cb;
  const g = audio.ac.createGain(); g.gain.value = .05 + Math.random() * .12;
  const hp = audio.ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200 + Math.random() * 2000;
  s.connect(hp); hp.connect(g); g.connect(audio.ac.destination); s.start();
}
document.querySelectorAll("[data-sound]").forEach(b => b.addEventListener("click", () => {
  soundOn = !soundOn;
  if (soundOn && !audio) { try { audio = makeAudio(); } catch (_) { soundOn = false; } }
  if (audio && audio.ac.state === "suspended") audio.ac.resume();
  document.querySelectorAll("[data-sound]").forEach(x => { x.setAttribute("aria-pressed", soundOn); x.querySelector("span").textContent = soundOn ? "Sound on" : "Sound off"; });
}));
function hear(dt, t) {
  if (!audio) return;
  const now = audio.ac.currentTime;
  const v = soundOn ? (.1 + .06 * (wind - 1) + gust * .22) : 0;
  audio.g.gain.setTargetAtTime(v, now, .25);
  audio.lp.frequency.setTargetAtTime(380 + gust * 900 + 120 * Math.sin(t * .23), now, .3);
  if (soundOn && place === "contact" && Math.random() < dt * 7) crackle();
}

/* ---------- contact form (FormSubmit, with an email fallback) ---------- */
const cform = $("cform");
const fstatus = $("form-status"), send = cform.querySelector(".send"), label = send.querySelector("span");
cform.addEventListener("submit", async e => {
  e.preventDefault();
  if (!cform.reportValidity()) return;
  const data = Object.fromEntries(new FormData(cform));
  if (data._honey) return; // a bot filled the hidden field
  send.disabled = true; label.textContent = "Sending"; fstatus.textContent = "";
  try {
    const res = await fetch(cform.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
    const out = await res.json().catch(() => ({}));
    if (/activat/i.test(out.message || "")) {
      send.disabled = false; label.textContent = "Send message";
      fstatus.textContent = "Almost ready: open the \"Activate Form\" email from FormSubmit, then send again."; return;
    }
    if (!res.ok || String(out.success) === "false") throw new Error(out.message || res.status);
    cform.classList.add("is-sent"); label.textContent = "Sent";
    fstatus.textContent = `Thank you, ${data.name.split(" ")[0]}. I'll write back to ${data.email}.`;
    cform.reset();
  } catch (err) {
    send.disabled = false; label.textContent = "Send message";
    const mail = $("email").getAttribute("href").replace("mailto:", "");
    const body = `${data.message}\n\n${data.name} (${data.email})\nProject: ${data.project}`;
    fstatus.innerHTML = `It didn't go through from here. <a href="mailto:${mail}?subject=${encodeURIComponent("New enquiry from your portfolio")}&body=${encodeURIComponent(body)}">Send it by email instead</a>, it's already written.`;
  }
});
$("copy").addEventListener("click", () => {
  const btn = $("copy"), done = m => { btn.textContent = m; setTimeout(() => (btn.textContent = "Copy email"), 1800); };
  try { navigator.clipboard.writeText($("email").textContent.trim()).then(() => done("Copied"), () => done("Press Ctrl+C")); }
  catch (_) { done("Press Ctrl+C"); }
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let mx = 0, my = 0, smx = 0, smy = 0, lastTrailFade = 0;
addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
const starPath = $("starLines").querySelector("path"), camFwd = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  frameNo++;
  // when nothing is moving, draw at half rate to leave room for the live site and save battery
  const still = now - lastInput > 2500 && !travel && Math.abs(G.tyaw - G.yaw) < .001 && Math.abs(SUN.tel - SUN.el) < .001 && G.fly >= 1;
  watchSpeed(now, still);
  if (still && frameNo % 2) return;
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  const k = reduce ? 1 : 1 - Math.exp(-dt * 5);
  smx += (mx - smx) * (1 - Math.exp(-dt * 2)); smy += (my - smy) * (1 - Math.exp(-dt * 2));
  gust *= Math.exp(-dt * 1.4);

  // sky and light follow the sun
  SUN.az += (SUN.taz - SUN.az) * k; SUN.el += (SUN.tel - SUN.el) * k;
  dirOf(SUN.az, SUN.el, sunDir); dirOf(SUN.az + Math.PI, clamp(-SUN.el * .9 + .12, .08, .55), moonDir);
  night = sstep(-SUN.el, -.04, .15);
  sampleSky(SUN.el);
  const U = sky.material.uniforms;
  U.uTime.value = t; U.uNight.value = night; U.uStars.value = SKY.stars;
  scene.fog.color.copy(SKY.fog); sandMat.color.copy(SKY.sand);
  hemi.color.copy(SKY.hemiS); hemi.groundColor.copy(SKY.hemiG); hemi.intensity = SKY.hemi;
  lightDir.copy(sunDir).lerp(moonDir, night).normalize();
  sunLight.position.copy(lightDir).multiplyScalar(80); sunLight.color.copy(SKY.sun); sunLight.intensity = SKY.sunI;
  dust.material.color.setRGB(1, lerp(.96, .9, night), lerp(.92, 1, night));
  dust.rotation.y = t * .01;
  blow(dt, t); burn(dt, t); hear(dt, t); flyBirds(t); tintMountains();
  sandDay.value = 1 - night;
  lanternMat.color.setRGB(1, .7, .42).multiplyScalar(.5 + sstep(night + (SUN.el < .1 ? .3 : 0), .05, .8) * 5);
  poolMat.opacity = .08 + night * .55;
  finish.uniforms.uTime.value = t;

  // trails slowly fill back in
  if (now - trailLive < 25000 && now - lastTrailFade > 90) {
    tctx.globalCompositeOperation = "source-over"; tctx.fillStyle = `rgba(0,0,0,${.012 + gust * .03})`; tctx.fillRect(0, 0, TR, TR);
    trailTex.needsUpdate = true; lastTrailFade = now;
  }

  frames.forEach((f, i) => {
    if (S.entered) f.rise = reduce ? 1 : clamp((now - S.enterT - (f.delay || 0)) / 1400, 0, 1);
    const r = ease(f.rise);
    const isHover = i === hoverI && !drag ? 1 : 0;
    f.hover += (isHover - f.hover) * (1 - Math.exp(-dt * 10));
    const bob = Math.sin(t * .7 + f.seed * 3) * .06;
    f.grp.position.set(f.base.x, f.base.y + bob - (1 - r) * 6, f.base.z);
    f.grp.lookAt(0, f.grp.position.y, 0);
    f.grp.translateZ(f.hover * .35);
    f.grp.scale.setScalar((1 + f.hover * .05) * (.7 + .3 * r));
    // with a card open, the other sites step back
    const dimT = S.open >= 0 && S.open !== i ? .28 : 1;
    f.dim += (dimT - f.dim) * (1 - Math.exp(-dt * 6));
    f.mat.opacity = f.dim; f.back.material.opacity = f.dim;
    f.glow.material.opacity = (.35 + night * .3 + f.hover * .4 + (S.open === i ? .35 : 0)) * r * f.dim;
  });

  // camera
  if (S.entered) G.fly = clamp((now - S.enterT) / 2600, 0, 1);
  const fl = reduce ? (S.entered ? 1 : 0) : ease(G.fly);
  if (!drag) {
    G.tyaw += G.vyaw; G.vyaw *= .92;
    // in Work the ring always comes to rest on one site
    if (place === "work" && S.open < 0 && S.entered && Math.abs(G.vyaw) < .002 && now - lastWheel > 240) { G.vyaw = 0; G.tyaw = Math.round(G.tyaw / STEP) * STEP; }
    if (place === "about" && S.entered) G.tyaw += dt * .02;
  }
  G.yaw += (G.tyaw - G.yaw) * k; G.fov += (G.tfov - G.fov) * k; G.pitch += (G.tpitch - G.pitch) * k;
  targetPose(fl);
  writeAmt.value += ((place === "services" ? 1 : 0) - writeAmt.value) * (1 - Math.exp(-dt * 2));
  if (travel && !reduce) {
    const kt = 1 - Math.exp(-dt * 2.6);
    CAM.pos.lerp(TP, kt); CAM.look.lerp(TL, kt); CAM.fov += (TF - CAM.fov) * kt;
    if ((CAM.pos.distanceTo(TP) < .03 && CAM.look.distanceTo(TL) < .06 && Math.abs(CAM.fov - TF) < .2) || now - travelT > 4000) travel = false;
  } else { CAM.pos.copy(TP); CAM.look.copy(TL); CAM.fov = TF; }
  camera.position.copy(CAM.pos); camera.fov = CAM.fov; camera.updateProjectionMatrix(); camera.lookAt(CAM.look);
  camera.updateMatrixWorld();

  // client stars and the lines between them
  camera.getWorldDirection(camFwd);
  const sv = S.entered ? clamp(night * 1.3 + sstep(G.pitch, .15, .45) + (place === "about" ? 1 : 0), 0, 1) * fl : 0;
  let path = "";
  stars.forEach(s => {
    tmpV.copy(s.dir).multiplyScalar(400).add(camera.position).project(camera);
    s.x = (tmpV.x + 1) / 2 * innerWidth; s.y = (1 - tmpV.y) / 2 * innerHeight;
    s.vis = camFwd.dot(s.dir) > .15 && s.x > -80 && s.x < innerWidth + 80 && s.y > -40 && s.y < innerHeight + 40;
  });
  stars.forEach((s, i) => {
    s.b.style.transform = `translate(${s.x}px, ${s.y}px)`;
    s.b.style.opacity = s.vis ? sv : 0;
    s.b.style.visibility = s.vis && sv > .05 && ringPlace() ? "visible" : "hidden";
    const n = stars[(i + 1) % N];
    if (s.vis && n.vis) path += `M${s.x.toFixed(1)} ${s.y.toFixed(1)}L${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
  });
  starPath.setAttribute("d", path); starPath.style.opacity = sv * .8;

  hover();
  const Q = QUAL[q];
  if (Q.shadow && (frameNo % Q.every === 0 || Math.abs(SUN.tel - SUN.el) > .001)) renderer.shadowMap.needsUpdate = true;
  composer.render();
  placeSun();
  liveSite(now);
  caption();
}

/* ---------- start ---------- */
applyQuality();
G.fov = G.tfov = baseFov();
let loaded = 0;
const jobs = items.map((it, i) => new Promise(res => loader.load(it.src, tex => {
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const f = frames[i]; f.mat.map = tex; f.mat.needsUpdate = true;
  // the frame's light takes the colour of the site
  const c = document.createElement("canvas"); c.width = c.height = 4; const x = c.getContext("2d");
  x.drawImage(tex.image, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
  for (let q = 0; q < d.length; q += 4) { r += d[q]; g += d[q+1]; b += d[q+2]; }
  const n = d.length / 4, col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.4 + .15), .62);
  f.glow.material.color.copy(col);
  loaded++; $("ln").textContent = String(Math.round(loaded / N * 100)).padStart(3, "0"); res();
}, undefined, () => { loaded++; res(); })));
document.body.dataset.place = "work";
$("hint").textContent = HINTS.work();
requestAnimationFrame(tick);
Promise.all(jobs).then(() => {
  $("loader").classList.add("done");
  setTimeout(() => document.body.classList.add("ready"), 300);
  const h = location.hash.slice(1);
  if (h === "work" || HINTS[h]) setTimeout(() => setPlace(h), 900);
});
})();

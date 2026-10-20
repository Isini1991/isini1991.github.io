(() => {
const IMG = "../journey/img/";
// Work shown in the journey, in order. Titles must match projects.js.
const PICK = [
  ["False Gods", "false-gods"],
  ["Oráculo Records", "oraculo"],
  ["Tristan Bejawn", "tristanbejawn"],
  ["The Monolith Project", "themonolithproject", "themonolithproject-scene-poster.webp", "themonolithproject-scene-poster.webp"],
  ["Faih Bitrou", "faih-bitrou"],
  ["VIGOR", "vigorvigorous"],
  ["boy", "learnwithregrets"],
  ["Sina Golnoghreh", "sinawings"],
  ["Origins Inconclusive", "originsinconclusive"],
  ["Matthew Joseph", "matthewjoseph"],
  ["DJ Lofi", "dj-lofi"],
  ["instinkt lab", "instinktlab"],
  ["Dais Records", "daisrecords"],
];
const NO_FRAME = ["vigorvigorous.com", "daisrecords.com", "brentfoster.com"];
const portrait = () => innerWidth / innerHeight < 0.8;
const touch = matchMedia("(hover: none)").matches;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const all = window.PROJECTS || [];
const scenes = [{ type: "intro", title: "Esi Khoshhal", sub: "Websites for artists, musicians and independent brands" }];
for (const [t, slug, desk, mob] of PICK) {
  const p = all.find(x => x.title === t); if (!p) continue;
  scenes.push({ type: "work", title: p.title, sub: p.client, url: p.url, p,
    framable: !NO_FRAME.some(h => p.url.includes(h)),
    desk: IMG + (desk || `${slug}-desktop.webp`), mob: IMG + (mob || `${slug}-mobile.webp`) });
}
const N = scenes.length, LAST = N - 1;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (window.Lenis && !reduce) {
  lenis = new window.Lenis({ lerp: 0.1 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
const scrollY_ = () => lenis ? lenis.scroll : window.scrollY;
let autoUntil = 0; // no snapping while a jump is under way
const scrollToY = (y, duration = 1.2) => {
  autoUntil = performance.now() + duration * 1000 + 150;
  if (!lenis) return window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  lenis.scrollTo(y, { duration, force: true });
};
addEventListener("wheel", () => { autoUntil = 0; }, { passive: true });

/* ---------- journey geometry: one scene per step of scrolling ---------- */
const journey = $("work");
let stepPx = 600, jTop = 0, vh = innerHeight, lastW = innerWidth;
function measure() {
  vh = document.documentElement.clientHeight;
  stepPx = Math.round(vh * (portrait() ? .7 : .85));
  journey.style.height = `${LAST * stepPx + vh}px`;
  jTop = journey.getBoundingClientRect().top + window.scrollY;
}
const sceneY = i => jTop + i * stepPx;

/* ---------- WebGL world ---------- */
const cv = $("world");
const gl = cv.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });

const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uPos, uSpacing, uZoom, uOpen, uZoomSlot, uCy, uRough, uTop;
uniform vec2 uHalf, uMouse;
uniform sampler2D uT0, uT1, uT2, uT3;
uniform vec4 uInfo[4];   // x hasTex, y texAspect, z scene index, w visible
uniform vec3 uGlow[4];
out vec4 o;

float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
float sdBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }

vec3 tex(int i, vec2 uv, vec2 dx, vec2 dy){
  if(i==0) return textureGrad(uT0,uv,dx,dy).rgb;
  if(i==1) return textureGrad(uT1,uv,dx,dy).rgb;
  if(i==2) return textureGrad(uT2,uv,dx,dy).rgb;
  return textureGrad(uT3,uv,dx,dy).rgb;
}

void main(){
  vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  float asp = uRes.x / uRes.y;
  float t = uTime;
  float px = 1.5 / uRes.y;
  float camX = uPos * uSpacing;
  vec2 m = uMouse;

  // dune crest the portals stand behind
  float wx = p.x + camX*.55;
  float crest = uCy - uHalf.y*.74 + .028*sin(wx*2.3+1.7) + .07*(fbm(vec2(wx*1.1, 2.7))-.5) - uZoom*.9;

  vec3 col = vec3(0.);
  vec3 light = vec3(0.);
  float insideAny = 0.;
  float above = smoothstep(-px, px, p.y - crest);

  for(int i=0;i<4;i++){
    vec4 inf = uInfo[i];
    if(inf.w < .5) continue;
    float k = inf.z;
    float cx = (k - uPos) * uSpacing;
    float focus = clamp(1. - abs(cx)/(uSpacing*1.05), 0., 1.);
    float isZ = step(abs(k - uZoomSlot), .1) * uZoom;
    vec2 half_ = mix(uHalf * mix(.84, 1., focus), vec2(asp*.5+.08, .58), isZ);
    if(k < .5) half_ *= uOpen;
    vec2 c = vec2(cx, mix(uCy, 0., isZ)) + m*.012*focus*(1.-isZ);
    vec2 q = p - c;
    float seed = k*7.31;
    float edge = (1.-isZ);
    float d = sdBox(q, half_, .05*uRough*(1.-isZ));
    d += (fbm(q*2.2/uRough + seed + vec2(t*.04, -t*.03)) - .5) * .11 * uRough * edge;
    d += (vn(q*26./uRough + seed) - .5) * .012 * mix(1., uRough, .5) * edge;
    float inside = smoothstep(px, -px, d);

    vec3 g = uGlow[i];
    float bright = mix(.3, 1., focus*focus);
    // light thrown from the opening
    light += g * bright * (exp(-max(d,0.)*7.)*.55 + exp(-max(d,0.)*42.)*.9) * edge;

    if(inside > 0.){
      vec3 c2;
      if(inf.x > .5){
        vec2 b = q / (2.*half_) + .5;
        float boxA = half_.x/half_.y, A = inf.y;
        vec2 s = vec2(1.);
        if(boxA > A) s.y = A/boxA; else s.x = boxA/A;
        float z = mix(.9, 1., isZ);
        vec2 uv = .5 + (b-.5)*s*z - m*.018*s*(1.-isZ);
        uv.y += (1. - s.y*z) * .5 * uTop * (1.-isZ);
        uv += (vec2(vn(b*5.+t*.15), vn(b*5.-t*.15+9.))-.5) * .006 * edge;
        vec2 dx = dFdx(uv), dy = dFdy(uv);
        c2 = tex(i, uv, dx, dy);
        float l = dot(c2, vec3(.3,.59,.11));
        c2 = mix(vec3(l), c2, mix(.25, 1., focus)) * bright;
        // inner falloff near the ragged edge, and a soft band so the title reads
        c2 *= mix(1., smoothstep(0., -.05, d)*.4+.6, edge);
      } else {
        // a void with slow drifting dust
        vec2 dq = q*28. + vec2(t*.25, t*.12);
        vec2 cell = floor(dq), f = fract(dq) - .5;
        vec2 off = vec2(h21(cell), h21(cell+3.1)) - .5;
        float r = length(f - off*.7);
        float tw = .5 + .5*sin(t*1.5 + h21(cell+7.)*6.28);
        float dust = smoothstep(.07, .0, r) * step(.82, h21(cell+11.)) * tw;
        c2 = vec3(.006) + dust*vec3(1.,.93,.82)*.8*smoothstep(0.,-.08,d);
      }
      float vis = inside * (isZ > .5 ? 1. : above);
      col = mix(col, c2, vis);
      insideAny = max(insideAny, vis);
    }
  }

  // sand in front, lit by the openings
  if(above < 1.){
    float depth = max(crest - p.y, 0.);
    float z = 1. / (depth*3. + .12);
    float rip = sin((p.x*z*.9 + camX*.35)*9. + fbm(vec2(wx*3., depth*7.))*5. + depth*40.);
    float tex_ = fbm(vec2(wx*14., depth*30.));
    float shade = .022 + .028*rip + .03*tex_;
    vec3 lit = light * (.55*exp(-depth*5.)) * (.75+.25*rip);
    vec3 sand = vec3(shade) + lit + vec3(.9,.95,1.)*exp(-depth*60.)*length(light)*.18;
    col = mix(sand, col, above);
  }
  // air glow behind
  col += light * .4 * above * (1. - insideAny) * (1. - smoothstep(-.1, .6, p.y)*.4);

  // vignette and grain
  col *= 1. - .45*pow(length(p/vec2(asp*.62, .62)), 2.6);
  col += (h21(gl_FragCoord.xy + fract(t)*317.) - .5) * .035;
  o = vec4(pow(max(col, 0.), vec3(.95)), 1.);
}`;

let pos = 0, target = 0, zoom = 0, zoomTarget = 0, open = 0, mx = 0, my = 0, smx = 0, smy = 0, settled = -1, zoomSlot = -1;
const half = [0, 0]; let spacing = 1, cy = .015, rough = 1, topAlign = 0;
const textures = new Array(N).fill(null);
const glows = scenes.map(s => s.type === "work" ? [.5,.5,.5] : [.95, .88, .78]);
const aspects = new Array(N).fill(1.6);
let u = null, blank = null;

function layoutGL() {
  if (!gl) return;
  const dpr = Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 1.6);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  gl.viewport(0, 0, cv.width, cv.height);
  const asp = innerWidth / innerHeight;
  if (portrait()) {
    // phone: a tall, phone-shaped frame that shows the top of each site, with neighbours peeking in
    half[0] = asp * .5 * .66; half[1] = Math.min(half[0] / .54, .29); half[0] = half[1] * .54;
    cy = .075; rough = .55; topAlign = 1;
    spacing = asp * .5 * .74 + half[0];
  } else {
    const short = innerHeight < 520; // phones held sideways
    half[0] = Math.min(asp * .5 * .6, .52); half[1] = Math.min(half[0] / 1.55, short ? .26 : .33); cy = short ? -.01 : .03; rough = 1; topAlign = 0;
    spacing = asp * .5 * .82 + half[0];
  }
}

if (gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  u = { res: U("uRes"), time: U("uTime"), pos: U("uPos"), spacing: U("uSpacing"), zoom: U("uZoom"), open: U("uOpen"),
    zslot: U("uZoomSlot"), cy: U("uCy"), rough: U("uRough"), top: U("uTop"), half: U("uHalf"), mouse: U("uMouse"), info: U("uInfo"), glow: U("uGlow") };
  ["uT0","uT1","uT2","uT3"].forEach((n, i) => gl.uniform1i(U(n), i));
  blank = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
} else {
  document.body.classList.add("no-gl");
}

function loadImg(src) { return new Promise(res => { const im = new Image(); im.decoding = "async";
  im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function upload(i, im) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (textures[i]) gl.deleteTexture(textures[i]);
  textures[i] = t; aspects[i] = im.naturalWidth / im.naturalHeight;
  // average colour, lifted, becomes the light the opening throws
  const c = document.createElement("canvas"); c.width = c.height = 6; const x = c.getContext("2d");
  x.drawImage(im, 0, 0, 6, 6); const d = x.getImageData(0, 0, 6, 6).data; let r = 0, g = 0, b = 0;
  for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k+1]; b += d[k+2]; }
  const n = d.length / 4; let v = [r/n/255, g/n/255, b/n/255]; const mxv = Math.max(...v, .05);
  const lum = .3*v[0] + .59*v[1] + .11*v[2], gain = .55 + .35 * Math.min(1, lum * 2.2);
  glows[i] = v.map(c => gain * (.3 + .7 * Math.min(1, c / mxv)));
}

/* ---------- scene text ---------- */
const titleEl = $("title"), h1 = $("h1"), sub = $("sub"), cta = $("cta");
const split = s => [...s].map((c, i) => c === " " ? " " : `<span class="ch" style="transition-delay:${i*22}ms">${esc(c)}</span>`).join("");
function showText(i) {
  const s = scenes[i];
  titleEl.classList.remove("in");
  document.body.classList.toggle("intro", s.type === "intro");
  setTimeout(() => {
    document.body.classList.toggle("work", s.type === "work");
    h1.innerHTML = split(s.title); sub.textContent = s.sub || "";
    $("num").textContent = s.type === "work" ? `${pad(i)} / ${pad(LAST)}` : "";
    requestAnimationFrame(() => requestAnimationFrame(() => titleEl.classList.add("in")));
  }, 120);
  const pv = scenes[i-1], nx = scenes[i+1];
  $("prev").classList.toggle("hide", !pv);
  if (pv) $("prev").querySelector("b").textContent = pv.type === "intro" ? "Start" : pv.title;
  $("next").querySelector("b").textContent = nx ? nx.title : "All projects";
  if (s.type === "intro") { cta.innerHTML = (touch ? "Swipe up to explore" : "Scroll to start exploring") + ' <span class="arrow"></span>'; cta.href = "#work"; cta.removeAttribute("target"); }
  else { cta.innerHTML = s.framable ? "Step inside the site" : "Visit the site ↗"; cta.href = s.url; cta.target = s.framable ? "" : "_blank"; }
}

/* ---------- scroll drives the camera, then settles on the nearest scene ---------- */
let snapT = 0, touching = false;
function onScroll() {
  const y = scrollY_();
  target = clamp((y - jTop) / stepPx, 0, LAST);
  document.body.classList.toggle("past", y > jTop + LAST * stepPx + vh * .5);
  $("railFill").style.transform = `scaleY(${target / LAST})`;
  clearTimeout(snapT);
  if (!touching) snapT = setTimeout(snap, touch ? 180 : 140);
}
function snap() {
  if (zoomTarget || reduce || performance.now() < autoUntil) return;
  if (lenis && lenis.isScrolling) { snapT = setTimeout(snap, 120); return; }
  const rel = (scrollY_() - jTop) / stepPx;
  if (rel <= 0 || rel >= LAST) return; // above the journey, or already past it
  const r = Math.round(rel);
  if (Math.abs(rel - r) > .004) scrollToY(sceneY(r), .8);
}
if (lenis) lenis.on("scroll", onScroll); else addEventListener("scroll", onScroll, { passive: true });
addEventListener("touchstart", () => { touching = true; autoUntil = 0; clearTimeout(snapT); }, { passive: true });
addEventListener("touchend", () => { touching = false; onScroll(); }, { passive: true });

const goScene = i => scrollToY(sceneY(clamp(i, 0, LAST)), 1.1);
$("prev").onclick = () => goScene(Math.round(target) - 1);
$("next").onclick = () => Math.round(target) >= LAST ? scrollToY($("index").getBoundingClientRect().top + scrollY_() - 60) : goScene(Math.round(target) + 1);
cta.addEventListener("click", e => {
  const s = scenes[Math.round(target)];
  if (s.type === "intro") { e.preventDefault(); goScene(1); }
  else if (s.framable) { e.preventDefault(); stepInside(); }
});

/* header links */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  if (a === cta) return;
  a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    e.preventDefault();
    if (id === "#top") return scrollToY(0, 1.4);
    if (id === "#work") return goScene(1);
    const el = document.querySelector(id); if (el) scrollToY(el.getBoundingClientRect().top + scrollY_() - 20, 1.4);
  });
});

/* hover and click on the opening */
function inJourney() { const y = scrollY_(); return y >= jTop - 2 && y <= jTop + LAST * stepPx + 2; }
function overPortal(x, y) {
  const s = scenes[Math.round(pos)];
  if (!s || s.type !== "work" || Math.abs(pos - Math.round(pos)) > .05 || !inJourney()) return false;
  const px = (x - innerWidth / 2) / innerHeight, py = -(y - innerHeight / 2) / innerHeight;
  return Math.abs(px) < half[0] * .92 && Math.abs(py - cy) < half[1] * .92 && py > cy - half[1] * .6;
}
addEventListener("pointermove", e => {
  mx = (e.clientX / innerWidth - .5) * 2; my = -(e.clientY / innerHeight - .5) * 2;
  document.body.classList.toggle("hovering", !zoomTarget && !touch && overPortal(e.clientX, e.clientY));
}, { passive: true });
document.addEventListener("click", e => {
  if (e.target.closest("a, button, input, textarea, label, .sec")) return;
  if (overPortal(e.clientX, e.clientY)) stepInside();
});

/* step inside: the opening grows to fill the screen, then the real site loads */
function stepInside() {
  const i = Math.round(target), s = scenes[i];
  if (!s || s.type !== "work") return;
  if (!s.framable) { window.open(s.url, "_blank", "noopener"); return; }
  zoomSlot = i; zoomTarget = 1; document.body.classList.remove("hovering"); document.body.classList.add("inside");
  if (lenis) lenis.stop();
  $("ext").href = s.url;
  setTimeout(() => { $("frame").src = s.url; $("live").classList.add("open"); $("live").setAttribute("aria-hidden", "false"); }, 900);
}
function closeLive() {
  if (!zoomTarget) return;
  $("live").classList.remove("open"); $("live").setAttribute("aria-hidden", "true");
  setTimeout(() => { $("frame").src = "about:blank"; zoomTarget = 0; document.body.classList.remove("inside"); if (lenis) lenis.start(); }, 350);
}
$("back").onclick = closeLive;
addEventListener("keydown", e => { if (e.key === "Escape") closeLive(); });

/* ---------- index ---------- */
const rows = $("rows");
const sceneOf = p => scenes.find(s => s.p === p);
rows.innerHTML = all.map((p, i) => `
  <li data-i="${i}">
    <a href="${esc(p.url || "#")}" target="_blank" rel="noopener" title="${esc(p.summary)}">
      <span class="n">${pad(i + 1)}</span><span class="t">${esc(p.title)}</span>
      <span class="c">${esc(p.client)}</span><span class="m">${esc(p.medium)}</span><span class="go">↗</span>
    </a>
  </li>`).join("");
$("index-count").textContent = `${all.length} projects`;
const previewSrc = p => { const s = sceneOf(p); return s ? s.desk : p.image ? "../../" + p.image : ""; };
const preview = $("preview");
if (matchMedia("(hover: hover) and (min-width: 861px)").matches) {
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
  const follow = () => {
    px += (tx - px) * .18; py += (ty - py) * .18;
    preview.style.left = px + "px"; preview.style.top = py + "px";
    raf = Math.abs(tx - px) + Math.abs(ty - py) > .5 ? requestAnimationFrame(follow) : 0;
  };
  rows.addEventListener("pointermove", e => {
    tx = e.clientX + 260; ty = e.clientY;
    if (!preview.classList.contains("on")) { px = tx; py = ty; }
    if (!raf) raf = requestAnimationFrame(follow);
  });
  rows.querySelectorAll("li").forEach(li => li.addEventListener("pointerenter", () => {
    const src = previewSrc(all[li.dataset.i]);
    if (!src) { preview.classList.remove("on"); return; }
    preview.innerHTML = `<img src="${esc(src)}" alt="">`;
    preview.classList.add("on");
  }));
  rows.addEventListener("pointerleave", () => preview.classList.remove("on"));
}

/* rows and statement come in as they scroll past */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .2 });
rows.querySelectorAll("li").forEach((li, k) => { li.style.transitionDelay = `${(k % 6) * 40}ms`; io.observe(li); });
const st = $("statement");
st.innerHTML = st.textContent.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ");
const words = [...st.querySelectorAll(".w")];
const lightWords = () => {
  const r = st.getBoundingClientRect();
  const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .4), 0, 1);
  words.forEach((w, i) => w.classList.toggle("lit", reduce || i < p * words.length * 1.1));
};
if (lenis) lenis.on("scroll", lightWords); else addEventListener("scroll", lightWords, { passive: true });

/* ---------- contact form (FormSubmit, with an email fallback) ---------- */
const cform = $("cform");
const status = $("form-status"), send = cform.querySelector(".send"), label = send.querySelector("span");
cform.addEventListener("submit", async e => {
  e.preventDefault();
  if (!cform.reportValidity()) return;
  const data = Object.fromEntries(new FormData(cform));
  if (data._honey) return; // a bot filled the hidden field
  send.disabled = true; label.textContent = "Sending"; status.textContent = "";
  try {
    const res = await fetch(cform.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
    const out = await res.json().catch(() => ({}));
    if (/activat/i.test(out.message || "")) {
      send.disabled = false; label.textContent = "Send message";
      status.textContent = "Almost ready: open the \"Activate Form\" email from FormSubmit, then send again."; return;
    }
    if (!res.ok || String(out.success) === "false") throw new Error(out.message || res.status);
    cform.classList.add("is-sent"); label.textContent = "Sent";
    status.textContent = `Thank you, ${data.name.split(" ")[0]}. I'll write back to ${data.email}.`;
    cform.reset();
  } catch (err) {
    send.disabled = false; label.textContent = "Send message";
    const mail = $("email").getAttribute("href").replace("mailto:", "");
    const body = `${data.message}\n\n${data.name} (${data.email})\nProject: ${data.project}`;
    status.innerHTML = `It didn't go through from here. <a href="mailto:${mail}?subject=${encodeURIComponent("New enquiry from your portfolio")}&body=${encodeURIComponent(body)}">Send it by email instead</a>, it's already written.`;
  }
});
$("copy").addEventListener("click", () => {
  const btn = $("copy"), done = m => { btn.textContent = m; setTimeout(() => (btn.textContent = "Copy email"), 1800); };
  try { navigator.clipboard.writeText($("email").textContent.trim()).then(() => done("Copied"), () => done("Press Ctrl+C")); }
  catch (_) { done("Press Ctrl+C"); }
});

/* ---------- loop ---------- */
const info = new Float32Array(16), glowArr = new Float32Array(12);
const t0 = performance.now();
let prevT = t0;
function frame(now) {
  requestAnimationFrame(frame);
  const t = (now - t0) / 1000, dt = Math.min(.1, (now - prevT) / 1000); prevT = now;
  pos += (target - pos) * (reduce ? 1 : 1 - Math.exp(-dt * 9));
  if (Math.abs(target - pos) < 1e-4) pos = target;
  zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 4));
  smx += (mx - smx) * (1 - Math.exp(-dt * 3)); smy += (my - smy) * (1 - Math.exp(-dt * 3));
  const near = Math.round(pos);
  if (Math.abs(pos - near) < .1 && near !== settled) { settled = near; showText(near); }
  if (Math.abs(pos - near) > .25 && settled !== -1) { titleEl.classList.remove("in"); document.body.classList.remove("intro"); settled = -1; }

  // the canvas sits behind the content sections; skip drawing once they cover it
  if (!gl || scrollY_() > jTop + LAST * stepPx + vh * 1.05 || document.hidden) return;
  const base = Math.floor(pos) - 1;
  for (let s = 0; s < 4; s++) {
    const idx = base + s, ok = idx >= 0 && idx < N;
    gl.activeTexture(gl.TEXTURE0 + s);
    gl.bindTexture(gl.TEXTURE_2D, ok && textures[idx] ? textures[idx] : blank);
    info[s*4] = ok && textures[idx] ? 1 : 0; info[s*4+1] = ok ? aspects[idx] : 1;
    info[s*4+2] = idx; info[s*4+3] = ok ? 1 : 0;
    const g = ok ? glows[idx] : [0,0,0]; glowArr[s*3] = g[0]; glowArr[s*3+1] = g[1]; glowArr[s*3+2] = g[2];
  }
  gl.uniform2f(u.res, cv.width, cv.height); gl.uniform1f(u.time, t);
  gl.uniform1f(u.pos, pos); gl.uniform1f(u.spacing, spacing); gl.uniform1f(u.zoom, zoom);
  gl.uniform1f(u.open, open); gl.uniform1f(u.cy, cy); gl.uniform1f(u.rough, rough); gl.uniform1f(u.top, topAlign); gl.uniform1f(u.zslot, zoomSlot);
  gl.uniform2f(u.half, half[0], half[1]); gl.uniform2f(u.mouse, smx, smy);
  gl.uniform4fv(u.info, info); gl.uniform3fv(u.glow, glowArr);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------- start ---------- */
measure(); layoutGL(); onScroll();
let lastPortrait = portrait();
addEventListener("resize", () => {
  layoutGL();
  // phones resize as the address bar moves: only re-measure the page for real size changes
  if (innerWidth !== lastW || Math.abs(document.documentElement.clientHeight - vh) > 140) { lastW = innerWidth; measure(); onScroll(); }
  if (gl && portrait() !== lastPortrait) {
    lastPortrait = portrait();
    scenes.forEach((s, i) => { if (s.type === "work") loadImg(lastPortrait ? s.mob : s.desk).then(im => im && upload(i, im)); });
  }
});
if (location.hash && location.hash !== "#top") {
  const el = document.querySelector(location.hash);
  if (el) setTimeout(() => { measure(); scrollToY(el.getBoundingClientRect().top + scrollY_() - 20, 0); }, 50);
}
const ln = $("ln"); let loaded = 0;
const jobs = gl ? scenes.map((s, i) => s.type !== "work" ? Promise.resolve() :
  loadImg(portrait() ? s.mob : s.desk).then(im => { if (im) upload(i, im); loaded++; ln.textContent = String(Math.round(loaded / LAST * 100)).padStart(3, "0"); })) : [];
requestAnimationFrame(frame);
showText(0);
Promise.all(jobs).then(() => {
  $("loader").classList.add("done");
  const s0 = performance.now();
  (function grow(n) { const p = Math.min(1, (n - s0) / 1800); open = 1 - Math.pow(1 - p, 3); if (p < 1) requestAnimationFrame(grow); })(s0);
});
})();

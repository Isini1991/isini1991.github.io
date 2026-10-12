(() => {
  const projects = window.PROJECTS || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- render projects ---------- */
  const coverHTML = (p) => {
    const art = p.video
      ? `<video muted ${Array.isArray(p.video) ? "" : "loop "}playsinline preload="none" data-src="${esc([].concat(p.video).join("|"))}"${p.image ? ` poster="${esc(p.image)}"` : ""}></video>`
      : p.image
        ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
        : `<div class="cover-art"></div>`;
    return `<div class="cover shape-${esc(p.shape || "orb")}" style="--c1:${esc(p.colors[0])};--c2:${esc(p.colors[1])}">${art}</div>`;
  };
  const isExternal = (url) => /^https?:/.test(url);
  const linkAttrs = (p) => `href="${esc(p.url || "#")}"${isExternal(p.url) ? ' target="_blank" rel="noopener"' : ""}`;

  // Live embeds only work on the real site, not inside a framed preview.
  const canEmbed = window.self === window.top && window.matchMedia("(min-width: 861px)").matches;
  const liveButton = (p, i) => p.live && canEmbed && isExternal(p.url)
    ? `<button class="live-btn label" type="button" data-live="${i}">Try it live</button>` : "";

  const featured = projects.filter((p) => p.featured);
  const track = document.getElementById("track");
  track.innerHTML = featured.map((p) => `
    <div class="card" data-i="${projects.indexOf(p)}">
      <a class="card-link" ${linkAttrs(p)}>
        ${coverHTML(p)}
        <div class="card-label">
          <span class="no">Cat. ${pad(projects.indexOf(p) + 1)}</span>
          <h3>${esc(p.title)}${p.year ? ", " + p.year : ""}</h3>
          <span class="client">${esc(p.client)}</span>
          <span class="medium">${esc(p.medium)}</span>
        </div>
      </a>
      ${liveButton(p, projects.indexOf(p))}
    </div>`).join("");

  const rows = document.getElementById("rows");
  rows.innerHTML = projects.map((p, i) => `
    <li class="row" data-i="${i}">
      <a ${linkAttrs(p)} title="${esc(p.summary)}">
        <span class="n">${pad(i + 1)}</span>
        <span class="t">${esc(p.title)}</span>
        <span class="c">${esc(p.client)}</span>
        <span class="m">${esc(p.medium)}</span>
        <span class="y">${p.year || ""}</span>
      </a>
    </li>`).join("");
  document.getElementById("index-count").textContent = `${projects.length} projects`;
  const count = document.getElementById("count");
  count.textContent = `01 / ${pad(featured.length)}`;

  /* ---------- motion clips: play while on screen ---------- */
  const startVideo = (v) => {
    if (!v.src) {
      const list = v.dataset.src.split("|");
      v.src = list[0];
      if (list.length > 1) { // several clips play one after another, then repeat
        let i = 0;
        v.addEventListener("ended", () => { i = (i + 1) % list.length; v.src = list[i]; v.play().catch(() => {}); });
      }
    }
    const playing = v.play();
    if (playing) playing.catch(() => {});
  };
  // Only the most visible clip plays, so the page never decodes several videos at once.
  const ratios = new Map();
  let current = null;
  const pickVideo = () => {
    let best = null, bestRatio = 0.35;
    ratios.forEach((r, v) => { if (r > bestRatio) { best = v; bestRatio = r; } });
    if (best === current) return;
    if (current) current.pause();
    current = best;
    if (current && !reduceMotion) startVideo(current);
  };
  const videoIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
    pickVideo();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  track.querySelectorAll("video[data-src]").forEach((v) => {
    videoIO.observe(v);
    if (reduceMotion) { // with reduced motion, clips only play while hovered
      const card = v.closest(".card");
      card.addEventListener("pointerenter", () => startVideo(v));
      card.addEventListener("pointerleave", () => v.pause());
    }
  });

  /* ---------- live sites inside the gallery cards ---------- */
  // On desktop, cards marked `embed` run the real site, scaled down, so its motion is
  // smooth and true to speed. Only the card most in view runs a site at any moment.
  const liveCovers = canEmbed && !reduceMotion && window.matchMedia("(hover: hover)").matches;
  if (liveCovers) {
    const SITE_W = 1440, SITE_H = 900;
    const coverRatios = new Map();
    let active = null;
    const mount = (card) => {
      const p = projects[card.dataset.i];
      const cover = card.querySelector(".cover");
      if (cover.querySelector("iframe")) return;
      const frame = document.createElement("iframe");
      frame.className = "cover-live" + (p.interactive ? " is-interactive" : "");
      frame.src = p.url;
      frame.title = `${p.title}, live`;
      frame.setAttribute("tabindex", "-1");
      frame.setAttribute("allow", "autoplay");
      frame.width = SITE_W; frame.height = SITE_H;
      frame.style.transform = `scale(${cover.clientWidth / SITE_W})`;
      frame.addEventListener("load", () => setTimeout(() => frame.classList.add("is-ready"), 600));
      cover.append(frame);
    };
    const unmount = (card) => card.querySelector(".cover-live")?.remove();
    const pick = () => {
      let best = null, bestRatio = 0.5;
      coverRatios.forEach((r, card) => { if (r > bestRatio) { best = card; bestRatio = r; } });
      if (best === active) return;
      if (active) unmount(active);
      active = best;
      if (active) mount(active);
    };
    const coverIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => coverRatios.set(e.target.closest(".card"), e.isIntersecting ? e.intersectionRatio : 0));
      clearTimeout(pick.t);
      pick.t = setTimeout(pick, 250); // wait for scrolling to settle before loading a site
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    track.querySelectorAll(".card").forEach((card) => {
      if (projects[card.dataset.i].embed) coverIO.observe(card.querySelector(".cover"));
    });
    window.addEventListener("resize", () => track.querySelectorAll(".cover-live").forEach((f) => {
      f.style.transform = `scale(${f.parentElement.clientWidth / SITE_W})`;
    }));
  }

  /* ---------- live embed ---------- */
  const live = document.getElementById("live");
  if (live && canEmbed) {
    const frame = live.querySelector("iframe");
    track.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-live]");
      if (!btn) return;
      const p = projects[btn.dataset.live];
      live.querySelector(".live-title").textContent = p.title;
      live.querySelector(".live-open").href = p.url;
      frame.src = p.url;
      frame.title = `${p.title}, live site`;
      if (lenis) lenis.stop();
      live.showModal();
    });
    live.addEventListener("close", () => { frame.src = "about:blank"; if (lenis) lenis.start(); });
    live.querySelector(".live-close").addEventListener("click", () => live.close());
    live.addEventListener("click", (e) => { if (e.target === live) live.close(); });
  }

  /* ---------- copy email ---------- */
  const copyBtn = document.getElementById("copy");
  copyBtn.addEventListener("click", () => {
    const email = document.getElementById("email").textContent.trim();
    const done = (msg) => { copyBtn.textContent = msg; setTimeout(() => (copyBtn.textContent = "Copy email"), 1800); };
    const selectIt = () => {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("email"));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      done("Selected, press Ctrl+C");
    };
    try {
      navigator.clipboard.writeText(email).then(() => done("Copied"), selectIt);
    } catch (e) { selectIt(); }
  });

  /* ---------- index hover preview ---------- */
  const preview = document.getElementById("preview");
  if (window.matchMedia("(hover: hover) and (min-width: 861px)").matches) {
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const follow = () => {
      px += (tx - px) * 0.18; py += (ty - py) * 0.18;
      preview.style.left = px + "px"; preview.style.top = py + "px";
      raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    rows.addEventListener("pointermove", (e) => {
      tx = e.clientX + 160; ty = e.clientY;
      if (!preview.classList.contains("on")) { px = tx; py = ty; }
      if (!raf) raf = requestAnimationFrame(follow);
    });
    rows.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("pointerenter", () => {
        preview.innerHTML = coverHTML(projects[row.dataset.i]);
        const v = preview.querySelector("video");
        if (v) startVideo(v);
        preview.classList.add("on");
      });
    });
    rows.addEventListener("pointerleave", () => preview.classList.remove("on"));
  }

  /* ---------- smooth scroll + scroll animation ---------- */
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  let lenis = null;

  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.1 });
    if (gsap && ST) {
      lenis.on("scroll", ST.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id.length > 1 ? document.querySelector(id) : null;
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: id === "#work" ? 0 : -64 });
      else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  if (gsap && ST) {
    gsap.registerPlugin(ST);

    if (!reduceMotion) {
      // Load sequence: headline lines rise out of their masks, the artwork unveils.
      gsap.from(".hero h1 .line > span", { yPercent: 110, duration: 1.15, stagger: 0.09, ease: "power4.out", delay: 0.1 });
      gsap.from(".artwork-frame", { clipPath: "inset(100% 0 0 0)", duration: 1.4, ease: "power4.inOut", delay: 0.2 });
      gsap.from([".hero-intro", ".hero-meta", ".wall-label"], { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", delay: 0.6 });

      // About statement fills in word by word as it scrolls past.
      const statement = document.querySelector(".statement");
      const wrapWords = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((w) => {
              if (!w.trim()) { frag.append(w); return; }
              const s = document.createElement("span"); s.className = "w"; s.textContent = w; frag.append(s);
            });
            child.replaceWith(frag);
          } else wrapWords(child);
        });
      };
      wrapWords(statement);
      gsap.fromTo(statement.querySelectorAll(".w"),
        { opacity: 0.28 },
        { opacity: 1, stagger: 0.05, ease: "none",
          scrollTrigger: { trigger: statement, start: "top 85%", end: "bottom 45%", scrub: true } });

      // Index rows drift in slightly from their resting position.
      gsap.utils.toArray(".row").forEach((row) => {
        gsap.from(row, { x: 24, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: row, start: "top 92%" } });
      });
    }

    // Horizontal gallery wall: pinned and scrubbed on wide screens only.
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const section = document.getElementById("work");
      const wrap = section.querySelector(".track-wrap");
      const bar = document.getElementById("bar");
      section.classList.add("is-pinned");
      const distance = () => Math.max(0, track.scrollWidth - wrap.clientWidth + parseFloat(getComputedStyle(wrap).paddingLeft) * 2);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            bar.style.transform = `scaleX(${self.progress})`;
            count.textContent = `${pad(Math.round(self.progress * (featured.length - 1)) + 1)} / ${pad(featured.length)}`;
          }
        }
      });

      track.querySelectorAll(".card").forEach((card) => {
        const art = card.querySelector(".cover-art, .cover img");
        if (!art) return;
        gsap.fromTo(art, { xPercent: -5 }, {
          xPercent: 5, ease: "none",
          scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true }
        });
      });

      ST.refresh();
      return () => section.classList.remove("is-pinned");
    });
  }

  /* ---------- hero ink-wash shader ---------- */
  const canvas = document.getElementById("ink");
  const THREE = window.THREE;
  if (!THREE || !canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) { return; }
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const css = (name) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000");
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.62, 0.4) },
    uHover: { value: 0 },
    uPaper: { value: css("--paper") },
    uInk: { value: css("--ink") },
    uKlein: { value: css("--klein") }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime, uHover;
      uniform vec2 uRes, uMouse;
      uniform vec3 uPaper, uInk, uKlein;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0., a = .5; mat2 r = mat2(.8, -.6, .6, .8);
        for (int i = 0; i < 4; i++){ v += a * noise(p); p = r * p * 2.02; a *= .5; }
        return v;
      }
      void main(){
        vec2 aspect = vec2(uRes.x / uRes.y, 1.);
        vec2 p = (vUv - .5) * aspect * 2.4;
        vec2 m = (uMouse - .5) * aspect * 2.4;
        float t = uTime * .05;
        vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(p + 3. * q + vec2(1.7, 9.2) + t * 1.4), fbm(p + 3. * q + vec2(8.3, 2.8) - t));
        float f = fbm(p + 3. * r);
        float d = length(p - m);
        f += uHover * .32 * exp(-d * d * 2.2);
        float ink = smoothstep(.5, .62, f);
        float rim = smoothstep(.47, .5, f) - smoothstep(.5, .55, f);
        vec3 col = mix(uPaper, uKlein, ink);
        col = mix(col, uInk, rim * .12);
        col = mix(col, uKlein * .55, smoothstep(.72, .95, f) * .65);
        col += (hash(vUv * uRes + fract(uTime)) - .5) * .05;
        gl_FragColor = vec4(col, 1.);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  };
  new ResizeObserver(() => { resize(); if (reduceMotion) renderer.render(scene, camera); }).observe(canvas);
  resize();

  const refreshColors = () => {
    uniforms.uPaper.value = css("--paper");
    uniforms.uInk.value = css("--ink");
    uniforms.uKlein.value = css("--klein");
    if (reduceMotion) renderer.render(scene, camera);
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshColors);
  new MutationObserver(refreshColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  if (reduceMotion) { uniforms.uTime.value = 40; renderer.render(scene, camera); return; }

  const target = new THREE.Vector2(0.62, 0.4);
  let hoverTarget = 0, visible = true;
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    target.set((e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height);
    hoverTarget = 1;
  });
  canvas.addEventListener("pointerleave", () => (hoverTarget = 0));
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  uniforms.uTime.value = 12;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    uniforms.uTime.value += dt;
    uniforms.uMouse.value.lerp(target, 0.06);
    uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * 0.05;
    renderer.render(scene, camera);
  });
})();

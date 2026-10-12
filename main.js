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
        ? p.mobile
          ? `<picture><source media="(max-width: 899px)" srcset="${esc(p.mobile)}"><img src="${esc(p.image)}" alt="" loading="lazy"></picture>`
          : `<img src="${esc(p.image)}" alt="" loading="lazy">`
        : `<div class="cover-art"></div>`;
    return `<div class="cover shape-${esc(p.shape || "orb")}" style="--c1:${esc(p.colors[0])};--c2:${esc(p.colors[1])}">${art}</div>`;
  };
  const isExternal = (url) => /^https?:/.test(url);
  const linkAttrs = (p) => `href="${esc(p.url || "#")}"${isExternal(p.url) ? ' target="_blank" rel="noopener"' : ""}`;

  // Live embeds only work on the real site, not inside a framed preview.
  const canEmbed = window.self === window.top;
  const phone = window.matchMedia("(max-width: 899px)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const liveButton = (p, i) => p.live && canEmbed && isExternal(p.url)
    ? `<button class="live-btn label" type="button" data-live="${i}">Try it live</button>` : "";

  const featured = projects.filter((p) => p.featured);
  const track = document.getElementById("track");
  track.innerHTML = featured.map((p) => `
    <div class="card" data-i="${projects.indexOf(p)}">
      <a class="card-link" ${linkAttrs(p)} data-cursor="${p.embed && canEmbed ? "Live" : "Visit"}">
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
      <a ${linkAttrs(p)} title="${esc(p.summary)}" data-cursor="Visit">
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
  // Cards marked `embed` run the real site, scaled down, so its motion is smooth and
  // true to speed. Phones get the site's mobile layout in a portrait card. Only the
  // card most in view runs a site at any moment.
  const liveCovers = canEmbed && !reduceMotion;
  if (liveCovers) {
    const SITE_W = phone ? 390 : 1440;
    const coverRatios = new Map();
    let active = null;
    const mount = (card) => {
      const p = projects[card.dataset.i];
      const cover = card.querySelector(".cover");
      if (cover.querySelector("iframe")) return;
      const frame = document.createElement("iframe");
      frame.className = "cover-live" + (p.interactive && finePointer ? " is-interactive" : ""); // on touch, swipes must still scroll the page
      frame.src = p.url;
      frame.title = `${p.title}, live`;
      frame.setAttribute("tabindex", "-1");
      frame.setAttribute("allow", "autoplay");
      frame.width = SITE_W; frame.height = Math.round(SITE_W * cover.clientHeight / cover.clientWidth);
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
  /* ---------- intro: the name counts in, then lifts away ---------- */
  const intro = document.getElementById("intro");
  if (intro && gsap && !reduceMotion) {
    if (lenis) lenis.stop();
    const counter = { v: 0 };
    const out = document.getElementById("intro-count");
    gsap.timeline({ onComplete() { intro.classList.add("is-done"); if (lenis) lenis.start(); } })
      .from(".intro-word", { yPercent: 100, duration: 0.7, ease: "power4.out" })
      .to(counter, { v: 100, duration: 1, ease: "power2.inOut", onUpdate() { out.textContent = String(Math.round(counter.v)).padStart(3, "0"); } }, 0)
      .to(intro, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "+=0.1")
      .from(".hero h1 .line > span", { yPercent: 110, duration: 1.1, stagger: 0.08, ease: "power4.out" }, "-=0.45")
      .from([".hero-role", ".hero-side"], { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.08, ease: "power3.out" }, "-=0.8");
  } else if (intro) intro.classList.add("is-done");

  /* ---------- section jumps: a blue curtain wipes across ---------- */
  const curtain = document.getElementById("curtain");
  const jump = (target, id) => {
    const offset = id === "#work" ? 0 : -64;
    if (lenis) lenis.scrollTo(target, { offset, immediate: true, force: true });
    else window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY + offset);
  };
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id.length > 1 ? document.querySelector(id) : null;
      if (!target) return;
      e.preventDefault();
      if (!gsap || reduceMotion) { jump(target, id); return; }
      gsap.timeline()
        .set(curtain, { transformOrigin: "bottom" })
        .to(curtain, { scaleY: 1, duration: 0.5, ease: "power3.inOut" })
        .add(() => jump(target, id))
        .set(curtain, { transformOrigin: "top" })
        .to(curtain, { scaleY: 0, duration: 0.6, ease: "power3.inOut", delay: 0.05 });
    });
  });

  /* ---------- cursor: a dot that grows over links and names what a card does ---------- */
  const cursor = document.getElementById("cursor");
  if (cursor && window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
    const label = document.getElementById("cursor-label");
    document.documentElement.classList.add("has-cursor");
    let x = -100, y = -100, cx = x, cy = y;
    window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cursor.classList.remove("is-hidden"); }, { passive: true });
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) cursor.classList.add("is-hidden"); }); // left the page or entered a live site
    document.addEventListener("pointerover", (e) => {
      const el = e.target.closest("[data-cursor], a, button");
      const text = el && el.dataset.cursor;
      cursor.classList.toggle("is-label", !!text);
      cursor.classList.toggle("is-link", !!el && !text);
      if (text) label.textContent = text;
    });
    const follow = () => {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  if (gsap && ST) {
    gsap.registerPlugin(ST);

    if (!reduceMotion) {
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

    // Horizontal gallery wall: pinned and scrubbed, on phones too.
    ST.config({ ignoreMobileResize: true }); // the phone address bar showing/hiding must not re-layout the pin
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
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

  /* ---------- hero: the name as liquid type ---------- */
  // The pointer leaves a fading trail (rendered into a small texture each frame);
  // the name is pushed along that trail and splits into blue echoes.
  const canvas = document.getElementById("liquid");
  const THREE = window.THREE;
  if (!THREE || !canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  } catch (e) { return; }
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);
  const hero = canvas.parentElement;
  const css = (name) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());

  const textCanvas = document.createElement("canvas");
  const tctx = textCanvas.getContext("2d");
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.minFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;
  const drawName = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    textCanvas.width = Math.round(w * dpr); textCanvas.height = Math.round(h * dpr);
    const narrow = window.innerWidth < 760;
    const size = Math.min(window.innerWidth * (narrow ? 0.62 : 0.42), h * (narrow ? 0.5 : 0.6)) * dpr;
    tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    tctx.fillStyle = "#fff";
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.font = `800 ${size}px "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif`;
    if ("fontStretch" in tctx) tctx.fontStretch = "condensed";
    if ("letterSpacing" in tctx) tctx.letterSpacing = `${-0.05 * size}px`;
    tctx.fillText("Esi", textCanvas.width / 2, textCanvas.height * 0.44 + size * 0.04); // sits a little high, clear of the headline
    textTex.needsUpdate = true;
  };

  const quad = new THREE.PlaneGeometry(2, 2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let trailA = new THREE.WebGLRenderTarget(256, 160, rtOpts);
  let trailB = new THREE.WebGLRenderTarget(256, 160, rtOpts);
  const trailUniforms = {
    uPrev: { value: trailA.texture },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uVel: { value: new THREE.Vector2() },
    uStrength: { value: 0 },
    uAspect: { value: 1.6 }
  };
  const trailScene = new THREE.Scene();
  trailScene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: trailUniforms, vertexShader,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uPrev; uniform vec2 uMouse, uVel; uniform float uStrength, uAspect;
      varying vec2 vUv;
      void main(){
        vec3 prev = texture2D(uPrev, vUv).rgb;
        vec2 d = (vUv - uMouse) * vec2(uAspect, 1.);
        float brush = exp(-dot(d, d) * 160.) * uStrength;
        vec3 next = prev * vec3(.955, .96, .96);   // r: ink amount, gb: push direction
        next.r += brush;
        next.gb += uVel * brush * 7.;
        gl_FragColor = vec4(clamp(next, vec3(0., -4., -4.), vec3(1.5, 4., 4.)), 1.);
      }`
  })));

  const uniforms = {
    uText: { value: textTex },
    uTrail: { value: trailB.texture },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBg: { value: css("--paper") },
    uInk: { value: css("--ink") },
    uBlue: { value: css("--klein") }
  };
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms, vertexShader,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uText, uTrail; uniform vec3 uBg, uInk, uBlue; uniform float uTime; uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 t = texture2D(uTrail, vUv).rgb;
        vec2 drift = vec2(sin(vUv.y * 7. + uTime * .5), cos(vUv.x * 5. - uTime * .4)) * .0025;
        vec2 flow = t.gb * .05 + drift;
        float m0 = texture2D(uText, vUv - flow).r;
        float m1 = texture2D(uText, vUv - flow * 2.3).r;
        float m2 = texture2D(uText, vUv - flow * 3.6).r;
        vec3 col = uBg + uBlue * min(t.r, 1.) * .16;
        col = mix(col, uBlue * .55, m2 * .7);
        col = mix(col, uBlue, m1);
        col = mix(col, uInk, m0);
        col += (hash(vUv * uRes + fract(uTime)) - .5) * .035;
        gl_FragColor = vec4(col, 1.);
      }`
  })));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * dpr, h * dpr);
    trailUniforms.uAspect.value = w / h;
    drawName();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const frame = () => {
    trailUniforms.uPrev.value = trailA.texture;
    renderer.setRenderTarget(trailB);
    renderer.render(trailScene, camera);
    renderer.setRenderTarget(null);
    uniforms.uTrail.value = trailB.texture;
    renderer.render(scene, camera);
    [trailA, trailB] = [trailB, trailA];
  };
  const ready = () => { drawName(); frame(); hero.classList.add("is-gl"); };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  if (reduceMotion) return;

  const pointer = new THREE.Vector2(0.5, 0.5), last = new THREE.Vector2(0.5, 0.5);
  let lastMove = -1e9, visible = true;
  hero.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    pointer.set((e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height);
    lastMove = performance.now();
  }, { passive: true });
  // On phones the finger is the brush. Listeners are passive, so the page still scrolls.
  const touch = (e) => {
    const t = e.touches[0], b = canvas.getBoundingClientRect();
    if (!t) return;
    pointer.set((t.clientX - b.left) / b.width, 1 - (t.clientY - b.top) / b.height);
    if (e.type === "touchstart") last.copy(pointer);
    lastMove = performance.now();
  };
  hero.addEventListener("touchstart", touch, { passive: true });
  hero.addEventListener("touchmove", touch, { passive: true });
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    const t = (uniforms.uTime.value += dt);
    const idle = performance.now() - lastMove > 2500;
    if (idle) { // nobody is moving: a slow ghost hand keeps the name alive
      pointer.set(0.5 + Math.sin(t * 0.45) * 0.32, 0.5 + Math.sin(t * 0.7) * 0.18);
    }
    const vel = pointer.clone().sub(last);
    const speed = Math.min(vel.length() * 40, 1);
    trailUniforms.uMouse.value.copy(pointer);
    trailUniforms.uVel.value.copy(vel.clampLength(0, 0.05));
    trailUniforms.uStrength.value = idle ? speed * 0.5 : speed;
    last.copy(pointer);
    frame();
  });
})();

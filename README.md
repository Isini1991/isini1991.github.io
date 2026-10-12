# Esi portfolio

Static site, no build step. Open `index.html` through any static server, or upload the folder to Netlify, Vercel, Cloudflare Pages or GitHub Pages.

- `projects.js` holds all project data (currently placeholders). Add cover images to an `images/` folder and set each project's `image` field.
- `styles.css` holds the colour and type tokens at the top.
- `main.js` holds the smooth scroll (Lenis), scroll animation (GSAP ScrollTrigger) and the three.js ink shader in the hero.
- `node build-preview.mjs` rebuilds `preview.html`, a single-file copy used for sharing a preview.

Libraries load from jsDelivr: gsap 3.12.5, lenis 1.1.13, three 0.160.0. Reduced-motion users get a static page with no pinning or shader animation.

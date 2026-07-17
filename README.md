# Portfolio Website — Template Guide

A fully static, responsive portfolio for a **senior data scientist & AI consultant**,
built with plain **HTML5 / CSS3 / vanilla JavaScript**. No frameworks, no build
tools, no backend — drop it on **GitHub Pages** as-is.

Design language: Apple-inspired — minimal, lots of whitespace, large typography,
soft shadows, rounded cards, glassmorphism nav, and fade-in-on-scroll animations.

---

## Project structure

```
/index.html                      Home
/about.html                      Executive biography
/portfolio.html                  Apple-style product showcase (4 cards)
/projects/
   customer-growth.html          ┐
   demand-planning.html          │ Four case studies, identical keynote layout
   funnel-analysis.html          │ (customer-growth.html is the canonical template)
   market-basket.html            ┘
/css/styles.css                  Entire design system (edit tokens in :root)
/js/main.js                      Nav, hamburger, scroll-reveal, video placeholders
/images/                         Replace placeholder images (see images/README.md)
/videos/                         Replace placeholder videos (see videos/README.md)
/documents/                      Put resume.pdf here (see documents/README.md)
```

## How to make it yours

Everything you need to replace is marked with **`REPLACE:`** comments in the HTML
and with visible dashed **placeholder** frames on the rendered page.

1. **Your identity** — search all `.html` files for these and replace globally:
   - `Your Name` / `Your<span>Name</span>` (nav logo + footer)
   - `https://github.com/yourusername`
   - `https://www.linkedin.com/in/yourusername`
   - `you@example.com`
2. **Résumé** — drop your PDF at `documents/resume.pdf` (or update the links).
3. **Images** — see `images/README.md` for the exact file names each page expects.
   To use a real image, replace the `<div class="placeholder ...">…</div>` block
   with the `<img>` shown in the adjacent comment.
4. **Copy** — replace every "placeholder" sentence, headline, KPI value, and
   timeline entry. No Lorem Ipsum is used — each placeholder says what goes there.
5. **Dashboards & repos** — on project pages, replace `#REPLACE-...` hrefs
   (interactive dashboard URL, GitHub repo, notebook, dataset).

## Re-theming

All design tokens live in the `:root` block at the top of `css/styles.css` —
colors, fonts, spacing, radii, shadows, and motion. Change them once to
restyle the whole site. The accent color is `--color-accent` (Apple blue).

## Scroll animations

Any element with the `data-reveal` attribute fades/slides in when scrolled into
view (handled by `IntersectionObserver` in `js/main.js`). Add
`data-reveal-delay="1"` … `"6"` to stagger siblings. Respects
`prefers-reduced-motion`.

## Adding another case study

1. Copy `projects/customer-growth.html` to `projects/your-slug.html`.
2. Replace the project title, the image slug `customer-growth` (used in all asset
   paths), the hero technology tags, and the Next/Previous navigation links.
3. Add a card for it on `portfolio.html` (and optionally `index.html`).

## Local preview

It's pure static HTML — just open `index.html` in a browser. For correct
relative paths while testing, you can also run any static server, e.g.:

```
python -m http.server 8000
```

then visit <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push these files to a repository.
2. Settings → Pages → deploy from the `main` branch, root folder.
3. Your site goes live at `https://<username>.github.io/<repo>/`.

## Dependencies

Only two, both loaded from a CDN (no install step):
- **Google Fonts** — Inter
- **Font Awesome 6** — icons

Everything else is hand-written and dependency-free.

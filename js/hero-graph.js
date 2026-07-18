/* ==========================================================================
   hero-graph.js — "Fabric of Analytics" hero background
   --------------------------------------------------------------------------
   Vanilla JS + Canvas 2D. No libraries.

   A continuous, evenly-spaced mesh (a flexible "fabric") of connected data
   points stretched across the hero. At rest it breathes with an almost
   imperceptible swell. Every few seconds a SINGLE compression wave enters
   from just off the right edge and travels left, physically compressing the
   fabric along a smooth Gaussian profile and tinting that region from gray
   through soft blue to accent blue — like information flowing through
   connected enterprise data. The cursor stretches nearby fabric toward it.
   A subtle perspective adds depth. Honors prefers-reduced-motion (static
   mesh, no animation). Fades out as the hero scrolls away.

   Self-initialising: only runs if #heroGraph exists (the home page).
   ========================================================================== */

(function () {
  "use strict";

  var canvas = document.getElementById("heroGraph");
  if (!canvas) return;
  var hero = canvas.closest(".hero");
  if (!hero) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  var PI2 = Math.PI * 2;

  /* ---- Palette (RGB triplets) --------------------------------------------
     Resting fabric = medium/light gray. Wave = soft blue → accent blue. */
  var NODE_GRAY = [104, 110, 122];
  var LINE_GRAY = [150, 155, 165];
  var SOFT_BLUE = [92, 150, 232];
  var ACCENT    = [0, 113, 227];

  /* Resting opacities (spec: nodes 35–45%, lines 18–25%) */
  var NODE_ALPHA = 0.42;
  var LINE_ALPHA = 0.20;

  /* ---- Tunables ---- */
  var IDLE_AMP    = 2.6;   /* px — breathing amplitude */
  var WAVE_AMP    = 8;     /* px — max compression displacement (~5px effective) */
  var MOUSE_R     = 150;   /* px — cursor influence radius */
  var MOUSE_PULL  = 22;    /* px — max cursor stretch */
  var EASE        = 0.14;  /* per-frame position easing → elastic relaxation */
  var TOP_SCALE   = 0.94;  /* perspective: top slightly farther */
  var BOT_SCALE   = 1.06;  /* perspective: bottom slightly closer */

  /* ---- State ---- */
  var W = 0, H = 0, dpr = 1;
  var cxHalf = 0, cyHalf = 0;
  var nodes = [];
  var edges = [];          /* pairs of node indices */
  var ncols = 0, nrows = 0;

  var running = false, rafId = null;
  var epoch = 0, lastNow = 0;

  /* Single wave only */
  var wave = null;         /* { start, dur, sigma, xStart, xEnd } */
  var waveX = null;
  var nextWaveAt = 0;

  /* Mouse (flat-space, perspective is subtle enough to ignore for input) */
  var mouse = { x: -9999, y: -9999, active: false };
  var mFlatX = -9999, mFlatY = -9999, mInfluence = 0;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ----------------------------------------------------------------------
     Helpers
     ---------------------------------------------------------------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

  function isMobile() { return window.innerWidth < 640; }

  function targetNodes() {
    var w = window.innerWidth;
    if (w >= 1024) return 500;  /* desktop 180–220 */
    if (w >= 640) return 135;   /* tablet  120–150 */
    return 75;                  /* mobile  60–90   */
  }

  /* Perspective: uniform depth-scale about the centre. Top (small y) is
     pulled inward (farther); bottom pushed outward (closer). Barely visible. */
  function projX(fx, fy) {
    var s = TOP_SCALE + (BOT_SCALE - TOP_SCALE) * clamp01(fy / H);
    return cxHalf + (fx - cxHalf) * s;
  }
  function projY(fx, fy) {
    var s = TOP_SCALE + (BOT_SCALE - TOP_SCALE) * clamp01(fy / H);
    return cyHalf + (fy - cyHalf) * s;
  }

  /* ----------------------------------------------------------------------
     Sizing / DPR
     ---------------------------------------------------------------------- */
  function resize() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    cxHalf = W / 2;
    cyHalf = H / 2;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ----------------------------------------------------------------------
     Build the uniform mesh (with overscan so it runs edge-to-edge with no
     visible boundary and no empty regions).
     ---------------------------------------------------------------------- */
  function buildMesh() {
    var gap = Math.sqrt((W * H) / targetNodes());
    var visCols = Math.max(2, Math.round(W / gap));
    var visRows = Math.max(2, Math.round(H / gap));
    var gapX = W / visCols;
    var gapY = H / visRows;

    var OVER = 2; /* extra rings of nodes beyond each edge */
    ncols = visCols + OVER * 2 + 1;
    nrows = visRows + OVER * 2 + 1;

    nodes = [];
    for (var j = 0; j < nrows; j++) {
      for (var i = 0; i < ncols; i++) {
        var bx = (i - OVER) * gapX;
        var by = (j - OVER) * gapY;

        /* Add a random jitter offset to break up the perfect squares.
           0.35 means up to 35% displacement of the gap size. 
           Adjust this factor up or down to change the "organicness". */
        var jitterAmount = 0.35; 
        bx += rand(-gapX * jitterAmount, gapX * jitterAmount);
        by += rand(-gapY * jitterAmount, gapY * jitterAmount);

        nodes.push({
          i: i, j: j,
          bx: bx, by: by,   /* fixed grid anchor (flat space) */
          cx: bx, cy: by,   /* current eased position (flat space) */
          px: bx, py: by,   /* projected screen position */
          ci: 0             /* wave intensity 0..1 (drives colour) */
        });
      }
    }

    /* Mesh edges: right + down neighbours = one continuous fabric */
    edges = [];
    for (var jj = 0; jj < nrows; jj++) {
      for (var ii = 0; ii < ncols; ii++) {
        var idx = jj * ncols + ii;
        if (ii < ncols - 1) edges.push(idx, idx + 1);
        if (jj < nrows - 1) edges.push(idx, idx + ncols);
      }
    }
  }

  /* ----------------------------------------------------------------------
     Wave lifecycle — one at a time, right → left, then a pause
     ---------------------------------------------------------------------- */
  function startWave(now) {
    var sigma = W * 0.14;                 /* Gaussian half-width */
    var dur = isMobile() ? 3000 : rand(4000, 6000);
    wave = {
      start: now,
      dur: dur,
      sigma: sigma,
      xStart: W + sigma * 2.5,            /* just outside the right edge */
      xEnd: -sigma * 2.5                  /* fully exited on the left */
    };
    waveX = wave.xStart;
  }

  function updateWave(now) {
    if (!wave) {
      if (now >= nextWaveAt) startWave(now);
      return;
    }
    var p = (now - wave.start) / wave.dur;
    if (p >= 1) {
      wave = null;
      waveX = null;
      nextWaveAt = now + rand(3500, 6000); /* breathe between waves */
    } else {
      waveX = wave.xStart + (wave.xEnd - wave.xStart) * p; /* steady travel */
    }
  }

  /* ----------------------------------------------------------------------
     Colour blend: gray → soft blue → accent blue, driven by intensity
     ---------------------------------------------------------------------- */
  function mix(base, ci) {
    /* ci 0..1; 0..0.5 gray→soft, 0.5..1 soft→accent */
    var r, g, b, f;
    if (ci < 0.5) {
      f = ci / 0.5;
      r = base[0] + (SOFT_BLUE[0] - base[0]) * f;
      g = base[1] + (SOFT_BLUE[1] - base[1]) * f;
      b = base[2] + (SOFT_BLUE[2] - base[2]) * f;
    } else {
      f = (ci - 0.5) / 0.5;
      r = SOFT_BLUE[0] + (ACCENT[0] - SOFT_BLUE[0]) * f;
      g = SOFT_BLUE[1] + (ACCENT[1] - SOFT_BLUE[1]) * f;
      b = SOFT_BLUE[2] + (ACCENT[2] - SOFT_BLUE[2]) * f;
    }
    return ((r | 0)) + "," + ((g | 0)) + "," + ((b | 0));
  }

  /* ----------------------------------------------------------------------
     Per-frame update of node positions + intensity
     ---------------------------------------------------------------------- */
  function updateNodes(time, animated) {
    /* ease the mouse influence + smoothed position for elastic return */
    var targetInf = (animated && mouse.active) ? 1 : 0;
    mInfluence += (targetInf - mInfluence) * 0.10;
    if (mouse.active) {
      mFlatX += (mouse.x - mFlatX) * 0.18;
      mFlatY += (mouse.y - mFlatY) * 0.18;
    }

    var haveWave = animated && wave;
    var sigma = haveWave ? wave.sigma : 1;
    var inv2s2 = haveWave ? 1 / (2 * sigma * sigma) : 0;

    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      var tx = nd.bx, ty = nd.by, ci = 0;

      if (animated) {
        /* --- idle breathing: coherent low-frequency swell --- */
        tx += IDLE_AMP * Math.sin(nd.bx * 0.012 + nd.by * 0.010 + time * 0.50);
        ty += IDLE_AMP * Math.cos(nd.by * 0.013 + nd.bx * 0.008 + time * 0.42);

        /* --- individual slow drift: unique to each node --- */
        // Uses the node index 'n' so every point wanders on its own path
        tx += 4.0 * Math.sin(time * 0.25 + n * 0.7); 
        ty += 4.0 * Math.cos(time * 0.20 + n * 0.4);

        /* --- compression wave (Gaussian, pushes toward the wave centre) --- */
        if (haveWave) {
          var dx = nd.bx - waveX;
          var e = Math.exp(-(dx * dx) * inv2s2);   /* 0..1 intensity */
          tx += -(dx / sigma) * e * WAVE_AMP;       /* antisymmetric → compresses */
          ci = e;
        }

        /* --- cursor stretch: nearby fabric eases toward the cursor --- */
        if (mInfluence > 0.001) {
          var mdx = mFlatX - nd.bx, mdy = mFlatY - nd.by;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < MOUSE_R && md > 0.001) {
            var pull = smoothstep(1 - md / MOUSE_R) * MOUSE_PULL * mInfluence;
            tx += (mdx / md) * pull;
            ty += (mdy / md) * pull;
          }
        }
      }

      /* elastic easing toward target → no snapping, natural relaxation */
      if (animated) {
        nd.cx += (tx - nd.cx) * EASE;
        nd.cy += (ty - nd.cy) * EASE;
      } else {
        nd.cx = tx; nd.cy = ty;
      }
      nd.ci = ci;
      nd.px = projX(nd.cx, nd.cy);
      nd.py = projY(nd.cx, nd.cy);
    }
  }

  /* ----------------------------------------------------------------------
     Draw
     ---------------------------------------------------------------------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* --- edges (the fabric) --- */
    ctx.lineWidth = 1;
    for (var e = 0; e < edges.length; e += 2) {
      var A = nodes[edges[e]], B = nodes[edges[e + 1]];
      var ci = (A.ci + B.ci) * 0.5;
      var alpha = LINE_ALPHA + ci * 0.16;      /* brighten in the wave */
      if (alpha < 0.02) continue;
      ctx.strokeStyle = "rgba(" + mix(LINE_GRAY, ci) + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(A.px, A.py);
      ctx.lineTo(B.px, B.py);
      ctx.stroke();
    }

    /* --- nodes --- */
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      var ci = nd.ci;
      var alpha = NODE_ALPHA + ci * 0.22;
      var rad = 1.5 + ci * 1.3;
      ctx.fillStyle = "rgba(" + mix(NODE_GRAY, ci) + "," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(nd.px, nd.py, rad, 0, PI2);
      ctx.fill();
    }
  }

  /* ----------------------------------------------------------------------
     Main loop + scroll fade
     ---------------------------------------------------------------------- */
  function frame(now) {
    if (!running) return;

    /* fade the whole layer out as the hero scrolls away */
    var heroH = hero.offsetHeight || H;
    var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    var master = 1 - Math.min(scrolled / (heroH * 0.9), 1);
    canvas.style.opacity = master.toFixed(3);
    if (master <= 0.01) { rafId = requestAnimationFrame(frame); return; }

    lastNow = now;
    var time = (now - epoch) / 1000;

    updateWave(now);
    updateNodes(time, true);
    draw();

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    var now = performance.now();
    if (!epoch) epoch = now;
    lastNow = now;
    if (!nextWaveAt) nextWaveAt = now + 1500; /* first wave shortly after load */
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function drawStatic() {
    canvas.style.opacity = "1";
    wave = null; waveX = null; mInfluence = 0;
    updateNodes(0, false);
    draw();
  }

  /* ----------------------------------------------------------------------
     Events
     ---------------------------------------------------------------------- */
  function onMouseMove(ev) {
    var rect = hero.getBoundingClientRect();
    var x = ev.clientX - rect.left;
    var y = ev.clientY - rect.top;
    if (x >= 0 && x <= W && y >= 0 && y <= H) {
      if (!mouse.active) { mFlatX = x; mFlatY = y; }
      mouse.x = x; mouse.y = y; mouse.active = true;
    } else {
      mouse.active = false;
    }
  }

  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      buildMesh();
      if (reduceMotion.matches) drawStatic();
    }, 200);
  }

  function onReduceMotionChange() {
    stop();
    resize();
    buildMesh();
    if (reduceMotion.matches) drawStatic();
    else start();
  }

  /* ----------------------------------------------------------------------
     Init
     ---------------------------------------------------------------------- */
  function init() {
    resize();
    buildMesh();

    window.addEventListener("resize", onResize, { passive: true });
    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener("change", onReduceMotionChange);
    } else if (reduceMotion.addListener) {
      reduceMotion.addListener(onReduceMotionChange);
    }

    if (reduceMotion.matches) { drawStatic(); return; }

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
      }, { threshold: 0 });
      io.observe(hero);
    } else {
      start();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

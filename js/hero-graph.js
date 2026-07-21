/* ==========================================================================
   hero-graph.js — "Organic Fabric of Data" Hero Background
   --------------------------------------------------------------------------
   Vanilla JS + Canvas 2D. 
   Features:
   - 3D Irregular/Jittered Mesh (Stretched on mobile)
   - Multi-harmonic continuous breathing topology
   - Smooth Right-to-Left compression waves (Constant 2-second travel duration)
   - 2 to 3 second resting breaks between wave pulses
   - Dynamic cursor interaction & floating data particles
   ========================================================================== */

(function () {
  "use strict";

  const canvas = document.getElementById("heroGraph");
  if (!canvas) return;
  const hero = canvas.closest(".hero");
  if (!hero) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const PI2 = Math.PI * 2;

  /* ---- Color Palette ---- */
  const COLOR_BASE   = [120, 140, 175]; // Cool gray-blue base
  const COLOR_MID    = [ 56, 189, 248]; // Cyan / Light Sky
  const COLOR_ACCENT = [ 99, 102, 241]; // Indigo / Accent
  const COLOR_GLOW   = [168,  85, 247]; // Deep violet accent wave

  /* ---- Grid & Mesh Settings ---- */
  let W = 0, H = 0, dpr = 1;
  let COLS = 45, ROWS = 35;
  let grid = [];                         // 3D Point Matrix
  let particles = [];                    // Floating ambient data nodes
  let gridMinX = -1000, gridMaxX = 1000; // Calculated dynamically in initMesh

  /* ---- Animation & Interaction State ---- */
  let running = false, rafId = null;
  let epoch = 0;
  
  // Wave state (travels right to left)
  let wave = {
    x: 1000,
    speed: 11,                           // Calculated dynamically for 2s duration
    width: 480,                          // Width of the pulse crest
    active: false
  };
  let nextWaveAt = 0;

  // Mouse interaction state
  const mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ----------------------------------------------------------------------
     3D Projection Engine
     ---------------------------------------------------------------------- */
  const CAMERA = {
    fov: 380,
    angleX: 0.52, // Slight tilt down to view surface topology
    offsetY: 60   // Vertical offset centering
  };

  function project3D(x, y, z) {
    const cosX = Math.cos(CAMERA.angleX);
    const sinX = Math.sin(CAMERA.angleX);

    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;

    const distance = CAMERA.fov + z1;
    const scale = CAMERA.fov / Math.max(distance, 1);

    const screenX = W / 2 + x * scale;
    const screenY = H / 2 + (y1 + CAMERA.offsetY) * scale;

    return { x: screenX, y: screenY, scale: scale };
  }

  /* ----------------------------------------------------------------------
     Data Initialization (Irregular Organic Mesh - Mobile Responsive)
     ---------------------------------------------------------------------- */
  function resize() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reduced column count on smaller screens so mesh lines don't cluster
    COLS = W < 640 ? 16 : W < 1024 ? 30 : 48;
    ROWS = W < 640 ? 18 : W < 1024 ? 24 : 36;
  }

  function initMesh() {
    grid = [];
    
    // Stretch fabric horizontally on smaller viewports to prevent overcrowding
    const spanMultiplier = W < 640 ? 2.6 : W < 1024 ? 2.1 : 1.8;
    const spanX = W * spanMultiplier;
    const spanZ = 1200;
    
    const spacingX = spanX / COLS;
    const spacingZ = spanZ / ROWS;

    // Track 3D mesh boundaries for wave trigger/exit calculations
    gridMinX = (-COLS / 2) * spacingX;
    gridMaxX = (COLS / 2) * spacingX;

    // Scale wave crest width to match mesh scale
    wave.width = Math.max(300, spanX * 0.18);

    // Calculate exact speed needed to cover distance in 2 seconds (60fps * 2s = 120 frames)
    const totalTravelDistance = (gridMaxX + wave.width) - (gridMinX - wave.width);
    wave.speed = totalTravelDistance / 120;

    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        // Base regular grid positions
        let bx = (c - COLS / 2) * spacingX;
        let bz = (r - ROWS / 2) * spacingZ;

        /* --- Irregular / Organic Mesh Displacement --- 
           Keeps edge borders structured while breaking internal square patterns */
        if (r > 0 && r < ROWS - 1 && c > 0 && c < COLS - 1) {
          const jitterAmount = 0.42; // Offset magnitude breaking square geometry
          bx += (Math.sin(c * 17.3 + r * 31.7) * spacingX) * jitterAmount;
          bz += (Math.cos(r * 13.1 + c * 23.9) * spacingZ) * jitterAmount;
        }

        grid[r][c] = {
          wx: bx,
          wy: 0,
          wz: bz,
          seed: Math.random() * Math.PI * 2, // Unique phase shift per node
          intensity: 0,
          px: 0, py: 0, scale: 0
        };
      }
    }

    // Floating ambient data dust particles
    particles = [];
    const pCount = W < 640 ? 15 : 50;
    for (let i = 0; i < pCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * W * 1.6,
        y: (Math.random() - 0.5) * 350,
        z: Math.random() * 1000 - 300,
        vy: -0.25 - Math.random() * 0.35,
        size: 1 + Math.random() * 2
      });
    }
  }

  /* ----------------------------------------------------------------------
     Wave Propagation & Smooth Lifecycle Dynamics
     ---------------------------------------------------------------------- */
  function triggerWave() {
    // Start wave fully outside rightmost grid coordinate
    wave.x = gridMaxX + wave.width; 
    wave.active = true;
  }

  function updateTopology(time, now) {
    // Smooth mouse position interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.08;
    mouse.y += (mouse.targetY - mouse.y) * 0.08;

    // Advance Right-to-Left Wave
    if (wave.active) {
      wave.x -= wave.speed;

      // Deactivate wave once it has fully passed off the left edge
      if (wave.x < gridMinX - wave.width) {
        wave.active = false;
        // Schedule next wave after a clean 2 to 3 second pause
        nextWaveAt = now + 2000 + Math.random() * 1000;
      }
    } else if (now > nextWaveAt) {
      triggerWave();
    }

    // Update Node Coordinates & Heights
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const node = grid[r][c];

        /* 1. Organic Multi-Harmonic Breathing */
        let waveY = Math.sin(node.wx * 0.0035 + time * 0.9 + node.seed) * 16 +
                    Math.cos(node.wz * 0.0040 + time * 0.7) * 12 +
                    Math.sin((node.wx - node.wz) * 0.0025 + time * 1.1) * 8;

        /* 2. Smooth Right-to-Left Wave Pulse */
        let waveIntensity = 0;
        if (wave.active) {
          const dx = Math.abs(node.wx - wave.x);

          if (dx < wave.width) {
            // Cosine curve profile for wave crest
            const norm = dx / wave.width;
            const pulse = Math.cos(norm * (Math.PI / 2));
            let intensity = Math.pow(Math.max(0, pulse), 2.5);

            /* --- EDGE FADE ENVELOPE (Prevents entry/exit glitches) ---
               Smoothly ramps down intensity near the left and right outer boundaries */
            const edgeDistX = Math.min(
              Math.abs(node.wx - gridMinX), 
              Math.abs(node.wx - gridMaxX)
            );
            const edgeFade = Math.min(1, edgeDistX / 200);
            intensity *= edgeFade;

            waveY -= intensity * 70; // Smooth elevation change
            waveIntensity = intensity;
          }
        }

        /* 3. Mouse Distortion Stretch */
        if (mouse.active) {
          const proj = project3D(node.wx, waveY, node.wz);
          const mdx = proj.x - mouse.x;
          const mdy = proj.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mDist < 170) {
            const pull = (1 - mDist / 170);
            waveY += Math.sin(pull * Math.PI) * 32;
            waveIntensity = Math.max(waveIntensity, pull * 0.6);
          }
        }

        node.wy = waveY;
        node.intensity = waveIntensity;

        // Apply 3D Projection
        const projected = project3D(node.wx, node.wy, node.wz);
        node.px = projected.x;
        node.py = projected.y;
        node.scale = projected.scale;
      }
    }

    // Particle drift loop
    for (let p of particles) {
      p.y += p.vy;
      if (p.y < -300) p.y = 200;
    }
  }

  /* ----------------------------------------------------------------------
     Render Loop Engine
     ---------------------------------------------------------------------- */
  function mixColors(c1, c2, weight) {
    const w = Math.min(Math.max(weight, 0), 1);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * w);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * w);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * w);
    return `${r},${g},${b}`;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    /* --- Draw Ambient Data Dust Particles --- */
    for (let p of particles) {
      const proj = project3D(p.x, p.y, p.z);
      if (proj.scale <= 0) continue;
      const alpha = Math.min(0.5, proj.scale * 0.35);
      ctx.fillStyle = `rgba(${COLOR_MID.join(",")}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, p.size * proj.scale, 0, PI2);
      ctx.fill();
    }

    /* --- Draw Organic Mesh Edges --- */
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p1 = grid[r][c];

        // Draw horizontal neighbor connection
        if (c < COLS - 1) {
          drawEdge(p1, grid[r][c + 1]);
        }

        // Draw vertical neighbor connection
        if (r < ROWS - 1) {
          drawEdge(p1, grid[r + 1][c]);
        }

        // Cross-connect diagonal edges on alternating nodes to form irregular triangles
        if (r < ROWS - 1 && c < COLS - 1 && (r + c) % 2 === 0) {
          drawEdge(p1, grid[r + 1][c + 1]);
        }
      }
    }

    /* --- Draw Glowing Dynamic Node Highlights --- */
    for (let r = 0; r < ROWS; r += 2) {
      for (let c = 0; c < COLS; c += 2) {
        const node = grid[r][c];
        if (node.scale <= 0) continue;

        const baseAlpha = Math.min(0.75, node.scale * 0.4);
        const nodeColor = node.intensity > 0.1 
          ? mixColors(COLOR_MID, COLOR_GLOW, node.intensity)
          : COLOR_BASE.join(",");

        ctx.fillStyle = `rgba(${nodeColor}, ${baseAlpha + node.intensity * 0.4})`;
        ctx.beginPath();
        ctx.arc(node.px, node.py, (1.2 + node.intensity * 2.2) * node.scale, 0, PI2);
        ctx.fill();
      }
    }
  }

  function drawEdge(p1, p2) {
    if (p1.scale <= 0 || p2.scale <= 0) return;

    const avgIntensity = (p1.intensity + p2.intensity) * 0.5;
    const avgScale = (p1.scale + p2.scale) * 0.5;
    
    let alpha = Math.min(0.4, avgScale * 0.32) + avgIntensity * 0.45;
    if (alpha < 0.02) return;

    let strokeColor;
    if (avgIntensity > 0.3) {
      strokeColor = mixColors(COLOR_MID, COLOR_ACCENT, (avgIntensity - 0.3) * 1.4);
    } else if (avgIntensity > 0.05) {
      strokeColor = mixColors(COLOR_BASE, COLOR_MID, avgIntensity * 6);
    } else {
      strokeColor = COLOR_BASE.join(",");
    }

    ctx.lineWidth = Math.max(0.4, (0.7 + avgIntensity * 1.6) * avgScale);
    ctx.strokeStyle = `rgba(${strokeColor}, ${alpha.toFixed(3)})`;

    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();
  }

  /* ----------------------------------------------------------------------
     Lifecycle & Event Handlers
     ---------------------------------------------------------------------- */
  function frame(now) {
    if (!running) return;

    // Fade canvas out smoothly on scroll down
    const scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
    const masterAlpha = 1 - Math.min(scrolled / (H * 0.8), 1);
    canvas.style.opacity = masterAlpha.toFixed(3);

    if (masterAlpha > 0.01) {
      const time = (now - epoch) * 0.001;
      updateTopology(time, now);
      render();
    }

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    epoch = performance.now();
    nextWaveAt = epoch + 800; // Trigger initial wave shortly after load
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onMouseMove(e) {
    const rect = hero.getBoundingClientRect();
    mouse.targetX = e.clientX - rect.left;
    mouse.targetY = e.clientY - rect.top;
    mouse.active = true;
  }

  function onMouseLeave() {
    mouse.active = false;
    mouse.targetX = -9999;
    mouse.targetY = -9999;
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initMesh();
    }, 150);
  }

  function init() {
    resize();
    initMesh();

    window.addEventListener("resize", onResize, { passive: true });
    hero.addEventListener("mousemove", onMouseMove, { passive: true });
    hero.addEventListener("mouseleave", onMouseLeave, { passive: true });

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.05 });
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
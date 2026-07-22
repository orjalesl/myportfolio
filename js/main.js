/* ==========================================================================
   main.js — shared interactions for the whole site
   --------------------------------------------------------------------------
   Vanilla JavaScript only. No dependencies.
   Handles:
     1. Sticky nav hairline on scroll
     2. Mobile hamburger menu
     3. Scroll-reveal animations (IntersectionObserver)
     4. Active nav link highlighting
     5. Webinar play-button placeholders (swap for real embed later)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. STICKY NAV — add hairline border once the page is scrolled
     ------------------------------------------------------------------ */
  var nav = document.querySelector(".nav");

  function handleNavScroll() {
    if (!nav) return;
    if (window.scrollY > 8) {
      nav.classList.add("is-scrolled");
    } else {
      nav.classList.remove("is-scrolled");
    }
  }
  window.addEventListener("scroll", handleNavScroll, { passive: true });
  handleNavScroll(); // run once on load

  /* ------------------------------------------------------------------
     2. MOBILE HAMBURGER MENU
     ------------------------------------------------------------------ */
  var toggle = document.querySelector(".nav__toggle");
  var mobileMenu = document.querySelector(".mobile-menu");

  function closeMenu() {
    if (!toggle || !mobileMenu) return;
    toggle.classList.remove("is-open");
    mobileMenu.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", function () {
      var isOpen = toggle.classList.toggle("is-open");
      mobileMenu.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("no-scroll", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close the menu when any link inside it is tapped
    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    // Close on resize back to desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 640) closeMenu();
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ------------------------------------------------------------------
     3. SCROLL-REVEAL ANIMATIONS
     Any element with [data-reveal] fades/slides in when it enters view.
     ------------------------------------------------------------------ */
  var revealEls = document.querySelectorAll("[data-reveal]");

  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target); // reveal once, then stop watching
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: no IntersectionObserver → just show everything
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ------------------------------------------------------------------
     4. ACTIVE NAV LINK
     Highlights the nav link matching the current page file name.
     ------------------------------------------------------------------ */
  var currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__link[href]").forEach(function (link) {
    var target = link.getAttribute("href").split("/").pop();
    if (target === currentPage) link.classList.add("is-active");
  });

  /* ------------------------------------------------------------------
     5. WEBINAR PLAY-BUTTON PLACEHOLDERS
     These are visual placeholders. When you add a real video, either:
       - replace the .video-block markup with a <video controls> or an
         <iframe> embed (YouTube/Vimeo), OR
       - wire this handler to swap in your embed on click.
     ------------------------------------------------------------------ */
  document.querySelectorAll(".video-block__play").forEach(function (play) {
    play.addEventListener("click", function () {
      // TODO (replace): load your real video/embed here.
      // Example:
      //   var parent = play.closest(".video-block");
      //   parent.innerHTML =
      //     '<iframe src="https://www.youtube.com/embed/VIDEO_ID?autoplay=1" ' +
      //     'allow="autoplay; fullscreen" style="width:100%;aspect-ratio:16/9;border:0"></iframe>';
      console.info("Video placeholder clicked — replace with a real embed in js/main.js.");
    });
  });

  /* ------------------------------------------------------------------
     6. CARD CAROUSELS — show one card at a time with named tabs + arrows
     Markup:
       <div class="carousel" data-carousel>
         <div class="carousel__viewport">
           <div class="carousel__track">
             <div class="carousel__slide" data-title="Label">…card…</div>
             …
           </div>
         </div>
         <div class="carousel__nav">
           <button class="carousel__arrow" data-carousel-prev>…</button>
           <div class="carousel__tabs"></div>   <!-- tabs injected here -->
           <button class="carousel__arrow" data-carousel-next>…</button>
         </div>
       </div>
     ------------------------------------------------------------------ */
  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var viewport = root.querySelector(".carousel__viewport");
    var track = root.querySelector(".carousel__track");
    var tabsWrap = root.querySelector(".carousel__tabs");
    var prevBtn = root.querySelector("[data-carousel-prev]");
    var nextBtn = root.querySelector("[data-carousel-next]");
    if (!viewport || !track) return;

    var slides = Array.prototype.slice.call(track.children);
    if (slides.length < 2) return; // nothing to navigate

    var index = 0;
    var tabs = [];

    // Build one named tab per slide (from data-title, fallback to number)
    if (tabsWrap) {
      slides.forEach(function (slide, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "carousel__tab";
        b.setAttribute("role", "tab");
        b.textContent = slide.getAttribute("data-title") || String(i + 1);
        b.addEventListener("click", function () { go(i); });
        tabsWrap.appendChild(b);
        tabs.push(b);
      });
    }

    function setHeight() {
      // Viewport hugs the active slide so cards of different heights look clean
      viewport.style.height = slides[index].offsetHeight + "px";
    }

    function update() {
      track.style.transform = "translateX(" + (-index * 100) + "%)";
      tabs.forEach(function (t, i) {
        var on = i === index;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      setHeight();
    }

    function go(i) {
      index = (i + slides.length) % slides.length; // wrap around
      update();
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { go(index - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { go(index + 1); });

    // Keyboard arrows when the carousel (or a child) has focus
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    });

    // Touch swipe
    var startX = null;
    viewport.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) { go(dx < 0 ? index + 1 : index - 1); }
      startX = null;
    }, { passive: true });

    // Activate the enhanced (horizontal) layout, then lay out
    root.classList.add("is-ready");
    update();

    // Recalculate height after images/fonts settle and on resize
    window.addEventListener("resize", setHeight, { passive: true });
    window.addEventListener("load", setHeight);
    setTimeout(setHeight, 300);
  });
})();

/**
 * scroll-nav.js — Floating directional scroll controls
 *
 * Adds a fixed bottom-right set of buttons (↑ ↓ ← →) that smoothly
 * scroll the page in the corresponding direction when clicked.
 * The controls auto-hide when the user is at the scroll origin and
 * appear once they've scrolled.
 */

(function () {
  "use strict";

  /* ── Configuration ─────────────────────────────────────────────── */
  const SCROLL_AMOUNT = 400; // px to scroll per click
  const SHOW_THRESHOLD = 80; // px scrolled before controls appear

  /* ── Template ──────────────────────────────────────────────────── */
  const HTML = `
    <div class="scroll-nav" id="scrollNav" aria-label="Scroll navigation">
      <button class="scroll-nav__btn" data-dir="up" aria-label="Scroll up">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <div class="scroll-nav__row">
        <button class="scroll-nav__btn" data-dir="left" aria-label="Scroll left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="scroll-nav__btn" data-dir="down" aria-label="Scroll down">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="scroll-nav__btn" data-dir="right" aria-label="Scroll right">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  /* ── Inject into DOM ──────────────────────────────────────────── */
  document.body.insertAdjacentHTML("beforeend", HTML);

  const nav = document.getElementById("scrollNav");
  const btns = nav.querySelectorAll("[data-dir]");

  /* ── Smooth-scroll handler ─────────────────────────────────────── */
  function handleScroll(dir) {
    const x = window.scrollX;
    const y = window.scrollY;
    const delta = SCROLL_AMOUNT;

    let targetX = x;
    let targetY = y;

    switch (dir) {
      case "up":
        targetY = Math.max(0, y - delta);
        break;
      case "down":
        targetY = y + delta;
        break;
      case "left":
        targetX = Math.max(0, x - delta);
        break;
      case "right":
        targetX = x + delta;
        break;
    }

    window.scrollTo({
      left: targetX,
      top: targetY,
      behavior: "smooth",
    });
  }

  btns.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      handleScroll(this.getAttribute("data-dir"));
    });
  });

  /* ── Show / hide based on scroll position ──────────────────────── */
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        const scrolled =
          window.scrollY > SHOW_THRESHOLD || window.scrollX > SHOW_THRESHOLD;
        nav.classList.toggle("visible", scrolled);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  /* ── Edge-case: already scrolled on load ────────────────────────── */
  onScroll();
})();
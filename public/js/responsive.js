// =============================================================================
//  SocialConnect — responsive.js
//  Handles all responsive / adaptive UI behaviour:
//    • Sidebar overlay backdrop
//    • Mobile search overlay
//    • Admin sidebar hamburger
//    • Swipe gestures (open / close drawers)
//    • Bottom-nav active-state sync
//    • Admin table horizontal-scroll wrap
//    • Sidebar scroll-shadow updates
//    • Resize / breakpoint handling
// =============================================================================

'use strict';

const Responsive = {

  // ── Breakpoints (match responsive.css) ──────────────────────────────────────
  MOBILE: 767,   // max-width for phones
  TABLET: 1099,  // max-width for tablets

  /** @returns {boolean} */
  isMobile()  { return window.innerWidth <= this.MOBILE; },
  /** @returns {boolean} */
  isTablet()  { return window.innerWidth > this.MOBILE && window.innerWidth <= this.TABLET; },
  /** @returns {boolean} */
  isDesktop() { return window.innerWidth > this.TABLET; },

  // ── Entry point ─────────────────────────────────────────────────────────────
  init() {
    this.injectSidebarOverlay();
    this.injectMobileSearch();
    this.injectAdminHamburger();
    this.bindEvents();
    this.handleResize();
    this.fixAdminTableScroll();
    this.initScrollShadows();
    this.updateMobileNavActive();
  },


  // ============================================================================
  //  SIDEBAR OVERLAY BACKDROP
  // ============================================================================

  injectSidebarOverlay() {
    if (document.getElementById('sidebarOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id        = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', () => this.closeSidebar());
    document.body.appendChild(overlay);
  },


  // ============================================================================
  //  MOBILE SEARCH OVERLAY
  // ============================================================================

  injectMobileSearch() {
    // ── Overlay container ────────────────────────────────────────────────────
    if (!document.getElementById('mobileSearchOverlay')) {
      const overlay = document.createElement('div');
      overlay.id        = 'mobileSearchOverlay';
      overlay.className = 'mobile-search-overlay';
      overlay.setAttribute('role', 'search');
      overlay.innerHTML = `
        <button
          class="mobile-search-back"
          aria-label="Close search"
          onclick="Responsive.closeMobileSearch()"
        >&#8592;</button>
        <input
          type="search"
          id="mobileSearchInput"
          placeholder="Search SocialConnect\u2026"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button
          class="mobile-search-cancel"
          aria-label="Cancel search"
          onclick="Responsive.closeMobileSearch()"
        >Cancel</button>
      `;
      document.body.appendChild(overlay);
    }

    // ── Search icon button inside navbar (mobile-only) ───────────────────────
    const navbarInner = document.querySelector('.navbar__inner');
    if (navbarInner && !document.getElementById('mobileSearchBtn')) {
      const btn = document.createElement('button');
      btn.id        = 'mobileSearchBtn';
      btn.className = 'navbar__action-btn';
      btn.setAttribute('aria-label', 'Open search');
      btn.style.display = 'none'; // visibility controlled by handleResize()
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      `;
      btn.addEventListener('click', () => this.openMobileSearch());

      // Place it just before .navbar__actions (or at the end)
      const actions = navbarInner.querySelector('.navbar__actions');
      if (actions) navbarInner.insertBefore(btn, actions);
      else navbarInner.appendChild(btn);
    }

    // ── Sync mobile input → main search input ────────────────────────────────
    const mobileInput = document.getElementById('mobileSearchInput');
    const mainInput   = document.getElementById('searchInput');

    if (mobileInput && mainInput) {
      mobileInput.addEventListener('input', () => {
        mainInput.value = mobileInput.value;
        mainInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Pressing Enter on mobile search: close overlay, keep value
      mobileInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.closeMobileSearch();
          // Trigger any form-submit / search handler on main input
          mainInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      });
    }
  },

  /** Open the mobile search overlay and focus the input. */
  openMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    // Delay focus so the overlay animation completes first (prevents iOS jank)
    setTimeout(() => {
      const input = document.getElementById('mobileSearchInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 120);
  },

  /** Close the mobile search overlay. */
  closeMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (overlay) overlay.classList.remove('active');
  },


  // ============================================================================
  //  ADMIN SIDEBAR HAMBURGER
  // ============================================================================

  injectAdminHamburger() {
    const adminSidebar = document.querySelector('.admin-sidebar');
    if (!adminSidebar) return;                          // not an admin page
    if (document.getElementById('adminHamburger')) return; // already injected

    // ── Hamburger button ─────────────────────────────────────────────────────
    const btn = document.createElement('button');
    btn.id        = 'adminHamburger';
    btn.className = 'admin-hamburger';
    btn.setAttribute('aria-label', 'Toggle admin sidebar');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'adminSidebar');
    btn.innerHTML = '&#9776;'; // ☰
    btn.addEventListener('click', () => this.toggleAdminSidebar());
    document.body.appendChild(btn);

    // Give the sidebar an id if it doesn't already have one
    if (!adminSidebar.id) adminSidebar.id = 'adminSidebar';

    // ── Backdrop for admin sidebar ───────────────────────────────────────────
    if (!document.getElementById('adminOverlay')) {
      const overlay = document.createElement('div');
      overlay.id        = 'adminOverlay';
      overlay.className = 'sidebar-overlay';
      overlay.style.zIndex = '350';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.addEventListener('click', () => this.closeAdminSidebar());
      document.body.appendChild(overlay);
    }
  },

  /** Toggle the admin sidebar open / closed. */
  toggleAdminSidebar() {
    const sidebar  = document.querySelector('.admin-sidebar');
    const overlay  = document.getElementById('adminOverlay');
    const btn      = document.getElementById('adminHamburger');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      this._closeAdminSidebarDOM(sidebar, overlay, btn);
    } else {
      sidebar.classList.add('open');
      overlay?.classList.add('active');
      btn?.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  },

  /** Close the admin sidebar. */
  closeAdminSidebar() {
    this._closeAdminSidebarDOM(
      document.querySelector('.admin-sidebar'),
      document.getElementById('adminOverlay'),
      document.getElementById('adminHamburger'),
    );
  },

  /** @private */
  _closeAdminSidebarDOM(sidebar, overlay, btn) {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    btn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  },


  // ============================================================================
  //  LEFT SIDEBAR TOGGLE (main layout)
  // ============================================================================

  /** Toggle the left sidebar drawer. */
  toggleSidebar() {
    const sidebar = document.querySelector('.layout__sidebar-left');
    if (!sidebar) return;
    if (sidebar.classList.contains('drawer-open')) {
      this.closeSidebar();
    } else {
      this._openSidebarDOM(sidebar);
    }
  },

  /** @private Opens the left sidebar drawer. */
  _openSidebarDOM(sidebar) {
    const overlay = document.getElementById('sidebarOverlay');

    sidebar.classList.add('drawer-open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  /** Close the left sidebar drawer. */
  closeSidebar() {
    const sidebar = document.querySelector('.layout__sidebar-left');
    const overlay = document.getElementById('sidebarOverlay');

    sidebar?.classList.remove('drawer-open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  },


  // ============================================================================
  //  RIGHT SIDEBAR TOGGLE (Discover / suggestions drawer)
  // ============================================================================

  /** Toggle the right sidebar drawer. */
  toggleRightSidebar() {
    // The right sidebar can live in .layout__sidebar-right (layout page)
    // or a standalone .right-sidebar-drawer element
    const sidebar =
      document.querySelector('.right-sidebar-drawer') ||
      document.querySelector('.layout__sidebar-right');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('drawer-open');
    if (isOpen) {
      sidebar.classList.remove('drawer-open');
      overlay?.classList.remove('active');
      document.body.style.overflow = '';
    } else {
      sidebar.classList.add('drawer-open');
      overlay?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },


  // ============================================================================
  //  EVENT BINDING
  // ============================================================================

  bindEvents() {
    // ── Close sidebar when a sidebar nav link is clicked (mobile / tablet) ───
    document.querySelectorAll('.sidebar-nav__item, .sidebar-nav a').forEach(item => {
      item.addEventListener('click', () => {
        if (this.isMobile() || this.isTablet()) {
          this.closeSidebar();
        }
      });
    });

    // ── Keyboard: Escape closes all drawers + overlays ───────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSidebar();
        this.closeAdminSidebar();
        this.closeMobileSearch();
      }
    });

    // ── Window resize ────────────────────────────────────────────────────────
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.handleResize(), 100);
    });

    // ── Swipe gestures ───────────────────────────────────────────────────────
    this.initSwipeToClose();

    // ── Mobile bottom-nav clicks ─────────────────────────────────────────────
    document.querySelectorAll('.mobile-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.mobile-nav__item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });
  },


  // ============================================================================
  //  SWIPE GESTURE HANDLER
  // ============================================================================

  initSwipeToClose() {
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    document.addEventListener('touchstart', (e) => {
      startX    = e.touches[0].clientX;
      startY    = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const dx       = e.changedTouches[0].clientX - startX;
      const dy       = e.changedTouches[0].clientY - startY;
      const elapsed  = Date.now() - startTime;

      // Ignore slow drags (> 500 ms) — let them be normal scrolls
      if (elapsed > 500) return;

      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!isHorizontal) return;

      // ── Swipe LEFT → close left sidebar ────────────────────────────────────
      if (dx < -50 && Math.abs(dy) < 60) {
        const sidebar = document.querySelector('.layout__sidebar-left');
        if (sidebar?.classList.contains('drawer-open')) {
          this.closeSidebar();
        }
      }

      // ── Swipe RIGHT from left edge (< 40 px) → open left sidebar ───────────
      if (startX < 40 && dx > 60 && Math.abs(dy) < 60) {
        const sidebar = document.querySelector('.layout__sidebar-left');
        if (sidebar && !sidebar.classList.contains('drawer-open')) {
          this.toggleSidebar();
        }
      }

      // ── Swipe RIGHT → close right sidebar ──────────────────────────────────
      if (dx > 50 && Math.abs(dy) < 60) {
        const rSidebar =
          document.querySelector('.right-sidebar-drawer') ||
          document.querySelector('.layout__sidebar-right');
        if (rSidebar?.classList.contains('drawer-open')) {
          this.toggleRightSidebar();
        }
      }
    }, { passive: true });
  },


  // ============================================================================
  //  RESIZE HANDLER
  // ============================================================================

  handleResize() {
    // Show / hide the mobile search button
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    if (mobileSearchBtn) {
      mobileSearchBtn.style.display = this.isMobile() ? 'flex' : 'none';
    }

    // On desktop, ensure all drawers are closed and body scroll is restored
    if (this.isDesktop()) {
      this.closeSidebar();
      this.closeAdminSidebar();
      document.body.style.overflow = '';
    }

    // Sync mobile nav active state
    this.updateMobileNavActive();
  },


  // ============================================================================
  //  MOBILE BOTTOM-NAV ACTIVE STATE
  // ============================================================================

  updateMobileNavActive() {
    const path = window.location.pathname.replace(/\/$/, ''); // strip trailing slash

    document.querySelectorAll('.mobile-nav__item').forEach(item => {
      item.classList.remove('active');

      const href    = (item.getAttribute('href') || '').replace(/\/$/, '');
      const page    = item.dataset.page || '';
      const matched =
        (href && path !== '' && path.endsWith(href)) ||
        (page && path.includes(page));

      if (matched) item.classList.add('active');
    });

    // Special-case: root / dashboard
    const isDashboard =
      path === '' ||
      path === '/dashboard' ||
      path.endsWith('/dashboard.html') ||
      path.endsWith('/index.html');

    if (isDashboard) {
      const homeItem = document.querySelector(
        '.mobile-nav__item[data-page="dashboard"], ' +
        '.mobile-nav__item[href="/dashboard"], ' +
        '.mobile-nav__item[href="/"], ' +
        '.mobile-nav__item[href="dashboard.html"]'
      );
      homeItem?.classList.add('active');
    }
  },


  // ============================================================================
  //  ADMIN TABLE — auto-wrap in scroll container
  // ============================================================================

  fixAdminTableScroll() {
    document.querySelectorAll('.admin-table').forEach(table => {
      // Skip if already wrapped
      if (table.closest('.admin-table-wrap')) return;

      const wrap = document.createElement('div');
      wrap.className = 'admin-table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  },


  // ============================================================================
  //  SIDEBAR SCROLL SHADOWS
  // ============================================================================

  initScrollShadows() {
    document.querySelectorAll(
      '.layout__sidebar-left, .layout__sidebar-right'
    ).forEach(sidebar => {
      const update = () => {
        const scrollTop  = sidebar.scrollTop;
        const scrollBot  = sidebar.scrollHeight - sidebar.scrollTop - sidebar.clientHeight;

        // Bottom shadow fades out when near the bottom
        sidebar.style.setProperty(
          '--scroll-shadow-opacity',
          scrollBot > 8 ? '1' : '0'
        );
        // Top shadow fades in when scrolled down
        sidebar.style.setProperty(
          '--scroll-shadow-top-opacity',
          scrollTop > 8 ? '1' : '0'
        );
      };

      sidebar.addEventListener('scroll', update, { passive: true });

      // Run once on init to set correct initial state
      update();
    });
  },


  // ============================================================================
  //  PUBLIC UTILITY HELPERS
  // ============================================================================

  /**
   * Programmatically set a badge count on a mobile-nav item.
   * @param {string} page  - value of data-page attribute
   * @param {number} count - badge number (0 removes the badge)
   */
  setNavBadge(page, count) {
    const item = document.querySelector(`.mobile-nav__item[data-page="${page}"]`);
    if (!item) return;

    let badge = item.querySelector('.mobile-nav__badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mobile-nav__badge';
        item.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : String(count);
    } else if (badge) {
      badge.remove();
    }
  },

  /**
   * Smoothly scroll the feed to the top (useful after route change).
   */
  scrollFeedToTop() {
    const feed = document.querySelector('.layout__feed');
    if (feed) {
      feed.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  /**
   * Check whether the current device has a touch screen.
   * @returns {boolean}
   */
  isTouchDevice() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  },

  /**
   * Add `.touch-device` class to <body> for CSS targeting.
   */
  _markTouchDevice() {
    if (this.isTouchDevice()) {
      document.body.classList.add('touch-device');
    }
  },

};


// =============================================================================
//  BOOTSTRAP
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  Responsive._markTouchDevice();
  Responsive.init();
});

// Re-run resize logic after all resources load (fonts can shift layout)
window.addEventListener('load', () => {
  Responsive.handleResize();
  Responsive.initScrollShadows();
});

// Expose globally so inline onclick="" attributes and other scripts can call it
window.Responsive = Responsive;

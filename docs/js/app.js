// SocialConnect - Shared Utilities
// Loaded on all authenticated pages

const SC = {
  // =====================
  // CONSTANTS
  // =====================
   API_BASE: (window.API_BASE || '') + '/api',
  TOKEN_KEY: 'sc_token',
  USER_KEY: 'sc_user',

  // =====================
  // AUTH UTILITIES
  // =====================
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(this.USER_KEY) || '{}');
    } catch {
      return {};
    }
  },

  setAuth(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  logout() {
    this.clearAuth();
    window.location.href = '/index.html';
  },

  requireAuth() {
    if (!this.getToken()) window.location.href = '/index.html';
  },

  requireAdmin() {
    const user = this.getCurrentUser();
    if (!this.getToken() || user.role !== 'admin') window.location.href = '/index.html';
  },

  // =====================
  // API UTILITIES
  // =====================
  async fetch(url, options = {}) {
    const token = this.getToken();
    const defaultHeaders = { 'Content-Type': 'application/json' };
    if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(this.API_BASE + url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      });

      if (res.status === 401) {
        this.clearAuth();
        window.location.href = '/index.html';
        return null;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      throw err;
    }
  },

  async get(url) {
    return this.fetch(url);
  },

  async post(url, body) {
    return this.fetch(url, { method: 'POST', body: JSON.stringify(body) });
  },

  async put(url, body) {
    return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) });
  },

  async delete(url) {
    return this.fetch(url, { method: 'DELETE' });
  },

  // =====================
  // DATE UTILITIES
  // =====================
  timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    // Older than 7 days — show a readable date; include year only if >1 year ago
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: diff > 31536000 ? 'numeric' : undefined
    });
  },

  formatDate(dateStr) {
    if (!dateStr) return 'Not provided';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  getAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  },

  // =====================
  // DOM UTILITIES
  // =====================
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  show(el) {
    const elem = typeof el === 'string' ? this.$(el) : el;
    if (elem) elem.style.display = '';
  },

  hide(el) {
    const elem = typeof el === 'string' ? this.$(el) : el;
    if (elem) elem.style.display = 'none';
  },

  toggle(el) {
    const elem = typeof el === 'string' ? this.$(el) : el;
    if (elem) elem.style.display = elem.style.display === 'none' ? '' : 'none';
  },

  setHTML(selector, html) {
    const el = this.$(selector);
    if (el) el.innerHTML = html;
  },

  setText(selector, text) {
    const el = this.$(selector);
    if (el) el.textContent = text;
  },

  // =====================
  // TOAST NOTIFICATIONS
  // =====================
  showToast(message, type = 'info', duration = 3500) {
    // Create toast container if it doesn't already exist
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span class="toast__message">${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">×</button>
      <div class="toast__progress"></div>
    `;

    container.appendChild(toast);

    // Trigger enter animation on next tick
    setTimeout(() => toast.classList.add('toast--visible'), 10);

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.add('toast--hiding');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  showSuccess(msg) { this.showToast(msg, 'success'); },
  showError(msg)   { this.showToast(msg, 'error');   },
  showWarning(msg) { this.showToast(msg, 'warning'); },
  showInfo(msg)    { this.showToast(msg, 'info');    },

  // =====================
  // IMAGE UTILITIES
  // =====================
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Compress an image file (from <input type="file">) to a base64 data URL.
   * Resizes to fit within maxW×maxH, then exports at the given JPEG quality.
   * This is critical for mobile uploads where camera photos can be 5-20 MB.
   *
   * @param {File}   file    The raw image file
   * @param {number} maxW    Max width  (default 1200)
   * @param {number} maxH    Max height (default 1200)
   * @param {number} quality JPEG quality 0-1 (default 0.85)
   * @returns {Promise<string>} base64 data URL
   */
  compressImage(file, maxW = 1200, maxH = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      // Skip compression for non-image or small files (< 500 KB)
      if (!file.type.startsWith('image/') || file.size < 500 * 1024) {
        return this.fileToBase64(file).then(resolve).catch(reject);
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;

        // Resize only if larger than max dimensions
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width  = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG (smaller than PNG)
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback to raw base64 if image can't be loaded
        this.fileToBase64(file).then(resolve).catch(reject);
      };
      img.src = url;
    });
  },

  getAvatar(user) {
    if (user && user.avatar) return user.avatar;
    const name = (user && user.name) ? user.name : 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877f2&color=fff&size=128`;
  },

  // =====================
  // MODAL UTILITIES
  // =====================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      // Small delay lets the browser paint display:flex before the transition fires
      setTimeout(() => modal.classList.add('modal--open'), 10);
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('modal--open');
      document.body.style.overflow = '';
      // Wait for the CSS exit transition before hiding
      setTimeout(() => (modal.style.display = 'none'), 300);
    }
  },

  // Attach overlay-click-to-close to every .modal-overlay on the page
  initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });
  },

  // =====================
  // HASHTAG UTILITIES
  // =====================
  highlightHashtags(text) {
    return text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
  },

  // =====================
  // VALIDATION UTILITIES
  // =====================
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  validatePassword(password) {
    return password.length >= 8 && /\d/.test(password);
  },

  getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)          score++;
    if (password.length >= 12)         score++;
    if (/[A-Z]/.test(password))        score++;
    if (/\d/.test(password))           score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 'weak',   color: '#e53935', label: 'Weak'   };
    if (score <= 3) return { level: 'medium', color: '#f7b928', label: 'Medium' };
    return             { level: 'strong', color: '#42b72a', label: 'Strong' };
  },

  // =====================
  // INTEREST UTILITIES
  // =====================
  ALL_INTERESTS: [
    'Travel', 'Photography', 'Music', 'Art', 'Fitness', 'Gaming', 'Cooking',
    'Reading', 'Movies', 'Sports', 'Technology', 'Fashion', 'Nature', 'Yoga',
    'Dancing', 'Writing', 'Coffee', 'Pets', 'Hiking', 'Nightlife'
  ],

  // Render all interest tags into a container, pre-selecting those in `selected`
  renderInterestTags(containerId, selected = [], onToggle = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = this.ALL_INTERESTS.map(interest => `
      <span class="tag ${selected.includes(interest) ? 'tag--selected' : ''}"
            data-interest="${interest}"
            onclick="SC.toggleInterest('${containerId}', '${interest}')">
        ${interest}
      </span>
    `).join('');

    // If a callback was provided, wire it up via delegation
    if (typeof onToggle === 'function') {
      container.addEventListener('click', e => {
        const tag = e.target.closest('[data-interest]');
        if (tag) onToggle(tag.dataset.interest, tag.classList.contains('tag--selected'));
      });
    }
  },

  toggleInterest(containerId, interest) {
    const tag = document.querySelector(`#${containerId} [data-interest="${interest}"]`);
    if (tag) tag.classList.toggle('tag--selected');
  },

  getSelectedInterests(containerId) {
    return [...document.querySelectorAll(`#${containerId} .tag--selected`)]
      .map(t => t.dataset.interest);
  },

  // =====================
  // NUMBER FORMATTING
  // =====================
  formatCount(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  },

  // =====================
  // URI SAFETY UTILITIES
  // =====================
  /**
   * Safely decode a URI component (e.g., from window.location or URL params).
   * Returns the raw string if decoding fails.
   */
  safeDecodeURIComponent(str) {
    if (!str) return str || '';
    try {
      return decodeURIComponent(str);
    } catch (e) {
      console.warn('[SC] safeDecodeURIComponent: malformed URI component, returning raw string', str, e);
      return str;
    }
  },

  /**
   * Safely decode a full URI.
   * Returns the raw string if decoding fails.
   */
  safeDecodeURI(str) {
    if (!str) return str || '';
    try {
      return decodeURI(str);
    } catch (e) {
      console.warn('[SC] safeDecodeURI: malformed URI, returning raw string', str, e);
      return str;
    }
  },

  /**
   * Safely navigate to a URL via window.location.href.
   * Falls back silently if the URL is malformed.
   */
  safeNavigate(url) {
    try {
      // Validate the URL first — will throw if malformed
      new URL(url, window.location.origin);
      window.location.href = url;
    } catch (e) {
      console.warn('[SC] safeNavigate: malformed URL, navigation blocked', url, e);
    }
  },

  /**
   * Safely open a URL in a new tab via window.open.
   */
  safeOpenWindow(url, target = '_blank', features = 'noopener') {
    try {
      new URL(url, window.location.origin);
      window.open(url, target, features);
    } catch (e) {
      console.warn('[SC] safeOpenWindow: malformed URL, open blocked', url, e);
    }
  },

  // =====================
  // DEBOUNCE
  // =====================
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // =====================
  // NAVBAR INIT
  // =====================
  initNavbar() {
    const user = this.getCurrentUser();

    // Populate avatar (button element uses backgroundImage)
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar) {
      navAvatar.style.backgroundImage = `url('${this.getAvatar(user)}')`;
      navAvatar.setAttribute('aria-label', `${user.name || 'User'}'s profile`);
    }

    // Populate display name
    const navName = document.getElementById('navName');
    if (navName) navName.textContent = user.name || 'User';

    // Profile dropdown toggle
    const profileDropdownToggle = document.getElementById('profileDropdownToggle');
    const profileDropdown       = document.getElementById('profileDropdown');
    if (profileDropdownToggle && profileDropdown) {
      profileDropdownToggle.addEventListener('click', e => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
      });
    }

    // Close any open dropdowns when clicking elsewhere on the page
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.active, .notifications-dropdown.active')
        .forEach(el => el.classList.remove('active'));
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// POST OPTIONS MODAL — shared between dashboard & profile
// ═══════════════════════════════════════════════════════════════
function openPostOptionsModal(postId, authorId, authorName, authorAvatar, isOwn) {
  const existing = document.getElementById('postOptionsModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'postOptionsModal';
  modal.className = 'post-options-overlay';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  const ownOptions = `
    <div class="post-options__item" onclick="deletePost('${postId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">🗑️</span>
      <span>Delete Post</span>
    </div>
    <div class="post-options__item" onclick="editPost('${postId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">✏️</span>
      <span>Edit Post</span>
    </div>
    <div class="post-options__item" onclick="pinPost('${postId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">📌</span>
      <span>Pin Post</span>
    </div>`;

  const otherOptions = `
    <div class="post-options__item" onclick="sendFriendRequest('${authorId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">👥</span>
      <span>Add Friend</span>
    </div>
    <div class="post-options__item" onclick="followUser('${authorId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">➕</span>
      <span>Follow</span>
    </div>
    <div class="post-options__item" onclick="openChat('${authorId}', '${authorName}', '${authorAvatar}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">💬</span>
      <span>Message</span>
    </div>
    <div class="post-options__item" onclick="sharePost('${postId}'); document.getElementById('postOptionsModal')?.remove();">
      <span class="post-options__icon">📤</span>
      <span>Share Post</span>
    </div>`;

  modal.innerHTML = `
    <div class="post-options__modal">
      <div class="post-options__header">
        <span>Post Options</span>
        <button class="post-options__close" onclick="document.getElementById('postOptionsModal')?.remove()">✕</button>
      </div>
      ${isOwn ? ownOptions : otherOptions}
    </div>`;
  document.body.appendChild(modal);

  const keyHandler = function(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', keyHandler); } };
  document.addEventListener('keydown', keyHandler);
}

// Make SC globally available on every authenticated page
window.SC = SC;

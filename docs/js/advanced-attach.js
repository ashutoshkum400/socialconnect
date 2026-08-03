const AdvancedAttach = (() => {
  let items = [];
  let selected = new Set();
  let currentCategory = 'all';
  let currentView = 'attach';
  let currentUser = null;
  let targetUsers = [];
  let itemSearchQuery = '';
  let userSearchQuery = '';
  let userSearchTimeout = null;
  let userDropdownActive = false;
  let historyMessages = [];
  let historyLoading = false;
  let settingsOpen = false;

  const API = (window.API_BASE || '') + '/api';

  const DEFAULT_PREFS = {
    theme: 'dark',
    bgEffect: 'particles',
    bgImage: '',
    bgImageDim: 0,
    animSpeed: 'normal',
    density: 'comfortable',
    fontSize: 'normal',
    btnStyle: 'default',
    cardEffect: 'none',
    autoUpload: true,
    rtl: false
  };

  let prefs = { ...DEFAULT_PREFS };

  function getToken() {
    try { return localStorage.getItem('sc_token') || localStorage.getItem('token') || sessionStorage.getItem('token') || ''; } catch(e) { return ''; }
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem('sc_user') || localStorage.getItem('user') || sessionStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch(e) { return null; }
  }

  function getDefaultAvatar(name) {
    const colors = ['6c5ce7','00cec9','feca57','ff6b6b','a29bfe','fd79a8','00b894','e17055'];
    const c = colors[name ? name.charCodeAt(0) % colors.length : 0];
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#${c}" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="white" font-size="40" font-weight="700" font-family="sans-serif">${(name || '?')[0].toUpperCase()}</text></svg>`)}`;
  }

  /* ─── Settings / Preferences ─── */
  function loadPrefs() {
    try {
      const saved = localStorage.getItem('aa_prefs');
      if (saved) {
        const parsed = JSON.parse(saved);
        prefs = { ...DEFAULT_PREFS, ...parsed };
      }
    } catch(e) {}
  }

  function savePrefs() {
    try { localStorage.setItem('aa_prefs', JSON.stringify(prefs)); } catch(e) {}
  }

  function applyPrefs() {
    const modal = document.querySelector('.aa-modal');
    if (!modal) return;
    modal.setAttribute('data-aa-theme', prefs.theme);
    modal.setAttribute('data-aa-anim', prefs.animSpeed);
    modal.setAttribute('data-aa-density', prefs.density);
    modal.setAttribute('data-aa-font-size', prefs.fontSize);
    modal.setAttribute('data-aa-btn-style', prefs.btnStyle);
    modal.setAttribute('data-aa-card-effect', prefs.cardEffect);
    if (prefs.rtl) {
      modal.setAttribute('dir', 'rtl');
    } else {
      modal.removeAttribute('dir');
    }
    applyBgEffect();
    updateSettingsUI();
  }

  function applyBgEffect() {
    const modal = document.querySelector('.aa-modal');
    if (!modal) return;
    const oldBg = modal.querySelector('.aa-bg-stars, .aa-bg-gradient, .aa-bg-aurora, .aa-bg-custom');
    if (oldBg) oldBg.remove();

    modal.style.backgroundImage = '';
    modal.style.backgroundSize = '';
    modal.style.backgroundPosition = '';
    modal.style.backgroundRepeat = '';

    const particlesEl = document.getElementById('aaParticles');
    if (particlesEl) particlesEl.style.display = 'none';

    if (prefs.bgImage) {
      const container = document.createElement('div');
      container.className = 'aa-bg-custom';
      container.style.backgroundImage = `url(${JSON.stringify(prefs.bgImage)})`;
      const dim = parseFloat(prefs.bgImageDim) || 0;
      if (dim > 0) {
        container.style.setProperty('--bg-dim', dim);
        container.classList.add('aa-bg-custom--dimmed');
      }
      modal.insertBefore(container, modal.firstChild);
      return;
    }

    const effect = prefs.bgEffect;
    if (effect === 'particles') {
      if (particlesEl) particlesEl.style.display = '';
    } else if (effect === 'stars') {
      const container = document.createElement('div');
      container.className = 'aa-bg-stars';
      for (let i = 0; i < 80; i++) {
        const star = document.createElement('div');
        star.className = 'aa-star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = star.style.height = (1 + Math.random() * 2) + 'px';
        star.style.animationDelay = Math.random() * 4 + 's';
        star.style.animationDuration = (2 + Math.random() * 4) + 's';
        container.appendChild(star);
      }
      modal.insertBefore(container, modal.firstChild);
    } else if (effect === 'gradient') {
      const container = document.createElement('div');
      container.className = 'aa-bg-gradient';
      modal.insertBefore(container, modal.firstChild);
    } else if (effect === 'aurora') {
      const container = document.createElement('div');
      container.className = 'aa-bg-aurora';
      for (let i = 0; i < 2; i++) {
        const wave = document.createElement('div');
        wave.className = 'aa-aurora-wave';
        container.appendChild(wave);
      }
      modal.insertBefore(container, modal.firstChild);
    }
  }

  function handleBgImageUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      prefs.bgImage = e.target.result;
      prefs.bgImageDim = '0';
      savePrefs();
      applyPrefs();
      recreateSettingsPanel();
      showToast('Background image set ✓', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function removeBgImage() {
    prefs.bgImage = '';
    prefs.bgImageDim = '0';
    savePrefs();
    applyPrefs();
    recreateSettingsPanel();
    showToast('Background image removed', 'info');
  }

  function setBgImageDim(val) {
    prefs.bgImageDim = val;
    savePrefs();
    applyBgEffect();
    const dimLabel = document.querySelector('.aa-settings-row .aa-settings-label-sub');
    if (dimLabel) dimLabel.textContent = Math.round(val * 100) + '%';
  }

  function recreateSettingsPanel() {
    const panel = document.getElementById('aaSettingsPanel');
    const overlay = document.getElementById('aaSettingsOverlay');
    if (panel) panel.remove();
    if (overlay) overlay.remove();
    createSettingsPanel();
    if (settingsOpen) {
      document.getElementById('aaSettingsPanel')?.classList.add('open');
      document.getElementById('aaSettingsOverlay')?.classList.add('open');
    }
  }

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    const panel = document.getElementById('aaSettingsPanel');
    const overlay = document.getElementById('aaSettingsOverlay');
    if (panel) panel.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  }

  function setPref(key, value) {
    prefs[key] = value;
    savePrefs();
    applyPrefs();
    const btn = document.querySelector('.aa-settings-btn');
    if (btn) {
      const hasCustom = Object.keys(DEFAULT_PREFS).some(k => prefs[k] !== DEFAULT_PREFS[k]);
      btn.classList.toggle('has-pref', hasCustom);
    }
  }

  function resetPrefs() {
    prefs = { ...DEFAULT_PREFS };
    savePrefs();
    applyPrefs();
    const btn = document.querySelector('.aa-settings-btn');
    if (btn) btn.classList.remove('has-pref');
    showToast('Settings reset to default', 'info');
  }

  function updateSettingsUI() {
    document.querySelectorAll('.aa-settings-opt').forEach(el => {
      const key = el.dataset.prefKey;
      const val = el.dataset.prefVal;
      el.classList.toggle('active', prefs[key] === val);
    });
    document.querySelectorAll('.aa-settings-theme-btn').forEach(el => {
      el.classList.toggle('active', prefs.theme === el.dataset.theme);
    });
  }

  function createSettingsPanel() {
    if (document.getElementById('aaSettingsPanel')) return;

    const overlay = document.createElement('div');
    overlay.className = 'aa-settings-overlay';
    overlay.id = 'aaSettingsOverlay';
    overlay.onclick = toggleSettings;

    const getThemeSwatches = () => {
      const themes = [
        { id: 'dark', label: 'Dark', colors: ['#0a0a1a', '#6c5ce7'] },
        { id: 'light', label: 'Light', colors: ['#f5f5fa', '#6c5ce7'] },
        { id: 'purple', label: 'Purple', colors: ['#120822', '#ce93d8'] },
        { id: 'ocean', label: 'Ocean', colors: ['#001220', '#29b6f6'] },
        { id: 'forest', label: 'Forest', colors: ['#0a1a0a', '#66bb6a'] },
        { id: 'sunset', label: 'Sunset', colors: ['#1a0a0a', '#ff9800'] },
        { id: 'midnight', label: 'Midnight', colors: ['#050510', '#7c7cff'] }
      ];
      return themes.map(t => `
        <button class="aa-settings-theme-btn${prefs.theme === t.id ? ' active' : ''}" data-theme="${t.id}" onclick="AdvancedAttach.setPref('theme','${t.id}')">
          <span class="aa-settings-theme-swatch" style="background:linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})"></span>
          <span class="aa-settings-theme-name">${t.label}</span>
        </button>
      `).join('');
    };

    const makeOptions = (key, options) => {
      return options.map(o => `
        <button class="aa-settings-opt${prefs[key] === o.value ? ' active' : ''}" data-pref-key="${key}" data-pref-val="${o.value}" onclick="AdvancedAttach.setPref('${key}','${o.value}')">${o.label}</button>
      `).join('');
    };

    const panel = document.createElement('div');
    panel.className = 'aa-settings-panel';
    panel.id = 'aaSettingsPanel';
    panel.innerHTML = `
      <div class="aa-settings-header">
        <span class="aa-settings-title">✦ Settings</span>
        <div style="display:flex;gap:6px;">
          <button class="aa-btn" onclick="AdvancedAttach.resetPrefs()" style="font-size:12px;padding:4px 10px;" title="Reset to defaults">↻ Reset</button>
          <button class="aa-btn aa-btn--close" onclick="AdvancedAttach.toggleSettings()" style="width:32px;height:32px;">✕</button>
        </div>
      </div>
      <div class="aa-settings-body">
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">🎨 Theme</div>
          <div class="aa-settings-themes">${getThemeSwatches()}</div>
        </div>
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">✨ Background</div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Effect</span>
            <div class="aa-settings-options">${makeOptions('bgEffect', [{label:'Particles',value:'particles'},{label:'Stars',value:'stars'},{label:'Gradient',value:'gradient'},{label:'Aurora',value:'aurora'},{label:'None',value:'none'}])}</div>
          </div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Custom Image<span class="aa-settings-label-sub">Upload your own</span></span>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="file" accept="image/*" id="aaBgImageInput" style="display:none" onchange="AdvancedAttach.handleBgImageUpload(this)">
              <button class="aa-settings-opt" onclick="document.getElementById('aaBgImageInput').click()" style="cursor:pointer;">${prefs.bgImage ? '🖼️ Change' : '📁 Choose'}</button>
              ${prefs.bgImage ? `<button class="aa-settings-opt" onclick="AdvancedAttach.removeBgImage()" style="cursor:pointer;color:var(--aa-danger);">✕ Clear</button>` : ''}
            </div>
          </div>
          ${prefs.bgImage ? `
          <div class="aa-settings-row">
            <span class="aa-settings-label">Dim<span class="aa-settings-label-sub">${Math.round((parseFloat(prefs.bgImageDim) || 0) * 100)}%</span></span>
            <input type="range" min="0" max="0.7" step="0.05" value="${parseFloat(prefs.bgImageDim) || 0}"
                   oninput="AdvancedAttach.setBgImageDim(this.value)"
                   style="flex:1;max-width:140px;accent-color:var(--aa-primary);height:4px;border-radius:2px;">
          </div>` : ''}
        </div>
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">⚡ Animation</div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Speed</span>
            <div class="aa-settings-options">${makeOptions('animSpeed', [{label:'Off',value:'off'},{label:'Slow',value:'slow'},{label:'Normal',value:'normal'},{label:'Fast',value:'fast'}])}</div>
          </div>
        </div>
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">📐 Layout</div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Density</span>
            <div class="aa-settings-options">${makeOptions('density', [{label:'Compact',value:'compact'},{label:'Comfortable',value:'comfortable'},{label:'Cozy',value:'cozy'}])}</div>
          </div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Font Size</span>
            <div class="aa-settings-options">${makeOptions('fontSize', [{label:'Small',value:'small'},{label:'Normal',value:'normal'},{label:'Large',value:'large'}])}</div>
          </div>
        </div>
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">🖌️ Style</div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Button Style</span>
            <div class="aa-settings-options">${makeOptions('btnStyle', [{label:'Default',value:'default'},{label:'Round',value:'round'},{label:'Square',value:'square'},{label:'Minimal',value:'minimal'}])}</div>
          </div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Card Effect</span>
            <div class="aa-settings-options">${makeOptions('cardEffect', [{label:'None',value:'none'},{label:'Glow',value:'glow'},{label:'Glass',value:'glass'},{label:'Border',value:'border'}])}</div>
          </div>
        </div>
        <div class="aa-settings-group">
          <div class="aa-settings-group-title">⚙️ Behavior</div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">Auto Upload</span>
            <div class="aa-settings-options">${makeOptions('autoUpload', [{label:'On',value:'true'},{label:'Off',value:'false'}])}</div>
          </div>
          <div class="aa-settings-row">
            <span class="aa-settings-label">RTL Layout</span>
            <div class="aa-settings-options">${makeOptions('rtl', [{label:'Off',value:'false'},{label:'On',value:'true'}])}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function init() {
    loadPrefs();
    currentUser = getCurrentUser();
    const overlay = document.getElementById('aaOverlay');
    if (!overlay) createStructure();
    setupEventListeners();
    createSettingsPanel();
    applyPrefs();
  }

  function createStructure() {
    const html = `
    <div class="aa-toast-container" id="aaToastContainer"></div>

    <div class="aa-overlay" id="aaOverlay">
      <div class="aa-modal">
        <div class="aa-particles" id="aaParticles"></div>
        <div class="aa-progress"><div class="aa-progress-bar" id="aaProgressBar"></div></div>

        <div class="aa-header">
          <div class="aa-header-left">
            <span class="aa-header-title">✦ Advanced Attach</span>
            <span class="aa-header-badge">v3.0</span>
          </div>
          <div class="aa-header-actions">
            <button class="aa-btn" onclick="AdvancedAttach.switchView('attach')" id="aaViewAttachBtn" style="display:none;" title="Back to Attach">📎 Attach</button>
            <button class="aa-btn" onclick="AdvancedAttach.switchView('history')" id="aaViewHistoryBtn" title="View History">📋 History</button>
            <button class="aa-btn" onclick="AdvancedAttach.openTextInput()" title="Send Text">📝 Text</button>
            <button class="aa-btn" onclick="AdvancedAttach.openLinkInput()" title="Send Link">🔗 Link</button>
            <button class="aa-btn" onclick="AdvancedAttach.openFilePicker()" title="Add Files">📁 Files</button>
            <button class="aa-btn" onclick="AdvancedAttach.openFolderPicker()" title="Add Folder">📂 Folder</button>
            <button class="aa-btn aa-settings-btn" onclick="AdvancedAttach.toggleSettings()" title="Settings">⚙️</button>
            <button class="aa-btn aa-btn--close" onclick="AdvancedAttach.close()">✕</button>
          </div>
        </div>

        <div class="aa-user-section" id="aaUserSection">
          <div class="aa-user-search-wrap">
            <span class="aa-user-search-icon">👥</span>
            <input class="aa-user-search" id="aaUserSearch" type="text"
                   placeholder="Search users to send to... (type name)"
                   autocomplete="off"
                   oninput="AdvancedAttach.handleUserSearch(this.value)">
            <div class="aa-user-dropdown" id="aaUserDropdown"></div>
          </div>
          <div class="aa-user-chips" id="aaUserChips"></div>
        </div>

        <div class="aa-text-input-area" id="aaTextInputArea">
          <textarea id="aaTextInput" placeholder="Type your text message here..." maxlength="10000"></textarea>
          <div class="aa-text-actions">
            <button class="aa-btn" onclick="AdvancedAttach.cancelTextInput()">Cancel</button>
            <button class="aa-btn aa-btn--primary" onclick="AdvancedAttach.confirmTextInput()">Add Text</button>
          </div>
        </div>

        <div class="aa-link-input-area" id="aaLinkInputArea">
          <div class="aa-link-input-row">
            <input id="aaLinkInput" type="url" placeholder="https://example.com">
            <input id="aaLinkTitleInput" type="text" placeholder="Link title (optional)">
            <button class="aa-btn aa-btn--primary" onclick="AdvancedAttach.confirmLinkInput()">Add Link</button>
            <button class="aa-btn" onclick="AdvancedAttach.cancelLinkInput()">Cancel</button>
          </div>
        </div>

        <div class="aa-body">
          <div class="aa-sidebar" id="aaSidebar">
            <div class="aa-category active" data-cat="all" onclick="AdvancedAttach.filterCategory('all')">
              <span class="aa-category-icon">✦</span> All Items
              <span class="aa-category-count" id="aaCountAll">0</span>
            </div>
            <div class="aa-category" data-cat="image" onclick="AdvancedAttach.filterCategory('image')">
              <span class="aa-category-icon">🖼️</span> Images
              <span class="aa-category-count" id="aaCountImage">0</span>
            </div>
            <div class="aa-category" data-cat="video" onclick="AdvancedAttach.filterCategory('video')">
              <span class="aa-category-icon">🎬</span> Videos
              <span class="aa-category-count" id="aaCountVideo">0</span>
            </div>
            <div class="aa-category" data-cat="audio" onclick="AdvancedAttach.filterCategory('audio')">
              <span class="aa-category-icon">🎵</span> Audio
              <span class="aa-category-count" id="aaCountAudio">0</span>
            </div>
            <div class="aa-category" data-cat="doc" onclick="AdvancedAttach.filterCategory('doc')">
              <span class="aa-category-icon">📄</span> Documents
              <span class="aa-category-count" id="aaCountDoc">0</span>
            </div>
            <div class="aa-category" data-cat="pdf" onclick="AdvancedAttach.filterCategory('pdf')">
              <span class="aa-category-icon">📕</span> PDF
              <span class="aa-category-count" id="aaCountPdf">0</span>
            </div>
            <div class="aa-category" data-cat="link" onclick="AdvancedAttach.filterCategory('link')">
              <span class="aa-category-icon">🔗</span> Links
              <span class="aa-category-count" id="aaCountLink">0</span>
            </div>
            <div class="aa-category" data-cat="text" onclick="AdvancedAttach.filterCategory('text')">
              <span class="aa-category-icon">💬</span> Text
              <span class="aa-category-count" id="aaCountText">0</span>
            </div>
            <div class="aa-category" data-cat="file" onclick="AdvancedAttach.filterCategory('file')">
              <span class="aa-category-icon">📦</span> Files
              <span class="aa-category-count" id="aaCountFile">0</span>
            </div>
            <div class="aa-category" data-cat="history" onclick="AdvancedAttach.filterCategory('history')" style="margin-top:12px;border-top:1px solid var(--aa-border);padding-top:12px;">
              <span class="aa-category-icon">📋</span> History
              <span class="aa-category-count" id="aaCountHistory">0</span>
            </div>
          </div>

          <div class="aa-content">
            <div class="aa-toolbar">
              <div class="aa-toolbar-left">
                <input class="aa-search" id="aaSearch" type="text" placeholder="Search items..." oninput="AdvancedAttach.handleItemSearch(this.value)">
                <span style="font-size:12px;color:var(--aa-text-sec);" id="aaItemCount">0 items</span>
              </div>
              <div class="aa-toolbar-right">
                <button class="aa-btn" onclick="AdvancedAttach.clearAll()" id="aaClearBtn" style="display:none;">🗑️ Clear All</button>
              </div>
            </div>

            <div class="aa-actions-bar" id="aaActionsBar">
              <span class="aa-actions-bar-text"><span id="aaSelectedCount">0</span> selected</span>
              <button class="aa-btn" onclick="AdvancedAttach.sendSelected()" title="Send selected items">📤 Send Selected</button>
              <button class="aa-btn aa-btn--danger" onclick="AdvancedAttach.removeSelected()" title="Remove selected">🗑️ Remove</button>
              <button class="aa-btn aa-btn--danger" onclick="AdvancedAttach.banSelected()" title="Ban selected">🚫 Ban</button>
              <button class="aa-btn" onclick="AdvancedAttach.selectAll()">🔘 Select All</button>
              <button class="aa-btn" onclick="AdvancedAttach.deselectAll()">✕ Deselect All</button>
            </div>

            <div class="aa-grid" id="aaGrid"></div>
          </div>
        </div>

        <div class="aa-footer">
          <div class="aa-footer-left">
            Total: <span id="aaTotalItems">0</span> items ·
            Size: <span id="aaTotalSize">0 B</span>
            <span id="aaUserCount" style="margin-left:12px;opacity:0.6;"></span>
          </div>
          <div class="aa-footer-right">
            <button class="aa-btn" onclick="AdvancedAttach.selectAll()">🔘 Select All</button>
            <button class="aa-btn aa-btn--primary" onclick="AdvancedAttach.sendSelected()">📤 Send (<span id="aaSendCount">0</span>)</button>
          </div>
        </div>
      </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    document.body.appendChild(div.lastElementChild);

    createParticles();
    setupDragDrop();
    createMobileBar();
  }

  function createMobileBar() {
    const existing = document.querySelector('.aa-mobile-bar');
    if (existing) existing.remove();
    const modal = document.querySelector('.aa-modal');
    if (!modal) return;
    const bar = document.createElement('div');
    bar.className = 'aa-mobile-bar';
    bar.innerHTML = `
      <button class="aa-mobile-bar-btn active" onclick="AdvancedAttach.openFilePicker()"><span>📁</span>Files</button>
      <button class="aa-mobile-bar-btn" onclick="AdvancedAttach.openTextInput()"><span>📝</span>Text</button>
      <button class="aa-mobile-bar-btn" onclick="AdvancedAttach.openLinkInput()"><span>🔗</span>Link</button>
      <button class="aa-mobile-bar-btn" onclick="AdvancedAttach.sendSelected()"><span>📤</span>Send</button>
      <button class="aa-mobile-bar-btn" onclick="AdvancedAttach.toggleSettings()"><span>⚙️</span>Settings</button>
    `;
    modal.appendChild(bar);
  }

  function createParticles() {
    const container = document.getElementById('aaParticles');
    if (!container) return;
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'aa-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.animationDuration = (6 + Math.random() * 6) + 's';
      p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
      p.style.background = ['var(--aa-primary)', 'var(--aa-accent)', 'var(--aa-warning)'][Math.floor(Math.random() * 3)];
      container.appendChild(p);
    }
  }

  function setupDragDrop() {
    const grid = document.getElementById('aaGrid');
    if (!grid) return;
    grid.addEventListener('dragover', e => { e.preventDefault(); grid.classList.add('dragover'); });
    grid.addEventListener('dragleave', () => grid.classList.remove('dragover'));
    grid.addEventListener('drop', e => {
      e.preventDefault();
      grid.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files?.length) addFiles(files);
    });
  }

  function setupEventListeners() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendSelected();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.aa-user-search-wrap')) {
        document.getElementById('aaUserDropdown')?.classList.remove('open');
        userDropdownActive = false;
      }
    });
  }

  function open(userId) {
    if (!document.getElementById('aaOverlay')) createStructure();
    currentView = 'attach';
    if (userId && !targetUsers.find(u => u.id === userId)) {
      targetUsers.push({ id: userId, name: 'User', username: '', avatar: '' });
      fetchUserInfo(userId);
    }
    document.getElementById('aaOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('aaViewAttachBtn').style.display = 'none';
    document.getElementById('aaViewHistoryBtn').style.display = '';
    document.querySelector('#aaSidebar .aa-category[data-cat="history"]').style.display = '';
    renderUserChips();
    filterCategory('all');
    updateUserCount();
    autoUpload();
    setTimeout(() => document.getElementById('aaUserSearch')?.focus(), 300);
  }

  async function fetchUserInfo(userId) {
    try {
      const res = await fetch(API + '/users/' + userId, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      const data = await res.json();
      const u = data.data || data;
      if (u && u.id) {
        const idx = targetUsers.findIndex(t => t.id === userId);
        if (idx > -1) {
          targetUsers[idx] = { id: u.id, name: u.name || u.username, username: u.username || '', avatar: u.avatar || '' };
          renderUserChips();
        }
      }
    } catch(e) {}
  }

  function close() {
    const overlay = document.getElementById('aaOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    targetUsers = [];
    historyMessages = [];
    document.getElementById('aaUserSearch').value = '';
    document.getElementById('aaUserDropdown')?.classList.remove('open');
    userDropdownActive = false;
    currentView = 'attach';
    if (settingsOpen) toggleSettings();
  }

  function handleUserSearch(query) {
    userSearchQuery = query.trim();
    clearTimeout(userSearchTimeout);
    if (!userSearchQuery) {
      document.getElementById('aaUserDropdown')?.classList.remove('open');
      userDropdownActive = false;
      return;
    }
    userSearchTimeout = setTimeout(() => searchUsersAPI(userSearchQuery), 300);
  }

  async function searchUsersAPI(query) {
    const dropdown = document.getElementById('aaUserDropdown');
    if (!dropdown) return;
    try {
      const res = await fetch(API + '/users?q=' + encodeURIComponent(query), {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      const json = await res.json();
      const users = Array.isArray(json) ? json : (json.data || json.users || [])
        .filter(u => u.id !== currentUser?.id && !targetUsers.find(t => t.id === u.id))
        .slice(0, 10);

      if (!users.length) {
        dropdown.innerHTML = `<div class="aa-user-dropdown__empty">No users found</div>`;
        dropdown.classList.add('open');
        userDropdownActive = true;
        return;
      }

      dropdown.innerHTML = users.map(u => {
        const id = u.id, name = u.name || u.username || 'User', username = u.username || '', avatar = u.avatar || '';
        return `<div class="aa-user-dropdown__item" data-user-id="${id}" data-user-name="${escapeHtml(name)}" data-user-username="${escapeHtml(username)}" data-user-avatar="${escapeHtml(avatar)}">
          <img class="aa-user-dropdown__avatar" src="${avatar || getDefaultAvatar(name)}" onerror="this.src='${getDefaultAvatar(name)}'" alt="">
          <div class="aa-user-dropdown__info">
            <span class="aa-user-dropdown__name">${escapeHtml(name)}</span>
            <span class="aa-user-dropdown__username">@${escapeHtml(username)}</span>
          </div>
          <span class="aa-user-dropdown__add">+ Add</span>
        </div>`;
      }).join('');
      dropdown.querySelectorAll('.aa-user-dropdown__item').forEach(el => {
        el.addEventListener('click', () => {
          selectUser(el.dataset.userId, el.dataset.userName, el.dataset.userUsername, el.dataset.userAvatar);
        });
      });
      dropdown.classList.add('open');
      userDropdownActive = true;
    } catch(e) {
      dropdown.innerHTML = `<div class="aa-user-dropdown__empty">Search failed</div>`;
      dropdown.classList.add('open');
      userDropdownActive = true;
    }
  }

  function selectUser(id, name, username, avatar) {
    if (targetUsers.find(u => u.id === id)) return;
    targetUsers.push({ id, name, username, avatar });
    document.getElementById('aaUserDropdown')?.classList.remove('open');
    userDropdownActive = false;
    document.getElementById('aaUserSearch').value = '';
    userSearchQuery = '';
    renderUserChips();
    updateUserCount();
    showToast(`Added ${name}`, 'success');
  }

  function removeUser(id) {
    targetUsers = targetUsers.filter(u => u.id !== id);
    renderUserChips();
    updateUserCount();
  }

  function renderUserChips() {
    const container = document.getElementById('aaUserChips');
    if (!container) return;
    if (!targetUsers.length) {
      container.innerHTML = '<span class="aa-user-chips__empty">No users selected — search and add users above</span>';
      return;
    }
    container.innerHTML = targetUsers.map(u => `
      <span class="aa-user-chip">
        <img class="aa-user-chip__avatar" src="${u.avatar || getDefaultAvatar(u.name)}" onerror="this.src='${getDefaultAvatar(u.name)}'" alt="">
        <span class="aa-user-chip__name">${escapeHtml(u.name || u.username || u.id)}</span>
        <button class="aa-user-chip__remove" onclick="event.stopPropagation();AdvancedAttach.removeUser('${u.id}')" title="Remove">✕</button>
      </span>
    `).join('');
  }

  function updateUserCount() {
    const el = document.getElementById('aaUserCount');
    if (el) el.textContent = targetUsers.length ? `👥 ${targetUsers.length} user(s)` : '';
  }

  async function loadHistory() {
    const grid = document.getElementById('aaGrid');
    if (!grid) return;
    if (!targetUsers.length) {
      grid.innerHTML = `<div class="aa-empty"><div class="aa-empty-icon">📋</div><div class="aa-empty-text">Select users first</div><div class="aa-empty-sub">Search and add users above to see chat history</div></div>`;
      return;
    }
    if (historyLoading) return;
    historyLoading = true;
    historyMessages = [];
    grid.innerHTML = `<div class="aa-empty"><div class="aa-empty-icon">⏳</div><div class="aa-empty-text">Loading history...</div></div>`;
    try {
      const allMessages = [];
      const mediaTypes = new Set(['image','video','audio','file','doc','pdf','gif','sticker']);
      for (const user of targetUsers) {
        const res = await fetch(API + '/chat/' + user.id, {
          headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (!res.ok) continue;
        const msgs = await res.json();
        const msgsArr = Array.isArray(msgs) ? msgs : (msgs.data || []);
        for (const m of msgsArr) {
          const type = (m.type || m.mediaType || 'text').toLowerCase();
          if (mediaTypes.has(type) || m.mediaUrl) {
            allMessages.push({ ...m, targetUserId: user.id, targetUserName: user.name || user.username });
          }
        }
      }
      allMessages.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
      historyMessages = allMessages;
      renderHistory();
    } catch (e) {
      grid.innerHTML = `<div class="aa-empty"><div class="aa-empty-icon">❌</div><div class="aa-empty-text">Failed to load history</div></div>`;
    } finally {
      historyLoading = false;
    }
  }

  function renderHistory() {
    const grid = document.getElementById('aaGrid');
    if (!grid) return;
    const countEl = document.getElementById('aaCountHistory');
    if (countEl) countEl.textContent = historyMessages.length;

    if (!historyMessages.length) {
      grid.innerHTML = `<div class="aa-empty"><div class="aa-empty-icon">📋</div><div class="aa-empty-text">No media/file history found</div><div class="aa-empty-sub">Sent and received files, images, videos, docs will appear here</div></div>`;
      return;
    }

    grid.innerHTML = historyMessages.map((m, idx) => {
      const isSent = m.senderId === currentUser?.id;
      const type = (m.type || m.mediaType || 'file').toLowerCase();
      const iconMap = { image:'🖼️', video:'🎬', audio:'🎵', file:'📦', doc:'📄', pdf:'📕', gif:'🎞️', sticker:'🎭' };
      const icon = iconMap[type] || '📎';
      const name = m.fileName || m.text || (type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'audio' ? 'Audio' : 'File');
      const size = m.fileSize ? formatSize(m.fileSize) : '';
      const time = m.time ? formatTime(m.time) : '';
      const targetName = m.targetUserName || 'User';
      const senderLabel = isSent ? `You → ${targetName}` : `${targetName} → You`;

      let thumbHtml = '';
      if ((type === 'image' || type === 'gif' || type === 'sticker') && m.mediaUrl) {
        thumbHtml = `<img src="${m.mediaUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`;
      } else if (type === 'video' && m.mediaUrl) {
        thumbHtml = `<video src="${m.mediaUrl}" muted preload="metadata"></video>`;
      } else {
        thumbHtml = `<span class="aa-item-thumb-icon">${icon}</span>`;
      }

      return `<div class="aa-item" data-id="${m.id || idx}" style="animation-delay:${idx * 0.03}s">
        <div class="aa-item-thumb">${thumbHtml}<span class="aa-item-type-badge">${type}</span></div>
        <div class="aa-item-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="aa-item-meta"><span>${size}</span><span>${isSent ? '📤' : '📥'} ${senderLabel}</span></div>
        <div style="font-size:10px;color:var(--aa-text-sec);margin:4px 0 6px;">${time}</div>
        ${m.mediaUrl ? `<div style="display:flex;gap:6px;">
          <button class="aa-item-action-btn" onclick="AdvancedAttach.resendHistoryItem('${m.id || idx}')" title="Forward to user">↻ Forward</button>
          <button class="aa-item-action-btn" onclick="window.open('${m.mediaUrl}','_blank')" title="Open">👁️ Open</button>
          <button class="aa-item-action-btn" onclick="AdvancedAttach.downloadUrl('${m.mediaUrl}','${escapeHtml(name)}')" title="Download">⬇️ Save</button>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function resendHistoryItem(msgId) {
    const msg = historyMessages.find(m => (m.id || '') === msgId);
    if (!msg) return;
    if (!targetUsers.length) { showToast('Select users to forward to', 'error'); return; }
    const sock = window.__socket || window.socket;
    let sent = 0;
    targetUsers.forEach(user => {
      if (sock?.emit) {
        sock.emit('send_message', {
          toUserId: user.id,
          text: msg.text || msg.fileName || '',
          type: msg.type || msg.mediaType || 'file',
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType || msg.type,
          fileName: msg.fileName || 'file',
          fileSize: msg.fileSize
        });
      }
      appendChatBubbleDirect(user.id, {
        senderId: currentUser?.id, time: new Date().toISOString(),
        text: msg.text || msg.fileName || '',
        type: msg.type || msg.mediaType || 'file',
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType || msg.type,
        fileName: msg.fileName || 'file',
        fileSize: msg.fileSize
      });
      sent++;
    });
    showToast(`Forwarded to ${sent} user(s) ✓`, 'success');
  }

  function downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.target = '_blank';
    a.click();
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    } catch(e) { return ''; }
  }

  function addFiles(fileList) {
    for (const file of fileList) {
      const relPath = file.webkitRelativePath || file.name;
      const item = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        relPath,
        mediaType: getMessageType(file),
        icon: getFileIcon(file),
        previewUrl: (file.type.startsWith('image/') || file.type.startsWith('video/')) ? URL.createObjectURL(file) : null,
        uploadProgress: 0,
        uploadUrl: null,
        uploaded: false,
        sending: false,
        kind: 'file',
        uploadError: false
      };
      items.push(item);
    }
    updateCounts();
    render();
    showToast(`Added ${fileList.length} file(s)`, 'success');
    autoUpload();
  }

  function addTextMessage(text) {
    if (!text?.trim()) return;
    const item = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: 'Text Message: ' + text.slice(0, 40) + (text.length > 40 ? '...' : ''),
      text: text.trim(),
      size: text.length,
      type: 'text/plain',
      mediaType: 'text',
      icon: '💬',
      kind: 'text',
      uploaded: true,
      uploadUrl: null
    };
    items.push(item);
    updateCounts();
    render();
    showToast('Text added', 'success');
  }

  function addLink(url, title) {
    if (!url?.trim()) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const displayTitle = title?.trim() || url;
    const item = {
      id: 'link_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: '🔗 ' + displayTitle,
      url: url.trim(),
      title: displayTitle.trim(),
      size: url.length,
      type: 'text/uri-list',
      mediaType: 'link',
      icon: '🔗',
      kind: 'link',
      uploaded: true,
      uploadUrl: url
    };
    items.push(item);
    updateCounts();
    render();
    showToast('Link added', 'success');
  }

  function getMessageType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    const ext = file.name?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc','docx','txt','rtf','odt'].includes(ext)) return 'doc';
    if (['xls','xlsx','csv'].includes(ext)) return 'doc';
    if (['ppt','pptx'].includes(ext)) return 'doc';
    return 'file';
  }

  function getFileIcon(file) {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎬';
    if (file.type.startsWith('audio/')) return '🎵';
    const ext = file.name?.split('.').pop()?.toLowerCase();
    const icons = { pdf:'📕', doc:'📄', docx:'📄', txt:'📝', rtf:'📄',
                    xls:'📊', xlsx:'📊', csv:'📊', ppt:'📽️', pptx:'📽️',
                    zip:'🗜️', rar:'🗜️', '7z':'🗜️', gz:'🗜️',
                    js:'📜', py:'📜', html:'🌐', css:'🎨', json:'📋',
                    mp3:'🎵', wav:'🎵', m4a:'🎵', flac:'🎵',
                    exe:'⚙️', dll:'⚙️', apk:'📱' };
    return icons[ext] || '📦';
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  function switchView(view) {
    currentView = view;
    const mobileBar = document.querySelector('.aa-mobile-bar');
    if (view === 'attach') {
      document.getElementById('aaViewAttachBtn').style.display = 'none';
      document.getElementById('aaViewHistoryBtn').style.display = '';
      document.getElementById('aaUserSection').style.display = '';
      document.getElementById('aaTextInputArea').style.display = '';
      document.getElementById('aaLinkInputArea').style.display = '';
      document.querySelector('.aa-toolbar').style.display = '';
      document.getElementById('aaActionsBar').style.display = '';
      document.querySelector('.aa-footer').style.display = '';
      document.querySelector('#aaSidebar .aa-category[data-cat="history"]').style.display = '';
      if (mobileBar) mobileBar.style.display = '';
      filterCategory('all');
    } else {
      document.getElementById('aaViewAttachBtn').style.display = '';
      document.getElementById('aaViewHistoryBtn').style.display = 'none';
      document.getElementById('aaUserSection').style.display = 'none';
      document.getElementById('aaTextInputArea').style.display = 'none';
      document.getElementById('aaLinkInputArea').style.display = 'none';
      document.querySelector('.aa-toolbar').style.display = 'none';
      document.getElementById('aaActionsBar').style.display = 'none';
      document.querySelector('.aa-footer').style.display = 'none';
      document.querySelector('#aaSidebar .aa-category[data-cat="history"]').style.display = 'none';
      if (mobileBar) mobileBar.style.display = 'none';
      filterCategory('history');
    }
  }

  function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('#aaSidebar .aa-category').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`#aaSidebar .aa-category[data-cat="${cat}"]`);
    if (activeEl) activeEl.classList.add('active');

    if (cat === 'history') {
      loadHistory();
      return;
    }
    render();
  }

  function handleItemSearch(query) {
    itemSearchQuery = query.toLowerCase().trim();
    render();
  }

  function getFilteredItems() {
    let result = items;
    if (currentCategory !== 'all') {
      result = result.filter(i => i.mediaType === currentCategory);
    }
    if (itemSearchQuery) {
      result = result.filter(i => i.name?.toLowerCase().includes(itemSearchQuery) ||
                                  i.text?.toLowerCase().includes(itemSearchQuery) ||
                                  i.url?.toLowerCase().includes(itemSearchQuery) ||
                                  i.title?.toLowerCase().includes(itemSearchQuery));
    }
    return result;
  }

  function toggleSelect(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    updateActionsBar();
    render();
  }

  function selectAll() {
    const filtered = getFilteredItems();
    filtered.forEach(i => selected.add(i.id));
    updateActionsBar();
    render();
    showToast(`Selected ${filtered.length} items`, 'info');
  }

  function deselectAll() {
    selected.clear();
    updateActionsBar();
    render();
  }

  function clearAll() {
    items.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    items = [];
    selected.clear();
    updateCounts();
    render();
    updateActionsBar();
    showToast('All items cleared', 'info');
  }

  function removeItem(id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    if (items[idx].previewUrl) URL.revokeObjectURL(items[idx].previewUrl);
    items.splice(idx, 1);
    selected.delete(id);
    updateCounts();
    render();
    updateActionsBar();
  }

  function removeSelected() {
    const toRemove = [...selected];
    toRemove.forEach(id => removeItem(id));
    if (toRemove.length) showToast(`Removed ${toRemove.length} item(s)`, 'info');
  }

  function banSelected() {
    const names = [...selected].map(id => items.find(i => i.id === id)).filter(Boolean).map(i => i.name);
    if (!names.length) return;
    showToast(`🚫 Banned: ${names.join(', ')}`, 'error');
    removeSelected();
  }

  function editItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.kind === 'text') {
      const newText = prompt('Edit text:', item.text);
      if (newText !== null && newText.trim()) {
        item.text = newText.trim();
        item.name = 'Text Message: ' + newText.slice(0, 40) + (newText.length > 40 ? '...' : '');
        render();
        showToast('Text updated', 'success');
      }
    } else if (item.kind === 'link') {
      const newUrl = prompt('Edit URL:', item.url);
      if (newUrl !== null && newUrl.trim()) {
        item.url = newUrl.trim();
        const newTitle = prompt('Edit title:', item.title);
        if (newTitle !== null) item.title = newTitle.trim() || item.url;
        item.name = '🔗 ' + item.title;
        render();
        showToast('Link updated', 'success');
      }
    } else {
      const newName = prompt('Rename:', item.name);
      if (newName !== null && newName.trim()) {
        item.name = newName.trim();
        render();
        showToast('Item renamed', 'success');
      }
    }
  }

  function showContextMenu(e, id) {
    e.preventDefault();
    removeContextMenu();
    const item = items.find(i => i.id === id);
    if (!item) return;

    const menu = document.createElement('div');
    menu.className = 'aa-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const actions = [
      { label: '✏️ Edit', action: () => { editItem(id); removeContextMenu(); } },
      { label: '📤 Send', action: () => { sendItems([id]); removeContextMenu(); } },
      { label: '🗑️ Delete', className: 'danger', action: () => { removeItem(id); removeContextMenu(); } },
      { label: '🚫 Ban', className: 'danger', action: () => { banSelected(); removeContextMenu(); } }
    ];

    if (item.kind === 'text') {
      actions.splice(0, 0, { label: '📋 Copy Text', action: () => { copyToClipboard(item.text); removeContextMenu(); } });
    }
    if (item.kind === 'link') {
      actions.splice(0, 0, { label: '🔗 Open Link', action: () => { window.open(item.url, '_blank'); removeContextMenu(); } });
    }

    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.textContent = a.label;
      if (a.className) btn.className = a.className;
      btn.onclick = a.action;
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';

    setTimeout(() => {
      document.addEventListener('click', removeContextMenu, { once: true });
    }, 10);
  }

  function removeContextMenu() {
    document.querySelectorAll('.aa-context-menu').forEach(el => el.remove());
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => {});
  }

  function render() {
    const grid = document.getElementById('aaGrid');
    if (!grid) return;
    renderUserChips();
    const filtered = getFilteredItems();

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="aa-empty">
          <div class="aa-empty-icon">✦</div>
          <div class="aa-empty-text">No items found</div>
          <div class="aa-empty-sub">Add files, folders, text, or links above</div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;justify-content:center;">
            <button class="aa-btn" onclick="AdvancedAttach.openFilePicker()">📁 Add Files</button>
            <button class="aa-btn" onclick="AdvancedAttach.openFolderPicker()">📂 Add Folder</button>
            <button class="aa-btn" onclick="AdvancedAttach.openTextInput()">📝 Add Text</button>
            <button class="aa-btn" onclick="AdvancedAttach.openLinkInput()">🔗 Add Link</button>
          </div>
        </div>
      `;
      updateFooterStats();
      return;
    }

    grid.innerHTML = filtered.map((item, idx) => {
      const isSelected = selected.has(item.id);
      const cat = item.mediaType;
      const sizeStr = formatSize(item.size);
      const thumbnail = getThumbnailHtml(item);
      const icon = item.icon || '📦';

      return `
        <div class="aa-item ${isSelected ? 'selected' : ''}"
             data-id="${item.id}"
             onclick="AdvancedAttach.toggleSelect('${item.id}')"
             oncontextmenu="AdvancedAttach.showContextMenu(event, '${item.id}')"
             style="animation-delay:${idx * 0.04}s">
          <div class="aa-item-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="aa-item-thumb">
            ${thumbnail || `<span class="aa-item-thumb-icon">${icon}</span>`}
            <span class="aa-item-type-badge">${cat}</span>
          </div>
          ${item.kind === 'file' && item.sending ? `
            <div class="aa-item-progress-wrap">
              <div class="aa-item-progress-bar" style="width:${item.uploadProgress}%"></div>
              <span class="aa-item-progress-text">${item.uploadProgress}%</span>
            </div>
          ` : ''}
          ${item.kind === 'file' && item.uploadError ? `
            <div class="aa-item-progress-wrap aa-item-progress-error">
              <span class="aa-item-progress-text" style="color:var(--aa-danger)">Upload Failed</span>
              <button class="aa-item-retry-btn" onclick="event.stopPropagation();AdvancedAttach.retryUpload('${item.id}')">↻ Retry</button>
            </div>
          ` : ''}
          <div class="aa-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="aa-item-meta">
            <span>${sizeStr}</span>
            <span>${item.uploaded ? '✅' : item.uploadError ? '❌' : item.sending ? '⏳' : item.kind !== 'file' ? '✅' : ''}</span>
          </div>
          <div class="aa-item-actions">
            <button class="aa-item-action-btn" onclick="event.stopPropagation();AdvancedAttach.sendItems(['${item.id}'])">📤 Send</button>
            <button class="aa-item-action-btn" onclick="event.stopPropagation();AdvancedAttach.editItem('${item.id}')">✏️ Edit</button>
            <button class="aa-item-action-btn danger" onclick="event.stopPropagation();AdvancedAttach.removeItem('${item.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    updateFooterStats();
  }

  function getThumbnailHtml(item) {
    if (item.kind === 'text') return `<span style="font-size:36px;opacity:0.6;">💬</span>`;
    if (item.kind === 'link') return `<span style="font-size:36px;opacity:0.6;">🔗</span>`;
    if (item.mediaType === 'image' && item.previewUrl) {
      return `<img src="${item.previewUrl}" alt="" loading="lazy">`;
    }
    if (item.mediaType === 'video' && item.previewUrl) {
      return `<video src="${item.previewUrl}" muted preload="metadata"></video>`;
    }
    return null;
  }

  function updateCounts() {
    const counts = { all: items.length, image: 0, video: 0, audio: 0, doc: 0, pdf: 0, link: 0, text: 0, file: 0 };
    items.forEach(i => { if (counts[i.mediaType] !== undefined) counts[i.mediaType]++; });
    Object.entries(counts).forEach(([key, val]) => {
      const el = document.getElementById('aaCount' + key.charAt(0).toUpperCase() + key.slice(1));
      if (el) el.textContent = val;
    });

    const totalSize = items.reduce((s, i) => s + i.size, 0);
    const totalEl = document.getElementById('aaTotalItems');
    const sizeEl = document.getElementById('aaTotalSize');
    if (totalEl) totalEl.textContent = items.length;
    if (sizeEl) sizeEl.textContent = formatSize(totalSize);

    const clearBtn = document.getElementById('aaClearBtn');
    if (clearBtn) clearBtn.style.display = items.length ? '' : 'none';
  }

  function updateFooterStats() {
    const filtered = getFilteredItems();
    const countEl = document.getElementById('aaItemCount');
    if (countEl) countEl.textContent = filtered.length + ' items';

    const totalSize = items.reduce((s, i) => s + i.size, 0);
    const sizeEl = document.getElementById('aaTotalSize');
    if (sizeEl) sizeEl.textContent = formatSize(totalSize);

    const totalEl = document.getElementById('aaTotalItems');
    if (totalEl) totalEl.textContent = items.length;

    const sendCount = document.getElementById('aaSendCount');
    if (sendCount) sendCount.textContent = selected.size || items.length;
  }

  function updateActionsBar() {
    const bar = document.getElementById('aaActionsBar');
    const countEl = document.getElementById('aaSelectedCount');
    if (!bar || !countEl) return;
    if (selected.size > 0) {
      bar.classList.add('visible');
      countEl.textContent = selected.size;
    } else {
      bar.classList.remove('visible');
    }
  }

  function autoUpload() {
    if (prefs.autoUpload === 'false') return;
    items.forEach((item, idx) => {
      if (item.kind === 'file' && !item.uploaded && !item.sending) {
        uploadItem(idx);
      }
    });
  }

  function retryUpload(id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = items[idx];
    item.sending = false;
    item.uploadError = false;
    item.uploadProgress = 0;
    item.uploadUrl = null;
    item.uploaded = false;
    render();
    uploadItem(idx);
  }

  function uploadItem(idx) {
    const item = items[idx];
    if (!item || item.kind !== 'file') return;

    item.sending = true;
    item.uploadProgress = 5;
    updateProgress();

    const formData = new FormData();
    formData.append('file', item.file);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        item.uploadProgress = Math.round((e.loaded / e.total) * 100);
        updateProgress();
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success && json.url) {
            item.uploadUrl = json.url;
            item.uploaded = true;
            item.sending = false;
            item.uploadProgress = 100;
            updateProgress();
            render();
            return;
          }
        } catch (e) {}
      }
      item.sending = false;
      item.uploadError = true;
      item.uploadProgress = 0;
      updateProgress();
      render();
      showToast(`Upload failed: ${item.name}`, 'error');
    };

    xhr.onerror = () => {
      item.sending = false;
      item.uploadError = true;
      item.uploadProgress = 0;
      updateProgress();
      render();
      showToast(`Upload failed: ${item.name}`, 'error');
    };

    xhr.open('POST', API + '/upload/chat-file');
    xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
    xhr.send(formData);
  }

  function updateProgress() {
    const uploading = items.filter(i => i.sending);
    const total = items.length;
    const uploadedCount = items.filter(i => i.uploaded).length;
    const bar = document.getElementById('aaProgressBar');
    if (!bar) return;
    if (uploading.length > 0) {
      const pct = total > 0 ? Math.round((uploadedCount / total) * 100) : 0;
      bar.style.width = pct + '%';
    } else if (uploadedCount === total && total > 0) {
      bar.style.width = '100%';
      setTimeout(() => { bar.style.width = '0%'; }, 2000);
    } else {
      bar.style.width = '0%';
    }
    items.forEach(item => {
      const el = document.querySelector(`.aa-item[data-id="${item.id}"]`);
      if (!el) return;
      if (item.kind === 'file' && item.sending) {
        const pBar = el.querySelector('.aa-item-progress-bar');
        const pText = el.querySelector('.aa-item-progress-text');
        if (pBar) pBar.style.width = item.uploadProgress + '%';
        if (pText) pText.textContent = item.uploadProgress + '%';
      }
      const metaStatus = el.querySelector('.aa-item-meta span:last-child');
      if (metaStatus) {
        if (item.uploaded) metaStatus.textContent = '✅';
        else if (item.uploadError) metaStatus.textContent = '❌';
        else if (item.sending) metaStatus.textContent = '⏳';
        else if (item.kind !== 'file') metaStatus.textContent = '✅';
        else metaStatus.textContent = '';
      }
    });
  }

  function sendSelected() {
    if (!targetUsers.length) {
      showToast('Please select at least one user to send to', 'error');
      document.getElementById('aaUserSearch')?.focus();
      return;
    }
    const toSend = selected.size > 0 ? [...selected] : items.filter(i => i.kind !== 'file' || i.uploaded).map(i => i.id);
    if (!toSend.length) {
      showToast('No items to send', 'error');
      return;
    }
    sendItems(toSend);
  }

  function sendItems(ids) {
    const toSend = ids.map(id => items.find(i => i.id === id)).filter(Boolean);
    if (!toSend.length) return;

    if (!targetUsers.length) {
      showToast('Please select users to send to', 'error');
      return;
    }

    let sent = 0;
    let totalToSend = toSend.length * targetUsers.length;

    const doSend = (itemIdx, userIdx) => {
      if (itemIdx >= toSend.length) {
        showToast(`Sent ${sent} item(s) to ${targetUsers.length} user(s) ✓`, 'success');
        toSend.forEach(i => {
          if (i.previewUrl && i.kind === 'file') URL.revokeObjectURL(i.previewUrl);
          const ii = items.indexOf(i);
          if (ii > -1) items.splice(ii, 1);
          selected.delete(i.id);
        });
        updateCounts();
        render();
        updateActionsBar();
        return;
      }

      const item = toSend[itemIdx];
      const user = targetUsers[userIdx];
      const msg = buildChatMessage(item);

      const sock = window.__socket || window.socket;
      if (sock?.emit) {
        sock.emit('send_message', {
          toUserId: user.id,
          ...msg
        });
      }

      appendChatBubbleDirect(user.id, {
        senderId: 'self',
        time: new Date().toISOString(),
        ...msg
      });

      sent++;

      if (userIdx + 1 < targetUsers.length) {
        setTimeout(() => doSend(itemIdx, userIdx + 1), 100);
      } else {
        setTimeout(() => doSend(itemIdx + 1, 0), 150);
      }
    };

    doSend(0, 0);
  }

  function buildChatMessage(item) {
    const base = { fileName: item.name, fileSize: item.size };
    if (item.kind === 'text') {
      return { ...base, text: item.text, type: 'text', mediaUrl: null, mediaType: 'text' };
    }
    if (item.kind === 'link') {
      return { ...base, text: item.url, type: 'link', mediaUrl: item.url, mediaType: 'link' };
    }
    return {
      ...base,
      text: item.mediaType === 'file' ? item.name : '',
      type: item.mediaType,
      mediaUrl: item.uploadUrl,
      mediaType: item.mediaType
    };
  }

  function appendChatBubbleDirect(userId, msg) {
    const fn = window.__appendChatBubble || window.appendChatBubble;
    if (typeof fn === 'function') {
      fn(userId, msg);
    }
  }

  function openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0';
    input.accept = '*/*';
    input.onchange = (e) => { if (e.target.files?.length) addFiles(e.target.files); };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  function openFolderPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0';
    input.onchange = (e) => {
      if (e.target.files?.length) {
        showToast('Adding folder contents...', 'info');
        addFiles(e.target.files);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  function openTextInput() {
    document.getElementById('aaTextInputArea')?.classList.add('visible');
    document.getElementById('aaLinkInputArea')?.classList.remove('visible');
    setTimeout(() => document.getElementById('aaTextInput')?.focus(), 100);
  }

  function cancelTextInput() {
    document.getElementById('aaTextInputArea')?.classList.remove('visible');
    document.getElementById('aaTextInput').value = '';
  }

  function confirmTextInput() {
    const text = document.getElementById('aaTextInput')?.value;
    if (text?.trim()) {
      addTextMessage(text);
      document.getElementById('aaTextInput').value = '';
    }
    document.getElementById('aaTextInputArea')?.classList.remove('visible');
  }

  function openLinkInput() {
    document.getElementById('aaLinkInputArea')?.classList.add('visible');
    document.getElementById('aaTextInputArea')?.classList.remove('visible');
    setTimeout(() => document.getElementById('aaLinkInput')?.focus(), 100);
  }

  function cancelLinkInput() {
    document.getElementById('aaLinkInputArea')?.classList.remove('visible');
    document.getElementById('aaLinkInput').value = '';
    document.getElementById('aaLinkTitleInput').value = '';
  }

  function confirmLinkInput() {
    const url = document.getElementById('aaLinkInput')?.value;
    const title = document.getElementById('aaLinkTitleInput')?.value;
    if (url?.trim()) {
      addLink(url, title);
      document.getElementById('aaLinkInput').value = '';
      document.getElementById('aaLinkTitleInput').value = '';
    }
    document.getElementById('aaLinkInputArea')?.classList.remove('visible');
  }

  function showToast(text, type = 'info') {
    const container = document.getElementById('aaToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'aa-toast ' + type;
    const icons = { success: '✅', error: '❌', info: '✦' };
    toast.innerHTML = `<span class="aa-toast-icon">${icons[type] || '✦'}</span><span class="aa-toast-text">${text}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return {
    init, open, close,
    addFiles, addTextMessage, addLink,
    filterCategory, handleItemSearch,
    handleUserSearch, selectUser, removeUser,
    toggleSelect, selectAll, deselectAll,
    clearAll, removeItem, removeSelected, banSelected,
    editItem, showContextMenu, switchView,
    sendSelected, sendItems, retryUpload,
    resendHistoryItem, downloadUrl,
    openFilePicker, openFolderPicker,
    openTextInput, cancelTextInput, confirmTextInput,
    openLinkInput, cancelLinkInput, confirmLinkInput,
    toggleSettings, setPref, resetPrefs,
    handleBgImageUpload, removeBgImage, setBgImageDim
  };
})();

document.addEventListener('DOMContentLoaded', () => AdvancedAttach.init());

window.AdvancedAttach = AdvancedAttach;

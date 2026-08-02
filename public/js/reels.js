const ReelsApp = (() => {
  // ─── State ────────────────────────────────────────────────────────────
  let reels = [];
  let currentIndex = 0;
  let isMuted = true;
  let observer = null;
  let editReelId = null;
  let settingsOpen = false;
  let currentTab = 'for-you';
  let page = 1;
  let hasMore = true;
  let commentsReelId = null;
  let socket = null;

  // Auth
  let token = localStorage.getItem('sc_token') || '';
  let currentUser = null;

  const STORAGE_KEY = 'rl_reels_data';
  const PREFS_KEY = 'rl_prefs';

  const DEFAULT_PREFS = {
    theme: 'dark',
    bgEffect: 'particles',
    bgImage: '',
    bgImageDim: '0.3',
    animSpeed: 'normal',
    cardEffect: 'none'
  };

  let prefs = { ...DEFAULT_PREFS };

  // ─── Auth ──────────────────────────────────────────────────────────────
  function getUser() {
    if (currentUser) return currentUser;
    try {
      const u = localStorage.getItem('sc_user');
      if (u) currentUser = JSON.parse(u);
    } catch (e) {}
    return currentUser;
  }

  function getToken() {
    return token || localStorage.getItem('sc_token') || '';
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // ─── API ───────────────────────────────────────────────────────────────
  async function api(path, opts = {}) {
    const headers = { ...opts.headers };
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    if (opts.body && typeof opts.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401 && path !== '/api/auth/login') {
      showToast('Session expired. Please login.');
      return null;
    }
    return res;
  }

  // ─── Prefs ─────────────────────────────────────────────────────────────
  function loadPrefs() {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) prefs = { ...DEFAULT_PREFS, ...JSON.parse(saved) };
    } catch (e) {}
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function applyPrefs() {
    const app = document.getElementById('reelsApp');
    if (!app) return;
    app.setAttribute('data-rl-theme', prefs.theme);
    app.setAttribute('data-rl-anim', prefs.animSpeed);
    app.setAttribute('data-rl-card', prefs.cardEffect);
    applyBgEffect();
    updateSettingsUI();
    const btn = document.querySelector('.rl-settings-btn');
    if (btn) {
      const hasCustom = Object.keys(DEFAULT_PREFS).some(k => String(prefs[k]) !== String(DEFAULT_PREFS[k]));
      btn.classList.toggle('has-pref', hasCustom);
    }
  }

  function applyBgEffect() {
    const app = document.getElementById('reelsApp');
    if (!app) return;
    const oldBg = app.querySelector('.rl-bg-custom, .rl-bg-stars, .rl-bg-gradient');
    if (oldBg) oldBg.remove();

    if (prefs.bgImage) {
      const div = document.createElement('div');
      div.className = 'rl-bg-custom';
      if (prefs.bgImageDim > 0) {
        div.style.setProperty('--rl-bg-dim', prefs.bgImageDim);
        div.classList.add('rl-bg-custom--dimmed');
      }
      div.style.backgroundImage = `url(${JSON.stringify(prefs.bgImage)})`;
      app.insertBefore(div, app.firstChild);
      return;
    }

    const effect = prefs.bgEffect;
    if (effect === 'stars') {
      const c = document.createElement('div');
      c.className = 'rl-bg-stars';
      for (let i = 0; i < 60; i++) {
        const s = document.createElement('div');
        s.className = 'rl-star';
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.width = s.style.height = (1 + Math.random() * 2) + 'px';
        s.style.animationDelay = Math.random() * 4 + 's';
        s.style.animationDuration = (2 + Math.random() * 4) + 's';
        c.appendChild(s);
      }
      app.insertBefore(c, app.firstChild);
    } else if (effect === 'gradient') {
      const c = document.createElement('div');
      c.className = 'rl-bg-gradient';
      app.insertBefore(c, app.firstChild);
    }
  }

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    document.getElementById('rlSettingsPanel')?.classList.toggle('open', settingsOpen);
    document.getElementById('rlSettingsOverlay')?.classList.toggle('open', settingsOpen);
  }

  function setPref(key, value) {
    prefs[key] = value;
    savePrefs();
    applyPrefs();
  }

  function resetPrefs() {
    prefs = { ...DEFAULT_PREFS };
    savePrefs();
    applyPrefs();
    showToast('Settings reset');
    recreateSettingsPanel();
  }

  function updateSettingsUI() {
    document.querySelectorAll('.rl-settings-opt').forEach(el => {
      el.classList.toggle('active', String(prefs[el.dataset.prefKey]) === el.dataset.prefVal);
    });
    document.querySelectorAll('.rl-settings-theme-btn').forEach(el => {
      el.classList.toggle('active', prefs.theme === el.dataset.theme);
    });
  }

  function handleBgImageUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      prefs.bgImage = e.target.result;
      prefs.bgImageDim = '0.3';
      savePrefs();
      applyPrefs();
      recreateSettingsPanel();
      showToast('Background image set ✓');
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
    showToast('Background removed');
  }

  function setBgImageDim(val) {
    prefs.bgImageDim = val;
    savePrefs();
    applyBgEffect();
    const label = document.querySelector('.rl-settings-row .rl-settings-label-sub');
    if (label) label.textContent = Math.round(val * 100) + '%';
  }

  function recreateSettingsPanel() {
    const p = document.getElementById('rlSettingsPanel');
    const o = document.getElementById('rlSettingsOverlay');
    if (p) p.remove();
    if (o) o.remove();
    createSettingsPanel();
    if (settingsOpen) {
      document.getElementById('rlSettingsPanel')?.classList.add('open');
      document.getElementById('rlSettingsOverlay')?.classList.add('open');
    }
  }

  function createSettingsPanel() {
    if (document.getElementById('rlSettingsPanel')) return;
    const overlay = document.createElement('div');
    overlay.className = 'rl-settings-overlay';
    overlay.id = 'rlSettingsOverlay';
    overlay.onclick = toggleSettings;

    const themes = [
      { id:'dark', label:'Dark', colors:['#000','#ff2a55'] },
      { id:'light', label:'Light', colors:['#f5f5fa','#e91e63'] },
      { id:'purple', label:'Purple', colors:['#120822','#ce93d8'] },
      { id:'ocean', label:'Ocean', colors:['#001220','#29b6f6'] },
      { id:'midnight', label:'Midnight', colors:['#050510','#7c7cff'] }
    ];

    const mo = (key, opts) => opts.map(o =>
      `<button class="rl-settings-opt${String(prefs[key]) === o.v ? ' active' : ''}" data-pref-key="${key}" data-pref-val="${o.v}" onclick="ReelsApp.setPref('${key}','${o.v}')">${o.l}</button>`
    ).join('');

    const panel = document.createElement('div');
    panel.className = 'rl-settings-panel';
    panel.id = 'rlSettingsPanel';
    panel.innerHTML = `
      <div class="rl-settings-header">
        <span class="rl-settings-title">✦ Reels Settings</span>
        <div style="display:flex;gap:6px;">
          <button class="rl-btn rl-btn--outline" onclick="ReelsApp.resetPrefs()" style="font-size:12px;padding:4px 10px;flex:none;">↻ Reset</button>
          <button class="rl-btn" onclick="ReelsApp.toggleSettings()" style="width:32px;height:32px;padding:0;font-size:18px;background:none;border:none;color:var(--rl-text);cursor:pointer;">✕</button>
        </div>
      </div>
      <div class="rl-settings-body">
        <div class="rl-settings-group">
          <div class="rl-settings-group-title">🎨 Theme</div>
          <div class="rl-settings-themes">${themes.map(t =>
            `<button class="rl-settings-theme-btn${prefs.theme === t.id ? ' active' : ''}" data-theme="${t.id}" onclick="ReelsApp.setPref('theme','${t.id}')">
              <span class="rl-settings-theme-swatch" style="background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]})"></span>
              <span class="rl-settings-theme-name">${t.label}</span>
            </button>`
          ).join('')}</div>
        </div>
        <div class="rl-settings-group">
          <div class="rl-settings-group-title">✨ Background</div>
          <div class="rl-settings-row">
            <span class="rl-settings-label">Effect</span>
            <div class="rl-settings-options">${mo('bgEffect', [{l:'Particles',v:'particles'},{l:'Stars',v:'stars'},{l:'Gradient',v:'gradient'},{l:'None',v:'none'}])}</div>
          </div>
          <div class="rl-settings-row">
            <span class="rl-settings-label">Custom Image<span class="rl-settings-label-sub">Upload</span></span>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="file" accept="image/*" id="rlBgImageInput" style="display:none" onchange="ReelsApp.handleBgImageUpload(this)">
              <button class="rl-settings-opt" onclick="document.getElementById('rlBgImageInput').click()" style="cursor:pointer;">${prefs.bgImage ? '🖼️ Change' : '📁 Choose'}</button>
              ${prefs.bgImage ? `<button class="rl-settings-opt" onclick="ReelsApp.removeBgImage()" style="cursor:pointer;color:#ff4444;">✕ Clear</button>` : ''}
            </div>
          </div>
          ${prefs.bgImage ? `
          <div class="rl-settings-row">
            <span class="rl-settings-label">Dim<span class="rl-settings-label-sub">${Math.round((parseFloat(prefs.bgImageDim)||0.3)*100)}%</span></span>
            <input type="range" min="0" max="0.7" step="0.05" value="${parseFloat(prefs.bgImageDim)||0.3}" class="rl-settings-slider" oninput="ReelsApp.setBgImageDim(this.value)">
          </div>` : ''}
        </div>
        <div class="rl-settings-group">
          <div class="rl-settings-group-title">⚡ Animation</div>
          <div class="rl-settings-row">
            <span class="rl-settings-label">Speed</span>
            <div class="rl-settings-options">${mo('animSpeed', [{l:'Off',v:'off'},{l:'Slow',v:'slow'},{l:'Normal',v:'normal'},{l:'Fast',v:'fast'}])}</div>
          </div>
        </div>
        <div class="rl-settings-group">
          <div class="rl-settings-group-title">🖌️ Style</div>
          <div class="rl-settings-row">
            <span class="rl-settings-label">Card Effect</span>
            <div class="rl-settings-options">${mo('cardEffect', [{l:'None',v:'none'},{l:'Glow',v:'glow'},{l:'Border',v:'border'},{l:'Subtle',v:'subtle'}])}</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.rl-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    feedMode = 'snap';
    page = 1;
    hasMore = true;
    reels = [];
    loadReels(true);
  }

  // ─── API: Load Reels ──────────────────────────────────────────────────
  async function loadReels(reset = false) {
    if (isLoading || !hasMore) return;
    isLoading = true;

    if (reset) {
      const feed = document.getElementById('rlFeed');
      if (feed) { feed.className = 'rl-feed ' + feedMode; feed.innerHTML = '<div class="rl-loader"><div class="rl-spinner"></div></div>'; }
    }

    try {
      if (currentTab === 'pexels') {
        await loadPexelsReels(reset);
        return;
      }

      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 10);
      if (currentTab === 'trending') params.set('type', 'trending');
      else if (currentTab === 'following') params.set('type', 'following');
      if (searchQuery) params.set('search', searchQuery);

      const res = await api('/api/reels?' + params.toString());
      if (!res) return;
      const data = await res.json();

      if (reset) reels = [];
      hasMore = data.hasMore;
      page = data.page + 1;

      for (const reel of data.reels) {
        if (!reels.find(r => r.id === reel.id)) {
          const existing = reels.findIndex(r => r.id === reel.id);
          if (existing === -1) {
            reels.push({
              ...reel,
              liked: (reel.likes || []).includes(getUser()?.id),
              saved: (reel.saves || []).includes(getUser()?.id),
            });
          }
        }
      }

      renderAll();
    } catch (e) {
      console.error('loadReels error:', e);
      showToast('Failed to load reels');
    } finally {
      isLoading = false;
    }
  }

  async function loadPexelsReels(reset = false) {
    try {
      const res = await api('/api/reels/pexels?page=' + page + '&per_page=10');
      if (!res) { isLoading = false; return; }
      const data = await res.json();

      if (reset) reels = [];
      hasMore = data.hasMore;
      page = data.page + 1;

      for (const v of data.videos) {
        if (!reels.find(r => r.id === v.id)) {
          reels.push({
            id: v.id,
            authorId: null,
            authorName: v.username,
            authorAvatar: v.userAvatar,
            videoUrl: v.videoUrl,
            caption: v.caption,
            audio: '',
            tags: [],
            likes: [],
            comments: [],
            saves: [],
            views: 0,
            liked: false,
            saved: false,
            time: Date.now(),
            author: { name: v.username, avatar: v.userAvatar },
          });
        }
      }

      renderAll();
    } catch (e) {
      console.error('loadPexelsReels error:', e);
      showToast('Failed to load Pexels reels');
    } finally {
      isLoading = false;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────
  function renderAll() {
    const feed = document.getElementById('rlFeed');
    if (!feed) return;

    feed.className = 'rl-feed ' + feedMode;

    const loaderEl = document.querySelector('.rl-loader');
    if (loaderEl) loaderEl.classList.add('hide');

    if (!reels.length) {
      showEmpty();
      return;
    }

    const existingIds = new Set();
    feed.querySelectorAll('.rl-reel').forEach(el => existingIds.add(el.dataset.id));

    let newHtml = '';
    for (let i = 0; i < reels.length; i++) {
      if (existingIds.has(reels[i].id)) continue;
      const r = reels[i];

      if (feedMode === 'grid') {
        const author = r.author || {};
        const authorName = author.name || r.authorName || 'Unknown';
        const likesCount = r.likes?.length || 0;
        const commentsCount = r.comments?.length || 0;
        newHtml += `
          <div class="rl-reel" data-index="${i}" data-id="${r.id}" onclick="ReelsApp.openFullscreen(${i})">
            <video class="rl-reel-video" src="${r.videoUrl}" muted preload="metadata" playsinline crossorigin="${r.videoUrl?.startsWith('http') ? 'anonymous' : ''}"></video>
            <div class="rl-reel-grid-overlay"></div>
            <div class="rl-reel-grid-info">
              <div class="rl-reel-caption">${escapeHtml(r.caption || '')}</div>
              <div class="rl-reel-username">${escapeHtml(authorName)}</div>
              <div class="rl-reel-stats">
                <span>❤️ ${formatCount(likesCount)}</span>
                <span>💬 ${formatCount(commentsCount)}</span>
              </div>
            </div>
          </div>`;
      } else {
        const author = r.author || {};
        const avatar = author.avatar || getDefaultAvatar(author.name || 'User');
        const authorName = author.name || r.authorName || 'Unknown';
        const isOwner = getUser()?.id === r.authorId;
        const likeIcon = r.liked
          ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
          : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        const saveIcon = r.saved
          ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`
          : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;
        newHtml += `
          <div class="rl-reel" data-index="${i}" data-id="${r.id}">
            <video class="rl-reel-video" src="${r.videoUrl}" muted="${isMuted}" loop playsinline preload="metadata" crossorigin="${r.videoUrl?.startsWith('http') ? 'anonymous' : ''}"></video>
            <div class="rl-reel-overlay"></div>
            <div class="rl-reel-actions">
              <button class="rl-action-btn ${r.liked ? 'liked' : ''}" onclick="event.stopPropagation();ReelsApp.toggleLike('${r.id}')" aria-label="Like">
                ${likeIcon} <span>${formatCount(r.likes?.length || 0)}</span>
              </button>
              <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.openComments('${r.id}')" aria-label="Comments">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>${formatCount(r.comments?.length || 0)}</span>
              </button>
              <button class="rl-action-btn ${r.saved ? 'saved' : ''}" onclick="event.stopPropagation();ReelsApp.toggleSave('${r.id}')" aria-label="Save">
                ${saveIcon} <span>Save</span>
              </button>
              ${isOwner ? `
              <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.openEdit('${r.id}')" aria-label="Edit">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Edit</span>
              </button>
              <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.deleteReel('${r.id}')" aria-label="Delete" style="color:#ff4444;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                <span>Delete</span>
              </button>` : `
              <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.reportReel('${r.id}')" aria-label="Report" style="color:#ffaa00;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                <span>Report</span>
              </button>`}
            </div>
            <div class="rl-reel-bottom">
              <div class="rl-reel-user">
                <img class="rl-reel-avatar" src="${avatar}" onerror="this.src='${getDefaultAvatar(authorName)}'" alt="" />
                <span class="rl-reel-username" onclick="event.stopPropagation();ReelsApp.goToProfile('${r.authorId}')">${escapeHtml(authorName)}</span>
                ${getUser()?.id !== r.authorId ? `<button class="rl-follow-btn" onclick="event.stopPropagation();ReelsApp.followUser('${r.authorId}', this)">Follow</button>` : ''}
              </div>
              <div class="rl-reel-caption">${escapeHtml(r.caption || '')}</div>
              ${r.audio ? `<div class="rl-reel-audio"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg> ${escapeHtml(r.audio)}</div>` : ''}
              ${r.tags?.length ? `<div class="rl-reel-tags">${r.tags.map(t => `<span class="rl-tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            </div>
            <button class="rl-reel-mute-btn" onclick="event.stopPropagation();ReelsApp.toggleMute()" aria-label="Toggle sound">${isMuted ? '🔇' : '🔊'}</button>
          </div>`;
      }
    }

    if (newHtml) {
      feed.insertAdjacentHTML('beforeend', newHtml);
      setupObserver();
      if (feedMode === 'snap') playCurrent();
    }
  }

  function showEmpty() {
    const feed = document.getElementById('rlFeed');
    if (!feed) return;
    document.querySelector('.rl-loader')?.classList.add('hide');
    feed.innerHTML = `
      <div class="rl-empty">
        <div class="rl-empty-icon">🎬</div>
        <div class="rl-empty-text">${searchQuery ? 'No results found' : 'No Reels Yet'}</div>
        <div class="rl-empty-sub">${searchQuery ? 'Try a different search term' : 'Upload your first reel or check back later'}</div>
        <button class="rl-empty-btn" onclick="ReelsApp.uploadReel()">Upload Reel</button>
      </div>
    `;
  }

  // ─── Observer ──────────────────────────────────────────────────────────
  function playCurrent() {
    setTimeout(() => {
      const visible = document.querySelector('.rl-feed.snap .rl-reel-video');
      if (visible) {
        visible.muted = isMuted;
        visible.play().catch(() => {});
      }
    }, 200);
  }

  function setupObserver() {
    if (observer) observer.disconnect();
    if (feedMode === 'snap') {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const vid = entry.target.querySelector('.rl-reel-video');
          if (entry.isIntersecting) {
            if (vid) {
              vid.muted = isMuted;
              vid.play().catch(() => {});
            }
            currentIndex = parseInt(entry.target.dataset.index) || 0;
            if (currentIndex >= reels.length - 3) loadReels();
          } else {
            if (vid) vid.pause();
          }
        });
      }, { threshold: 0.7 });
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            currentIndex = parseInt(entry.target.dataset.index) || 0;
            if (currentIndex >= reels.length - 3) loadReels();
          }
        });
      }, { threshold: 0.1 });
    }
    document.querySelectorAll('.rl-reel').forEach(el => observer.observe(el));
  }

  // ─── Like / Save / Follow ──────────────────────────────────────────────
  async function toggleLike(id) {
    if (!isLoggedIn()) { showToast('Please login to like'); return; }
    const r = reels.find(x => x.id === id);
    if (!r) return;
    r.liked = !r.liked;
    r.likes = r.liked ? (r.likes || []).concat(getUser().id) : (r.likes || []).filter(u => u !== getUser().id);
    renderAll();
    setupObserver();
    setupObserver();
    try {
      await api('/api/reels/' + id + '/like', { method: 'POST' });
    } catch (e) { showToast('Failed to update like'); }
  }

  async function toggleSave(id) {
    if (!isLoggedIn()) { showToast('Please login to save'); return; }
    const r = reels.find(x => x.id === id);
    if (!r) return;
    r.saved = !r.saved;
    renderAll();
    setupObserver();
    setupObserver();
    showToast(r.saved ? 'Reel saved ✓' : 'Reel unsaved');
    try {
      await api('/api/reels/' + id + '/save', { method: 'POST' });
    } catch (e) { showToast('Failed to save'); }
  }

  async function followUser(userId, btn) {
    if (!isLoggedIn()) { showToast('Please login to follow'); return; }
    try {
      const res = await api('/api/follow/' + userId, { method: 'POST' });
      if (!res) return;
      const data = await res.json();
      btn.textContent = 'Following';
      btn.classList.add('following');
      btn.disabled = true;
      showToast(data.message || 'Followed!');
    } catch (e) {
      showToast('Failed to follow');
    }
  }

  function goToProfile(userId) {
    try {
      window.location.href = '/profile.html?id=' + safeEnc(String(userId));
    } catch (e) {
      console.warn('[ReelsApp] goToProfile: invalid user ID, navigation blocked', userId, e);
      showToast('Unable to navigate to profile');
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    document.querySelectorAll('.rl-reel-video').forEach(v => { v.muted = isMuted; });
  }

  async function deleteReel(id) {
    if (!confirm('Delete this reel?')) return;
    try {
      const res = await api('/api/reels/' + id, { method: 'DELETE' });
      if (!res) return;
      reels = reels.filter(r => r.id !== id);
      renderAll();
      if (reels.length > 0) { setupObserver(); }
      showToast('Reel deleted');
    } catch (e) {
      showToast('Failed to delete reel');
    }
  }

  async function reportReel(id) {
    if (!confirm('Report this reel as inappropriate?')) return;
    try {
      await api('/api/reels/' + id + '/report', { method: 'POST' });
      showToast('Reel reported. Thank you.');
    } catch (e) {
      showToast('Failed to report');
    }
  }

  // ─── Comments ──────────────────────────────────────────────────────────
  function openComments(reelId) {
    commentsReelId = reelId;
    const modal = document.getElementById('rlCommentsModal');
    const body = document.getElementById('rlCommentsBody');
    modal?.classList.add('open');
    if (body) body.innerHTML = '<div class="rl-loader-sm" style="padding:40px;text-align:center;"><div class="rl-spinner"></div></div>';
    document.getElementById('rlCommentInput').value = '';
    loadComments(reelId);
  }

  function closeComments() {
    commentsReelId = null;
    document.getElementById('rlCommentsModal')?.classList.remove('open');
  }

  async function loadComments(reelId) {
    try {
      const res = await api('/api/reels/' + reelId);
      if (!res) return;
      const data = await res.json();
      renderComments(data.comments || []);
    } catch (e) {
      document.getElementById('rlCommentsBody').innerHTML = '<div style="padding:40px;text-align:center;color:var(--rl-text-sec);">Failed to load comments</div>';
    }
  }

  function renderComments(comments) {
    const body = document.getElementById('rlCommentsBody');
    if (!body) return;
    if (!comments.length) {
      body.innerHTML = '<div style="padding:48px;text-align:center;color:var(--rl-text-sec);font-size:14px;">💬 No comments yet<br><span style="font-size:12px;">Be the first to comment!</span></div>';
      return;
    }
    body.innerHTML = comments.map(c => {
      const cu = c.user || {};
      const avatar = cu.avatar || getDefaultAvatar(cu.name || 'User');
      return `<div class="rl-comment">
        <img class="rl-comment-avatar" src="${avatar}" onerror="this.src='${getDefaultAvatar(cu.name || 'U')}'" alt="" />
        <div class="rl-comment-body">
          <div class="rl-comment-name">${escapeHtml(cu.name || 'Unknown')}</div>
          <div class="rl-comment-text">${escapeHtml(c.text)}</div>
          <div class="rl-comment-time">${timeAgo(c.time)}</div>
        </div>
      </div>`;
    }).join('');
  }

  async function postComment() {
    if (!isLoggedIn()) { showToast('Please login to comment'); return; }
    const input = document.getElementById('rlCommentInput');
    const text = input?.value?.trim();
    if (!text || !commentsReelId) return;
    try {
      const res = await api('/api/reels/' + commentsReelId + '/comment', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (!res) return;
      const comment = await res.json();
      input.value = '';
      // Refresh comments
      loadComments(commentsReelId);
      // Update count in feed
      const reel = reels.find(r => r.id === commentsReelId);
      if (reel) {
        reel.comments = reel.comments || [];
        reel.comments.push(comment);
        // Update the like/comment count display
        const actionBtn = document.querySelector(`.rl-reel[data-id="${commentsReelId}"] .rl-action-btn:nth-child(2) span`);
        if (actionBtn) actionBtn.textContent = formatCount(reel.comments.length);
      }
    } catch (e) {
      showToast('Failed to post comment');
    }
  }

  // ─── Upload ────────────────────────────────────────────────────────────
  function uploadReel() {
    if (!isLoggedIn()) { showToast('Please login to upload'); return; }
    document.getElementById('rlFileInput')?.click();
  }

  async function handleFileInput(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { showToast('Please select a video file'); return; }
    if (file.size > 200 * 1024 * 1024) { showToast('Video too large (max 200MB)'); return; }

    showToast('Uploading video...');

    try {
      const formData = new FormData();
      formData.append('video', file);

      const t = getToken();
      const uploadRes = await fetch('/api/reels/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + t },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

      // Create reel with the uploaded video URL
      const caption = prompt('Caption for your reel (optional):') || '';
      const audio = prompt('Audio title (optional):') || '';

      const reelRes = await api('/api/reels', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: uploadData.videoUrl,
          caption,
          audio,
          tags: [],
        }),
      });
      if (!reelRes) return;
      const reel = await reelRes.json();

      reels.unshift({
        ...reel,
        liked: false,
        saved: false,
        likes: reel.likes || [],
        comments: reel.comments || [],
        saves: reel.saves || [],
      });
      renderAll();
      setupObserver();
      setupObserver();
      showToast('Reel uploaded ✓');
      const feed = document.getElementById('rlFeed');
      if (feed) feed.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      showToast('Upload failed: ' + e.message);
    }
  }

  // ─── Fullscreen ────────────────────────────────────────────────────────
  function openFullscreen(idx) {
    const r = reels[idx];
    if (!r) return;
    const container = document.getElementById('rlFullscreen');
    const content = document.getElementById('rlFullscreenContent');
    if (!container || !content) return;

    let html = '';
    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      const author = reel.author || {};
      const avatar = author.avatar || getDefaultAvatar(author.name || 'User');
      const authorName = author.name || reel.authorName || 'Unknown';
      const likeIcon = reel.liked
        ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
        : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
      const saveIcon = reel.saved
        ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`
        : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;
      const isOwner = getUser()?.id === reel.authorId;
      html += `
        <div class="rl-reel" data-index="${i}" data-id="${reel.id}">
          <video class="rl-reel-video" src="${reel.videoUrl}" muted="${isMuted}" loop playsinline preload="metadata" crossorigin="${reel.videoUrl?.startsWith('http') ? 'anonymous' : ''}"></video>
          <div class="rl-reel-overlay"></div>
          <div class="rl-reel-actions">
            <button class="rl-action-btn ${reel.liked ? 'liked' : ''}" onclick="event.stopPropagation();ReelsApp.toggleLike('${reel.id}')" aria-label="Like">
              ${likeIcon} <span>${formatCount(reel.likes?.length || 0)}</span>
            </button>
            <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.openComments('${reel.id}')" aria-label="Comments">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span>${formatCount(reel.comments?.length || 0)}</span>
            </button>
            <button class="rl-action-btn ${reel.saved ? 'saved' : ''}" onclick="event.stopPropagation();ReelsApp.toggleSave('${reel.id}')" aria-label="Save">
              ${saveIcon} <span>Save</span>
            </button>
            ${isOwner ? `
            <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.openEdit('${reel.id}')" aria-label="Edit">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Edit</span>
            </button>
            <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.deleteReel('${reel.id}')" aria-label="Delete" style="color:#ff4444;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              <span>Delete</span>
            </button>` : `
            <button class="rl-action-btn" onclick="event.stopPropagation();ReelsApp.reportReel('${reel.id}')" aria-label="Report" style="color:#ffaa00;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              <span>Report</span>
            </button>`}
          </div>
          <div class="rl-reel-bottom">
            <div class="rl-reel-user">
              <img class="rl-reel-avatar" src="${avatar}" onerror="this.src='${getDefaultAvatar(authorName)}'" alt="" />
              <span class="rl-reel-username" onclick="event.stopPropagation();ReelsApp.goToProfile('${reel.authorId}')">${escapeHtml(authorName)}</span>
              ${getUser()?.id !== reel.authorId ? `<button class="rl-follow-btn" onclick="event.stopPropagation();ReelsApp.followUser('${reel.authorId}', this)">Follow</button>` : ''}
            </div>
            <div class="rl-reel-caption">${escapeHtml(reel.caption || '')}</div>
            ${reel.audio ? `<div class="rl-reel-audio"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg> ${escapeHtml(reel.audio)}</div>` : ''}
            ${reel.tags?.length ? `<div class="rl-reel-tags">${reel.tags.map(t => `<span class="rl-tag">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
          <button class="rl-reel-mute-btn" onclick="event.stopPropagation();ReelsApp.toggleMute()" aria-label="Toggle sound">${isMuted ? '🔇' : '🔊'}</button>
        </div>`;
    }

    content.innerHTML = html;
    container.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Scroll to the clicked reel
    requestAnimationFrame(() => {
      const target = content.querySelector(`.rl-reel[data-index="${idx}"]`);
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      // Autoplay the visible one
      setTimeout(() => {
        const visible = content.querySelector('.rl-reel-video');
        if (visible) { visible.muted = isMuted; visible.play().catch(() => {}); }
      }, 300);
    });
  }

  function closeFullscreen() {
    const container = document.getElementById('rlFullscreen');
    if (container) {
      container.classList.remove('open');
      container.innerHTML = `
        <button class="rl-fullscreen-close" onclick="ReelsApp.closeFullscreen()" aria-label="Close">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div class="rl-fullscreen-content" id="rlFullscreenContent"></div>
      `;
    }
    document.body.style.overflow = '';
  }

  // ─── Edit ──────────────────────────────────────────────────────────────
  function openEdit(id) {
    const r = reels.find(x => x.id === id);
    if (!r) return;
    editReelId = id;
    document.getElementById('rlEditCaption').value = r.caption || '';
    document.getElementById('rlEditAudio').value = r.audio || '';
    document.getElementById('rlEditTags').value = (r.tags || []).join(', ');
    document.getElementById('rlEditModal').classList.add('open');
  }

  function closeEdit() {
    editReelId = null;
    document.getElementById('rlEditModal').classList.remove('open');
  }

  async function saveEdit() {
    if (!editReelId) return;
    const caption = document.getElementById('rlEditCaption').value.trim();
    const audio = document.getElementById('rlEditAudio').value.trim();
    const tagsStr = document.getElementById('rlEditTags').value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      const res = await api('/api/reels/' + editReelId, {
        method: 'PUT',
        body: JSON.stringify({ caption, audio, tags }),
      });
      if (!res) return;
      const updated = await res.json();
      const idx = reels.findIndex(r => r.id === editReelId);
      if (idx !== -1) reels[idx] = { ...reels[idx], ...updated };
      closeEdit();
      renderAll();
      setupObserver();
      setupObserver();
      showToast('Reel updated ✓');
    } catch (e) {
      showToast('Failed to update reel');
    }
  }

  // ─── Socket ────────────────────────────────────────────────────────────
  function initSocket() {
    try {
      socket = io();
      socket.emit('authenticate', getToken());

      socket.on('authenticated', () => {});

      socket.on('new_reel', (reel) => {
        if (currentTab !== 'following') {
          reels.unshift({ ...reel, liked: false, saved: false });
          renderAll();
          setupObserver();
          if (document.querySelector('.rl-empty')) setupObserver();
        }
      });

      socket.on('delete_reel', (reelId) => {
        reels = reels.filter(r => r.id !== reelId);
        renderAll();
        if (reels.length > 0) { setupObserver(); }
      });

      socket.on('reel_like', (data) => {
        const r = reels.find(x => x.id === data.reelId);
        if (r) {
          const wasLiked = r.liked;
          r.likes = data.likes;
          // Don't override local like state
          const user = getUser();
          if (user) r.liked = data.likes.includes(user.id);
          updateLikeDisplay(r.id, data.likes.length);
        }
      });

      socket.on('reel_comment', (data) => {
        const r = reels.find(x => x.id === data.reelId);
        if (r) {
          r.comments = r.comments || [];
          const exists = r.comments.find(c => c.id === data.comment.id);
          if (!exists) r.comments.push(data.comment);
          updateCommentCountDisplay(r.id, r.comments.length);
          if (commentsReelId === data.reelId) loadComments(data.reelId);
        }
      });

    } catch (e) {
      console.warn('Socket init error:', e.message);
    }
  }

  function updateLikeDisplay(reelId, count) {
    const reelEl = document.querySelector(`.rl-reel[data-id="${reelId}"]`);
    if (reelEl) {
      const likeBtn = reelEl.querySelector('.rl-action-btn.liked, .rl-action-btn');
      const span = likeBtn?.querySelector('span');
      if (span) span.textContent = formatCount(count);
    }
  }

  function updateCommentCountDisplay(reelId, count) {
    const reelEl = document.querySelector(`.rl-reel[data-id="${reelId}"]`);
    if (reelEl) {
      const btns = reelEl.querySelectorAll('.rl-action-btn');
      if (btns[1]) {
        const span = btns[1].querySelector('span');
        if (span) span.textContent = formatCount(count);
      }
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  async function init() {
    getUser();
    loadPrefs();
    createSettingsPanel();
    applyPrefs();
    initSocket();

    // Load reels from API
    loadReels(true);

    // Infinite scroll
    const feed = document.getElementById('rlFeed');
    if (feed) {
      feed.addEventListener('scroll', () => {
        if (feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 600) {
          loadReels();
        }
      });
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeComments();
        closeFullscreen();
        closeEdit();
      }
    });
  }

  // ─── Safe encodeURIComponent ─────────────────────────────────────────
  function safeEnc(str) {
    try {
      return encodeURIComponent(str);
    } catch (e) {
      console.warn('[ReelsApp] safeEnc: malformed string, sanitizing', e);
      try {
        return encodeURIComponent(String(str).replace(/[\uD800-\uDFFF]/g, ''));
      } catch (e2) {
        console.warn('[ReelsApp] safeEnc: fallback also failed, using char-by-char encode', e2);
        var s = String(str);
        var result = '';
        for (var i = 0; i < s.length; i++) {
          try {
            result += encodeURIComponent(s[i]);
          } catch (e3) {
            result += '%EF%BF%BD';
          }
        }
        return result;
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  function formatCount(n) {
    if (!n && n !== 0) return '0';
    n = Number(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function getDefaultAvatar(name) {
    const colors = ['ff2a55','ff6b35','ffd700','2ed573','1e90ff','a29bfe','fd79a8','00cec9'];
    const c = colors[name ? name.charCodeAt(0) % colors.length : 0];
    return `data:image/svg+xml,${safeEnc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#${c}" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="white" font-size="40" font-weight="700" font-family="sans-serif">${(name || '?')[0].toUpperCase()}</text></svg>`)}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('rlToast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ─── Public API ────────────────────────────────────────────────────────
  return {
    init,
    toggleLike,
    toggleSave,
    toggleMute,
    deleteReel,
    reportReel,
    uploadReel,
    handleFileInput,
    openFullscreen,
    closeFullscreen,
    openEdit,
    closeEdit,
    saveEdit,
    toggleSettings,
    setPref,
    resetPrefs,
    handleBgImageUpload,
    removeBgImage,
    setBgImageDim,
    toggleSearch,
    onSearchInput,
    clearSearch,
    switchTab,
    openComments,
    closeComments,
    postComment,
    followUser,
    goToProfile,
  };
})();

// ─── File input handler ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ReelsApp.init();
  const fileInput = document.getElementById('rlFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) ReelsApp.handleFileInput(e.target.files[0]);
      e.target.value = '';
    });
  }
});

window.ReelsApp = ReelsApp;
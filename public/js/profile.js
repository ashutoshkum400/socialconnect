// ═══════════════════════════════════════════════════════════════
// SocialConnect – Profile Page
// ═══════════════════════════════════════════════════════════════

const token       = localStorage.getItem('sc_token');
const currentUser = JSON.parse(localStorage.getItem('sc_user') || '{}');
if (!token) window.location.href = '/index.html';

const urlParams     = new URLSearchParams(window.location.search);
const profileUserId = urlParams.get('id') || currentUser._id || currentUser.id || '';
const isOwnProfile  = String(profileUserId) === String(currentUser._id || currentUser.id || '');

let profileUser         = null;   // full user object for the viewed profile
let profilePosts        = [];     // cached posts array
let socket              = null;   // Socket.IO instance
let pendingAvatarBase64 = null;   // base64 string staged in edit modal

// ═══════════════════════════════════════════════════════════════
// LOW-LEVEL UTILITIES
// ═══════════════════════════════════════════════════════════════

/** Escape HTML special chars to prevent XSS in innerHTML strings. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Generate a ui-avatars.com fallback URL for a given name. */
function avatarFallback(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=1877f2&color=fff&size=128`;
}

/** Wrap #hashtags in a coloured span. */
function highlightHashtags(text) {
  return text.replace(/#(\w+)/g, '<span class="hashtag" style="color:var(--primary);font-weight:600;">#$1</span>');
}

/** Standalone timeAgo — does not depend on the SC object. */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return '';
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 30)      return 'Just now';
  if (diff < 60)      return `${diff}s ago`;
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: diff > 31536000 ? 'numeric' : undefined
  });
}

/** Standalone formatDate — does not depend on the SC object. */
function formatDate(dateStr) {
  if (!dateStr) return 'Not provided';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'Not provided';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Calculate age from a birth-date string. Returns null if unavailable. */
function getAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Capitalise the first letter of a string. */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Thin fetch wrapper that attaches the Bearer token and throws on errors. */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    window.location.href = '/index.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

async function init() {
  // ── Refresh currentUser from server to avoid stale localStorage data ──
  try {
    const fresh = await apiFetch('/api/me');
    if (fresh) {
      // Update the module-level currentUser with server-fresh data
      Object.assign(currentUser, fresh);
      localStorage.setItem('sc_user', JSON.stringify(fresh));
    }
  } catch {
    // If /api/me fails (e.g. network glitch), fall back to localStorage
  }

  // Re-resolve profileUserId and isOwnProfile with fresh data
  const resolvedProfileUserId = urlParams.get('id') || currentUser._id || currentUser.id || '';
  const resolvedIsOwnProfile = String(resolvedProfileUserId) === String(currentUser._id || currentUser.id || '');

  // Populate navbar avatar / name via shared helper
  SC.initNavbar();

  // Show own-only OR other-only elements based on whose profile this is
  document.querySelectorAll('.own-only').forEach(el => {
    el.style.display = resolvedIsOwnProfile ? '' : 'none';
  });
  document.querySelectorAll('.other-only').forEach(el => {
    el.style.display = resolvedIsOwnProfile ? 'none' : '';
  });

  // Load the profile data (also loads posts)
  await loadProfile(resolvedProfileUserId);

  // Tab click handlers (delegated via data-tab attribute)
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search input with debounce
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        const dr = document.getElementById('searchResults');
        if (dr) dr.classList.add('hidden');
        return;
      }
      searchTimer = setTimeout(() => searchUsers(q), 350);
    });
  }

  // Close search results on outside click
  document.addEventListener('click', e => {
    const sr = document.getElementById('searchResults');
    const si = document.getElementById('searchInput');
    if (sr && si && !si.contains(e.target) && !sr.contains(e.target)) {
      sr.classList.add('hidden');
    }
    // Close profile dropdown on outside click
    const wrap = document.getElementById('profileDropdownWrap');
    const menu = document.getElementById('profileDropdown');
    if (menu && wrap && !wrap.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // Let SC handle overlay-click-to-close for modals
  SC.initModals();

  // Own-profile extras
  if (isOwnProfile) {
    // Post via advanced post modal (Ctrl+Enter when focused on modal textarea)

    // Edit avatar via overlay button
    const editAvatarBtn  = document.getElementById('editAvatarBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (editAvatarBtn && avatarFileInput) {
      editAvatarBtn.addEventListener('click', () => avatarFileInput.click());
      avatarFileInput.addEventListener('change', e => {
        if (e.target.files[0]) uploadAvatar(e.target.files[0]);
      });
    }

    // Edit cover photo via button in cover area
    const editCoverBtn  = document.getElementById('editCoverBtn');
    const coverFileInput = document.getElementById('coverFileInput');
    if (editCoverBtn && coverFileInput) {
      editCoverBtn.addEventListener('click', () => coverFileInput.click());
      coverFileInput.addEventListener('change', e => {
        if (e.target.files[0]) uploadCoverPhoto(e.target.files[0]);
      });
    }

    // Photo tab upload
    const photoFileInput = document.getElementById('photoFileInput');
    if (photoFileInput) {
      photoFileInput.addEventListener('change', e => {
        if (e.target.files[0]) uploadPhoto(e.target.files[0]);
      });
    }
  }

  // Socket.IO – authenticate and listen for online/offline events
  try {
    socket = io();
    socket.emit('authenticate', token);

    socket.on('user_online', data => {
      if (String(data.userId) === String(profileUserId)) updateOnlineStatus(true);
    });
    socket.on('user_offline', data => {
      if (String(data.userId) === String(profileUserId)) updateOnlineStatus(false);
    });
  } catch (_) {
    // Socket.IO not available in this environment — silently skip
  }
}

/** Update the online status badge below the profile name. */
function updateOnlineStatus(online) {
  const el = document.getElementById('profileOnlineStatus');
  if (!el) return;
  el.innerHTML = online
    ? '<span class="online-dot online-dot--sm" style="display:inline-block;"></span><span style="color:var(--success);font-size:var(--font-size-sm);font-weight:600;">Online now</span>'
    : '';
}

// ═══════════════════════════════════════════════════════════════
// LOAD PROFILE
// ═══════════════════════════════════════════════════════════════

async function loadProfile(userId) {
  try {
    const endpoint = isOwnProfile ? '/api/me' : `/api/users/${userId}`;
    const user = await apiFetch(endpoint);
    if (!user) return;
    profileUser = user;

    // ── Cover photo
    const coverArea = document.getElementById('coverPhotoArea');
    if (coverArea && user.coverPhoto) {
      coverArea.style.backgroundImage    = `url('${user.coverPhoto}')`;
      coverArea.style.backgroundSize     = 'cover';
      coverArea.style.backgroundPosition = 'center';
    }

    // ── Profile avatar (large)
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
      avatarEl.src     = user.avatar || avatarFallback(user.name);
      avatarEl.alt     = user.name || 'Profile avatar';
      avatarEl.onerror = function () { this.src = avatarFallback(user.name || 'User'); };
    }

    // ── Create-post avatar (own profile)
    const cpAvatar = document.getElementById('createPostAvatar');
    if (cpAvatar) {
      cpAvatar.src     = user.avatar || avatarFallback(user.name);
      cpAvatar.onerror = function () { this.src = avatarFallback(user.name || 'Me'); };
    }

    // ── Name, username, bio, joined
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = user.name || 'Unknown';

    const usernameEl = document.getElementById('profileUsername');
    if (usernameEl) usernameEl.textContent = user.username ? `@${user.username}` : '';

    const bioEl = document.getElementById('profileBio');
    if (bioEl) bioEl.textContent = user.bio || '';

    const joinedEl = document.getElementById('profileJoined');
    if (joinedEl) {
      if (user.joinedAt) {
        const d = new Date(user.joinedAt);
        joinedEl.textContent = `📅 Joined ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      } else {
        joinedEl.textContent = '';
      }
    }

    // ── Meta pills: location · gender · age · lookingFor · joined
    const metaEl = document.getElementById('profileMeta');
    if (metaEl) {
      const pills = [];
      if (user.location)   pills.push(`<span class="profile-details__meta-item">📍 ${escapeHtml(user.location)}</span>`);
      if (user.gender)     pills.push(`<span class="profile-details__meta-item">⚧ ${escapeHtml(capitalize(user.gender))}</span>`);
      const age = getAge(user.birthDate);
      if (age)             pills.push(`<span class="profile-details__meta-item">🎂 ${age} yrs</span>`);
      if (user.lookingFor) pills.push(`<span class="profile-details__meta-item">💜 ${escapeHtml(capitalize(user.lookingFor))}</span>`);
      if (user.joinedAt) {
        const d = new Date(user.joinedAt);
        const joinedStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        pills.push(`<span class="profile-details__meta-item">📅 Joined ${joinedStr}</span>`);
      }
      metaEl.innerHTML = pills.join('');
    }

    // ── Stats: posts count fetched separately in loadUserPosts
    const statFriends   = document.getElementById('statFriends');
    const statFollowers = document.getElementById('statFollowers');
    const statFollowing = document.getElementById('statFollowing');
    if (statFriends)   statFriends.textContent   = SC.formatCount((user.friends   || []).length);
    if (statFollowers) statFollowers.textContent = SC.formatCount((user.followers || []).length);
    if (statFollowing) statFollowing.textContent = SC.formatCount((user.following || []).length);

    // ── Other-profile button states
    if (!isOwnProfile) {
      const myId = String(currentUser._id || currentUser.id || '');

      const followBtn = document.getElementById('followBtn');
      if (followBtn) {
        const following = (user.followers || []).map(String).includes(myId);
        followBtn.textContent = following ? '✓ Following' : '+ Follow';
        followBtn.classList.toggle('btn--primary',         !following);
        followBtn.classList.toggle('btn--outline-primary',  following);
      }

      const addFriendBtn = document.getElementById('addFriendBtn');
      if (addFriendBtn) {
        const isFriend = (user.friends || []).map(String).includes(myId);
        if (isFriend) {
          addFriendBtn.textContent = '👥 Friends';
          addFriendBtn.disabled = true;
          addFriendBtn.classList.replace('btn--primary', 'btn--secondary');
        }
      }
    }

    // ── Page title
    document.title = `${user.name || 'Profile'} – SocialConnect`;

    // ── Load posts for the Posts tab
    await loadUserPosts(userId);

  } catch (err) {
    SC.showError('Could not load profile.');
    console.error('[loadProfile]', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOAD & RENDER POSTS
// ═══════════════════════════════════════════════════════════════

async function loadUserPosts(userId) {
  const container = document.getElementById('userPostsList');
  if (!container) return;

  // Show skeleton while fetching
  container.innerHTML = [1, 2].map(() => `
    <div class="skeleton-card card">
      <div class="skeleton-card__header">
        <div class="skeleton skeleton--circle"></div>
        <div class="skeleton-card__content">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text-sm"></div>
        </div>
      </div>
      <div class="skeleton skeleton--text" style="margin:var(--space-sm) 0;"></div>
      <div class="skeleton skeleton--text-sm" style="width:60%;"></div>
    </div>
  `).join('');

  try {
    const posts = await apiFetch(`/api/posts?userId=${userId}`);
    profilePosts = Array.isArray(posts) ? posts : [];

    // Update posts stat
    const statPosts = document.getElementById('statPosts');
    if (statPosts) statPosts.textContent = SC.formatCount(profilePosts.length);

    if (profilePosts.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-state__icon">📝</div>
          <h3 class="empty-state__title">No posts yet</h3>
          <p class="empty-state__text">${isOwnProfile
            ? 'Share something with your friends!'
            : `${escapeHtml(profileUser?.name || 'This user')} hasn't posted anything yet.`
          }</p>
        </div>`;
    } else {
      container.innerHTML = profilePosts.map(p => renderPost(p)).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:var(--space-lg);text-align:center;color:var(--text-muted);">Failed to load posts.</div>`;
    console.error('[loadUserPosts]', err);
  }
}

/**
 * Build the full HTML string for a single post card.
 * Matches the dashboard.js createPostElement() visual style.
 */
function renderPost(post) {
  const author      = post.author || {};
  const authorId    = String(post.authorId || author._id || author.id || '');
  const authorName  = escapeHtml(author.name || 'Unknown');
  const authorAvatar= author.avatar || avatarFallback(author.name || 'U');
  const isOwn       = authorId === String(currentUser._id || currentUser.id || '');
  const likes       = post.likes || [];
  const comments    = post.comments || [];
  const liked       = likes.map(String).includes(String(currentUser._id || currentUser.id || ''));
  const likeCount   = likes.length;
  const commentCount= comments.length;
  const postTime    = post.time || post.createdAt || '';

  return `
    <article class="post-card card" data-post-id="${post.id || post._id}" role="article" aria-label="Post by ${authorName}">

      <div class="post-card__header">
        <a href="/profile.html?id=${authorId}" class="post-card__avatar-link" style="flex-shrink:0;">
          <img
            src="${authorAvatar}"
            alt="${authorName}"
            class="post-card__avatar"
            onerror="this.src='${avatarFallback(author.name || 'U')}'"
          >
        </a>
        <div class="post-card__meta">
          <a href="/profile.html?id=${authorId}" class="post-card__name">${authorName}</a>
          ${author.username ? `<span style="font-size:var(--font-size-xs);color:var(--text-secondary);">@${escapeHtml(author.username)}</span>` : ''}
          <span class="post-card__time" title="${escapeHtml(postTime)}">${timeAgo(postTime)}</span>
        </div>
        ${isOwn ? `
          <div class="dropdown" style="margin-left:auto;position:relative;">
            <button
              class="post-card__options"
              onclick="this.nextElementSibling.classList.toggle('hidden')"
              aria-label="Post options"
            >•••</button>
            <div class="dropdown__menu hidden" style="right:0;min-width:150px;">
              <div class="dropdown__item dropdown__item--danger" onclick="deletePost('${post.id || post._id}')">
                <span class="dropdown__icon">🗑️</span> Delete Post
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      ${(post.feeling || post.activity || post.location) ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 var(--space-md) var(--space-xs);font-size:13px;">
          ${post.feeling ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.feeling}</span>` : ''}
          ${post.activity ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.activity}</span>` : ''}
          ${post.location ? `<span class="tag" style="font-size:12px;padding:3px 10px;">📍 ${post.location.name}</span>` : ''}
        </div>
      ` : ''}

      <div class="post-card__content${!post.image && post.text && post.text.length < 120 ? ' large-text' : ''}">
        ${highlightHashtags(escapeHtml(post.text || ''))}
      </div>

      ${post.image ? `
        <div style="margin-top:var(--space-sm);">
          <img
            src="${post.image}"
            alt="Post image"
            class="post-card__image"
            loading="lazy"
            onerror="this.parentElement.style.display='none'"
          >
        </div>
      ` : ''}

      ${post.media && post.media.photos && post.media.photos.length > 0 ? `
        <div style="margin-top:var(--space-sm);display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">
          ${post.media.photos.map((photo, idx) => `
            <img
              src="${photo.data || photo.thumbnail || ''}"
              alt="Photo ${idx + 1}"
              style="width:100%;height:150px;object-fit:cover;border-radius:8px;cursor:pointer;"
              loading="lazy"
              onclick="window.open('${photo.data || photo.thumbnail || ''}', '_blank')"
              onerror="this.parentElement.style.display='none'"
            >
          `).join('')}
        </div>
      ` : ''}

      ${post.media && post.media.videos && post.media.videos.length > 0 ? `
        <div style="margin-top:var(--space-sm);display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
          ${post.media.videos.map((video, idx) => `
            <video
              src="${video.data || ''}"
              style="width:100%;max-height:300px;border-radius:8px;background:#000;"
              controls
              preload="metadata"
              ${idx > 0 ? '' : 'autoplay muted'}
            ></video>
          `).join('')}
        </div>
      ` : ''}

      ${post.media && post.media.audio && post.media.audio.length > 0 ? `
        <div style="margin-top:var(--space-sm);display:flex;flex-wrap:wrap;gap:10px;">
          ${post.media.audio.map(audio => `
            <div style="flex:1;min-width:200px;padding:12px;background:var(--input-bg);border-radius:8px;border:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:20px;">🎵</span>
                <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${audio.name || 'Audio file'}</span>
              </div>
              <audio src="${audio.data || ''}" controls style="width:100%;height:36px;" preload="none"></audio>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${post.tags && post.tags.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--space-sm);">
          ${post.tags.map(tag => `<span class="tag tag--pink" style="font-size:12px;padding:2px 8px;">#${tag}</span>`).join('')}
        </div>
      ` : ''}

      <div class="post-card__stats">
        ${likeCount > 0 ? `
          <div class="post-card__reactions">
            <div class="post-card__reactions-icons">👍</div>
            <span>${likeCount} ${likeCount === 1 ? 'like' : 'likes'}</span>
          </div>` : ''}
        ${commentCount > 0 ? `
          <button class="post-card__show-comments" onclick="toggleComments('${post.id || post._id}')">
            ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}
          </button>` : ''}
      </div>

      <div class="post-card__actions">
        <button
          class="post-card__action-btn${liked ? ' liked' : ''}"
          id="likeBtn_${post.id || post._id}"
          onclick="likePost('${post.id || post._id}')"
          aria-label="${liked ? 'Unlike' : 'Like'} post"
          aria-pressed="${liked}"
        >
          <span aria-hidden="true">👍</span>
          <span id="likeLabel_${post.id || post._id}">${liked ? 'Liked' : 'Like'}</span>
        </button>
        <button
          class="post-card__action-btn"
          onclick="toggleComments('${post.id || post._id}')"
          aria-label="Comment"
        >💬 Comment</button>
        ${isOwn ? `
          <button
            class="post-card__action-btn"
            style="color:var(--danger);"
            onclick="deletePost('${post.id || post._id}')"
            aria-label="Delete post"
          >🗑️ Delete</button>` : ''}
      </div>

      <div class="post-card__comments hidden" id="comments_${post.id || post._id}">
        <div id="commentList_${post.id || post._id}">
          ${comments.map(c => renderComment(c)).join('')}
        </div>
        <div class="post-card__comment-input">
          <img
            src="${currentUser.avatar || avatarFallback(currentUser.name || 'Me')}"
            alt="Your avatar"
            class="post-card__comment-avatar"
            style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
            onerror="this.src='${avatarFallback(currentUser.name || 'Me')}'"
          >
          <input
            type="text"
            placeholder="Write a comment…"
            aria-label="Write a comment"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();const v=this.value.trim();if(v){commentOnPost('${post.id || post._id}',v);this.value=''}}"
          >
        </div>
      </div>

    </article>`;
}

/** Build HTML for a single comment bubble. */
function renderComment(comment) {
  const u      = comment.user || {};
  const name   = escapeHtml(u.name || 'Unknown');
  const avatar = u.avatar || avatarFallback(u.name || 'U');
  return `
    <div class="post-card__comment" data-comment-id="${comment.id || comment._id || ''}">
      <img src="${avatar}" alt="${name}" class="post-card__comment-avatar"
           onerror="this.src='${avatarFallback(u.name || 'U')}'">
      <div class="post-card__comment-bubble">
        <span class="post-card__comment-name">${name}</span>
        <p class="post-card__comment-text">${escapeHtml(comment.text || '')}</p>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

function switchTab(tabName) {
  // Highlight active tab button
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Map tab name → panel element id
  const panels = { posts: 'postsTab', photos: 'photosTab', friends: 'friendsTab', about: 'aboutTab' };
  Object.entries(panels).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = name === tabName ? '' : 'none';
  });

  // Lazy-load content on first visit to each tab
  if (tabName === 'photos'  && profileUser) loadPhotos(profileUser);
  if (tabName === 'friends' && profileUser) loadFriends(profileUser);
  if (tabName === 'about'   && profileUser) loadAbout(profileUser);
}

// ═══════════════════════════════════════════════════════════════
// PHOTOS TAB
// ═══════════════════════════════════════════════════════════════

function loadPhotos(user) {
  const grid = document.getElementById('photosGrid');
  if (!grid) return;

  const photos = user.photos || [];
  if (photos.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-lg);">
        <div class="empty-state__icon">📷</div>
        <p class="empty-state__text">${isOwnProfile ? 'Upload your first photo!' : 'No photos yet.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = photos.map((src, i) => `
    <div class="photo-grid__item">
      <img
        src="${src}"
        alt="Photo ${i + 1}"
        loading="lazy"
        onerror="this.parentElement.style.display='none'"
      >
      <div class="photo-grid__overlay">
        <div class="photo-grid__overlay-actions">
          <button class="photo-grid__overlay-btn" onclick="viewPhoto('${src}')" aria-label="View photo">🔍</button>
        </div>
      </div>
    </div>`).join('');
}

/** Open a photo in a new tab (light-box replacement). */
function viewPhoto(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ═══════════════════════════════════════════════════════════════
// FRIENDS TAB
// ═══════════════════════════════════════════════════════════════

async function loadFriends(user) {
  const grid = document.getElementById('friendsGrid');
  if (!grid) return;

  const friendIds = user.friends || [];
  if (friendIds.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding:var(--space-lg);">
        <div class="empty-state__icon">👥</div>
        <p class="empty-state__text">No friends yet.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '<p style="color:var(--text-muted);padding:var(--space-sm);">Loading friends…</p>';

  try {
    const results = await Promise.allSettled(
      friendIds.slice(0, 24).map(id => apiFetch(`/api/users/${id}`))
    );
    const friends = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

    if (friends.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state__icon">👥</div>
          <p class="empty-state__text">No friends to display.</p>
        </div>`;
      return;
    }

    grid.innerHTML = friends.map(friend => {
      const fid    = friend._id || friend.id;
      const fname  = escapeHtml(friend.name || 'User');
      const favatar= friend.avatar || avatarFallback(friend.name);
      return `
        <div class="card" style="padding:var(--space-md);text-align:center;display:flex;flex-direction:column;align-items:center;gap:var(--space-xs);">
          <img
            src="${favatar}"
            alt="${fname}"
            style="width:64px;height:64px;border-radius:50%;object-fit:cover;"
            onerror="this.src='${avatarFallback(friend.name || 'User')}'"
          >
          <div style="font-weight:700;font-size:var(--font-size-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${fname}</div>
          ${friend.username ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted);">@${escapeHtml(friend.username)}</div>` : ''}
          <a href="/profile.html?id=${fid}" class="btn btn--outline-secondary btn--sm btn--full" style="margin-top:var(--space-xs);">View Profile</a>
        </div>`;
    }).join('');
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--text-muted);">Failed to load friends.</p>';
    console.error('[loadFriends]', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// ABOUT TAB
// ═══════════════════════════════════════════════════════════════

function loadAbout(user) {
  const content = document.getElementById('aboutContent');
  if (!content) return;

  const age = getAge(user.birthDate);

  // Build a list of { icon, label, value } rows — null entries are filtered out
  const rows = [
    { icon: '👤', label: 'Full Name',           value: user.name },
    isOwnProfile
      ? { icon: '📧', label: 'Email',            value: user.email }
      : null,
    user.location
      ? { icon: '📍', label: 'Location',          value: user.location }
      : null,
    user.birthDate
      ? { icon: '🎂', label: 'Birthday',          value: formatDate(user.birthDate) }
      : null,
    age
      ? { icon: '🎈', label: 'Age',               value: `${age} years old` }
      : null,
    user.gender
      ? { icon: '⚧',  label: 'Gender',            value: capitalize(user.gender) }
      : null,
    user.lookingFor
      ? { icon: '💜', label: 'Looking For',        value: capitalize(user.lookingFor) }
      : null,
    user.relationshipStatus
      ? { icon: '💑', label: 'Relationship',       value: capitalize(user.relationshipStatus) }
      : null,
    { icon: '📅', label: 'Joined',
      value: user.createdAt ? formatDate(user.createdAt) : 'Unknown' },
    user.interests && user.interests.length
      ? { icon: '⭐', label: 'Interests',          value: user.interests.join(' · ') }
      : null
  ].filter(Boolean);

  content.innerHTML = `
    <dl style="margin:0;">
      ${rows.map(row => `
        <div style="display:flex;gap:var(--space-md);align-items:flex-start;padding:var(--space-sm) 0;border-bottom:1px solid var(--border-light);">
          <span style="font-size:1.25rem;min-width:28px;text-align:center;margin-top:2px;" aria-hidden="true">${row.icon}</span>
          <div style="flex:1;min-width:0;">
            <dt style="font-size:var(--font-size-xs);color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">${row.label}</dt>
            <dd style="font-size:var(--font-size-base);color:var(--text);margin:0;">${escapeHtml(String(row.value || 'Not provided'))}</dd>
          </div>
        </div>`).join('')}
    </dl>`;
}

// ═══════════════════════════════════════════════════════════════
// EDIT PROFILE MODAL
// ═══════════════════════════════════════════════════════════════

function openEditModal() {
  if (!isOwnProfile || !profileUser) return;

  const u = profileUser;

  // Helper to safely set a form field value
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('editName',               u.name);
  setVal('editBio',                u.bio);
  setVal('editLocation',           u.location);
  setVal('editBirthDate',          u.birthDate ? u.birthDate.split('T')[0] : '');
  setVal('editGender',             u.gender);
  setVal('editLookingFor',         u.lookingFor);
  setVal('editRelationshipStatus', u.relationshipStatus);
  setVal('editAvatarUrl',          '');       // clear URL field; use file upload instead
  setVal('editCoverUrl',           '');       // clear URL field; use file upload instead

  // Avatar preview
  const preview = document.getElementById('editAvatarPreview');
  if (preview) {
    preview.src = u.avatar || avatarFallback(u.name);
    preview.onerror = function () { this.src = avatarFallback(u.name || 'User'); };
  }

  // Render interest tags using SC helper
  SC.renderInterestTags('editInterestTags', u.interests || []);

  // Show modal
  const modal = document.getElementById('editProfileModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('modal--open'), 10);
  }
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) {
    modal.classList.remove('modal--open');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
  pendingAvatarBase64 = null;
}

/** Close the edit modal when the user clicks the dark overlay. */
function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('editProfileModal')) closeEditModal();
}

async function saveProfile() {
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) { saveBtn.textContent = 'Saving…'; saveBtn.disabled = true; }

  try {
    const name               = document.getElementById('editName')?.value.trim();
    const bio                = document.getElementById('editBio')?.value.trim();
    const location           = document.getElementById('editLocation')?.value.trim();
    const birthDate          = document.getElementById('editBirthDate')?.value;
    const gender             = document.getElementById('editGender')?.value;
    const lookingFor         = document.getElementById('editLookingFor')?.value;
    const relationshipStatus = document.getElementById('editRelationshipStatus')?.value;
    const interests          = SC.getSelectedInterests('editInterestTags');

    // Avatar: URL field → existing avatar (immediate upload handles file selection)
    const avatarUrlInput = document.getElementById('editAvatarUrl')?.value.trim();
    const avatar = avatarUrlInput || profileUser.avatar;

    // Cover: URL field → existing cover
    const coverUrlInput = document.getElementById('editCoverUrl')?.value.trim();
    const coverPhoto = coverUrlInput || profileUser.coverPhoto;

    const body = {
      name, bio, location, birthDate, gender,
      lookingFor, relationshipStatus, interests,
      avatar, coverPhoto
    };

    // Strip keys that are empty strings or undefined (don't overwrite with blank)
    Object.keys(body).forEach(k => {
      if (body[k] === '' || body[k] === undefined) delete body[k];
    });

    const updated = await apiFetch('/api/me', { method: 'PUT', body: JSON.stringify(body) });

    // Merge into localStorage so other parts of the UI stay consistent
    const merged = { ...currentUser, ...updated };
    localStorage.setItem('sc_user', JSON.stringify(merged));

    SC.showSuccess('Profile updated!');
    closeEditModal();

    // Re-render the profile header with fresh data
    await loadProfile(profileUserId);

  } catch (err) {
    SC.showError(`Could not save profile: ${err.message}`);
    console.error('[saveProfile]', err);
  } finally {
    if (saveBtn) { saveBtn.textContent = 'Save Changes'; saveBtn.disabled = false; }
  }
}

// ═══════════════════════════════════════════════════════════════
// PHOTO / AVATAR UPLOADS
// ═══════════════════════════════════════════════════════════════

/**
 * Upload a new profile photo immediately (like Facebook) —
 * reads the file as base64 and persists it to the server right away.
 * No extra "Save Changes" step needed.
 */
async function uploadAvatar(file) {
  if (!file) return;
  try {
    SC.showInfo('Uploading profile photo…');
    const base64 = await SC.compressImage(file, 400, 400, 0.85);

    const updated = await apiFetch('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ avatar: base64 })
    });

    // Persist to localStorage so nav / sidebar / etc. update
    const merged = { ...currentUser, ...updated };
    localStorage.setItem('sc_user', JSON.stringify(merged));

    // Update profile-page avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) profileAvatar.src = base64;

    // Update edit-modal preview if it is open
    const editPreview = document.getElementById('editAvatarPreview');
    if (editPreview) editPreview.src = base64;

    // Keep profileUser in sync so saveProfile() doesn't overwrite with stale data
    if (profileUser) profileUser.avatar = base64;

    // Also sync nav avatar if user is on their own profile
    SC.initNavbar();

    SC.showSuccess('Profile photo updated!');
  } catch (err) {
    SC.showError(`Could not upload profile photo: ${err.message}`);
    console.error('[uploadAvatar]', err);
  }
}

/** Upload a new cover photo immediately (no staging). */
async function uploadCoverPhoto(file) {
  if (!file) return;
  try {
    SC.showInfo('Uploading cover photo…');
    const base64 = await SC.compressImage(file, 1200, 400, 0.85);

    const updated = await apiFetch('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ coverPhoto: base64 })
    });

    localStorage.setItem('sc_user', JSON.stringify({ ...currentUser, ...updated }));

    const coverArea = document.getElementById('coverPhotoArea');
    if (coverArea) {
      coverArea.style.backgroundImage    = `url('${base64}')`;
      coverArea.style.backgroundSize     = 'cover';
      coverArea.style.backgroundPosition = 'center';
    }
    // Keep profileUser in sync so saveProfile() doesn't overwrite with stale data
    if (profileUser) profileUser.coverPhoto = base64;

    // Sync the cover URL field in the edit modal if it is open
    const coverUrlInput = document.getElementById('editCoverUrl');
    if (coverUrlInput) coverUrlInput.value = '';

    SC.showSuccess('Cover photo updated!');
  } catch (err) {
    SC.showError(`Could not update cover: ${err.message}`);
    console.error('[uploadCoverPhoto]', err);
  }
}

/** Add a new photo to the user's photos array and persist immediately. */
async function uploadPhoto(file) {
  if (!file) return;
  try {
    SC.showInfo('Uploading photo…');
    const base64 = await SC.compressImage(file, 1200, 1200, 0.85);

    const photos  = [...(profileUser.photos || []), base64];
    const updated = await apiFetch('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ photos })
    });

    localStorage.setItem('sc_user', JSON.stringify({ ...currentUser, ...updated }));
    if (profileUser) profileUser.photos = photos;

    loadPhotos(profileUser);
    SC.showSuccess('Photo uploaded!');
  } catch (err) {
    SC.showError(`Could not upload photo: ${err.message}`);
    console.error('[uploadPhoto]', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// SOCIAL ACTIONS (follow, friend, connect, message)
// ═══════════════════════════════════════════════════════════════

async function toggleFollow(userId) {
  const btn = document.getElementById('followBtn');
  if (!btn || btn.disabled) return;

  const wasFollowing = btn.textContent.includes('Following');
  const endpoint     = wasFollowing ? `/api/unfollow/${userId}` : `/api/follow/${userId}`;

  btn.disabled = true;
  try {
    await apiFetch(endpoint, { method: 'POST' });

    const statFollowers = document.getElementById('statFollowers');
    const currentCount  = parseInt(statFollowers?.textContent) || 0;

    if (wasFollowing) {
      btn.textContent = '+ Follow';
      btn.classList.replace('btn--primary', 'btn--outline-primary');
      if (statFollowers) statFollowers.textContent = SC.formatCount(Math.max(0, currentCount - 1));
      SC.showInfo('Unfollowed.');
    } else {
      btn.textContent = '✓ Following';
      btn.classList.replace('btn--outline-primary', 'btn--primary');
      if (statFollowers) statFollowers.textContent = SC.formatCount(currentCount + 1);
      SC.showSuccess('Now following!');
    }
  } catch (err) {
    SC.showError(`Could not update follow: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function sendFriendRequest(userId) {
  const btn = document.getElementById('addFriendBtn');
  if (!btn || btn.disabled) return;

  btn.textContent = 'Sending…';
  btn.disabled    = true;
  try {
    await apiFetch(`/api/friends/request/${userId}`, { method: 'POST' });
    btn.textContent = 'Request Sent ✓';
    SC.showSuccess('Friend request sent!');
  } catch (err) {
    SC.showError(`Could not send request: ${err.message}`);
    btn.textContent = '👤 Add Friend';
    btn.disabled    = false;
  }
}

async function connectUser(userId) {
  const btn = document.getElementById('connectBtn');
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  try {
    const result = await apiFetch(`/api/connect/${userId}`, { method: 'POST' });
    if (result && result.match) {
      showMatchBanner(profileUser?.name || 'this person');
    } else {
      SC.showInfo('Connection request sent!');
    }
    btn.innerHTML   = '💜 Connected';
    btn.classList.add('matched');
  } catch (err) {
    SC.showError(`Could not connect: ${err.message}`);
    btn.disabled = false;
  }
}

/** Store target user ID in sessionStorage and jump to the dashboard chat. */
function messageUser(userId) {
  sessionStorage.setItem('openChat', userId);
  window.location.href = '/dashboard.html';
}

// ═══════════════════════════════════════════════════════════════
// POSTS — CREATE, LIKE, COMMENT, DELETE
// ═══════════════════════════════════════════════════════════════

async function likePost(postId) {
  const btn   = document.getElementById(`likeBtn_${postId}`);
  const label = document.getElementById(`likeLabel_${postId}`);
  if (!btn) return;

  const wasLiked = btn.classList.contains('liked');

  // Optimistic UI update
  btn.classList.toggle('liked', !wasLiked);
  btn.setAttribute('aria-pressed', String(!wasLiked));
  if (label) label.textContent = wasLiked ? 'Like' : 'Liked';

  try {
    const result = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    const likes  = result.likes || [];

    // Sync the stats bar reactions count
    const card     = btn.closest('[data-post-id]');
    const statsBar = card?.querySelector('.post-card__stats');
    if (statsBar) {
      let reactEl = statsBar.querySelector('.post-card__reactions');
      if (likes.length === 0) {
        reactEl?.remove();
      } else if (!reactEl) {
        statsBar.insertAdjacentHTML('afterbegin', `
          <div class="post-card__reactions">
            <div class="post-card__reactions-icons">👍</div>
            <span>${likes.length} ${likes.length === 1 ? 'like' : 'likes'}</span>
          </div>`);
      } else {
        const span = reactEl.querySelector('span');
        if (span) span.textContent = `${likes.length} ${likes.length === 1 ? 'like' : 'likes'}`;
      }
    }
  } catch (_) {
    // Revert on failure
    btn.classList.toggle('liked', wasLiked);
    btn.setAttribute('aria-pressed', String(wasLiked));
    if (label) label.textContent = wasLiked ? 'Liked' : 'Like';
    SC.showError('Could not update like.');
  }
}

function toggleComments(postId) {
  const section = document.getElementById(`comments_${postId}`);
  if (!section) return;

  const isHidden = section.classList.contains('hidden');
  section.classList.toggle('hidden', !isHidden);

  if (isHidden) {
    // Focus the comment input when opening
    const input = section.querySelector('input[type="text"]');
    if (input) input.focus();
  }
}

async function commentOnPost(postId, text) {
  if (!text.trim()) return;
  try {
    const result  = await apiFetch(`/api/posts/${postId}/comment`, {
      method: 'POST',
      body:   JSON.stringify({ text: text.trim() })
    });

    const comment     = result.comment || result;
    const commentList = document.getElementById(`commentList_${postId}`);
    if (commentList) commentList.insertAdjacentHTML('beforeend', renderComment(comment));

    // Update comment count in stats bar
    const card   = document.querySelector(`[data-post-id="${postId}"]`);
    const cCount = card?.querySelector(`#commentList_${postId}`)?.children.length || 0;
    const statsBar = card?.querySelector('.post-card__stats');
    if (statsBar) {
      let showBtn = statsBar.querySelector('.post-card__show-comments');
      if (!showBtn) {
        statsBar.insertAdjacentHTML('beforeend',
          `<button class="post-card__show-comments" onclick="toggleComments('${postId}')">${cCount} comment</button>`);
      } else {
        showBtn.textContent = `${cCount} ${cCount === 1 ? 'comment' : 'comments'}`;
      }
    }
  } catch (err) {
    SC.showError(`Could not post comment: ${err.message}`);
  }
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });

    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) card.remove();

    // Decrement stat
    const statPosts = document.getElementById('statPosts');
    if (statPosts) statPosts.textContent = String(Math.max(0, (parseInt(statPosts.textContent) || 1) - 1));

    // Show empty state if the list is now empty
    const container = document.getElementById('userPostsList');
    if (container && !container.querySelector('.post-card')) {
      container.innerHTML = `
        <div class="empty-state card">
          <div class="empty-state__icon">📝</div>
          <h3 class="empty-state__title">No posts yet</h3>
          <p class="empty-state__text">Share something with your friends!</p>
        </div>`;
    }

    SC.showSuccess('Post deleted.');
  } catch (err) {
    SC.showError(`Could not delete post: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MATCH BANNER
// ═══════════════════════════════════════════════════════════════

function showMatchBanner(name) {
  const banner  = document.getElementById('matchBanner');
  const subText = document.getElementById('matchBannerText');
  if (!banner) return;
  if (subText) subText.textContent = `You and ${name} are connected!`;
  banner.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(closeMatchBanner, 8000);
}

function closeMatchBanner() {
  const banner = document.getElementById('matchBanner');
  if (banner) banner.classList.add('hidden');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

async function searchUsers(query) {
  const dropdown = document.getElementById('searchResults');
  if (!dropdown) return;

  if (!query || query.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  try {
    const results = await apiFetch(`/api/users?q=${encodeURIComponent(query)}`);
    const users   = Array.isArray(results) ? results : (results.users || results.data || []);

    if (users.length === 0) {
      dropdown.innerHTML = '<div class="search-dropdown__empty">No users found</div>';
    } else {
      dropdown.innerHTML = users.slice(0, 8).map(u => {
        const uid    = u._id || u.id;
        const uname  = escapeHtml(u.name || 'User');
        const uavatar= u.avatar || avatarFallback(u.name);
        return `
          <a
            href="/profile.html?id=${uid}"
            class="search-result-item"
            onclick="document.getElementById('searchResults').classList.add('hidden')"
          >
            <img
              src="${uavatar}"
              alt="${uname}"
              class="search-result-item__avatar"
              onerror="this.src='${avatarFallback(u.name || 'U')}'"
            >
            <div class="search-result-item__info">
              <div class="search-result-item__name">${uname}</div>
              ${u.username ? `<div class="search-result-item__meta">@${escapeHtml(u.username)}</div>` : ''}
            </div>
          </a>`;
      }).join('');
    }
    dropdown.classList.remove('hidden');
  } catch (err) {
    dropdown.classList.add('hidden');
    console.error('[searchUsers]', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// NAVBAR HELPERS
// ═══════════════════════════════════════════════════════════════

function toggleProfileDropdown() {
  const menu = document.getElementById('profileDropdown');
  const btn  = document.getElementById('profileDropdownToggle');
  if (!menu) return;
  const opening = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !opening);
  btn?.setAttribute('aria-expanded', String(opening));
}

/** Navigate to the current user's own profile page. */
function goToProfile() {
  const id = currentUser._id || currentUser.id;
  window.location.href = id ? `/profile.html?id=${id}` : '/profile.html';
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

function logout() {
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_user');
  sessionStorage.clear();
  window.location.href = '/index.html';
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', init);

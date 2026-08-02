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
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=1877f2&color=fff&size=256`;
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

    // ── Meta pills
    loadProfileMeta(user);

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

// ── Render meta pills (extracted so it can be re-called after async name lookup)
function loadProfileMeta(user) {
  const metaEl = document.getElementById('profileMeta');
  if (!metaEl) return;
  const pills = [];
  if (user.location)         pills.push(`<span class="profile-details__meta-item">📍 ${escapeHtml(user.location)}</span>`);
  if (user.gender)           pills.push(`<span class="profile-details__meta-item">⚧ ${escapeHtml(capitalize(user.gender))}</span>`);
  const age = getAge(user.birthDate);
  if (age)                   pills.push(`<span class="profile-details__meta-item">🎂 ${age} yrs</span>`);
  if (user.lookingFor)       pills.push(`<span class="profile-details__meta-item">💜 ${escapeHtml(capitalize(user.lookingFor))}</span>`);
  // Relationship status with "with" link
  if (user.relationshipStatus) {
    let relText = `💑 ${escapeHtml(capitalize(user.relationshipStatus))}`;
    const isNonSingle = !['Single', 'single', '', undefined, null].includes(user.relationshipStatus);
    if (user.relationshipWith && user.relationshipWithName) {
      relText += ` with <a href="/profile.html?id=${encodeURIComponent(user.relationshipWith)}" style="color:var(--primary);text-decoration:underline;">${escapeHtml(user.relationshipWithName)}</a>`;
    } else if (user.relationshipWith && isNonSingle && !user.relationshipWithName) {
      relText += ' with <em>loading…</em>';
      // Fetch the name asynchronously
      apiFetch(`/api/users/${user.relationshipWith}`).then(p => {
        if (p && p.name) {
          user.relationshipWithName = p.name;
          loadProfileMeta(user);
        }
      }).catch(() => {});
    }
    pills.push(`<span class="profile-details__meta-item">${relText}</span>`);
  }
  if (user.joinedAt) {
    const d = new Date(user.joinedAt);
    const joinedStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    pills.push(`<span class="profile-details__meta-item">📅 Joined ${joinedStr}</span>`);
  }
  metaEl.innerHTML = pills.join('');
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
        <div style="margin-left:auto;">
            <button class="post-card__options" onclick="openPostOptionsModal('${post.id || post._id}', '${authorId}', '${escapeHtml(authorName)}', '${authorAvatar || ''}', ${isOwn})" aria-label="Post options">••••</button>
          </div>
      </div>

      ${(post.feeling || post.activity || post.location || (author.relationshipStatus && author.relationshipVisibility !== 'hide' && !['Single','single',''].includes(author.relationshipStatus))) ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 var(--space-md) var(--space-xs);font-size:13px;">
          ${post.feeling ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.feeling}</span>` : ''}
          ${post.activity ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.activity}</span>` : ''}
          ${post.location ? `<span class="tag" style="font-size:12px;padding:3px 10px;">📍 ${post.location.name}</span>` : ''}
          ${author.relationshipStatus && author.relationshipVisibility !== 'hide' && !['Single','single',''].includes(author.relationshipStatus) ? `
            <span class="tag tag--rel" title="${escapeHtml(capitalize(author.relationshipStatus))}${author.relationshipWithName ? ' with ' + escapeHtml(author.relationshipWithName) : ''}">
              💑 ${escapeHtml(capitalize(author.relationshipStatus))}${author.relationshipWith && author.relationshipWithName ? ` with <a href="/profile.html?id=${encodeURIComponent(author.relationshipWith)}" style="color:inherit;text-decoration:underline;">${escapeHtml(author.relationshipWithName)}</a>` : ''}
            </span>
          ` : ''}
        </div>
      ` : ''}

      <div class="post-card__content${!post.image && post.text && post.text.length < 120 ? ' large-text' : ''}">
        ${highlightHashtags(escapeHtml(post.text || ''))}
      </div>

      <div class="post-card__body">
      ${post.image ? `
        <div class="post-card__media post-card__media--hero">
          <img src="${post.image}" alt="Post image" class="post-card__image" loading="lazy" onerror="this.parentElement.style.display='none'" onclick="window.open('${post.image}', '_blank')" style="cursor:pointer;">
        </div>
      ` : ''}

      ${post.media && post.media.photos && post.media.photos.length > 0 ? (() => {
        const photos = post.media.photos;
        const total = photos.length;
        let gridStyle = '';
        let itemStyle = '';
        const overlay = total > 4 ? `<div class="post-card__img-overlay">+${total - 4}</div>` : '';
        if (total === 1) {
          gridStyle = 'grid-template-columns:1fr';
          itemStyle = 'min-height:300px;max-height:500px;';
        } else if (total === 2) {
          gridStyle = 'grid-template-columns:1fr 1fr';
          itemStyle = 'aspect-ratio:1;';
        } else if (total === 3) {
          gridStyle = 'grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr';
          itemStyle = '';
        } else {
          gridStyle = 'grid-template-columns:1fr 1fr';
          itemStyle = 'aspect-ratio:1;';
        }
        return `
        <div class="post-card__media post-card__media-grid" style="${gridStyle};">
          ${photos.slice(0, 4).map((photo, idx) => {
            const isThree = total === 3;
            const rowspan = isThree && idx === 0 ? 'grid-row:span 2;' : '';
            return `
            <div class="post-card__img-wrap" style="${rowspan}" onclick="window.open('${photo.data || photo.thumbnail || ''}', '_blank')">
              <img src="${photo.data || photo.thumbnail || ''}" alt="Photo ${idx + 1}" style="width:100%;height:100%;object-fit:cover;${itemStyle}" loading="lazy" onerror="this.parentElement.style.display='none'">
              ${idx === 3 && overlay ? overlay : ''}
            </div>`;
          }).join('')}
        </div>`;
      })() : ''}

      ${post.media && post.media.videos && post.media.videos.length > 0 ? `
        <div class="post-card__media post-card__media-grid" style="grid-template-columns:${post.media.videos.length === 1 ? '1fr' : '1fr 1fr'};">
          ${post.media.videos.map((video, idx) => `
            <div class="post-card__img-wrap" style="aspect-ratio:16/9;">
              <video src="${video.data || ''}" style="width:100%;height:100%;background:#000;display:block;" controls preload="metadata" ${idx === 0 ? 'autoplay muted' : ''}></video>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${post.media && post.media.audio && post.media.audio.length > 0 ? `
        <div class="post-card__media" style="display:flex;flex-wrap:wrap;gap:10px;">
          ${post.media.audio.map(audio => `
            <div style="flex:1;min-width:200px;padding:12px;background:var(--bg);border-radius:8px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:20px;">🎵</span>
                <span style="font-size:13px;color:var(--text-secondary);">${audio.name || 'Audio file'}</span>
              </div>
              <audio src="${audio.data || ''}" controls style="width:100%;height:36px;" preload="none"></audio>
            </div>
          `).join('')}
        </div>
      ` : ''}
      </div>

      ${post.tags && post.tags.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--space-sm);">
          ${post.tags.map(tag => `<span class="tag tag--pink" style="font-size:12px;padding:2px 8px;">#${tag}</span>`).join('')}
        </div>
      ` : ''}

      <div class="post-card__stats">
        <div class="post-card__stats-left">
          ${likeCount > 0 ? `
            <div class="post-card__reactions" title="${likeCount} like${likeCount !== 1 ? 's' : ''}">
              <div class="post-card__reactions-icons"><span class="react-thumb">👍</span>${likeCount > 1 ? '<span class="react-heart">❤️</span>' : ''}</div>
              <span>${likeCount}</span>
            </div>
          ` : ''}
        </div>
        <div class="post-card__stats-right">
          ${commentCount > 0 ? `
            <button class="post-card__stat-item" onclick="toggleComments('${post.id || post._id}')">${commentCount} comment${commentCount !== 1 ? 's' : ''}</button>
          ` : ''}
        </div>
      </div>

      <div class="post-card__actions">
        <button
          class="post-card__action-btn${liked ? ' liked' : ''}"
          id="likeBtn_${post.id || post._id}"
          onclick="likePost('${post.id || post._id}')"
          aria-label="${liked ? 'Unlike' : 'Like'} post"
          aria-pressed="${liked}"
        >
          <svg class="like-icon" width="20" height="20" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          <span id="likeLabel_${post.id || post._id}">${liked ? 'Liked' : 'Like'}</span>
        </button>
        <div class="post-card__action-divider"></div>
        <button class="post-card__action-btn post-card__action-btn--comment" onclick="toggleComments('${post.id || post._id}')" aria-label="Comment on post">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Comment</span>
        </button>
        <div class="post-card__action-divider"></div>
        <button class="post-card__action-btn post-card__action-btn--share" onclick="sharePost('${post.id || post._id}')" aria-label="Share post">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>Share</span>
        </button>
        ${isOwn ? `
          <div class="post-card__action-divider"></div>
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
      ? {
          icon: '💑',
          label: 'Relationship',
          value: user.relationshipWith && user.relationshipWithName
            ? `${capitalize(user.relationshipStatus)} with ${user.relationshipWithName}`
            : capitalize(user.relationshipStatus)
        }
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
  // Set relationship "with" field
  const withHidden = document.getElementById('editRelationshipWith');
  const withSearch = document.getElementById('editRelationshipWithSearch');
  if (withHidden && withSearch && u.relationshipWith) {
    withHidden.value = u.relationshipWith;
    // Try to look up the name
    const withUserName = u.relationshipWithName || '';
    withSearch.value = withUserName;
  } else if (withHidden && withSearch) {
    withHidden.value = '';
    withSearch.value = '';
  }
  // Set relationship visibility
  const visRadios = document.querySelectorAll('input[name="editRelVis"]');
  const curVis = u.relationshipVisibility || 'show';
  visRadios.forEach(r => { r.checked = r.value === curVis; });
  toggleRelationshipWithField();

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
  // Hide with-user search results
  const results = document.getElementById('editWithSearchResults');
  if (results) results.style.display = 'none';
}

// Toggle the "with whom" field based on relationship status
function toggleRelationshipWithField() {
  const sel = document.getElementById('editRelationshipStatus');
  const group = document.getElementById('editRelationshipWithGroup');
  if (!sel || !group) return;
  const val = sel.value.toLowerCase();
  // Show "with whom" only for non-single, non-empty values
  const show = val && val !== '' && val !== 'single' && val !== 'not specified';
  group.style.display = show ? 'block' : 'none';
  if (!show) {
    document.getElementById('editRelationshipWith').value = '';
    document.getElementById('editRelationshipWithSearch').value = '';
    const results = document.getElementById('editWithSearchResults');
    if (results) results.style.display = 'none';
  }
}

// Relationship user search with debounce
let relSearchTimer;
function initRelUserSearch() {
  const input = document.getElementById('editRelationshipWithSearch');
  const hidden = document.getElementById('editRelationshipWith');
  const results = document.getElementById('editWithSearchResults');
  if (!input || !hidden || !results) return;

  input.addEventListener('input', function () {
    clearTimeout(relSearchTimer);
    const q = this.value.trim();
    if (q.length < 2) {
      results.style.display = 'none';
      return;
    }
    relSearchTimer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/users?q=${encodeURIComponent(q)}`);
        const users = Array.isArray(data) ? data : (data.data || []);
        if (users.length === 0) {
          results.innerHTML = '<div class="search-dropdown__item" style="padding:8px;color:var(--text-muted);">No users found</div>';
        } else {
          results.innerHTML = users.slice(0, 10).map(u => `
            <div class="search-dropdown__item" data-userid="${u._id || u.id}" data-username="${escapeHtml(u.name)}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;">
              <img src="${u.avatar || avatarFallback(u.name)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">
              <span>${escapeHtml(u.name)}</span>
            </div>
          `).join('');
          results.querySelectorAll('.search-dropdown__item').forEach(el => {
            el.addEventListener('click', function () {
              hidden.value = this.dataset.userid;
              input.value = this.dataset.username;
              results.style.display = 'none';
            });
          });
        }
        results.style.display = 'block';
      } catch (e) { /* ignore */ }
    }, 300);
  });

  // Hide results on blur (with delay to allow click)
  input.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none'; }, 200));
  input.addEventListener('focus', () => { if (results.children.length > 0) results.style.display = 'block'; });
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
    const relationshipWith   = document.getElementById('editRelationshipWith')?.value || '';
    const relVisRadios       = document.querySelectorAll('input[name="editRelVis"]');
    let relationshipVisibility = 'show';
    relVisRadios.forEach(r => { if (r.checked) relationshipVisibility = r.value; });
    const interests          = SC.getSelectedInterests('editInterestTags');

    // Avatar: URL field → existing avatar (immediate upload handles file selection)
    const avatarUrlInput = document.getElementById('editAvatarUrl')?.value.trim();
    const avatar = avatarUrlInput || profileUser.avatar;

    // Cover: URL field → existing cover
    const coverUrlInput = document.getElementById('editCoverUrl')?.value.trim();
    const coverPhoto = coverUrlInput || profileUser.coverPhoto;

    const body = {
      name, bio, location, birthDate, gender,
      lookingFor, relationshipStatus, relationshipWith, relationshipVisibility, interests,
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

    // Update create-post avatar on profile page
    const cpAvatar = document.getElementById('createPostAvatar');
    if (cpAvatar) cpAvatar.src = base64;

    // Update my-story avatar if present
    const myStoryAvatar = document.getElementById('myStoryAvatar');
    if (myStoryAvatar) myStoryAvatar.src = base64;

    // Update edit-modal preview if it is open
    const editPreview = document.getElementById('editAvatarPreview');
    if (editPreview) editPreview.src = base64;

    // Keep profileUser in sync so saveProfile() doesn't overwrite with stale data
    if (profileUser) profileUser.avatar = base64;

    // Sync nav & sidebar avatars across the app
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

async function sharePost(postId) {
  try {
    const result = await apiFetch(`/posts/advanced/${postId}/share`, { method: 'POST' });
    if (result && result.ok) {
      const shares = result.data?.shares || 0;
      SC.showToast(`Post shared! 📤 (${shares} total shares)`, 'success');
      return;
    }
  } catch (e) { /* fall through */ }
  const url = `${window.location.origin}/post.html?id=${postId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      SC.showToast('Link copied to clipboard! 📋', 'success');
    });
  } else {
    SC.showToast('Share: ' + url, 'info');
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
// MATCH POPUP — full overlay with love tone & auto-relationship
// ═══════════════════════════════════════════════════════════════

let matchToneTimer = null;
let matchToneContext = null;

function playMatchTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    matchToneContext = ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.25, ctx.currentTime);
    master.connect(ctx.destination);

    const chords = [
      { freqs: [261.63, 329.63, 392.00, 493.88], dur: 0.8 },
      { freqs: [220.00, 261.63, 329.63, 440.00], dur: 0.8 },
      { freqs: [174.61, 220.00, 261.63, 349.23], dur: 0.8 },
      { freqs: [196.00, 246.94, 311.13, 392.00], dur: 0.8 },
    ];
    let t = ctx.currentTime;
    for (let loop = 0; loop < 1; loop++) {
      for (const chord of chords) {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.7, t + 0.08);
        gain.gain.setValueAtTime(0.7, t + chord.dur - 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + chord.dur);
        gain.connect(master);
        for (const freq of chord.freqs) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(gain);
          osc.start(t);
          osc.stop(t + chord.dur);
        }
        t += chord.dur;
      }
    }
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.06, ctx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 4.5);
    padGain.connect(master);
    [261.63, 329.63, 392.00].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(padGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 5);
    });

    matchToneTimer = setTimeout(() => {
      try { ctx.close(); } catch (e) { /* ignore */ }
      matchToneContext = null;
    }, 5200);
  } catch (e) { /* silent fallback */ }
}

function showMatchBanner(name) {
  const banner = document.getElementById('matchBanner');
  const subText = document.getElementById('matchBannerText');
  if (!banner) return;
  if (subText) subText.textContent = `You and ${name} are connected!`;

  // Set avatars
  const currentUserData = JSON.parse(localStorage.getItem('sc_user') || '{}');
  const myAvatar = document.getElementById('matchPopupMyAvatar');
  const theirAvatar = document.getElementById('matchPopupTheirAvatar');
  if (myAvatar) {
    myAvatar.src = currentUserData.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.name || 'You')}&background=1877f2&color=fff&size=96`;
  }
  if (theirAvatar) {
    const avatarName = (name || '').split(' ')[0] || 'Them';
    theirAvatar.src = profileUser?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=ff69b4&color=fff&size=96`;
  }

  banner.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Play romantic love tone
  playMatchTone();

  // Auto-close after 5 seconds, then open relationship modal
  setTimeout(() => {
    closeMatchBanner();
    const uid = profileUserId || profileUser?.id || profileUser?._id;
    if (uid) {
      openRelationshipModal(uid, `You matched with ${name}! Would you like to set your relationship?`, null);
    }
  }, 5500);
}

function closeMatchBanner() {
  const banner = document.getElementById('matchBanner');
  if (banner) banner.classList.add('hidden');
  document.body.style.overflow = '';
  if (matchToneTimer) {
    clearTimeout(matchToneTimer);
    matchToneTimer = null;
  }
  if (matchToneContext) {
    try { matchToneContext.close(); } catch (e) { /* ignore */ }
    matchToneContext = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP MODAL (for profile page)
// ═══════════════════════════════════════════════════════════════

function openRelationshipModal(userId, message, notifId) {
  const modal = document.getElementById('relationshipModal');
  if (!modal) return;

  const userNameEl = document.getElementById('relationshipModalUserName');
  if (userNameEl) {
    userNameEl.textContent = profileUser?.name || 'User';
  }

  modal.dataset.userId = userId;
  if (notifId) modal.dataset.notifId = notifId;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeRelationshipModal() {
  const modal = document.getElementById('relationshipModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    delete modal.dataset.userId;
    delete modal.dataset.notifId;
  }
}

async function addRelationship() {
  const modal = document.getElementById('relationshipModal');
  const userId = modal?.dataset?.userId;
  const notifId = modal?.dataset?.notifId;
  if (!userId) return;

  const selectedType = document.querySelector('input[name="relType"]:checked');
  const relType = selectedType ? selectedType.value : 'single';

  const result = await apiFetch(`/api/connect/accept/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ relationshipType: relType })
  });

  if (result) {
    SC.showSuccess(`Relationship added: ${relType}!`);
    closeRelationshipModal();
    await loadProfile(profileUserId);
    if (notifId) {
      try { await apiFetch(`/api/notifications/read/${notifId}`, { method: 'PUT' }); } catch (e) { /* ignore */ }
    }
  } else {
    SC.showError('Could not add relationship');
  }
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

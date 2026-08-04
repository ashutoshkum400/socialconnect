
/* ==========================================================================
   SocialConnect — dashboard.js
   All dashboard logic: feed, posts, friends, notifications, chat, socket
   ========================================================================== */

'use strict';

// ─── Auth Guard ──────────────────────────────────────────────────────────────
const token = localStorage.getItem('sc_token');
const currentUser = JSON.parse(localStorage.getItem('sc_user') || '{}');
if (!token) window.location.href = '/index.html';

// ─── Socket.IO ───────────────────────────────────────────────────────────────
// Socket is best-effort: if the client library fails to load, use a safe
// no-op object so the rest of the dashboard (feed, users, posts) still loads.
const socket = (typeof io === 'function')
  ? io(window.SOCKET_URL)
  : { on() {}, emit() {}, off() {}, disconnect() {}, removeAllListeners() {} };
if (typeof io === 'function') socket.emit('authenticate', token);

// ─── State ───────────────────────────────────────────────────────────────────
const API = (window.API_BASE || '') + '/api';
const HEADERS = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

let allUsers = [];             // cache from /api/users
let allNotifications = [];     // cache from /api/notifications
let onlineUserIds = new Set(); // user IDs currently online
let pendingRequests = [];      // pending friend requests list
let openChatWindows = {};      // { userId: windowElement }
let chatListAllUsers = [];     // all users for chat list
let lastMatchedUserId = null;  // for "send message" after match banner
let unreadCounts = {};         // { userId: count }
let totalUnread = 0;           // total unread messages across all users
let recentChats = {};          // { userId: { user, lastMessage, unread, updatedAt } }

// ─── API Helper ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  options.headers = { ...HEADERS(), ...(options.headers || {}) };
  const res = await fetch(API + path, options);
  if (res.status === 401) { logout(); return null; }
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════════
// 1. LOAD CURRENT USER — update nav avatar + sidebar profile card
// ═══════════════════════════════════════════════════════════════════
async function loadCurrentUser() {
  const result = await apiFetch('/me');
  if (!result || !result.ok) return;
  const user = result.data;

  // Persist freshest user data & sync local reference
  localStorage.setItem('sc_user', JSON.stringify(user));
  Object.assign(currentUser, user);

  // Nav avatars
  ['navAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.backgroundImage = `url('${user.avatar || avatarUrl(user.name)}')`;
      el.setAttribute('aria-label', `${user.name}'s profile`);
    }
  });

  // Create-post avatar
  const cpAvatar = document.getElementById('createPostAvatar');
  if (cpAvatar) cpAvatar.src = user.avatar || avatarUrl(user.name);

  // My story avatar
  const myStoryAvatar = document.getElementById('myStoryAvatar');
  if (myStoryAvatar) myStoryAvatar.src = user.avatar || avatarUrl(user.name);

  // Sidebar profile link
  const sidebarProfileLink = document.getElementById('sidebarProfileLink');
  if (sidebarProfileLink) sidebarProfileLink.href = `/profile.html?id=${user.id}`;

  // Sidebar profile card
  renderSidebarProfile(user);
}

function renderSidebarProfile(user) {
  const skeleton = document.getElementById('sidebarProfileSkeleton');
  const content = document.getElementById('sidebarProfileContent');
  if (!skeleton || !content) return;

  const postsCount = 0; // Would be retrieved separately
  const friendsCount = (user.friends || []).length;
  const followersCount = (user.followers || []).length;

  content.innerHTML = `
    <div style="position:relative;">
      <div style="
        height:80px;
        background:${user.coverPhoto ? `url('${user.coverPhoto}') center/cover no-repeat` : 'var(--gradient-primary)'};
        border-radius:var(--radius-sm) var(--radius-sm) 0 0;
      "></div>
      <div style="padding:0 var(--space-md) var(--space-md);margin-top:-28px;">
        <div style="position:relative;display:inline-block;margin-bottom:var(--space-xs);">
          <img
            src="${user.avatar || avatarUrl(user.name)}"
            alt="${user.name}"
            style="width:56px;height:56px;border-radius:50%;border:3px solid var(--card-bg);object-fit:cover;"
            onerror="this.src='${avatarUrl(user.name)}'"
          >
          <span class="online-dot online-dot--sm" style="position:absolute;bottom:2px;right:2px;"></span>
        </div>
        <div>
          <a href="/profile.html?id=${user.id}" class="post-card__name" style="font-size:var(--font-size-base);font-weight:700;display:block;">
            ${escapeHtml(user.name)}
          </a>
          <span style="font-size:var(--font-size-sm);color:var(--text-secondary);">@${escapeHtml(user.username || '')}</span>
          ${user.bio ? `<p style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:4px;line-height:1.4;">${escapeHtml(user.bio)}</p>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;margin-top:var(--space-md);padding-top:var(--space-sm);border-top:1px solid var(--border);">
          <div style="cursor:pointer;">
            <div style="font-weight:700;font-size:var(--font-size-base);color:var(--text);">${postsCount}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-secondary);">Posts</div>
          </div>
          <div style="cursor:pointer;border-left:1px solid var(--border);border-right:1px solid var(--border);">
            <div style="font-weight:700;font-size:var(--font-size-base);color:var(--text);">${friendsCount}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-secondary);">Friends</div>
          </div>
          <div style="cursor:pointer;">
            <div style="font-weight:700;font-size:var(--font-size-base);color:var(--text);">${followersCount}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-secondary);">Followers</div>
          </div>
        </div>
        <a href="/profile.html?id=${user.id}" class="btn btn--outline-secondary btn--sm btn--full" style="margin-top:var(--space-sm);">
          Edit Profile
        </a>
      </div>
    </div>
  `;

  skeleton.classList.add('hidden');
  content.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════════
// 2. LOAD FEED
// ═══════════════════════════════════════════════════════════════════
async function loadFeed() {
  const result = await apiFetch('/posts/feed/advanced');
  const skeleton = document.getElementById('feedSkeleton');
  const container = document.getElementById('feedContainer');
  const emptyState = document.getElementById('feedEmpty');

  if (skeleton) skeleton.style.display = 'none';

  if (!result || !result.ok || !result.data) {
    showToast('Could not load feed', 'error');
    return;
  }

  const posts = result.data.posts || result.data;

  if (!posts.length) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  container.innerHTML = '';
  posts.forEach(post => {
    const el = createPostElement(post);
    container.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. RENDER POST — returns a DOM element for a post card
// ═══════════════════════════════════════════════════════════════════
function renderPost(post) {
  return createPostElement(post).outerHTML;
}

function createPostElement(post) {
  const author = post.author || {};
  const authorId = post.authorId || author.id || '';
  const authorName = escapeHtml(author.name || 'Unknown');
  const authorAvatar = author.avatar || avatarUrl(author.name || 'U');
  const authorUsername = escapeHtml(author.username || '');
  const isOwn = authorId === (currentUser.id || '');
  const likes = post.likes || [];
  const comments = post.comments || [];
  const liked = likes.includes(currentUser.id);
  const likeCount = likes.length;
  const commentCount = comments.length;
  const shareCount = post.shares ? post.shares.length : 0;
  const viewCount = post.views ? post.views.length : (post.interactionMetrics?.impressions || 0);

  const div = document.createElement('article');
  div.className = 'post-card card';
  div.setAttribute('data-post-id', post.id);
  div.setAttribute('role', 'article');
  div.setAttribute('aria-label', `Post by ${author.name || 'Unknown'}`);

  const formatCount = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  const isVerified = author.verified || author.isVerified || false;

  div.innerHTML = `
    <div class="post-card__header">
      <a href="/profile.html?id=${authorId}" class="post-card__avatar-link" style="flex-shrink:0;">
        <img
          src="${authorAvatar}"
          alt="${authorName}"
          class="post-card__avatar"
          onerror="this.src='${avatarUrl(author.name || 'U')}'"
        >
        ${isVerified ? '<span class="post-card__verified" title="Verified">✓</span>' : ''}
      </a>
      <div class="post-card__meta">
        <div class="post-card__name-row">
          <a href="/profile.html?id=${authorId}" class="post-card__name">${authorName}</a>
          ${isVerified ? '<span class="post-card__verified" title="Verified Account">✓</span>' : ''}
        </div>
        <div class="post-card__time">
          <span>${timeAgo(post.time || post.timestamp)}</span>
          <span>·</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
      </div>
      <div style="margin-left:auto;">
        <button class="post-card__options" onclick="openPostOptionsModal('${post.id}', '${authorId}', '${escapeHtml(authorName)}', '${authorAvatar}', ${isOwn})" aria-label="Post options">••••</button>
      </div>
    </div>

    <div class="post-card__body" id="postBody_${post.id}">
       ${author.relationshipStatus && author.relationshipVisibility !== 'hide' && !['Single','single',''].includes(author.relationshipStatus) ? `
       <div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 var(--space-md) var(--space-xs);">
         ${author.relationshipStatus && author.relationshipVisibility !== 'hide' && !['Single','single',''].includes(author.relationshipStatus) ? `
           <span class="tag tag--rel" title="${escapeHtml(capitalize(author.relationshipStatus))}${author.relationshipWithName ? ' with ' + escapeHtml(author.relationshipWithName) : ''}">
             💑 ${escapeHtml(capitalize(author.relationshipStatus))}${author.relationshipWith && author.relationshipWithName ? ` with <a href="/profile.html?id=${encodeURIComponent(author.relationshipWith)}" style="color:inherit;text-decoration:underline;">${escapeHtml(author.relationshipWithName)}</a>` : ''}
           </span>
         ` : ''}
       </div>
     ` : ''}

    ${post.feeling || post.activity || post.location ? `
      <div class="post-card__subject">
        ${post.feeling ? `<span class="subject-feeling">${post.feeling}</span>` : ''}
        ${post.activity ? `<span class="subject-activity">${post.activity}</span>` : ''}
        ${post.location ? `<span class="subject-location">📍 ${post.location.name}</span>` : ''}
      </div>
    ` : ''}
    ${(!post.feeling && !post.activity && !post.location) && post.text ? `
      <div class="post-card__content${!post.image && (!post.media || !post.media.photos || !post.media.photos.length) && post.text.length < 120 ? ' large-text' : ''}${post.text.length > 300 ? ' truncated' : ''}" id="postContent_${post.id}">
        ${highlightHashtags(escapeHtml(post.text))}
      </div>
      ${post.text.length > 300 ? `<span class="post-card__see-more" onclick="expandPostText('${post.id}')">See more</span>` : ''}
    ` : ''}

    ${post.image ? `
      <div class="post-card__media post-card__media--hero">
        <img src="${post.image}" alt="Post image" class="post-card__image" loading="lazy" onerror="this.parentElement.style.display='none'" onclick="openPostModal('${post.id}')" style="cursor:pointer;">
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
          <div class="post-card__img-wrap" style="${rowspan}${idx === 3 ? '' : ''}" onclick="window.open('${photo.data || photo.thumbnail || ''}', '_blank')">
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
      <div class="post-card__media" style="display:flex;flex-wrap:wrap;gap:10px;padding:0 var(--space-md) var(--space-sm);">
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

    ${post.tags && post.tags.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 var(--space-md) var(--space-sm);">
        ${post.tags.map(tag => `<span class="tag tag--pink" style="font-size:12px;padding:2px 8px;">#${tag}</span>`).join('')}
      </div>
    ` : ''}

    <div class="post-card__stats">
      <div class="post-card__stats-left">
        ${likeCount > 0 ? `
          <div class="post-card__reactions" title="${likeCount} like${likeCount !== 1 ? 's' : ''}">
            <div class="post-card__reactions-icons"><span class="react-thumb">👍</span>${likeCount > 1 ? '<span class="react-heart">❤️</span>' : ''}</div>
            <span>${formatCount(likeCount)}</span>
          </div>
        ` : ''}
      </div>
      <div class="post-card__stats-right">
        ${viewCount > 0 ? `<span class="post-card__stat-item" title="${viewCount} view${viewCount !== 1 ? 's' : ''}">${formatCount(viewCount)} view${viewCount !== 1 ? 's' : ''}</span>` : ''}
        ${commentCount > 0 ? `<button class="post-card__stat-item" onclick="toggleComments('${post.id}')">${formatCount(commentCount)} comment${commentCount !== 1 ? 's' : ''}</button>` : ''}
        ${shareCount > 0 ? `<span class="post-card__stat-item">${formatCount(shareCount)} share${shareCount !== 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
    </div>

    <div class="post-card__actions">
      <button class="post-card__action-btn${liked ? ' liked' : ''}" id="likeBtn_${post.id}" onclick="likePost('${post.id}')" aria-label="${liked ? 'Unlike' : 'Like'} post" aria-pressed="${liked}">
        <svg class="like-icon" width="20" height="20" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        <span id="likeLabel_${post.id}">${liked ? 'Liked' : 'Like'}</span>
      </button>
      <div class="post-card__action-divider"></div>
      <button class="post-card__action-btn post-card__action-btn--comment" onclick="toggleComments('${post.id}')" aria-label="Comment on post">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Comment</span>
      </button>
      <div class="post-card__action-divider"></div>
      <button class="post-card__action-btn post-card__action-btn--share" onclick="sharePost('${post.id}')" aria-label="Share post">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        <span>Share</span>
      </button>
    </div>

    <div class="post-card__comments hidden" id="comments_${post.id}">
      <div id="commentList_${post.id}">
        ${comments.map(c => renderComment(c)).join('')}
      </div>
      <div class="post-card__comment-input">
        <img src="${currentUser.avatar || avatarUrl(currentUser.name || 'Me')}" alt="Your avatar" class="post-card__comment-avatar" onerror="this.src='${avatarUrl(currentUser.name || 'Me')}'">
        <div class="post-card__comment-input-wrap">
          <input type="text" placeholder="Write a comment..." aria-label="Write a comment" data-post-id="${post.id}" onkeydown="handleCommentKeydown(event, '${post.id}')">
          <button class="post-card__comment-emoji" aria-label="Add emoji">😊</button>
        </div>
      </div>
    </div>
  `;

  return div;
}

function expandPostText(postId) {
  const el = document.getElementById(`postContent_${postId}`);
  if (el) {
    el.classList.remove('truncated');
    const seeMore = el.nextElementSibling;
    if (seeMore && seeMore.classList.contains('post-card__see-more')) {
      seeMore.style.display = 'none';
    }
  }
}

function renderComment(comment) {
  const user = comment.user || {};
  const name = escapeHtml(user.name || 'Unknown');
  const avatar = user.avatar || avatarUrl(user.name || 'U');
  const userId = user.id || comment.userId || '';
  const commentId = comment.id || '';
  return `
    <div class="post-card__comment" data-comment-id="${commentId}">
      <a href="/profile.html?id=${userId}" style="flex-shrink:0;">
        <img src="${avatar}" alt="${name}" class="post-card__comment-avatar"
          onerror="this.src='${avatarUrl(user.name || 'U')}'">
      </a>
      <div style="flex:1;">
        <div class="post-card__comment-bubble">
          <a href="/profile.html?id=${userId}" class="post-card__comment-name">${name}</a>
          <p class="post-card__comment-text">${escapeHtml(comment.text || '')}</p>
        </div>
        <div class="post-card__comment-actions">
          <span class="post-card__comment-like-btn" onclick="likeComment('${commentId}')">Like</span>
          <span class="post-card__comment-reply-btn">Reply</span>
          <span>${timeAgo(comment.time)}</span>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 5. LOAD NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════
async function loadNotifications() {
  const result = await apiFetch('/notifications');
  if (!result || !result.ok) return;

  allNotifications = result.data || [];
  renderNotifications(allNotifications);
  updateNotifBadge();
}

function renderNotifications(notifs) {
  const list = document.getElementById('notifList');
  if (!list) return;

  if (!notifs.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding:var(--space-lg) 0;">
        <div class="empty-state__icon">🔔</div>
        <p class="empty-state__text" style="font-size:var(--font-size-sm);color:var(--text-secondary);">No notifications yet</p>
      </div>
    `;
    return;
  }

  // Enrich notifications with user data from allUsers
  const enrichedNotifs = notifs.map(n => {
    if (n.fromId && !n.fromName) {
      const fromUser = allUsers.find(u => u.id === n.fromId);
      if (fromUser) {
        return {
          ...n,
          fromName: fromUser.name,
          fromAvatar: fromUser.avatar
        };
      }
    }
    return n;
  });

  const priorityColors = { high: '#e53935', medium: '#f7b928', low: '#65676b' };
  const priorityLabels = { high: 'HIGH', medium: '', low: '' };

  // Group similar notifications (optional)
  list.innerHTML = enrichedNotifs.map(n => {
    const avatarSrc = n.fromAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.fromName || 'U')}&background=random&color=fff&size=40`;
    const priorityColor = priorityColors[n.priority] || '#65676b';
    const priorityLabel = priorityLabels[n.priority] || '';

    const iconMap = {
      like: `<span class="notification-item__icon notification-item__icon--like">👍</span>`,
      comment: `<span class="notification-item__icon notification-item__icon--comment">💬</span>`,
      share: `<span class="notification-item__icon notification-item__icon--share">📤</span>`,
      friend_request: `<span class="notification-item__icon notification-item__icon--friend">👥</span>`,
      friend_accept: `<span class="notification-item__icon notification-item__icon--friend">✅</span>`,
      follow: `<span class="notification-item__icon notification-item__icon--friend">➕</span>`,
      follow_back: `<span class="notification-item__icon notification-item__icon--friend">🔄</span>`,
      match: `<span class="notification-item__icon notification-item__icon--match">💜</span>`,
      connect_request: `<span class="notification-item__icon notification-item__icon--match">💜</span>`,
      connect_accept: `<span class="notification-item__icon notification-item__icon--match">✅</span>`,
      message: `<span class="notification-item__icon">💬</span>`,
    };
    const icon = iconMap[n.type] || `<span class="notification-item__icon">🔔</span>`;

    // Check if notification should be clickable (like, comment, share)
    const isPostRelated = ['like', 'comment', 'share'].includes(n.type);
    const clickHandler = isPostRelated && n.postId 
      ? `onclick="navigateToPost('${n.postId}'); markNotifAsRead('${n.id}'); event.stopPropagation();"`
      : `onclick="markNotifAsRead('${n.id}'); event.stopPropagation();"`;

    // Generate action buttons based on notification type
    let actionButtons = '';
    if (n.type === 'friend_request') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--primary btn--xs" onclick="acceptFriendRequest('${n.fromId}'); event.stopPropagation();">Accept</button>
          <button class="btn btn--outline-secondary btn--xs" onclick="rejectFriendRequest('${n.fromId}'); event.stopPropagation();">Reject</button>
        </div>
      `;
    } else if (n.type === 'follow') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--outline-primary btn--xs" onclick="followUser('${n.fromId}'); event.stopPropagation();">Follow Back</button>
        </div>
      `;
    } else if (n.type === 'connect_request') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--match btn--xs" onclick="openRelationshipModal('${n.fromId}', '${escapeHtml(n.text || '')}', '${n.id}'); event.stopPropagation();">Connect</button>
        </div>
      `;
    } else if (n.type === 'friend_accept') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--outline-primary btn--xs" onclick="openChat('${n.fromId}', '${escapeHtml(n.fromName || '')}', '${escapeHtml(n.fromAvatar || '')}'); event.stopPropagation();">Message</button>
          <button class="btn btn--outline-secondary btn--xs" onclick="window.location.href='/profile.html?id=${n.fromId}'; event.stopPropagation();">View Profile</button>
        </div>
      `;
    } else if (n.type === 'follow_back') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--outline-primary btn--xs" onclick="openChat('${n.fromId}', '${escapeHtml(n.fromName || '')}', '${escapeHtml(n.fromAvatar || '')}'); event.stopPropagation();">Message</button>
          <button class="btn btn--outline-secondary btn--xs" onclick="window.location.href='/profile.html?id=${n.fromId}'; event.stopPropagation();">View Profile</button>
        </div>
      `;
    } else if (n.type === 'match' || n.type === 'connect_accept') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--match btn--xs" onclick="openChat('${n.fromId}', '${escapeHtml(n.fromName || '')}', '${escapeHtml(n.fromAvatar || '')}'); event.stopPropagation();">Message</button>
          <button class="btn btn--outline-secondary btn--xs" onclick="window.location.href='/profile.html?id=${n.fromId}'; event.stopPropagation();">View Profile</button>
        </div>
      `;
    } else if (n.type === 'message') {
      actionButtons = `
        <div class="notification-item__actions">
          <button class="btn btn--outline-primary btn--xs" onclick="openChat('${n.fromId}', '${escapeHtml(n.fromName || '')}', '${escapeHtml(n.fromAvatar || '')}'); event.stopPropagation();">Reply</button>
        </div>
      `;
    }

    // Priority badge for high priority
    const priorityBadge = n.priority === 'high' ? `<span class="notif-priority-badge">HIGH</span>` : '';

    return `
      <div class="notification-item${n.read ? '' : ' unread'} notif-priority-${n.priority || 'medium'}${isPostRelated ? ' notification-item--clickable' : ''}" 
           data-notif-id="${n.id}" 
           ${clickHandler}
           style="cursor: pointer; border-left: 3px solid ${n.read ? 'transparent' : priorityColor};">
        <div class="notification-item__avatar-wrap">
          <img src="${avatarSrc}" alt="${escapeHtml(n.fromName || 'User')}" class="notification-item__avatar" onerror="this.style.display='none'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
          <div style="position:absolute;bottom:-2px;right:-2px;">${icon}</div>
        </div>
        <div class="notification-item__content">
          <p class="notification-item__text">${n.text || ''} ${priorityBadge}</p>
          <span class="notification-item__time">${timeAgo(n.time)}</span>
        </div>
        ${!n.read ? `<span class="notification-item__unread-dot" aria-label="Unread"></span>` : ''}
        ${actionButtons}
      </div>
    `;
  }).join('');
}

function updateNotifBadge() {
  const unread = allNotifications.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  const mobileBadge = document.getElementById('mobileNotifBadge');

  [badge, mobileBadge].forEach(el => {
    if (!el) return;
    if (unread > 0) {
      el.textContent = unread > 99 ? '99+' : unread;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function markNotifAsRead(notifId) {
  const notif = allNotifications.find(n => n.id === notifId);
  if (notif) {
    notif.read = true;
    updateNotifBadge();
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      renderNotifications(allNotifications);
    }
    // Call server to mark as read
    apiFetch(`/notifications/read/${notifId}`, { method: 'PUT' }).catch(() => {});
  }
}

// Play notification sound for high-priority notifications
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) { /* silent fallback */ }
}

// Sweet desirable love tone for incoming messages (1 second)
function playMessageTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.2, ctx.currentTime);
    master.connect(ctx.destination);

    // Two-note romantic chime: C5 → E5 with gentle vibrato
    const notes = [
      { freq: 523.25, start: 0, dur: 0.5 },
      { freq: 659.25, start: 0.25, dur: 0.6 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      // Gentle vibrato
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 6;
      vibrato.type = 'sine';
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 3;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(ctx.currentTime + start);
      vibrato.stop(ctx.currentTime + start + dur);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + start + 0.06);
      gain.gain.setValueAtTime(0.8, ctx.currentTime + start + dur - 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    // Soft triangle pad underneath for warmth
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.05, ctx.currentTime);
    padGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    padGain.connect(master);
    [392.00, 523.25].forEach(f => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(padGain);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 1.2);
    });

    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);
  } catch (e) { /* silent fallback */ }
}

// Navigate to a specific post when clicking on like/comment/share notifications
function navigateToPost(postId) {
  // Close the notification dropdown
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }

  // Try to find the post in the current feed
  const postCard = document.querySelector(`[data-post-id="${postId}"]`);
  
  if (postCard) {
    // Scroll to the post
    postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight the post temporarily
    postCard.style.transition = 'box-shadow 0.3s ease';
    postCard.style.boxShadow = '0 0 0 3px var(--primary), 0 4px 12px rgba(88, 86, 214, 0.3)';
    
    setTimeout(() => {
      postCard.style.boxShadow = '';
    }, 2000);
  } else {
    // If post not found in current feed, open it in a modal
    openPostModal(postId);
  }
}

async function markAllNotifsRead() {
  const result = await apiFetch('/notifications/read', { method: 'PUT' });
  if (result && result.ok) {
    allNotifications = allNotifications.map(n => ({ ...n, read: true }));
    renderNotifications(allNotifications);
    updateNotifBadge();
  }
}

function switchNotifTab(btn, type) {
  document.querySelectorAll('.notifications-dropdown__tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  const filtered = type === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;
  renderNotifications(filtered);
}

// ═══════════════════════════════════════════════════════════════════
// 6. LOAD FRIEND REQUESTS
// ═══════════════════════════════════════════════════════════════════
async function loadFriendRequests() {
  const result = await apiFetch('/friends/requests');
  if (!result || !result.ok) return;

  pendingRequests = result.data || [];
  renderFriendRequests();
  updateFriendReqBadge();
}

function renderFriendRequests() {
  const sidebarList = document.getElementById('sidebarRequestsList');
  const sidebarWrap = document.getElementById('sidebarRequests');

  if (!pendingRequests.length) {
    if (sidebarWrap) sidebarWrap.style.display = 'none';
    return;
  }

  // Show up to 2 in sidebar
  if (sidebarList) sidebarList.innerHTML = pendingRequests.slice(0, 2).map(req => {
    const user = req.user || {};
    const fromId = req.from || user.id || '';
    return `
      <div class="friend-request-item" style="padding:var(--space-sm) 0;" data-from-id="${fromId}">
        <img
          src="${user.avatar || avatarUrl(user.name || 'U')}"
          alt="${escapeHtml(user.name || 'User')}"
          class="friend-request-item__avatar"
          style="width:40px;height:40px;"
          onerror="this.src='${avatarUrl(user.name || 'U')}'"
        >
        <div class="friend-request-item__info" style="flex:1;min-width:0;">
          <a href="/profile.html?id=${fromId}" class="friend-request-item__name">
            ${escapeHtml(user.name || 'Unknown')}
          </a>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button class="btn btn--primary btn--xs" onclick="acceptFriendRequest('${fromId}')">Confirm</button>
          <button class="btn btn--outline-secondary btn--xs" onclick="rejectFriendRequest('${fromId}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  if (sidebarWrap) sidebarWrap.style.display = 'block';
}

function updateFriendReqBadge() {
  const count = pendingRequests.length;
  const mobileBadge = document.getElementById('mobileFriendBadge');

  [mobileBadge].forEach(el => {
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? '99+' : count;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 7 & 8. ACCEPT / REJECT FRIEND REQUESTS
// ═══════════════════════════════════════════════════════════════════
async function acceptFriendRequest(fromId) {
  const result = await apiFetch(`/friends/accept/${fromId}`, { method: 'POST' });
  if (!result || !result.ok) {
    showToast('Could not accept request', 'error');
    return;
  }
  showToast('Friend request accepted! 🎉', 'success');

  // Remove from DOM immediately
  document.querySelectorAll(`[data-from-id="${fromId}"]`).forEach(el => el.remove());

  pendingRequests = pendingRequests.filter(r => (r.from || '') !== fromId);
  updateFriendReqBadge();
  renderFriendRequests();
  loadSuggestions(); // refresh suggestions
}

async function rejectFriendRequest(fromId) {
  const result = await apiFetch(`/friends/reject/${fromId}`, { method: 'POST' });
  if (!result || !result.ok) {
    showToast('Could not reject request', 'error');
    return;
  }

  document.querySelectorAll(`[data-from-id="${fromId}"]`).forEach(el => el.remove());
  pendingRequests = pendingRequests.filter(r => (r.from || '') !== fromId);
  updateFriendReqBadge();
  renderFriendRequests();
}

// ═══════════════════════════════════════════════════════════════════
// 9. SEND FRIEND REQUEST
// ═══════════════════════════════════════════════════════════════════
async function sendFriendRequest(userId) {
  const result = await apiFetch(`/friends/request/${userId}`, { method: 'POST' });

  if (!result) return;
  if (!result.ok) {
    showToast(result.data?.error || 'Could not send request', 'warning');
    return;
  }

  // Update all "Add Friend" buttons for this user
  document.querySelectorAll(`[data-friend-btn="${userId}"]`).forEach(btn => {
    btn.textContent = 'Requested';
    btn.disabled = true;
    btn.classList.remove('btn--outline-primary');
    btn.classList.add('btn--outline-secondary');
  });

  showToast('Friend request sent!', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// 10. FOLLOW USER
// ═══════════════════════════════════════════════════════════════════
async function followUser(userId) {
  // Determine current follow state
  const followBtn = document.querySelector(`[data-follow-btn="${userId}"]`);
  const isFollowing = followBtn && followBtn.dataset.following === 'true';

  const endpoint = isFollowing ? `/unfollow/${userId}` : `/follow/${userId}`;
  const result = await apiFetch(endpoint, { method: 'POST' });

  if (!result || !result.ok) {
    showToast('Action failed', 'error');
    return;
  }

  // Toggle all follow buttons for this user
  document.querySelectorAll(`[data-follow-btn="${userId}"]`).forEach(btn => {
    const nowFollowing = !isFollowing;
    btn.dataset.following = nowFollowing ? 'true' : 'false';
    btn.textContent = nowFollowing ? 'Following' : 'Follow';
    if (nowFollowing) {
      btn.classList.remove('btn--outline-primary');
      btn.classList.add('btn--outline-secondary');
    } else {
      btn.classList.add('btn--outline-primary');
      btn.classList.remove('btn--outline-secondary');
    }
  });

  showToast(isFollowing ? 'Unfollowed' : 'Following! ✅', 'success');

  // If this was a follow-back (triggered from notification), update notif
  if (!isFollowing) {
    loadNotifications();
  }
}

// ═══════════════════════════════════════════════════════════════════
// 11. CONNECT USER (dating)
// ═══════════════════════════════════════════════════════════════════
async function connectUser(userId) {
   const result = await apiFetch(`/connect/${userId}`, { method: 'POST' });
   if (!result || !result.ok) {
     showToast('Could not connect', 'error');
     return;
   }

   const data = result.data;

   // Update connect buttons for this user
   document.querySelectorAll(`[data-connect-btn="${userId}"]`).forEach(btn => {
     btn.textContent = data.match ? '💜 Matched!' : '💜 Interested';
     btn.disabled = data.match;
     btn.classList.add('btn--match', 'matched');
   });

   if (data.match) {
     lastMatchedUserId = userId;
     const matchedUser = allUsers.find(u => u.id === userId);
     const sub = document.getElementById('matchBannerSub');
     if (sub && matchedUser) sub.textContent = `You and ${matchedUser.name} connected!`;
     // Set their avatar for the popup
     const theirAvatar = document.getElementById('matchPopupTheirAvatar');
     if (theirAvatar && matchedUser) {
       theirAvatar.src = matchedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedUser.name)}&background=ff69b4&color=fff&size=96`;
     }
     showMatchBanner();
   } else {
     showToast('Connection request sent 💜', 'success');
   }
 }

 async function acceptConnection(userId) {
   const result = await apiFetch(`/connect/accept/${userId}`, { method: 'POST' });
   if (!result || !result.ok) {
     showToast('Could not accept connection', 'error');
     return;
   }

   showToast('Connection accepted! 💜', 'success');
   
   // Update notifications
   allNotifications = allNotifications.filter(n => !(n.type === 'connect' && n.fromId === userId));
   renderNotifications(allNotifications);
   updateNotifBadge();
 }

// ═══════════════════════════════════════════════════════════════════
// 12. LOAD SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════
async function loadSuggestions() {
  if (!allUsers.length) {
    const result = await apiFetch('/users');
    if (!result || !result.ok) return;
    allUsers = result.data || [];
    chatListAllUsers = allUsers;
    renderChatList(allUsers);
    loadUnreadCounts().then(() => renderChatList(allUsers));
    loadRecentChats();
    renderStories(allUsers);
  }

  const skeleton = document.getElementById('suggestionsSkeleton');
  const suggestionsEl = document.getElementById('suggestions');
  const discoverList = document.getElementById('discoverList');

  // Exclude self
  const others = allUsers.filter(u => u.id !== currentUser.id);

  // Suggestions (right sidebar — people you may know)
  const suggestions = others.slice(0, 6);

  if (skeleton) skeleton.remove();

  const suggestionsHtml = suggestions.map(user => `
    <div class="suggestion-item">
      <div class="suggestion-item__avatar-wrap" style="position:relative;flex-shrink:0;">
        <img
          src="${user.avatar || avatarUrl(user.name)}"
          alt="${escapeHtml(user.name)}"
          class="suggestion-item__avatar"
          style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
          onerror="this.src='${avatarUrl(user.name)}'"
          onclick="window.location.href='/profile.html?id=${user.id}'"
        >
        ${onlineUserIds.has(user.id) ? `<span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>` : ''}
      </div>
      <div class="suggestion-item__info">
        <a href="/profile.html?id=${user.id}" class="suggestion-item__name">${escapeHtml(user.name)}</a>
        <span class="suggestion-item__sub">${escapeHtml(user.location || user.bio?.substring(0, 30) || 'SocialConnect member')}</span>
      </div>
      <div class="suggestion-item__actions">
        <button
          class="btn btn--outline-primary btn--xs"
          data-friend-btn="${user.id}"
          onclick="sendFriendRequest('${user.id}')"
          aria-label="Add ${escapeHtml(user.name)} as friend"
        >Add</button>
      </div>
    </div>
  `).join('');

  if (suggestionsEl) suggestionsEl.innerHTML = suggestionsHtml;

  // Discover & Date section — show 4 profiles with Connect button
  const discoverUsers = others.slice(0, 4);
  if (discoverList) {
    discoverList.innerHTML = discoverUsers.map(user => `
      <div style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) 0;border-bottom:1px solid var(--border-light);">
        <div style="position:relative;flex-shrink:0;">
          <img
            src="${user.avatar || avatarUrl(user.name)}"
            alt="${escapeHtml(user.name)}"
            style="width:48px;height:48px;border-radius:50%;object-fit:cover;cursor:pointer;"
            onclick="window.location.href='/profile.html?id=${user.id}'"
            onerror="this.src='${avatarUrl(user.name)}'"
          >
          ${onlineUserIds.has(user.id) ? `<span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>` : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <a href="/profile.html?id=${user.id}" style="font-weight:600;color:var(--text);font-size:var(--font-size-sm);display:block;truncate;">${escapeHtml(user.name)}</a>
          <span style="font-size:var(--font-size-xs);color:var(--text-secondary);">${escapeHtml(user.location || '')}</span>
          ${user.interests && user.interests.length ? `<div style="margin-top:2px;"><span class="tag tag--pink" style="font-size:10px;padding:1px 6px;">${escapeHtml(user.interests[0])}</span></div>` : ''}
        </div>
        <button
          class="btn btn--match btn--sm"
          data-connect-btn="${user.id}"
          onclick="connectUser('${user.id}')"
          aria-label="Connect with ${escapeHtml(user.name)}"
        >
          <span class="heart-icon" aria-hidden="true">💜</span>
        </button>
      </div>
    `).join('');
  }
}

function loadMoreSuggestions() {
  showToast('Loading more suggestions...', 'info');
  // In a real app this would paginate; for now just re-render
  loadSuggestions();
}

// ═══════════════════════════════════════════════════════════════════
// 13. LOAD ONLINE FRIENDS widget
// ═══════════════════════════════════════════════════════════════════
function renderOnlineFriends() {
  const container = document.getElementById('onlineFriends');
  if (!container) return;

  const countBadge = document.getElementById('onlineFriendsCount');

  const myFriends = currentUser.friends || [];
  const onlineFriendsList = allUsers.filter(u =>
    onlineUserIds.has(u.id) && myFriends.includes(u.id)
  );

  // Update the count badge in the widget title
  if (countBadge) {
    const total = onlineFriendsList.length;
    countBadge.textContent = total > 0 ? `(${total})` : '';
  }

  if (!onlineFriendsList.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-md) 0;">
        <p class="empty-state__text" style="font-size:var(--font-size-sm);">No friends online right now</p>
      </div>
    `;
    return;
  }

  container.innerHTML = onlineFriendsList.map(u => `
    <div class="chat-list-item" onclick="openChat('${u.id}', '${escapeHtml(u.name)}', '${u.avatar || avatarUrl(u.name)}')">
      <div class="chat-list-item__avatar-wrap">
        <img
          src="${u.avatar || avatarUrl(u.name)}"
          alt="${escapeHtml(u.name)}"
          class="chat-list-item__avatar"
          onerror="this.src='${avatarUrl(u.name)}'"
        >
        <span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>
      </div>
      <div class="chat-list-item__info">
        <span class="chat-list-item__name">${escapeHtml(u.name)}</span>
        <span class="chat-list-item__preview" style="color:var(--success);">Active now</span>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// 14. SEARCH USERS
// ═══════════════════════════════════════════════════════════════════
async function searchUsers(query, dropdownId = 'searchResults') {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  if (!query.trim()) {
    dropdown.classList.add('hidden');
    return;
  }

  const result = await apiFetch(`/users?q=${encodeURIComponent(query)}`);
  if (!result || !result.ok) return;

  const users = (result.data || []).filter(u => u.id !== currentUser.id).slice(0, 8);

  if (!users.length) {
    dropdown.innerHTML = `<div class="search-dropdown__empty">No results for "${escapeHtml(query)}"</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = `
    <div class="search-dropdown__section-title">People</div>
    ${users.map(u => `
      <div
        class="search-result-item"
        onclick="window.location.href='/profile.html?id=${u.id}'"
        role="option"
        tabindex="0"
        onkeydown="if(event.key==='Enter') window.location.href='/profile.html?id=${u.id}'"
      >
        <div style="position:relative;flex-shrink:0;">
          <img
            src="${u.avatar || avatarUrl(u.name)}"
            alt="${escapeHtml(u.name)}"
            class="search-result-item__avatar"
            onerror="this.src='${avatarUrl(u.name)}'"
          >
          ${onlineUserIds.has(u.id) ? `<span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>` : ''}
        </div>
        <div class="search-result-item__info">
          <span class="search-result-item__name">${highlightMatch(escapeHtml(u.name), query)}</span>
          <span class="search-result-item__meta">@${escapeHtml(u.username || '')} ${u.location ? '· ' + escapeHtml(u.location) : ''}</span>
        </div>
      </div>
    `).join('')}
  `;
  dropdown.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════════
// 15. LIKE POST
// ═══════════════════════════════════════════════════════════════════
async function likePost(postId) {
  const btn = document.getElementById(`likeBtn_${postId}`);
  const label = document.getElementById(`likeLabel_${postId}`);
  if (!btn) return;

  const wasLiked = btn.classList.contains('liked');

  // Optimistic update
  btn.classList.toggle('liked', !wasLiked);
  btn.setAttribute('aria-pressed', !wasLiked);
  if (label) label.textContent = wasLiked ? 'Like' : 'Liked';

  const result = await apiFetch(`/posts/${postId}/like`, { method: 'POST' });
  if (!result || !result.ok) {
    // Revert
    btn.classList.toggle('liked', wasLiked);
    btn.setAttribute('aria-pressed', wasLiked);
    if (label) label.textContent = wasLiked ? 'Liked' : 'Like';
    showToast('Could not like post', 'error');
    return;
  }

  // Update like count in stats bar
  const likes = result.data?.likes || [];
  updateLikeCountInDOM(postId, likes);
}

function updateLikeCountInDOM(postId, likes) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (!card) return;
  const statsBar = card.querySelector('.post-card__stats-left');
  if (!statsBar) return;

  const count = Array.isArray(likes) ? likes.length : likes;
  let reactEl = statsBar.querySelector('.post-card__reactions');
  if (count > 0) {
    if (!reactEl) {
      reactEl = document.createElement('div');
      reactEl.className = 'post-card__reactions';
      statsBar.appendChild(reactEl);
    }
    const formatCount = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    };
    reactEl.innerHTML = `
      <div class="post-card__reactions-icons"><span class="react-thumb">👍</span>${count > 1 ? '<span class="react-heart">❤️</span>' : ''}</div>
      <span>${formatCount(count)}</span>
    `;
  } else if (reactEl) {
    reactEl.remove();
  }
}

// ═══════════════════════════════════════════════════════════════════
// 16. COMMENT ON POST
// ═══════════════════════════════════════════════════════════════════
async function commentPost(postId, text) {
  if (!text || !text.trim()) return;

  const result = await apiFetch(`/posts/${postId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text: text.trim() })
  });

  if (!result || !result.ok) {
    showToast('Could not post comment', 'error');
    return;
  }

  const comment = result.data?.comment || result.data;
  if (!comment) return;

  // Ensure comment has user info
  if (!comment.user) {
    comment.user = { name: currentUser.name, avatar: currentUser.avatar, id: currentUser.id };
  }

  // Append to DOM
  const commentList = document.getElementById(`commentList_${postId}`);
  if (commentList) {
    const el = document.createElement('div');
    el.innerHTML = renderComment(comment);
    commentList.appendChild(el.firstElementChild);

    // Scroll into view
    const commentsSection = document.getElementById(`comments_${postId}`);
    if (commentsSection) commentsSection.scrollTop = commentsSection.scrollHeight;
  }

  // Update comment count in stats bar
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (card) {
    const statsRight = card.querySelector('.post-card__stats-right');
    if (statsRight) {
      let commentStat = statsRight.querySelector('.post-card__stat-item[onclick]');
      const count = (document.getElementById(`commentList_${postId}`)?.children.length) || 1;
      const formatCount = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
      };
      if (commentStat) {
        commentStat.textContent = `${formatCount(count)} comment${count !== 1 ? 's' : ''}`;
      } else {
        const btn = document.createElement('button');
        btn.className = 'post-card__stat-item';
        btn.onclick = () => toggleComments(postId);
        btn.textContent = `${formatCount(count)} comment${count !== 1 ? 's' : ''}`;
        statsRight.appendChild(btn);
      }
    }
  }
}

function handleCommentKeydown(event, postId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const text = event.target.value;
    event.target.value = '';
    commentPost(postId, text);
  }
}

function likeComment(commentId) {
  const btn = document.querySelector(`[data-comment-id="${commentId}"] .post-card__comment-like-btn`);
  if (btn) {
    const isLiked = btn.classList.toggle('liked');
    btn.textContent = isLiked ? 'Liked' : 'Like';
    if (isLiked) btn.style.color = 'var(--primary)';
    else btn.style.color = '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// 16b. MINIMIZE POST
// ═══════════════════════════════════════════════════════════════════
function toggleMinimizePost(postId) {
  const card = document.querySelector(`article[data-post-id="${postId}"]`);
  if (!card) return;

  if (card.classList.contains('minimized')) {
    card.classList.remove('minimized');
    const body = card.querySelector('.post-card__body');
    if (body) body.style.display = '';
    const btn = card.querySelector('.post-card__minimize-btn');
    if (btn) {
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="9 8 5 12 9 16"/></svg>';
      btn.title = 'Minimize';
    }
    return;
  }

  const body = card.querySelector('.post-card__body');
  const hasContent = body && body.innerHTML.trim().length > 20;
  const btn = card.querySelector('.post-card__minimize-btn');

  if (!hasContent) {
    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => card.remove(), 300);
    return;
  }

  card.classList.add('minimized');
  if (body) body.style.display = 'none';
  const comments = card.querySelector('.post-card__comments');
  if (comments) comments.classList.add('hidden');
  if (btn) {
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="15 8 19 12 15 16"/></svg>';
    btn.title = 'Expand';
  }
}

// ═══════════════════════════════════════════════════════════════════
// 17. DELETE POST
// ═══════════════════════════════════════════════════════════════════
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;

  const result = await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
  if (!result || !result.ok) {
    showToast('Could not delete post', 'error');
    return;
  }

  // Remove from DOM
  removePostFromDOM(postId);
  showToast('Post deleted', 'success');

  // Check if feed is now empty
  const container = document.getElementById('feedContainer');
  if (container && !container.children.length) {
    const emptyState = document.getElementById('feedEmpty');
    if (emptyState) emptyState.classList.remove('hidden');
  }
}

function removePostFromDOM(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if (card) {
    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.97)';
    setTimeout(() => card.remove(), 300);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 18. TIME AGO
// ═══════════════════════════════════════════════════════════════════
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return '';

  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 5) return 'Just now';
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 120) return '1 minute ago';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200) return '1 hour ago';
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return 'Yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}

// ═══════════════════════════════════════════════════════════════════
// 19. LOGOUT
// ═══════════════════════════════════════════════════════════════════
function logout() {
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_user');
  window.location.href = '/index.html';
}

// ═══════════════════════════════════════════════════════════════════
// SOCKET EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

socket.on('user_online', ({ userId, online }) => {
  if (online) {
    onlineUserIds.add(userId);
  } else {
    onlineUserIds.delete(userId);
  }

  // Update all online dots in DOM for this user
  document.querySelectorAll(`[data-user-id="${userId}"] .online-dot`).forEach(dot => {
    dot.style.display = online ? 'block' : 'none';
  });

  // Refresh online friends widget
  renderOnlineFriends();
});

socket.on('newPost', (data) => {
  const post = data.post || data;
  // Don't add own posts (already added via advanced post)
  if (post.authorId === currentUser.id) return;

  // Enrich with author info if available
  if (data.fromUser && !post.author) {
    post.author = data.fromUser;
  }

  const container = document.getElementById('feedContainer');
  if (!container) return;

  const el = createPostElement(post);
  el.style.opacity = '0';
  el.style.transform = 'translateY(-12px)';
  container.prepend(el);
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  showToast(`${post.author?.name || 'Someone'} posted something new`, 'info');
});

socket.on('delete_post', (postId) => {
  removePostFromDOM(postId);
});

socket.on('post_like', ({ postId, likes }) => {
  updateLikeCountInDOM(postId, likes);

  const btn = document.getElementById(`likeBtn_${postId}`);
  const label = document.getElementById(`likeLabel_${postId}`);
  if (!btn) return;

  const liked = Array.isArray(likes)
    ? likes.includes(currentUser.id)
    : false;

  btn.classList.toggle('liked', liked);
  btn.setAttribute('aria-pressed', liked);
  if (label) label.textContent = liked ? 'Liked' : 'Like';
});

socket.on('new_comment', ({ postId, comment }) => {
  if (!comment.user) {
    comment.user = allUsers.find(u => u.id === comment.userId) || {};
  }

  const commentList = document.getElementById(`commentList_${postId}`);
  if (commentList) {
    // Don't duplicate own comment (already added optimistically)
    if (comment.userId === currentUser.id) return;
    const el = document.createElement('div');
    el.innerHTML = renderComment(comment);
    commentList.appendChild(el.firstElementChild);
  }
});

socket.on('notification', (notif) => {
  // Enrich with user data
  if (notif.fromId) {
    const fromUser = allUsers.find(u => u.id === notif.fromId);
    if (fromUser) {
      notif.fromName = fromUser.name;
      notif.fromAvatar = fromUser.avatar;
    }
  }
  notif.priority = notif.priority || 'medium';
  allNotifications.unshift(notif);
  updateNotifBadge();

  // If notif dropdown is open, refresh it
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    renderNotifications(allNotifications);
    // Animate the first (newest) notification
    const firstItem = dropdown.querySelector('.notification-item');
    if (firstItem) firstItem.classList.add('new-notif');
  }

  // Show toast with icon based on priority
  const priorityIcons = { high: '🔴', medium: '🔵', low: '🔔' };
  const icon = priorityIcons[notif.priority] || '🔔';
  showToast(`${icon} ${notif.text || 'New notification'}`, 'info', notif.priority === 'high' ? 6000 : 4000);

  // Play notification sound for high priority
  if (notif.priority === 'high') {
    playNotifSound();
  }

  // Show match popup when a "match" notification arrives via socket
  if (notif.type === 'match' && notif.fromId) {
    lastMatchedUserId = notif.fromId;
    const sub = document.getElementById('matchBannerSub');
    if (sub && notif.fromName) sub.textContent = `You and ${notif.fromName} connected!`;
    showMatchBanner();
  }
});

socket.on('new_message_notif', ({ from, text, time }) => {
  // from can be an object { id, name, ... } or a string ID
  const senderId = typeof from === 'object' ? (from.id || from._id) : from;
  const senderName = typeof from === 'object' ? (from.name || 'Someone') : 'Someone';
  const senderAvatar = typeof from === 'object' ? (from.avatar || '') : '';

  // Play sweet love tone
  playMessageTone();

  // Update per-user unread count
  if (senderId) {
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    updateChatLauncherBadge();
  }

  // Show toast with sender info
  showToast(`💬 ${senderName}: ${text}`, 'info', 5000, () => {
    openChat(senderId, senderName, senderAvatar);
  });

  // Live browser notification (only when permission granted)
  notifyBrowser(`💬 ${senderName}`, text, senderAvatar);
});

// ─── Browser Notifications (live notification system) ─────────────────────────
function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try { Notification.requestPermission(); } catch {}
}

function notifyBrowser(title, body, icon) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon, tag: 'sc-new-message', silent: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

// Position preview popup near the mouse cursor (Facebook-style)
function positionPreview(e, el) {
  const x = e.clientX + 16;
  const y = e.clientY + 16;
  const w = el.offsetWidth || 200;
  const h = el.offsetHeight || 200;
  const maxX = window.innerWidth - w - 10;
  const maxY = window.innerHeight - h - 10;
  el.style.left = Math.min(x, maxX) + 'px';
  el.style.top = Math.min(y, maxY) + 'px';
}

// ═══════════════════════════════════════════════════════════════════
// EMOJI / GIF / STICKER PICKER DATA
// ═══════════════════════════════════════════════════════════════════
let emojiData = null;
let gifLibrary = [];
let stickerLibrary = [];

async function loadEmojiData() {
  try {
    const res = await fetch(`${API}/emoji`, { headers: HEADERS() });
    const json = await res.json();
    if (json.success) emojiData = json.data;
  } catch (e) { console.error('loadEmojiData error:', e); }
}

async function loadGifLibrary() {
  try {
    const res = await fetch(`${API}/gifs`, { headers: HEADERS() });
    const json = await res.json();
    if (json.success) gifLibrary = json.data;
  } catch (e) { /* ignore */ }
}

// Paginated sticker loader — loads first page eagerly, rest on demand
let stickerPage = 0;
let stickerHasMore = true;
let stickerLoading = false;

async function loadStickerLibrary(page = 0) {
  if (stickerLoading) return;
  stickerLoading = true;
  try {
    const res = await fetch(`${API}/stickers?page=${page}&limit=80`, { headers: HEADERS() });
    const json = await res.json();
    if (json.success) {
      if (page === 0) {
        stickerLibrary = json.data;
      } else {
        stickerLibrary = [...stickerLibrary, ...json.data];
      }
      stickerPage = json.page;
      stickerHasMore = json.hasMore;
    }
  } catch (e) { /* ignore */ }
  stickerLoading = false;
}

// Fallback: if a locally-served GIF/sticker fails to load, try CDN
function giphyFallback(img) {
  var src = img.getAttribute('src');
  if (!src) return;
  img.onerror = null;
  var gifMatch = src.match(/\/media\/gifs\/(.+)\.gif/);
  if (gifMatch) {
    img.src = 'https://media0.giphy.com/media/' + gifMatch[1] + '/giphy.gif';
    return;
  }
  img.style.display = 'none';
  var placeholder = document.createElement('span');
  placeholder.className = 'chat-media-fallback';
  placeholder.textContent = '⚠';
  placeholder.style.cssText = 'font-size:24px;opacity:0.5;display:flex;align-items:center;justify-content:center;width:100%;height:100%;';
  if (img.parentNode) img.parentNode.appendChild(placeholder);
}

function toggleMediaPicker(userId, pickerType) {
  const existing = document.querySelector(`[data-chat-picker="${userId}"]`);
  if (existing) {
    if (existing.dataset.pickerType === pickerType) {
      existing.remove();
      return;
    }
    existing.remove();
  }
  const picker = document.createElement('div');
  picker.className = 'chat-media-picker';
  picker.setAttribute('data-chat-picker', userId);
  picker.setAttribute('data-picker-type', pickerType);
  picker.style.pointerEvents = 'all';

  if (pickerType === 'emoji') {
    renderEmojiPicker(picker, userId);
  } else if (pickerType === 'gif') {
    renderGifPicker(picker, userId);
  } else if (pickerType === 'sticker') {
    renderStickerPicker(picker, userId);
  }

  const inputArea = document.querySelector(`[data-chat-user-id="${userId}"] .chat-window__input-area`);
  if (inputArea) {
    inputArea.parentNode.insertBefore(picker, inputArea);
  }
}

function renderEmojiPicker(picker, userId) {
  const cats = emojiData ? Object.keys(emojiData) : [];
  let activeCat = cats[0] || 'Smileys';

  const header = document.createElement('div');
  header.className = 'chat-media-picker__tabs';
  header.innerHTML = cats.map(c => `
    <button class="chat-media-picker__tab${c === activeCat ? ' active' : ''}" data-cat="${c}">${c}</button>
  `).join('');

  const body = document.createElement('div');
  body.className = 'chat-media-picker__body';

  function renderCategory(cat) {
    const emojis = (emojiData && emojiData[cat]) || [];
    body.innerHTML = `<div class="chat-media-picker__grid">${emojis.map(e => {
      if (typeof e === 'object' && e.url) {
        return `<button class="chat-media-picker__emoji" data-type="animated" data-url="${e.url}" data-name="${escapeHtml(e.name || '')}" title="${escapeHtml(e.name || '')}">
          <img src="${e.url}" alt="${escapeHtml(e.name || '')}" loading="lazy" onerror="giphyFallback(this)">
        </button>`;
      }
      return `<button class="chat-media-picker__emoji" data-type="static" data-char="${e}">${e}</button>`;
    }).join('')}</div>`;

    body.querySelectorAll('.chat-media-picker__emoji').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.type === 'animated') {
          sendMediaMessage(userId, 'emoji', btn.dataset.url, btn.dataset.name);
        } else {
          sendMediaMessage(userId, 'emoji', null, btn.dataset.char);
        }
        const pickerEl = document.querySelector(`[data-chat-picker="${userId}"]`);
        if (pickerEl) pickerEl.remove();
      });
    });
  }

  renderCategory(activeCat);

  header.addEventListener('click', (e) => {
    const tab = e.target.closest('.chat-media-picker__tab');
    if (!tab) return;
    header.querySelectorAll('.chat-media-picker__tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderCategory(tab.dataset.cat);
  });

  if (!emojiData) {
    body.innerHTML = '<div style="padding:var(--space-md);text-align:center;color:var(--text-muted);">Loading emojis...</div>';
    loadEmojiData();
  }

  picker.appendChild(header);
  picker.appendChild(body);
}

// GIF category definitions (mapped to GIF_NAMES keywords)
const GIF_CATEGORIES = [
  { label: '🔥 All',       filter: '' },
  { label: '🎉 Party',     filter: 'party|celebrat|confetti|cheer|yay' },
  { label: '❤️ Love',      filter: 'love|heart|kiss|hug|cute|blush' },
  { label: '😂 Funny',     filter: 'lol|funny|laugh|joke|wow|omg|mindblown' },
  { label: '💃 Dance',     filter: 'danc|groove|spin|jump' },
  { label: '👋 Greetings', filter: 'wave|hi|bye|goodbye|hello' },
  { label: '😢 Feelings',  filter: 'sad|cry|happy|joy|smile|mad|angr' },
];

function renderGifPicker(picker, userId) {
  picker.setAttribute('data-gif-picker', userId);

  const header = document.createElement('div');
  header.className = 'chat-media-picker__header';
  header.innerHTML = `
    <div class="chat-media-picker__search">
      <input class="chat-media-picker__search-input" type="text" placeholder="🔍 Search GIFs..." autocomplete="off">
    </div>
    <div class="chat-media-picker__tabs">
      ${GIF_CATEGORIES.map((c, i) => `<button class="chat-media-picker__tab${i === 0 ? ' active' : ''}" data-filter="${c.filter}">${c.label}</button>`).join('')}
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'chat-media-picker__body';

  // Hover preview element
  const preview = document.createElement('div');
  preview.className = 'chat-media-picker__preview hidden';
  preview.innerHTML = '<img class="chat-media-picker__preview-img" src="" alt="">';
  picker.appendChild(preview);

  function renderGifs(query, categoryFilter) {
    if (!gifLibrary.length) {
      body.innerHTML = `
        <div style="padding:var(--space-lg);text-align:center;color:var(--text-muted);font-size:12px;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>Loading GIFs…
        </div>`;
      // Retry once more
      loadGifLibrary().then(() => renderGifs(query, categoryFilter));
      return;
    }
    const q = query.toLowerCase().trim();
    const catRe = categoryFilter ? new RegExp(categoryFilter, 'i') : null;
    let filtered = gifLibrary;
    if (q) filtered = filtered.filter(g => g.name.toLowerCase().includes(q));
    else if (catRe) filtered = filtered.filter(g => catRe.test(g.name));

    if (!filtered.length) {
      body.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No GIFs found 😔</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'chat-media-picker__grid chat-media-picker__grid--gif';
    grid.innerHTML = filtered.map(g => `
      <button class="chat-media-picker__media chat-media-picker__media--gif"
              data-cdn="${escapeHtml(g.cdnUrl || '')}"
              data-url="${escapeHtml(g.url)}"
              data-name="${escapeHtml(g.name)}"
              title="${escapeHtml(g.name)}">
        <img src="${g.url}" alt="${escapeHtml(g.name)}" loading="lazy"
             onerror="this.src='${escapeHtml(g.cdnUrl || g.url)}'">
        <span class="chat-media-picker__media-label">${escapeHtml(g.name)}</span>
      </button>
    `).join('');

    // Hover preview — positioned at mouse like Facebook
    grid.querySelectorAll('.chat-media-picker__media--gif').forEach(btn => {
      btn.addEventListener('mouseenter', (e) => {
        const img = preview.querySelector('img');
        img.src = btn.dataset.cdn || btn.dataset.url;
        img.alt = btn.dataset.name;
        preview.classList.remove('hidden');
        positionPreview(e, preview);
      });
      btn.addEventListener('mousemove', (e) => positionPreview(e, preview));
      btn.addEventListener('mouseleave', () => preview.classList.add('hidden'));
      btn.addEventListener('click', () => {
        sendMediaMessage(userId, 'gif', btn.dataset.url, btn.dataset.name);
        preview.classList.add('hidden');
      });
    });

    body.innerHTML = '';
    body.appendChild(grid);
  }

  let activeCatFilter = '';
  let debounceTimer;
  const searchInput = header.querySelector('.chat-media-picker__search-input');

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderGifs(searchInput.value, ''), 200);
  });

  header.querySelectorAll('.chat-media-picker__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      header.querySelectorAll('.chat-media-picker__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCatFilter = tab.dataset.filter;
      searchInput.value = '';
      renderGifs('', activeCatFilter);
    });
  });

  renderGifs('', '');
  picker.appendChild(header);
  picker.appendChild(body);
}

function renderStickerPicker(picker, userId) {
  picker.setAttribute('data-sticker-picker', userId);

  const header = document.createElement('div');
  header.className = 'chat-media-picker__header';
  header.innerHTML = `
    <div class="chat-media-picker__search">
      <input class="chat-media-picker__search-input" type="text" placeholder="🔍 Search stickers..." autocomplete="off">
    </div>
    <div class="chat-media-picker__tabs">
      <button class="chat-media-picker__tab active" data-type="all">🎨 All</button>
      <button class="chat-media-picker__tab" data-type="gif">🎞️ Animated</button>
      <button class="chat-media-picker__tab" data-type="png">🖼️ Art</button>
      <button class="chat-media-picker__tab" data-type="svg">✨ Vector</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'chat-media-picker__body';

  // Hover preview
  const preview = document.createElement('div');
  preview.className = 'chat-media-picker__preview hidden';
  preview.innerHTML = '<img class="chat-media-picker__preview-img chat-media-picker__preview-img--sticker" src="" alt="">';
  picker.appendChild(preview);

  let activeType = 'all';
  let searchQuery = '';
  let renderPage = 0;
  let rendering = false;

  function getStickerUrl(url) {
    // Ensure spaces are encoded
    return url.replace(/ /g, '%20');
  }

  function getFilteredStickers() {
    let data = stickerLibrary;
    if (searchQuery) data = data.filter(s => s.name.toLowerCase().includes(searchQuery));
    if (activeType !== 'all') data = data.filter(s => {
      const ext = (s.url.split('.').pop() || '').toLowerCase().split('?')[0];
      return ext === activeType;
    });
    return data;
  }

  function renderStickers(reset = false) {
    if (rendering) return;
    rendering = true;

    if (!stickerLibrary.length) {
      body.innerHTML = `
        <div style="padding:var(--space-lg);text-align:center;color:var(--text-muted);font-size:12px;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>Loading stickers…
        </div>`;
      loadStickerLibrary(0).then(() => { rendering = false; renderStickers(true); });
      return;
    }

    if (reset) {
      renderPage = 0;
      body.innerHTML = '';
    }

    const PAGE_SIZE = 40;
    const filtered = getFilteredStickers();
    const start = renderPage * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    if (!slice.length && renderPage === 0) {
      body.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No stickers found 😔</div>`;
      rendering = false;
      return;
    }

    // Remove existing load-more sentinel
    const oldSentinel = body.querySelector('.sticker-load-more');
    if (oldSentinel) oldSentinel.remove();

    // Append new items
    let grid = body.querySelector('.chat-media-picker__grid--sticker');
    if (!grid || reset) {
      grid = document.createElement('div');
      grid.className = 'chat-media-picker__grid chat-media-picker__grid--sticker';
      body.appendChild(grid);
    }

    slice.forEach(s => {
      const safeUrl = getStickerUrl(s.url);
      const btn = document.createElement('button');
      btn.className = 'chat-media-picker__media chat-media-picker__media--sticker';
      btn.dataset.url = safeUrl;
      btn.dataset.name = s.name;
      btn.title = s.name;
      btn.innerHTML = `<img src="${safeUrl}" alt="${escapeHtml(s.name)}" loading="lazy" onerror="this.style.opacity='0.3'">`;

      btn.addEventListener('mouseenter', (e) => {
        const img = preview.querySelector('img');
        img.src = safeUrl;
        img.alt = s.name;
        preview.classList.remove('hidden');
        positionPreview(e, preview);
      });
      btn.addEventListener('mousemove', (e) => positionPreview(e, preview));
      btn.addEventListener('mouseleave', () => preview.classList.add('hidden'));
      btn.addEventListener('click', () => {
        sendMediaMessage(userId, 'sticker', safeUrl, s.name);
        preview.classList.add('hidden');
      });
      grid.appendChild(btn);
    });

    renderPage++;
    const hasMore = (renderPage * PAGE_SIZE) < filtered.length;

    if (hasMore) {
      const sentinel = document.createElement('div');
      sentinel.className = 'sticker-load-more';
      sentinel.style.cssText = 'text-align:center;padding:8px;color:var(--text-muted);font-size:11px;grid-column:1/-1;cursor:pointer;';
      sentinel.textContent = '▼ Load more';
      sentinel.addEventListener('click', () => renderStickers(false));
      body.appendChild(sentinel);
    }

    rendering = false;
  }

  // Infinite scroll
  body.addEventListener('scroll', () => {
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 40) {
      renderStickers(false);
    }
  });

  // Search
  let debounceTimer;
  const searchInput = header.querySelector('.chat-media-picker__search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = searchInput.value.toLowerCase().trim();
      renderStickers(true);
    }, 200);
  });

  // Type tabs
  header.querySelectorAll('.chat-media-picker__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      header.querySelectorAll('.chat-media-picker__tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeType = tab.dataset.type;
      renderStickers(true);
    });
  });

  renderStickers(true);
  picker.appendChild(header);
  picker.appendChild(body);
}

function sendMediaMessage(toUserId, mediaType, mediaUrl, name) {
  const text = name || '';
  socket.emit('send_message', { toUserId, text, type: mediaType, mediaUrl, mediaType });
  // Optimistically append
  appendChatBubble(toUserId, {
    text,
    type: mediaType,
    mediaUrl,
    mediaType,
    senderId: currentUser.id,
    time: new Date().toISOString()
  });
  // Close picker
  const picker = document.querySelector(`[data-chat-picker="${toUserId}"]`);
  if (picker) picker.remove();
}

// ═══════════════════════════════════════════════════════════════════
// CHAT SYSTEM
// ═══════════════════════════════════════════════════════════════════

// --- Chat List Panel ---
function updateChatLauncherBadge() {
  const badge = document.getElementById('chatLauncherBadge');
  if (!badge) return;
  if (totalUnread > 0) {
    badge.textContent = formatBadgeCount(totalUnread);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleChatListPanel() {
  const panel = document.getElementById('chatListPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);

  if (isHidden) {
    // Load fresh unread counts then populate
    loadUnreadCounts().then(() => {
      renderChatList(chatListAllUsers);
    });
    // Ask once for browser notifications (needs a user gesture)
    requestNotificationPermission();
    // Clear the badge when opening panel
    totalUnread = 0;
    updateChatLauncherBadge();
  }
}

// Load unread message counts from server
async function loadUnreadCounts() {
  try {
    const result = await apiFetch('/chat/unread/counts');
    if (result && result.ok) {
      unreadCounts = result.data.counts || {};
      totalUnread = result.data.total || 0;
    }
  } catch (e) { /* ignore */ }
}

function formatBadgeCount(count) {
  if (!count || count <= 0) return '';
  return count >= 100 ? '99+' : String(count);
}

function renderChatList(users) {
  const list = document.getElementById('chatListItems');
  if (!list) return;

  const others = users.filter(u => u.id !== currentUser.id);
  if (!others.length) {
    list.innerHTML = `<div style="padding:var(--space-lg);text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">No conversations yet</div>`;
    return;
  }

  // Sort: most recently active conversations first (WhatsApp-style), then unread, then name
  const sorted = [...others].sort((a, b) => {
    const aTime = recentChats[a.id] ? new Date(recentChats[a.id].updatedAt).getTime() : 0;
    const bTime = recentChats[b.id] ? new Date(recentChats[b.id].updatedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    return a.name.localeCompare(b.name);
  });

  list.innerHTML = sorted.map(u => {
    const uc = unreadCounts[u.id] || 0;
    const rc = recentChats[u.id];
    const badgeText = formatBadgeCount(uc);
    const preview = uc > 0
      ? `${uc} unread message${uc !== 1 ? 's' : ''}`
      : (rc ? lastMessagePreview(rc.lastMessage) : (onlineUserIds.has(u.id) ? 'Active now' : 'Tap to message'));
    const timeStr = rc ? formatChatListTime(rc.updatedAt) : '';
    return `
    <div
      class="chat-list-item${uc > 0 ? ' unread' : ''}"
      role="listitem"
      onclick="openChat('${u.id}', '${escapeHtml(u.name)}', '${u.avatar || avatarUrl(u.name)}')"
      tabindex="0"
      onkeydown="if(event.key==='Enter') openChat('${u.id}', '${escapeHtml(u.name)}', '${u.avatar || avatarUrl(u.name)}')"
      aria-label="Chat with ${escapeHtml(u.name)}${uc > 0 ? ', ' + uc + ' unread messages' : ''}"
    >
      <div class="chat-list-item__avatar-wrap" style="position:relative;">
        <img
          src="${u.avatar || avatarUrl(u.name)}"
          alt="${escapeHtml(u.name)}"
          class="chat-list-item__avatar"
          onerror="this.src='${avatarUrl(u.name)}'"
        >
        ${onlineUserIds.has(u.id) ? `<span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>` : ''}
        ${uc > 0 ? `<span class="chat-list-item__badge">${badgeText}</span>` : ''}
      </div>
      <div class="chat-list-item__info">
        <span class="chat-list-item__name">${escapeHtml(u.name)}</span>
        <span class="chat-list-item__preview">${escapeHtml(preview)}</span>
      </div>
      <div class="chat-list-item__meta">
        <span class="chat-list-item__time">${timeStr}</span>
        ${uc > 0 ? '<span class="chat-list-item__unread-dot"></span>' : ''}
      </div>
    </div>
  `}).join('');
}

// --- WhatsApp-style recent chats ---
async function loadRecentChats() {
  const result = await apiFetch('/chat/recent');
  if (!result || !result.ok) return;
  const recents = result.data || [];
  recentChats = {};
  recents.forEach(r => {
    if (r.user && r.user.id) recentChats[r.user.id] = r;
  });
  renderChatList(chatListAllUsers);
}

function updateRecentChat(userId, message) {
  if (!userId || !message) return;
  const user = allUsers.find(u => u.id === userId);
  recentChats[userId] = {
    user: user || { id: userId },
    lastMessage: message,
    updatedAt: message.time || new Date().toISOString(),
  };
  renderChatList(chatListAllUsers);
}

function lastMessagePreview(m) {
  if (!m) return '';
  const type = m.type || 'text';
  if (type === 'audio') return '🎤 Voice message';
  if (type === 'gif') return '🎞️ GIF';
  if (type === 'sticker') return '🎭 Sticker';
  if (type === 'emoji') return m.text || '';
  if (type === 'image') return '🖼️ Photo';
  if (type === 'video') return '🎬 Video';
  if (type === 'file') return '📎 ' + (m.fileName || 'File');
  return m.text || '';
}

function formatChatListTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function filterChatList(query) {
  const filtered = query.trim()
    ? chatListAllUsers.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(query.toLowerCase())
      )
    : chatListAllUsers;
  renderChatList(filtered);
}

// --- Open Chat Window ---
function openChat(userId, userName, userAvatar) {
  // Close chat list panel
  const panel = document.getElementById('chatListPanel');
  if (panel) panel.classList.add('hidden');

  // Reset unread count for this user
  if (unreadCounts[userId]) {
    delete unreadCounts[userId];
    totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    updateChatLauncherBadge();
    // Re-render chat list if panel is open
    if (panel && !panel.classList.contains('hidden')) {
      renderChatList(chatListAllUsers);
    }
  }

  // If window already open, focus it
  if (openChatWindows[userId]) {
    const existing = openChatWindows[userId];
    existing.style.display = 'flex';
    existing.querySelector('.chat-window__input') && existing.querySelector('.chat-window__input').focus();
    return;
  }

  // Max 3 windows — close oldest if needed
  const windowIds = Object.keys(openChatWindows);
  if (windowIds.length >= 3) {
    const oldestId = windowIds[0];
    closeChatWindow(oldestId);
  }

  // Join socket room
  socket.emit('join_chat', { withUserId: userId });

  // Create window
  const win = document.createElement('div');
  win.className = 'chat-window';
  win.setAttribute('data-chat-user-id', userId);
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', `Chat with ${userName}`);
  win.style.pointerEvents = 'all';

  const isOnline = onlineUserIds.has(userId);

  win.innerHTML = `
    <div class="chat-window__header">
      <img
        src="${userAvatar}"
        alt="${escapeHtml(userName)}"
        class="chat-window__header-avatar"
        onerror="this.src='${avatarUrl(userName)}'"
        onclick="window.location.href='/profile.html?id=${userId}'"
        style="cursor:pointer;"
      >
      <div class="chat-window__header-info">
        <span class="chat-window__header-name">${escapeHtml(userName)}</span>
        <span class="chat-window__header-status" id="chatStatus_${userId}">${isOnline ? 'Active now' : 'Offline'}</span>
      </div>
      <div class="chat-window__header-actions">
        <button class="chat-window__header-btn chat-window__call-btn" onclick="startCall('${userId}', '${escapeHtml(userName)}', '${userAvatar}', 'audio')" aria-label="Audio call" title="Audio call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
        <button class="chat-window__header-btn chat-window__call-btn" onclick="startCall('${userId}', '${escapeHtml(userName)}', '${userAvatar}', 'video')" aria-label="Video call" title="Video call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <button class="chat-window__header-btn chat-window__call-btn" onclick="startGroupCallFromChat('${userId}', '${escapeHtml(userName)}', '${userAvatar}')" aria-label="Group call" title="Group Call" style="font-size:14px;font-weight:700;">👥</button>
        <button class="chat-theme-btn" onclick="openThemePicker('${userId}')" aria-label="Chat theme" title="Chat Theme">🎨</button>
        
        <button class="chat-window__header-btn" onclick="closeChatWindow('${userId}')" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="chat-window__messages" id="chatMessages_${userId}">
      <div style="text-align:center;padding:var(--space-md);color:var(--text-muted);font-size:var(--font-size-sm);">
        Loading messages...
      </div>
    </div>
    <div id="chatTyping_${userId}" class="chat-typing hidden" aria-live="polite">
      <div class="chat-typing__dot"></div>
      <div class="chat-typing__dot"></div>
      <div class="chat-typing__dot"></div>
      <span class="chat-typing__label">typing…</span>
    </div>
    <div class="chat-window__input-area" id="chatInputArea_${userId}">
      <div class="chat-window__picker-toolbar">
        <button class="chat-window__picker-btn" onclick="toggleMediaPicker('${userId}', 'emoji')" aria-label="Emoji picker" title="Emoji">😊</button>
        <button class="chat-window__picker-btn" onclick="toggleMediaPicker('${userId}', 'gif')" aria-label="GIF picker" title="GIF">GIF</button>
        <button class="chat-window__picker-btn" onclick="toggleMediaPicker('${userId}', 'sticker')" aria-label="Sticker picker" title="Sticker">🎯</button>
      </div>
      <div class="chat-window__input-mode" id="chatInputMode_${userId}">
        <button class="chat-window__mic-btn" id="voiceBtn_${userId}" onmousedown="startVoiceRecording('${userId}')" onmouseup="stopVoiceRecording('${userId}')" onmouseleave="if(voiceRecorders['${userId}'])cancelVoiceRecording('${userId}')" ontouchstart="startVoiceRecording('${userId}')" ontouchend="stopVoiceRecording('${userId}')" aria-label="Hold to record voice message" title="Hold to record">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <div class="chat-window__attach-wrap">
          <button class="chat-window__attach-btn" id="attachBtn_${userId}" onclick="handleAttachClick('${userId}')" aria-label="Attach file" title="Attach file">+</button>
          <div class="chat-window__attach-menu hidden" id="attachMenu_${userId}">
            <button onclick="showFilePicker('${userId}')" title="Select Files"><span>📁</span> Files</button>
            <button onclick="showFolderPicker('${userId}')" title="Select Folder"><span>📂</span> Folder</button>
          </div>
        </div>
        <input type="file" id="fileInput_${userId}" multiple style="position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0" onchange="handleFilesSelected('${userId}', event)">
        <input type="file" id="folderInput_${userId}" multiple webkitdirectory style="position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0" onchange="handleFilesSelected('${userId}', event)">
        <button class="chat-window__send-btn" onclick="sendMessageFromInput('${userId}')" aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
        <input
          type="text"
          class="chat-window__input"
          id="chatInput_${userId}"
          placeholder="Aa"
          aria-label="Type a message"
          data-chat-user-id="${userId}"
          onkeydown="handleChatKeydown(event, '${userId}')"
          oninput="handleChatTyping('${userId}')"
          autocomplete="off"
        >
      </div>
      
      <div class="voice-recording-overlay hidden" id="recordingOverlay_${userId}">
        <div class="voice-recording-overlay__waveform" id="recordingWaveform_${userId}">
          ${Array.from({ length: 15 }, (_, i) => `<div class="voice-recording-overlay__bar" style="animation-delay:${(i * 0.1).toFixed(1)}s"></div>`).join('')}
        </div>
        <div class="voice-recording-overlay__timer" id="recordingTime_${userId}">0:00</div>
        <div class="voice-recording-overlay__hint">Release to stop · Slide to cancel</div>
        <button class="voice-recording-overlay__cancel" onclick="cancelVoiceRecording('${userId}')" aria-label="Cancel recording">✕</button>
      </div>
      <div class="voice-preview-overlay hidden" id="voicePreview_${userId}">
        <div class="voice-preview-overlay__waveform">
          ${Array.from({ length: 30 }, (_, i) => `<div class="voice-preview-overlay__bar" style="height:${3 + Math.random() * 18}px"></div>`).join('')}
        </div>
        <button class="voice-preview-overlay__play" id="voicePreviewPlay_${userId}" onclick="playVoicePreview('${userId}')" aria-label="Play preview">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <span class="voice-preview-overlay__time" id="voicePreviewTime_${userId}">0:00</span>
        <div class="voice-preview-overlay__actions">
          <button class="voice-preview-overlay__btn voice-preview-overlay__btn--delete" onclick="deleteVoicePreview('${userId}')" aria-label="Delete recording" title="Delete">✕</button>
          <button class="voice-preview-overlay__btn voice-preview-overlay__btn--send" onclick="sendVoiceFromPreview('${userId}')" aria-label="Send voice message" title="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <audio id="voicePreviewAudio_${userId}" preload="none" style="display:none;"></audio>
      </div>
    </div>
  
      <div class="chat-file-preview hidden" id="filePreview_${userId}">
        <div class="chat-file-preview__header">
          <span class="chat-file-preview__title">Attached Files</span>
          <button class="chat-file-preview__close" onclick="cancelFilePreview('${userId}')" aria-label="Cancel">✕</button>
        </div>
        <div class="chat-file-preview__list" id="filePreviewList_${userId}"></div>
        <div class="chat-file-preview__footer">
          <span class="chat-file-preview__info" id="filePreviewInfo_${userId}">0 files</span>
          <div class="chat-file-preview__actions">
            <button class="chat-file-preview__btn chat-file-preview__btn--add" onclick="showFilePicker('${userId}')">+ Files</button>
            <button class="chat-file-preview__btn chat-file-preview__btn--add" onclick="showFolderPicker('${userId}')">+ Folder</button>
            <button class="chat-file-preview__btn chat-file-preview__btn--send hidden" id="sendAllBtn_${userId}" onclick="sendFilePreview('${userId}')">Send All</button>
          </div>
        </div>
      </div>
    `;

  const container = document.getElementById('chatWindowsContainer');
  if (container) container.appendChild(win);
  openChatWindows[userId] = win;

  // Apply saved theme
  const savedTheme = currentUser.chatTheme || 'default';
  applyChatTheme(userId, savedTheme);

  // Load history
  loadChatHistory(userId);

  // Mark any pending messages as read (WhatsApp-style read receipts)
  socket.emit('mark_read', { withUserId: userId });

  // Focus input
  setTimeout(() => {
    const input = document.getElementById(`chatInput_${userId}`);
    if (input) input.focus();
  }, 100);
}

function minimizeChatWindow(userId) {
  const win = openChatWindows[userId];
  if (!win) return;
  const msgs = win.querySelector('.chat-window__messages');
  const inputArea = win.querySelector('.chat-window__input-area');
  const typing = document.getElementById(`chatTyping_${userId}`);
  const isMinimized = win.dataset.minimized === 'true';

  [msgs, inputArea, typing].forEach(el => {
    if (el) el.style.display = isMinimized ? '' : 'none';
  });
  win.dataset.minimized = isMinimized ? 'false' : 'true';
}

function closeChatWindow(userId) {
  const win = openChatWindows[userId];
  if (win) {
    win.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    win.style.opacity = '0';
    win.style.transform = 'translateY(10px)';
    setTimeout(() => {
      win.remove();
      delete openChatWindows[userId];
    }, 200);
  }
}

// --- Load Chat History ---
async function loadChatHistory(userId) {
  const msgContainer = document.getElementById(`chatMessages_${userId}`);
  if (!msgContainer) return;

  const result = await apiFetch(`/chat/${userId}`);
  if (!result || !result.ok) {
    msgContainer.innerHTML = `<div style="text-align:center;padding:var(--space-md);color:var(--text-muted);font-size:var(--font-size-sm);">Could not load messages</div>`;
    return;
  }

  const messages = result.data || [];
  renderChatHistory(userId, messages);
}

// ─── Message status ticks (WhatsApp-style ✓ / ✓✓) ────────────────────────────
const TICK_SINGLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
const TICK_DOUBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12.5l5 5L16 7.5"/><path d="M9.5 12.5l5 5 8-9.5"/></svg>';

function messageStatus(msg, isSent) {
  if (!isSent) return '';
  let st = 'sent';
  if (msg.read) st = 'read';
  else if (msg.delivered) st = 'delivered';
  const title = st === 'read' ? 'Read' : (st === 'delivered' ? 'Delivered' : 'Sent');
  return `<span class="chat-bubble__status chat-bubble__status--${st}" data-status="${st}" title="${title}">${st === 'sent' ? TICK_SINGLE : TICK_DOUBLE}</span>`;
}

function setBubbleStatus(el, status) {
  const s = el.querySelector('.chat-bubble__status');
  if (!s) return;
  const st = status === 'read' ? 'read' : (status === 'delivered' ? 'delivered' : 'sent');
  s.className = `chat-bubble__status chat-bubble__status--${st}`;
  s.setAttribute('data-status', st);
  s.title = st === 'read' ? 'Read' : (st === 'delivered' ? 'Delivered' : 'Sent');
  s.innerHTML = st === 'sent' ? TICK_SINGLE : TICK_DOUBLE;
}

function uuidv4() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function renderChatMessage(msg) {
  const isSent = msg.senderId === currentUser.id;
  const type = msg.type || 'text';

  let content = '';

  if (type === 'audio' && msg.mediaUrl) {
    const duration = msg.duration || 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const msgId = `audio_${msg.senderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    content = `
      <div class="chat-bubble--audio chat-bubble--${isSent ? 'sent' : 'received'}" id="${msgId}" data-time="${msg.time}" data-msg-id="${msg.id || ''}" data-client-id="${msg.clientId || ''}">
        <button class="chat-bubble__audio-play" onclick="toggleAudioPlayback('${msgId}', '${msg.mediaUrl}')" aria-label="Play voice message">
          <svg class="chat-audio-bubble__play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg class="chat-audio-bubble__pause-icon hidden" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <div class="chat-bubble__audio-waveform">
          ${Array.from({ length: 20 }, () => `<div class="chat-bubble__audio-waveform-bar" style="height:${4 + Math.random() * 20}px"></div>`).join('')}
        </div>
        <span class="chat-bubble__audio-duration">${durationStr}</span>
        <span class="chat-bubble__audio-status ${msg.read ? 'played' : ''}"></span>
        <span class="chat-bubble__time">${formatTime(msg.time)}</span>
        ${messageStatus(msg, isSent)}
        <audio src="${msg.mediaUrl}" preload="none" style="display:none;"></audio>
      </div>
    `;
  } else if (type === 'gif' && msg.mediaUrl) {
    content = `
      <div class="chat-media-bubble">
        <img src="${msg.mediaUrl}" alt="${escapeHtml(msg.text || 'GIF')}" class="chat-media-bubble__img" loading="lazy" onclick="window.open('${msg.mediaUrl}', '_blank')" onerror="giphyFallback(this)">
        ${msg.text ? `<div class="chat-media-bubble__caption">${escapeHtml(msg.text)}</div>` : ''}
      </div>
    `;
  } else if (type === 'sticker' && msg.mediaUrl) {
    content = `
      <div class="chat-media-bubble chat-media-bubble--sticker">
        <img src="${msg.mediaUrl}" alt="${escapeHtml(msg.text || 'Sticker')}" class="chat-media-bubble__sticker" loading="lazy" onerror="giphyFallback(this)">
      </div>
    `;
  } else if (type === 'emoji' && msg.mediaUrl) {
    content = `
      <div class="chat-media-bubble chat-media-bubble--emoji">
        <img src="${msg.mediaUrl}" alt="${escapeHtml(msg.text || 'Emoji')}" class="chat-media-bubble__emoji-gif" loading="lazy" onerror="giphyFallback(this)">
      </div>
    `;
  } else if (type === 'image' && msg.mediaUrl) {
    content = `
      <div class="chat-file-bubble chat-file-bubble--image">
        <img src="${msg.mediaUrl}" alt="${escapeHtml(msg.text || 'Photo')}" class="chat-file-bubble__img" loading="lazy" onclick="window.open('${msg.mediaUrl}', '_blank')">
        ${msg.text ? `<div class="chat-file-bubble__caption">${escapeHtml(msg.text)}</div>` : ''}
      </div>
    `;
  } else if (type === 'video' && msg.mediaUrl) {
    content = `
      <div class="chat-file-bubble chat-file-bubble--video">
        <video src="${msg.mediaUrl}" class="chat-file-bubble__video" controls preload="metadata" onclick="event[event.target.paused?'play':'pause']()">
        </video>
        ${msg.text ? `<div class="chat-file-bubble__caption">${escapeHtml(msg.text)}</div>` : ''}
      </div>
    `;
  } else if (type === 'file' && msg.mediaUrl) {
    const fileName = msg.fileName || msg.text || 'File';
    const fileSize = msg.fileSize ? formatFileSize(msg.fileSize) : '';
    const fileIcon = getFileIconFromName(fileName);
    content = `
      <div class="chat-file-bubble chat-file-bubble--file">
        <div class="chat-file-bubble__icon">${fileIcon}</div>
        <div class="chat-file-bubble__info">
          <span class="chat-file-bubble__name">${escapeHtml(fileName)}</span>
          ${fileSize ? `<span class="chat-file-bubble__size">${fileSize}</span>` : ''}
        </div>
        <a href="${msg.mediaUrl}" class="chat-file-bubble__download" download="${escapeHtml(fileName)}" title="Download" target="_blank">⬇</a>
      </div>
    `;
  } else {
    // Check if message is only emojis
    const emojiOnly = msg.text && /^[\p{Emoji}\p{Extended_Pictographic}\s]+$/u.test(msg.text);
    if (emojiOnly && msg.text.length < 10) {
      content = `<span style="font-size:32px;line-height:1.2;">${escapeHtml(msg.text)}</span>`;
    } else {
      content = escapeHtml(msg.text || '');
    }
  }

  if (type === 'audio') return content;

  return `
    <div class="chat-bubble chat-bubble--${isSent ? 'sent' : 'received'}" data-msg-id="${msg.id || ''}" data-client-id="${msg.clientId || ''}">
      ${content}
      <span class="chat-bubble__meta">
        <span class="chat-bubble__time">${formatTime(msg.time)}</span>
        ${messageStatus(msg, isSent)}
      </span>
    </div>
  `;
}

function renderChatHistory(userId, messages) {
  const msgContainer = document.getElementById(`chatMessages_${userId}`);
  if (!msgContainer) return;

  if (!messages.length) {
    msgContainer.innerHTML = `<div style="text-align:center;padding:var(--space-lg);color:var(--text-muted);font-size:var(--font-size-sm);">No messages yet. Say hello! 👋</div>`;
    return;
  }

  let lastDate = null;
  msgContainer.innerHTML = messages.map(msg => {
    const msgDate = new Date(msg.time).toDateString();
    let separator = '';

    if (msgDate !== lastDate) {
      lastDate = msgDate;
      separator = `<div class="chat-date-separator"><span>${formatChatDate(msg.time)}</span></div>`;
    }

    return `${separator}${renderChatMessage(msg)}`;
  }).join('');

  // Scroll to bottom
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// --- Send Message ---
function handleChatKeydown(event, userId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessageFromInput(userId);
  }
}

function sendMessageFromInput(userId) {
  const input = document.getElementById(`chatInput_${userId}`);
  if (!input) return;
  const text = input.value.trim();

  const fileData = filePreviewData[userId];
  const hasFiles = fileData && fileData.length > 0;
  const uploadedFiles = hasFiles ? fileData.filter(i => i.uploaded && !i.sending) : [];

  if (!text && uploadedFiles.length === 0) return;

  input.value = '';

  if (uploadedFiles.length > 0) sendFilePreview(userId);
  if (text) sendMessage(userId, text);
}

function sendMessage(toUserId, text) {
  if (!text.trim()) return;

  // Detect if message is emoji-only
  const emojiOnly = /^[\p{Emoji}\p{Extended_Pictographic}\s]+$/u.test(text) && text.length < 10;
  const type = emojiOnly ? 'emoji' : 'text';

  const clientId = uuidv4();
  socket.emit('send_message', { toUserId, text, type, mediaUrl: null, mediaType: null, clientId });

  // Optimistically append sent message (single grey tick until server echoes)
  appendChatBubble(toUserId, {
    clientId,
    text,
    type,
    mediaUrl: null,
    mediaType: null,
    senderId: currentUser.id,
    time: new Date().toISOString(),
    delivered: false,
    read: false
  });
}

function appendChatBubble(userId, msg) {
  const msgContainer = document.getElementById(`chatMessages_${userId}`);
  if (!msgContainer) return;

  // Remove "no messages" placeholder
  const placeholder = msgContainer.querySelector('div[style*="text-align:center"]');
  if (placeholder) placeholder.remove();

  const isSent = msg.senderId === currentUser.id;

  // Add date separator if needed
  const lastMsg = msgContainer.lastElementChild;
  if (lastMsg && lastMsg.classList.contains('chat-bubble')) {
    const lastTime = lastMsg.querySelector('.chat-bubble__time');
    if (lastTime) {
      const lastDate = new Date(lastTime.textContent ? lastTime.closest('.chat-bubble').dataset.time : Date.now());
      // For simplicity just skip date check on append
    }
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderChatMessage(msg);
  const bubble = wrapper.firstElementChild;
  if (bubble) {
    msgContainer.appendChild(bubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

// --- File Attachment ---
let filePreviewData = {};

function handleAttachClick(userId) {
  // Open the Advanced Attach panel instead of basic menu
  if (typeof AdvancedAttach !== 'undefined' && AdvancedAttach.open) {
    AdvancedAttach.open(userId);
  } else {
    // Fallback to load the overlay dynamically
    const script = document.createElement('script');
    script.src = '/js/advanced-attach.js';
    script.onload = () => { AdvancedAttach.open(userId); };
    document.head.appendChild(script);
    // Also ensure CSS is loaded
    if (!document.querySelector('link[href="/css/advanced-attach.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/advanced-attach.css';
      document.head.appendChild(link);
    }
  }
}

function showFilePicker(userId) {
  const menu = document.getElementById(`attachMenu_${userId}`);
  if (menu) menu.classList.add('hidden');
  const input = document.getElementById(`fileInput_${userId}`);
  if (input) { input.value = ''; input.click(); }
}

function showFolderPicker(userId) {
  const menu = document.getElementById(`attachMenu_${userId}`);
  if (menu) menu.classList.add('hidden');
  const input = document.getElementById(`folderInput_${userId}`);
  if (input) { input.value = ''; input.click(); }
}

function generateFilePreviewUrl(file) {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    return URL.createObjectURL(file);
  }
  return null;
}

function handleFilesSelected(userId, event) {
  const rawFiles = event.target.files;
  if (!rawFiles || !rawFiles.length) return;
  event.target.value = '';

  if (!filePreviewData[userId]) filePreviewData[userId] = [];

  for (const file of rawFiles) {
    const relPath = file.webkitRelativePath || file.name;
    const previewUrl = generateFilePreviewUrl(file);
    filePreviewData[userId].push({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      relPath,
      mediaType: getMessageType(file),
      icon: getFileIcon(file),
      previewUrl,
      uploadProgress: 0,
      uploadUrl: null,
      uploaded: false,
      sending: false
    });
  }

  showFilePreview(userId);
}

function getItemThumbnail(item) {
  if (item.mediaType === 'image' && item.previewUrl) {
    return `<img src="${item.previewUrl}" class="chat-file-preview__item-thumb" alt="">`;
  }
  if (item.mediaType === 'video' && item.previewUrl) {
    return `<video src="${item.previewUrl}" class="chat-file-preview__item-thumb" muted preload="metadata"></video>`;
  }
  return `<span class="chat-file-preview__item-icon">${item.icon}</span>`;
}

function showFilePreview(userId) {
  const el = document.getElementById(`filePreview_${userId}`);
  const list = document.getElementById(`filePreviewList_${userId}`);
  const info = document.getElementById(`filePreviewInfo_${userId}`);
  if (!el || !list) return;

  const data = filePreviewData[userId] || [];
  if (!data.length) { el.classList.add('hidden'); return; }

  list.innerHTML = data.map((item, idx) => {
    const sizeStr = formatFileSize(item.size);
    const displayPath = item.relPath !== item.name ? item.relPath : '';
    const thumbnail = getItemThumbnail(item);
    const progressWidth = item.uploadProgress || 0;
    const showProgress = item.sending && !item.uploaded;
    const showSend = item.uploaded && !item.sending;

    return `
      <div class="chat-file-preview__item ${item.sending ? 'chat-file-preview__item--sending' : ''}" data-idx="${idx}">
        <div class="chat-file-preview__item-thumb-wrap">
          ${thumbnail}
          ${item.mediaType === 'video' && item.previewUrl ? '<div class="chat-file-preview__item-play-badge">▶</div>' : ''}
        </div>
        <div class="chat-file-preview__item-info">
          <span class="chat-file-preview__item-name">${escapeHtml(item.name)}</span>
          ${displayPath ? `<span class="chat-file-preview__item-path">${escapeHtml(displayPath)}</span>` : ''}
          <span class="chat-file-preview__item-size">${sizeStr}</span>
          ${showProgress ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="chat-file-preview__progress" style="flex:1;">
                <div class="chat-file-preview__progress-bar" style="width:${progressWidth}%"></div>
              </div>
              <span class="chat-file-preview__progress-text" style="font-size:10px;color:var(--text-secondary);">${progressWidth}%</span>
            </div>
          ` : ''}
          ${showSend ? '<span class="chat-file-preview__item-done">Uploaded ✓</span>' : ''}
        </div>
        <div class="chat-file-preview__item-actions">
          ${showSend ? `
            <button class="chat-file-preview__item-send" onclick="sendSingleFile('${userId}', ${idx})" aria-label="Send file">Send</button>
          ` : `
            <button class="chat-file-preview__item-remove" onclick="removeFileFromPreview('${userId}', ${idx})" aria-label="Remove file">✕</button>
          `}
        </div>
      </div>
    `;
  }).join('');

  const totalSize = data.reduce((s, i) => s + i.size, 0);
  const totalUploaded = data.filter(i => i.uploaded).length;
  const totalSending = data.filter(i => i.sending).length;
  const allDone = data.every(i => i.uploaded || i.sending);
  info.textContent = `${data.length} file(s) · ${formatFileSize(totalSize)}${totalUploaded > 0 ? ` · ${totalUploaded} uploaded` : ''}`;

  el.classList.remove('hidden');
  el.scrollTop = 0;

  autoUploadFiles(userId);
}

function autoUploadFiles(userId) {
  const data = filePreviewData[userId];
  if (!data) return;

  data.forEach((item, idx) => {
    if (!item.uploaded && !item.sending && item.uploadProgress === 0) {
      uploadFileWithProgress(userId, idx);
    }
  });
}

function uploadFileWithProgress(userId, idx) {
  const item = filePreviewData[userId]?.[idx];
  if (!item) return;

  item.sending = true;
  item.uploadProgress = 5;
  updatePreviewItem(userId, idx);

  const formData = new FormData();
  formData.append('file', item.file);

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      item.uploadProgress = Math.round((e.loaded / e.total) * 100);
      updatePreviewItemProgress(userId, idx);
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
          updatePreviewItem(userId, idx);
          updatePreviewFooter(userId);
          if (item.previewUrl && item.mediaType === 'image') {
            URL.revokeObjectURL(item.previewUrl);
          }
          return;
        }
      } catch (e) {}
    }
    item.sending = false;
    item.uploadProgress = 0;
    updatePreviewItem(userId, idx);
    showToast(`Upload failed: ${item.name}`, 'error');
  };

  xhr.onerror = () => {
    item.sending = false;
    item.uploadProgress = 0;
    updatePreviewItem(userId, idx);
    showToast(`Upload failed: ${item.name}`, 'error');
  };

  xhr.open('POST', API + '/upload/chat-file');
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.send(formData);
}

function updatePreviewItem(userId, idx) {
  const el = document.getElementById(`filePreview_${userId}`);
  if (!el || el.classList.contains('hidden')) return;
  showFilePreview(userId);
}

function updatePreviewItemProgress(userId, idx) {
  const item = document.querySelector(`#filePreview_${userId} .chat-file-preview__item[data-idx="${idx}"]`);
  if (!item) return;
  const bar = item.querySelector('.chat-file-preview__progress-bar');
  if (bar) bar.style.width = `${filePreviewData[userId][idx].uploadProgress}%`;
  const text = item.querySelector('.chat-file-preview__progress-text');
  if (text) text.textContent = `${filePreviewData[userId][idx].uploadProgress}%`;
}

function updatePreviewFooter(userId) {
  const info = document.getElementById(`filePreviewInfo_${userId}`);
  const sendAll = document.getElementById(`sendAllBtn_${userId}`);
  const data = filePreviewData[userId];
  if (!info || !data) return;
  const totalSize = data.reduce((s, i) => s + i.size, 0);
  const totalUploaded = data.filter(i => i.uploaded).length;
  info.textContent = `${data.length} file(s) · ${formatFileSize(totalSize)}${totalUploaded > 0 ? ` · ${totalUploaded} uploaded` : ''}`;
  if (sendAll) {
    if (totalUploaded > 0) sendAll.classList.remove('hidden');
    else sendAll.classList.add('hidden');
  }
}

function removeFileFromPreview(userId, index) {
  const item = filePreviewData[userId]?.[index];
  if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (!filePreviewData[userId]) return;
  filePreviewData[userId].splice(index, 1);
  if (filePreviewData[userId].length === 0) {
    delete filePreviewData[userId];
    document.getElementById(`filePreview_${userId}`)?.classList.add('hidden');
  } else {
    showFilePreview(userId);
  }
}

function cancelFilePreview(userId) {
  const data = filePreviewData[userId];
  if (data) data.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  delete filePreviewData[userId];
  document.getElementById(`filePreview_${userId}`)?.classList.add('hidden');
}

function sendSingleFile(userId, idx) {
  const item = filePreviewData[userId]?.[idx];
  if (!item || !item.uploaded || !item.uploadUrl) return;

  item.sending = true;
  updatePreviewItem(userId, idx);

  const msgText = item.mediaType === 'file' ? item.name : '';
  socket.emit('send_message', {
    toUserId: userId,
    text: msgText,
    type: item.mediaType,
    mediaUrl: item.uploadUrl,
    mediaType: item.mediaType,
    fileName: item.name,
    fileSize: item.size
  });

  appendChatBubble(userId, {
    text: msgText,
    type: item.mediaType,
    mediaUrl: item.uploadUrl,
    mediaType: item.mediaType,
    fileName: item.name,
    fileSize: item.size,
    senderId: currentUser.id,
    time: new Date().toISOString()
  });

  removeFileFromPreview(userId, idx);
  showToast(`${item.name} sent ✓`, 'success');

  if (!filePreviewData[userId] || filePreviewData[userId].length === 0) {
    document.getElementById(`filePreview_${userId}`)?.classList.add('hidden');
  }
}

async function sendFilePreview(userId) {
  const data = filePreviewData[userId];
  if (!data || !data.length) return;

  // Collect indices before sending (avoids race from array mutation)
  const indices = [];
  data.forEach((item, idx) => {
    if (item.uploaded && !item.sending) indices.push(idx);
  });

  for (const idx of indices) {
    sendSingleFile(userId, idx);
    await new Promise(r => setTimeout(r, 200));
  }
}

function getFileIcon(file) {
  if (file.type.startsWith('image/')) return '🖼️';
  if (file.type.startsWith('video/')) return '🎬';
  if (file.type.startsWith('audio/')) return '🎵';
  if (file.name.match(/\.zip$/i) || file.name.match(/\.rar$/i) || file.name.match(/\.7z$/i) || file.name.match(/\.tar$/i) || file.name.match(/\.gz$/i)) return '📦';
  if (file.name.match(/\.pdf$/i)) return '📄';
  if (file.name.match(/\.(doc|docx)$/i)) return '📝';
  if (file.name.match(/\.(xls|xlsx)$/i)) return '📊';
  if (file.name.match(/\.(ppt|pptx)$/i)) return '📑';
  return '📎';
}

function getFileIconFromName(fileName) {
  if (fileName.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i)) return '🖼️';
  if (fileName.match(/\.(mp4|webm|mov|avi|mkv|wmv)$/i)) return '🎬';
  if (fileName.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) return '🎵';
  if (fileName.match(/\.(zip|rar|7z|tar|gz)$/i)) return '📦';
  if (fileName.match(/\.pdf$/i)) return '📄';
  if (fileName.match(/\.(doc|docx)$/i)) return '📝';
  if (fileName.match(/\.(xls|xlsx)$/i)) return '📊';
  if (fileName.match(/\.(ppt|pptx)$/i)) return '📑';
  return '📎';
}

function getMessageType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// --- Socket: Incoming Messages ---
socket.on('message', ({ chatKey, message }) => {
  // Determine the other user's ID from the chatKey
  const parts = chatKey.split('_');
  const otherUserId = parts.find(id => id !== currentUser.id);
  if (!otherUserId) return;

  // If chat window is open, append message
  if (openChatWindows[otherUserId]) {
    const win = openChatWindows[otherUserId];
    const existing = message.clientId
      ? win.querySelector(`[data-client-id="${message.clientId}"]`)
      : null;
    if (existing) {
      // Replace optimistic bubble with the server-confirmed message (real id, ticks)
      const tmp = document.createElement('div');
      tmp.innerHTML = renderChatMessage(message);
      const realBubble = tmp.firstElementChild;
      if (realBubble) {
        existing.replaceWith(realBubble);
        const mc = document.getElementById(`chatMessages_${otherUserId}`);
        if (mc) mc.scrollTop = mc.scrollHeight;
      }
    } else {
      appendChatBubble(otherUserId, message);
    }
    // Chat is open and visible → mark these messages as read
    socket.emit('mark_read', { withUserId: otherUserId });
  } else {
    // Otherwise show notification toast
    const sender = allUsers.find(u => u.id === message.senderId);
    const senderName = sender ? sender.name : 'Someone';
    const senderAvatar = sender ? (sender.avatar || avatarUrl(sender.name)) : '';
    const type = message.type || 'text';
    let preview = message.text || '';
    if (type === 'gif') preview = '📷 GIF';
    else if (type === 'sticker') preview = '🎯 Sticker';
    else if (type === 'emoji' && message.text) preview = message.text;
    else if (type === 'audio') preview = '🎤 Voice message';
    else if (type === 'image') preview = '🖼️ Photo';
    else if (type === 'video') preview = '🎬 Video';
    else if (type === 'file') preview = '📎 ' + (message.fileName || 'File');
    showToast(`💬 ${senderName}: ${preview}`, 'info', 5000, () => {
      openChat(message.senderId, senderName, senderAvatar);
    });
    notifyBrowser(`💬 ${senderName}`, preview, senderAvatar);
  }

  // Keep the WhatsApp-style recent-chats list fresh
  if (!openChatWindows[otherUserId] && message.senderId !== currentUser.id) {
    unreadCounts[otherUserId] = (unreadCounts[otherUserId] || 0) + 1;
    totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    updateChatLauncherBadge();
  }
  if (message.senderId !== currentUser.id) {
    updateRecentChat(otherUserId, message);
  }
});

// --- Socket: Read receipts (✓✓ turns blue in real time) ---
socket.on('messages_read', ({ chatKey, messageIds }) => {
  (messageIds || []).forEach(id => {
    if (!id) return;
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    if (el) setBubbleStatus(el, 'read');
  });
});

// --- Socket: Typing Indicator ---
let typingDebounce = {};

function handleChatTyping(userId) {
  socket.emit('typing', { toUserId: userId, typing: true });

  clearTimeout(typingDebounce[userId]);
  typingDebounce[userId] = setTimeout(() => {
    socket.emit('typing', { toUserId: userId, typing: false });
  }, 1500);
}

socket.on('typing', ({ userId, typing }) => {
  const typingEl = document.getElementById(`chatTyping_${userId}`);
  if (!typingEl) return;
  typingEl.classList.toggle('hidden', !typing);

  // Scroll to show typing indicator
  if (typing) {
    const msgContainer = document.getElementById(`chatMessages_${userId}`);
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
  }
});

// ─── Voice Recording ──────────────────────────────────────────────────────────
let voiceRecorders = {};
let voiceRecordingChunks = {};
let voiceRecordingStart = {};
let voiceRecordingTimer = {};
let voiceRecordingAnim = {};
let voicePreview = {};

function startVoiceRecording(userId) {
  if (voicePreview[userId]) { sendVoiceFromPreview(userId); return; }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Voice recording not supported in this browser', 'error');
    return;
  }

  navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 48000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  })
    .then(stream => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 192000
      });
      voiceRecorders[userId] = recorder;
      voiceRecordingChunks[userId] = [];
      voiceRecordingStart[userId] = Date.now();

      recorder.ondataavailable = e => {
        if (e.data.size > 0) voiceRecordingChunks[userId].push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const startTime = voiceRecordingStart[userId] || Date.now();
        const chunks = voiceRecordingChunks[userId] || [];
        const mimeType = recorder.mimeType || 'audio/webm';

        delete voiceRecorders[userId];
        delete voiceRecordingChunks[userId];
        delete voiceRecordingStart[userId];

        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: mimeType });
        const duration = Math.floor((Date.now() - startTime) / 1000);
        if (duration < 1) { showToast('Recording too short', 'error'); return; }

        if (voicePreview[userId]) URL.revokeObjectURL(voicePreview[userId].url);
        const url = URL.createObjectURL(blob);
        voicePreview[userId] = { blob, url, duration, mimeType };

        showVoicePreview(userId);
      };

      recorder.start(100);

      const overlay = document.getElementById(`recordingOverlay_${userId}`);
      if (overlay) overlay.classList.remove('hidden');

      const micBtn = document.getElementById(`voiceBtn_${userId}`);
      if (micBtn) micBtn.classList.add('recording');

      voiceRecordingTimer[userId] = setInterval(() => {
        const elapsed = Math.floor((Date.now() - voiceRecordingStart[userId]) / 1000);
        if (elapsed >= 300) { stopVoiceRecording(userId); return; }
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeEl = document.getElementById(`recordingTime_${userId}`);
        if (timeEl) timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }, 1000);

      const bars = document.querySelectorAll(`#recordingWaveform_${userId} .voice-recording-overlay__bar`);
      voiceRecordingAnim[userId] = setInterval(() => {
        bars.forEach(bar => {
          const h = 4 + Math.random() * 28;
          bar.style.height = `${h}px`;
        });
      }, 150);
    })
    .catch(err => {
      console.error('Voice recording error:', err);
      showToast('Could not access microphone. Please check permissions.', 'error');
    });
}

function stopVoiceRecording(userId) {
  const recorder = voiceRecorders[userId];
  if (!recorder || recorder.state === 'inactive') return;

  recorder.stop();

  const overlay = document.getElementById(`recordingOverlay_${userId}`);
  if (overlay) overlay.classList.add('hidden');

  const micBtn = document.getElementById(`voiceBtn_${userId}`);
  if (micBtn) micBtn.classList.remove('recording');

  clearInterval(voiceRecordingTimer[userId]);
  clearInterval(voiceRecordingAnim[userId]);
  delete voiceRecordingTimer[userId];
  delete voiceRecordingAnim[userId];
}

function showVoicePreview(userId) {
  const preview = voicePreview[userId];
  if (!preview) return;

  const el = document.getElementById(`voicePreview_${userId}`);
  if (!el) return;
  el.classList.remove('hidden');

  const mins = Math.floor(preview.duration / 60);
  const secs = preview.duration % 60;
  const timeEl = document.getElementById(`voicePreviewTime_${userId}`);
  if (timeEl) timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Reset play button
  const playBtn = document.getElementById(`voicePreviewPlay_${userId}`);
  if (playBtn) {
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }
}

function hideVoicePreview(userId) {
  const el = document.getElementById(`voicePreview_${userId}`);
  if (el) el.classList.add('hidden');
  // Stop any playing audio
  const audio = document.getElementById(`voicePreviewAudio_${userId}`);
  if (audio) { audio.pause(); audio.currentTime = 0; }
}

function cancelVoiceRecording(userId) {
  const recorder = voiceRecorders[userId];
  if (recorder && recorder.state !== 'inactive') {
    voiceRecordingChunks[userId] = [];
    recorder.stop();
  }

  const overlay = document.getElementById(`recordingOverlay_${userId}`);
  if (overlay) overlay.classList.add('hidden');

  const micBtn = document.getElementById(`voiceBtn_${userId}`);
  if (micBtn) micBtn.classList.remove('recording');

  clearInterval(voiceRecordingTimer[userId]);
  clearInterval(voiceRecordingAnim[userId]);
  delete voiceRecordingTimer[userId];
  delete voiceRecordingAnim[userId];
  delete voiceRecorders[userId];
  delete voiceRecordingChunks[userId];
  delete voiceRecordingStart[userId];
}

function playVoicePreview(userId) {
  const preview = voicePreview[userId];
  if (!preview) return;

  const audio = document.getElementById(`voicePreviewAudio_${userId}`);
  const playBtn = document.getElementById(`voicePreviewPlay_${userId}`);
  if (!audio || !playBtn) return;

  if (audio.paused) {
    audio.src = preview.url;
    audio.play().then(() => {
      playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    }).catch(() => {});
    audio.onended = () => {
      playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    };
  } else {
    audio.pause();
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }
}

function deleteVoicePreview(userId) {
  if (voicePreview[userId]) {
    URL.revokeObjectURL(voicePreview[userId].url);
  }
  delete voicePreview[userId];
  hideVoicePreview(userId);
}

async function sendVoiceFromPreview(userId) {
  const preview = voicePreview[userId];
  if (!preview) return;

  hideVoicePreview(userId);

  const duration = preview.duration;
  const blob = preview.blob;
  delete voicePreview[userId];

  try {
    const res = await fetch(`${API}/upload/audio`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'audio/webm'
      },
      body: blob
    });
    const json = await res.json();
    if (!json.success || !json.url) {
      showToast('Failed to upload voice message', 'error');
      return;
    }

    socket.emit('send_message', {
      toUserId: userId,
      text: '',
      type: 'audio',
      mediaUrl: json.url,
      mediaType: 'audio',
      duration: duration
    });

    appendChatBubble(userId, {
      text: '',
      type: 'audio',
      mediaUrl: json.url,
      mediaType: 'audio',
      duration: duration,
      senderId: currentUser.id,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.error('Upload voice error:', err);
    showToast('Failed to send voice message', 'error');
  }
}

let activeAudioPlayer = null;
let activeAudioMsgId = null;

function toggleAudioPlayback(msgId, audioUrl) {
  const container = document.getElementById(msgId);
  if (!container) return;

  const audio = container.querySelector('audio');
  const playIcon = container.querySelector('.chat-audio-bubble__play-icon');
  const pauseIcon = container.querySelector('.chat-audio-bubble__pause-icon');
  const waveBars = container.querySelectorAll('.chat-bubble__audio-waveform-bar');

  if (!audio) return;

  // If another audio is playing, stop it
  if (activeAudioPlayer && activeAudioPlayer !== audio) {
    activeAudioPlayer.pause();
    activeAudioPlayer.currentTime = 0;
    if (activeAudioMsgId) {
      const prevContainer = document.getElementById(activeAudioMsgId);
      if (prevContainer) {
        prevContainer.querySelector('.chat-audio-bubble__play-icon')?.classList.remove('hidden');
        prevContainer.querySelector('.chat-audio-bubble__pause-icon')?.classList.add('hidden');
        prevContainer.querySelectorAll('.chat-bubble__audio-waveform-bar').forEach(b => b.classList.remove('playing'));
      }
    }
  }

  if (audio.paused) {
    audio.play().then(() => {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      activeAudioPlayer = audio;
      activeAudioMsgId = msgId;

      // Animate waveform bars during playback
      const animateBars = () => {
        if (audio.paused) return;
        waveBars.forEach((bar, i) => {
          const progress = audio.currentTime / audio.duration;
          const barProgress = i / waveBars.length;
          if (barProgress <= progress) {
            bar.classList.add('active');
          } else {
            bar.classList.remove('active');
          }
        });
        requestAnimationFrame(animateBars);
      };
      requestAnimationFrame(animateBars);
    }).catch(err => {
      console.error('Audio playback error:', err);
      showToast('Could not play audio', 'error');
    });

    audio.onended = () => {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      waveBars.forEach(b => b.classList.remove('active'));
      activeAudioPlayer = null;
      activeAudioMsgId = null;
    };
  } else {
    audio.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    waveBars.forEach(b => b.classList.remove('active'));
    activeAudioPlayer = null;
    activeAudioMsgId = null;
  }
}

// ─── Group Call from Chat Header ──────────────────────────────────────────
function startGroupCallFromChat(userId, userName, userAvatar) {
  // Open the participant picker modal to choose who to invite
  const existing = document.getElementById('groupCallInitModal');
  if (existing) existing.remove();

  // Close any existing call state
  if (callState.active) { SC.showError('You are already in a call'); return; }
  if (groupCallState.active) { SC.showError('Already in a group call'); return; }

  const modal = document.createElement('div');
  modal.id = 'groupCallInitModal';
  modal.className = 'group-call__add-modal-overlay';
  modal.innerHTML = `
    <div class="group-call__add-modal">
      <div class="group-call__add-modal-header">
        <span>Start Group Call</span>
        <button onclick="this.closest('.group-call__add-modal-overlay').remove()">✕</button>
      </div>
      <div style="padding:var(--space-md);display:flex;gap:var(--space-sm);">
        <button class="btn btn--primary btn--sm" onclick="doStartGroupCall('audio')" style="flex:1;">🎤 Audio Call</button>
        <button class="btn btn--primary btn--sm" onclick="doStartGroupCall('video')" style="flex:1;">📷 Video Call</button>
      </div>
      <div style="padding:0 var(--space-md) var(--space-sm);font-size:var(--font-size-sm);color:var(--text-secondary);">
        Select friends to invite (you can invite more later)
      </div>
      <div class="group-call__add-modal-search">
        <input type="text" id="groupCallInitSearch" placeholder="Search friends..." autocomplete="off" oninput="groupCallInitSearchInput(this.value)" onkeydown="groupCallInitSearchKeydown(event)">
      </div>
      <div class="group-call__add-modal-list" id="groupCallInitCandidateList">
        <div style="padding:var(--space-md);text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">Loading...</div>
      </div>
      <div style="padding:var(--space-md);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <span id="groupCallInitCount" style="font-size:var(--font-size-sm);color:var(--text-secondary);">0 selected</span>
        <button class="btn btn--primary btn--sm" onclick="doStartGroupCallWithSelected()" id="groupCallInitStartBtn" disabled>Start Call</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.remove(); });
  const input = document.getElementById('groupCallInitSearch');
  if (input) { input.focus(); input.select(); }
  renderGroupCallInitCandidates();
}

let selectedGroupCallInitIds = [];

var groupCallInitSearchInput = (function() {
  var timer;
  return function() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      var input = document.getElementById('groupCallInitSearch');
      if (input) renderGroupCallInitCandidates(input.value);
    }, 200);
  };
})();

function groupCallInitSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
  event.preventDefault();
  const items = document.querySelectorAll('#groupCallInitCandidateList .group-call__candidate-item');
  if (!items.length) return;
  let idx = Array.from(items).findIndex(function(el) { return el.classList.contains('group-call__candidate-item--focused'); });
  if (event.key === 'ArrowDown') {
    idx = idx < items.length - 1 ? idx + 1 : 0;
  } else if (event.key === 'ArrowUp') {
    idx = idx > 0 ? idx - 1 : items.length - 1;
  } else if (event.key === 'Enter') {
    if (idx >= 0 && idx < items.length) {
      items[idx].click();
    }
    return;
  }
  items.forEach(function(el) { el.classList.remove('group-call__candidate-item--focused'); });
  if (idx >= 0) {
    items[idx].classList.add('group-call__candidate-item--focused');
    items[idx].scrollIntoView({ block: 'nearest' });
  }
}

function renderGroupCallInitCandidates(query) {
  const list = document.getElementById('groupCallInitCandidateList');
  if (!list) return;

  const candidates = (allUsers || []).filter(u =>
    u.id !== currentUser?.id
  );

  const q = (query || '').toLowerCase().trim();
  const filtered = q
    ? candidates.filter(u => u.name.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q))
    : candidates;

  if (!filtered.length) {
    list.innerHTML = '<div class="group-call__no-results"><div class="group-call__no-results-icon">🔍</div>No friends match your search</div>';
    return;
  }

  list.innerHTML = filtered.map(function(u) {
    const sel = selectedGroupCallInitIds.includes(u.id);
    const nameEscaped = escapeHtml(u.name);
    const nameHtml = q ? nameEscaped.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<em>$1</em>') : nameEscaped;
    return `
    <div class="group-call__candidate-item ${sel ? 'selected' : ''}" onclick="toggleGroupCallInitCandidate('${u.id}')" data-init-id="${u.id}">
      <div class="group-call__candidate-check">
        <div class="group-call__checkbox ${sel ? 'checked' : ''}">${sel ? '✓' : ''}</div>
      </div>
      <img src="${u.avatar || ''}" alt="${escapeHtml(u.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff&size=40'" class="group-call__candidate-avatar">
      <div class="group-call__candidate-info">
        <div class="group-call__candidate-name">${nameHtml}</div>
        <div class="group-call__candidate-status">${onlineUserIds.has(u.id) ? '🟢 Online' : 'Offline'}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleGroupCallInitCandidate(userId) {
  const idx = selectedGroupCallInitIds.indexOf(userId);
  if (idx === -1) {
    selectedGroupCallInitIds.push(userId);
  } else {
    selectedGroupCallInitIds.splice(idx, 1);
  }
  const item = document.querySelector('[data-init-id="' + userId + '"]');
  if (item) {
    item.classList.toggle('selected');
    const cb = item.querySelector('.group-call__checkbox');
    if (cb) {
      cb.classList.toggle('checked');
      cb.textContent = selectedGroupCallInitIds.includes(userId) ? '✓' : '';
    }
  }
  const countEl = document.getElementById('groupCallInitCount');
  const btn = document.getElementById('groupCallInitStartBtn');
  if (countEl) countEl.textContent = selectedGroupCallInitIds.length + ' selected';
  if (btn) btn.disabled = selectedGroupCallInitIds.length === 0;
}

async function doStartGroupCall(callType) {
  document.getElementById('groupCallInitModal')?.remove();
  // Find the active chat window to host the group call
  const wins = Object.keys(openChatWindows);
  if (wins.length === 0) { SC.showError('No chat window open'); return; }
  const firstWinId = wins[0];
  const winEl = openChatWindows[firstWinId];
  const nameEl = winEl?.querySelector('.chat-window__header-name');
  groupCallState.chatWinId = firstWinId;
  groupCallState.callType = callType;
  await startGroupCall(callType);
}

async function doStartGroupCallWithSelected() {
  const ids = [...selectedGroupCallInitIds];
  selectedGroupCallInitIds = [];
  document.getElementById('groupCallInitModal')?.remove();

  if (ids.length === 0) { SC.showError('Select at least one participant'); return; }

  // Find the active chat window
  const wins = Object.keys(openChatWindows);
  if (wins.length === 0) { SC.showError('No chat window open'); return; }
  groupCallState.chatWinId = wins[0];
  await startGroupCall('audio');

  // Invite selected participants after a short delay to let the call initialize
  setTimeout(() => {
    ids.forEach(uid => {
      inviteToGroupCall(uid);
    });
  }, 500);
}

function openChatFromMatch() {
  if (lastMatchedUserId) {
    const user = allUsers.find(u => u.id === lastMatchedUserId);
    if (user) openChat(user.id, user.name, user.avatar || avatarUrl(user.name));
  }
}

// ═══════════════════════════════════════════════════════════════════
// RELATIONSHIP MODAL
// ═══════════════════════════════════════════════════════════════════

function openRelationshipModal(userId, message, notifId) {
  const modal = document.getElementById('relationshipModal');
  if (!modal) return;

  const userNameEl = document.getElementById('relationshipModalUserName');
  if (userNameEl && message) {
    // Try multiple patterns to extract the name
    let name = 'User';
    const patterns = [/with (\w+) wants/, /matched with ([^!]+)/, /connected with ([^!]+)/];
    for (const p of patterns) {
      const m = message.match(p);
      if (m) { name = m[1]; break; }
    }
    // Fallback: if userId is known from allUsers, use that name
    if (name === 'User' && userId) {
      const found = allUsers.find(u => u.id === userId);
      if (found) name = found.name;
    }
    userNameEl.textContent = name;
  }

  // Store userId and optional notifId for later
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
  const userId = modal?.dataset.userId;
  const notifId = modal?.dataset.notifId; // Get notification ID if available
  if (!userId) return;

  const selectedType = document.querySelector('input[name="relType"]:checked');
  const relType = selectedType ? selectedType.value : 'single';

  const result = await apiFetch(`/connect/accept/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ relationshipType: relType })
  });

  if (result && result.ok) {
    showToast(`Relationship added: ${relType}!`, 'success');
    closeRelationshipModal();
    loadCurrentUser();
    // Mark connect_request notification as read
    if (notifId) markNotifAsRead(notifId);
  } else {
    showToast(result?.data?.error || 'Could not add relationship', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
// NAVBAR INTERACTIONS
// ═══════════════════════════════════════════════════════════════════

// Search with debounce
let searchDebounce;
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => searchUsers(e.target.value, 'searchResults'), 300);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value) {
      document.getElementById('searchResults')?.classList.remove('hidden');
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('searchResults')?.classList.add('hidden');
      searchInput.blur();
    }
  });
}

// Close search dropdown on outside click
document.addEventListener('click', (e) => {
  const el = document.getElementById('searchResults');
  if (el && !e.target.closest('.navbar__search')) {
    el.classList.add('hidden');
  }
});

// Notifications dropdown
function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  closeAllDropdowns();

  if (isHidden) {
    dropdown.classList.remove('hidden');
    document.getElementById('notifBtn')?.setAttribute('aria-expanded', 'true');
    // Mark as read when opened
    if (allNotifications.some(n => !n.read)) {
      setTimeout(markAllNotifsRead, 2000);
    }
  }
}

// Close notification dropdown (for mobile)
function closeNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
    document.getElementById('notifBtn')?.setAttribute('aria-expanded', 'false');
  }
}

// Profile dropdown
function toggleProfileDropdown() {
  const menu = document.getElementById('profileDropdown');
  const btn = document.getElementById('navAvatar');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  closeAllDropdowns();

  if (isHidden) {
    menu.classList.remove('hidden');
    btn && btn.setAttribute('aria-expanded', 'true');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown__menu, .notifications-dropdown').forEach(el => {
    el.classList.add('hidden');
  });
  document.querySelectorAll('[aria-expanded]').forEach(el => {
    el.setAttribute('aria-expanded', 'false');
  });
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown__menu').forEach(el => el.classList.add('hidden'));
}

// Post options modal (Facebook-style popup)
// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('notifDropdown');
  const isNotifBtn = e.target.closest('#notifBtn') || e.target.closest('[onclick*="toggleNotifDropdown"]');

  // If notification dropdown is open and we clicked outside it (and not on the button)
  if (dropdown && !dropdown.classList.contains('hidden') && !e.target.closest('.notifications-dropdown') && !isNotifBtn) {
    closeNotifDropdown();
  }

  // Close post options modal on outside click
  if (!e.target.closest('#postOptionsModal') && !e.target.closest('.post-card__options')) {
    document.getElementById('postOptionsModal')?.remove();
  }

    // Close attach menus on outside click
  if (!e.target.closest('.chat-window__attach-wrap')) {
    document.querySelectorAll('.chat-window__attach-menu').forEach(m => m.classList.add('hidden'));
  }

  // Close other dropdowns (but not when clicking notification button or its dropdown)
  if (!e.target.closest('.dropdown') && !e.target.closest('.notifications-dropdown') && !isNotifBtn) {
    closeAllDropdowns();
    closeAllMenus();
  }
});

// Escape key closes all
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('postOptionsModal')?.remove();
    closeAllDropdowns();
    closeAllMenus();
    document.getElementById('searchResults')?.classList.add('hidden');
  }
});

// ═══════════════════════════════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function openPostModal(postId) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const modal = document.getElementById('postModal');
  const body = document.getElementById('postModalBody');
  if (!modal || !body || !card) return;

  body.innerHTML = card.outerHTML;
  // Show comments in the modal copy
  const commentsSection = body.querySelector(`#comments_${postId}`);
  if (commentsSection) commentsSection.classList.remove('hidden');

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePostModal() {
  const modal = document.getElementById('postModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function handleModalOverlayClick(event, modalId) {
  if (event.target.id === modalId) {
    if (modalId === 'postModal') closePostModal();
    if (modalId === 'allUsersModal') closeSuggestionsModal();
  }
}

// ═══════════════════════════════════════════════════════════════
// ALL USERS / SUGGESTIONS MODAL
// ═══════════════════════════════════════════════════════════════
async function openSuggestionsModal() {
  const modal = document.getElementById('allUsersModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Ensure users are loaded
  if (!allUsers.length) {
    const result = await apiFetch('/users');
    if (result && result.ok) allUsers = result.data || [];
  }
  renderAllUsersList();

  const searchInput = document.getElementById('allUsersSearch');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
    searchInput.addEventListener('input', function() {
      renderAllUsersList(this.value.trim());
    });
  }
}

function closeSuggestionsModal() {
  const modal = document.getElementById('allUsersModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderAllUsersList(query) {
  const list = document.getElementById('allUsersList');
  if (!list) return;

  const q = (query || '').toLowerCase().trim();
  const users = q
    ? allUsers.filter(u => u.id !== currentUser.id && u.name.toLowerCase().includes(q))
    : allUsers.filter(u => u.id !== currentUser.id);

  if (!users.length) {
    list.innerHTML = `<div class="empty-state" style="padding:var(--space-lg) 0;grid-column:1/-1;">
      <div class="empty-state__icon">🔍</div>
      <p class="empty-state__text">${q ? 'No users found matching "' + escapeHtml(q) + '"' : 'No users to show'}</p>
    </div>`;
    return;
  }

  list.innerHTML = users.map(user => `
    <div class="friend-request-item" style="padding:var(--space-sm);border:1px solid var(--border-light);border-radius:8px;">
      <img
        src="${user.avatar || avatarUrl(user.name)}"
        alt="${escapeHtml(user.name)}"
        class="friend-request-item__avatar"
        onerror="this.src='${avatarUrl(user.name || 'U')}'"
      >
      <div class="friend-request-item__info">
        <a href="/profile.html?id=${user.id}" class="friend-request-item__name">
          ${escapeHtml(user.name)}
        </a>
        <span class="friend-request-item__mutual">
          ${escapeHtml(user.location || user.bio?.substring(0, 40) || 'SocialConnect member')}
        </span>
      </div>
      <div class="friend-request-item__actions">
        <button
          class="btn btn--outline-primary btn--sm"
          data-friend-btn="${user.id}"
          onclick="sendFriendRequest('${user.id}')"
          aria-label="Add ${escapeHtml(user.name)} as friend"
        >Add</button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// MATCH POPUP — full overlay with love tone & auto-relationship
// ═══════════════════════════════════════════════════════════════════

let matchToneTimer = null;
let matchToneContext = null;

function playMatchTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    matchToneContext = ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.25, ctx.currentTime);
    master.connect(ctx.destination);

    // Romantic chord progression: Cmaj7 → Am → F → G7 (looped twice)
    const chords = [
      { freqs: [261.63, 329.63, 392.00, 493.88], dur: 0.8 }, // Cmaj7
      { freqs: [220.00, 261.63, 329.63, 440.00], dur: 0.8 }, // Am7
      { freqs: [174.61, 220.00, 261.63, 349.23], dur: 0.8 }, // Fmaj7
      { freqs: [196.00, 246.94, 311.13, 392.00], dur: 0.8 }, // G7
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
    // Add a gentle pad for warmth
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

    // Stop context after 5 seconds
    matchToneTimer = setTimeout(() => {
      try { ctx.close(); } catch (e) { /* ignore */ }
      matchToneContext = null;
    }, 5200);
  } catch (e) { /* silent fallback */ }
}

function showMatchBanner() {
  const banner = document.getElementById('matchBanner');
  if (!banner) return;

  // Set avatars
  const currentUserData = JSON.parse(localStorage.getItem('sc_user') || '{}');
  const myAvatar = document.getElementById('matchPopupMyAvatar');
  const theirAvatar = document.getElementById('matchPopupTheirAvatar');
  if (myAvatar) {
    myAvatar.src = currentUserData.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.name || 'You')}&background=1877f2&color=fff&size=96`;
  }
  if (theirAvatar && lastMatchedUserId) {
    const matchedUser = allUsers.find(u => u.id === lastMatchedUserId);
    if (matchedUser) {
      theirAvatar.src = matchedUser.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedUser.name || 'Them')}&background=ff69b4&color=fff&size=96`;
    }
  }

  banner.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Play romantic love tone
  playMatchTone();

  // Auto-close after 5 seconds, then open relationship modal
  setTimeout(() => {
    closeMatchBanner();
    // Auto-open relationship modal for both users to set relationship
    if (lastMatchedUserId) {
      const matchedUser = allUsers.find(u => u.id === lastMatchedUserId);
      const name = matchedUser ? matchedUser.name : 'User';
      openRelationshipModal(lastMatchedUserId, `You matched with ${name}! Would you like to set your relationship?`, null);
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

// ═══════════════════════════════════════════════════════════════════
// CREATE POST UI INTERACTIONS
// ═══════════════════════════════════════════════════════════════════

function expandCreatePost() {
  // Open the advanced post modal instead
  openAdvancedPostModal();
}

function collapseCreatePost() {
  // No longer needed - old create post UI removed
}

// ─── TOGGLE CREATE POST MINIMIZE ──────────────────────────────────────────────
function toggleCreatePost() {
  const card = document.getElementById('createPostCard');
  const floatBtn = document.getElementById('createPostFloatBtn');
  if (!card) return;

  const isMinimized = card.classList.toggle('minimized');
  if (isMinimized) {
    card.style.maxHeight = '0';
    card.style.opacity = '0';
    card.style.marginBottom = '0';
    card.style.padding = '0 12px';
    card.style.overflow = 'hidden';
    if (floatBtn) floatBtn.classList.remove('hidden');
  } else {
    card.style.maxHeight = '';
    card.style.opacity = '';
    card.style.marginBottom = '';
    card.style.padding = '';
    card.style.overflow = '';
    if (floatBtn) floatBtn.classList.add('hidden');
  }
}

// ─── OPEN ADVANCED POST MODAL ────────────────────────────────────────────────
function openAdvancedPostModal() {
  if (window.AdvancedPost) {
    AdvancedPost.openPostModal();
  } else {
    showToast('Advanced post system is loading...', 'info');
  }
}

// Wire up the advanced post button after DOM is ready
function setupAdvancedPostButton() {
  const btn = document.getElementById('advancedPostBtn');
  if (btn) {
    btn.addEventListener('click', openAdvancedPostModal);
  }
}

// Call setup from init
const origOnReady = window.onload || null;
// No need to override, we'll add it to the init function

function togglePostImageInput() {
  // Open the advanced post modal instead
  openAdvancedPostModal();
}



// ═══════════════════════════════════════════════════════════════════
// POST COMMENTS TOGGLE
// ═══════════════════════════════════════════════════════════════════

function toggleComments(postId) {
  const section = document.getElementById(`comments_${postId}`);
  if (!section) return;
  const isHidden = section.classList.contains('hidden');
  section.classList.toggle('hidden', !isHidden);

  if (isHidden) {
    // Focus comment input
    const input = section.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STORY BAR
// ═══════════════════════════════════════════════════════════════════

function renderStories(users) {
  const scroll = document.getElementById('storyScroll');
  if (!scroll) return;

  // Keep the first (my story) item; append others after it
  const myStoryItem = document.getElementById('myStoryItem');

  const storyUsers = users.filter(u => u.id !== currentUser.id).slice(0, 6);
  storyUsers.forEach((u, i) => {
    const item = document.createElement('div');
    item.className = 'story-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `${u.name}'s story`);
    item.onclick = () => alert('Stories coming soon! 🎉');
    item.onkeydown = (e) => { if (e.key === 'Enter') alert('Stories coming soon! 🎉'); };
    item.innerHTML = `
      <div class="story-item__circle${i < 3 ? '' : ' seen'}">
        <img
          src="${u.avatar || avatarUrl(u.name)}"
          alt="${escapeHtml(u.name)}"
          class="story-item__img"
          onerror="this.src='${avatarUrl(u.name)}'"
        >
      </div>
      <span class="story-item__name">${escapeHtml(u.name.split(' ')[0])}</span>
    `;
    scroll.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════════
// SHARE POST
// ═══════════════════════════════════════════════════════════════════

async function sharePost(postId) {
  // Try the advanced share API first
  try {
    const result = await apiFetch(`/posts/advanced/${postId}/share`, { method: 'POST' });
    if (result && result.ok) {
      const shares = result.data?.shares || 0;
      showToast(`Post shared! 📤 (${shares} total shares)`, 'success');
      return;
    }
  } catch (e) { /* fall through to clipboard fallback */ }

  // Fallback: copy link to clipboard
  const url = `${window.location.origin}/post.html?id=${postId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard! 📋', 'success');
    });
  } else {
    showToast('Share: ' + url, 'info');
  }
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION HELPERS
// ═══════════════════════════════════════════════════════════════════

function goToProfile() {
  const id = currentUser.id || '';
  window.location.href = id ? `/profile.html?id=${id}` : '/profile.html';
}

function openProfile(userId) {
  window.location.href = `/profile.html?id=${userId}`;
}

function scrollToSuggestions() {
  const widget = document.getElementById('suggestionsWidget');
  if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

function showToast(message, type = 'info', duration = 3500, onClick = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  if (onClick) toast.style.cursor = 'pointer';

  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast__content">
      <p class="toast__message">${escapeHtml(message)}</p>
    </div>
    <button class="toast__close" aria-label="Dismiss notification">&times;</button>
    <div class="toast__progress"></div>
  `;

  toast.querySelector('.toast__close').addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast(toast);
  });

  if (onClick) toast.addEventListener('click', onClick);

  container.appendChild(toast);

  // Animate progress bar
  const progress = toast.querySelector('.toast__progress');
  if (progress) {
    progress.style.transition = `width ${duration}ms linear`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { progress.style.width = '0%'; });
    });
  }

  const timer = setTimeout(() => removeToast(toast), duration);
  toast.dataset.timer = timer;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  clearTimeout(parseInt(toast.dataset.timer));
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function avatarUrl(name) {
  const initials = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=256`;
}

function highlightHashtags(text) {
  return text.replace(/#(\w+)/g, '<span class="tag tag--pink" style="cursor:pointer;font-weight:600;">#$1</span>');
}

function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<em>$1</em>');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatChatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════
// CHAT THEMES SYSTEM
// ═══════════════════════════════════════════════════════════════════

const CHAT_THEMES = {
  default: { name: 'Default', icon: '🌐', desc: 'Classic blue' },
  whatsapp: { name: 'WhatsApp', icon: '💚', desc: 'Green bubbles' },
  midnight: { name: 'Midnight', icon: '🌙', desc: 'Dark mode' },
  sunset: { name: 'Sunset', icon: '🌅', desc: 'Warm tones' },
  ocean: { name: 'Ocean', icon: '🌊', desc: 'Teal vibes' },
  lavender: { name: 'Lavender', icon: '💜', desc: 'Purple dream' },
  forest: { name: 'Forest', icon: '🌿', desc: 'Nature green' },
  rosegold: { name: 'Rose Gold', icon: '🌹', desc: 'Pink & gold' },
  galaxy: { name: 'Galaxy', icon: '✨', desc: 'Cosmic dark' },
  custom: { name: 'Custom', icon: '🎨', desc: 'Your style' },
};

const CHAT_BG_PATTERNS = [
  { id: 'none', label: 'None', icon: '⊘' },
  { id: 'dots', label: 'Dots', icon: '••' },
  { id: 'subtle', label: 'Subtle', icon: '·' },
  { id: 'lines', label: 'Lines', icon: '≡' },
  { id: 'grid', label: 'Grid', icon: '▦' },
  { id: 'zigzag', label: 'Zigzag', icon: '≋' },
  { id: 'circles', label: 'Circles', icon: '◌' },
];

const CHAT_BG_ANIMATIONS = [
  { id: 'none', label: 'None', icon: '—' },
  { id: 'aurora', label: 'Aurora', icon: '🌌' },
  { id: 'waves', label: 'Waves', icon: '🌊' },
  { id: 'pulse', label: 'Pulse', icon: '💫' },
  { id: 'drift', label: 'Drift', icon: '☁️' },
  { id: 'twinkle', label: 'Twinkle', icon: '✨' },
];

function applyChatTheme(userId, themeName) {
  const win = openChatWindows[userId];
  if (!win) return;

  const messagesArea = win.querySelector('.chat-window__messages');
  const headerActions = win.querySelector('.chat-window__header-actions');

  win.removeAttribute('data-chat-theme');

  const themeProps = [
    '--cht-window-bg', '--cht-hdr-bg', '--cht-hdr-text', '--cht-hdr-border',
    '--cht-sent-bg', '--cht-sent-text', '--cht-sent-bbr',
    '--cht-rcv-bg', '--cht-rcv-text', '--cht-rcv-bbl',
    '--cht-bg', '--cht-bg-img', '--cht-bg-overlay', '--cht-bg-anim',
    '--cht-in-bg', '--cht-in-area-bg',
    '--cht-in-border', '--cht-accent',
    '--cht-rcv-play-bg', '--cht-rcv-play-color', '--cht-rcv-wave-bg',
    '--cht-picker-color', '--cht-picker-hover-bg', '--cht-picker-hover-color',
    '--cht-mic-color', '--cht-mic-hover-bg', '--cht-mic-hover-color',
    '--cht-icon-color', '--cht-icon-hover-bg'
  ];
  themeProps.forEach(p => win.style.removeProperty(p));
  if (messagesArea) {
    messagesArea.style.removeProperty('background-image');
    messagesArea.classList.remove(
      'chat-bg-anim-aurora', 'chat-bg-anim-waves', 'chat-bg-anim-pulse',
      'chat-bg-anim-drift', 'chat-bg-anim-twinkle',
      'chat-bg-pattern-dots', 'chat-bg-pattern-lines', 'chat-bg-pattern-grid',
      'chat-bg-pattern-zigzag', 'chat-bg-pattern-circles', 'chat-bg-pattern-subtle'
    );
  }

  if (themeName === 'custom' && currentUser.chatThemeCustom) {
    const c = currentUser.chatThemeCustom;
    if (c.headerBg) win.style.setProperty('--cht-hdr-bg', c.headerBg);
    if (c.sentBg) win.style.setProperty('--cht-sent-bg', c.sentBg);
    if (c.sentText) win.style.setProperty('--cht-sent-text', c.sentText);
    if (c.receivedBg) win.style.setProperty('--cht-rcv-bg', c.receivedBg);
    if (c.receivedText) win.style.setProperty('--cht-rcv-text', c.receivedText);
    if (c.chatBg) win.style.setProperty('--cht-bg', c.chatBg);
    if (c.accent) win.style.setProperty('--cht-accent', c.accent);

    // Background image
    if (c.backgroundImage) {
      const imgUrl = c.backgroundImage;
      win.style.setProperty('--cht-bg-img', `url(${imgUrl})`);
    }

    // Background pattern (overrides image if set)
    if (c.bgPattern && c.bgPattern !== 'none') {
      if (messagesArea) messagesArea.classList.add(`chat-bg-pattern-${c.bgPattern}`);
    }

    // Background dim overlay
    const dim = parseFloat(c.bgDim) || 0;
    if (dim > 0) {
      win.style.setProperty('--cht-bg-overlay', `rgba(0,0,0,${dim})`);
    }

    // Background animation
    if (c.bgAnimation && c.bgAnimation !== 'none') {
      if (messagesArea) messagesArea.classList.add(`chat-bg-anim-${c.bgAnimation}`);
    }
  } else if (themeName !== 'default') {
    win.dataset.chatTheme = themeName;
  }

  currentUser.chatTheme = themeName;
}

async function saveChatTheme(userId, themeName) {
  applyChatTheme(userId, themeName);
  try {
    await apiFetch('/me', {
      method: 'PUT',
      body: JSON.stringify({ chatTheme: themeName }),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) { /* ignore */ }
}

async function saveCustomTheme(userId, customData) {
  currentUser.chatThemeCustom = customData;
  currentUser.chatTheme = 'custom';
  try {
    await apiFetch('/me', {
      method: 'PUT',
      body: JSON.stringify({
        chatTheme: 'custom',
        chatThemeCustom: customData
      }),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) { /* ignore */ }
  applyChatTheme(userId, 'custom');
}

function openThemePicker(userId) {
  const existing = document.querySelector('.chat-theme-picker-overlay');
  if (existing) existing.remove();

  const custom = currentUser.chatThemeCustom || {};
  const currentTheme = currentUser.chatTheme || 'default';

  const overlay = document.createElement('div');
  overlay.className = 'chat-theme-picker-overlay';
  overlay.innerHTML = `
    <div class="chat-theme-picker">
      <div class="chat-theme-picker__header">
        <h3>🎨 Chat Themes</h3>
        <button class="chat-theme-picker__close" onclick="this.closest('.chat-theme-picker-overlay').remove()">✕</button>
      </div>
      <div class="chat-theme-picker__body">
        <p class="chat-theme-picker__section-title">Preset Themes</p>
        <div class="chat-theme-picker__grid" id="themeGrid">
          ${Object.entries(CHAT_THEMES).filter(([k]) => k !== 'custom').map(([key, theme]) => `
            <div class="chat-theme-picker__item ${currentTheme === key ? 'active' : ''}" data-theme="${key}" onclick="selectPresetTheme('${userId}', '${key}')">
              <div class="chat-theme-picker__item-icon" style="background:${getThemePreviewBg(key)}">${theme.icon}</div>
              <span class="chat-theme-picker__item-name">${theme.name}</span>
            </div>
          `).join('')}
        </div>

        <div class="chat-theme-picker__custom">
          <p class="chat-theme-picker__section-title">Custom Theme</p>
          <div class="chat-theme-picker__custom-row">
            <label>Header</label>
            <input type="color" id="customHeaderBg" value="${custom.headerBg || '#1877f2'}">
          </div>
          <div class="chat-theme-picker__custom-row">
            <label>Sent Bubble</label>
            <input type="color" id="customSentBg" value="${custom.sentBg || '#1877f2'}">
            <input type="color" id="customSentText" value="${custom.sentText || '#ffffff'}" title="Text color">
          </div>
          <div class="chat-theme-picker__custom-row">
            <label>Received Bubble</label>
            <input type="color" id="customReceivedBg" value="${custom.receivedBg || '#f0f2f5'}">
            <input type="color" id="customReceivedText" value="${custom.receivedText || '#050505'}" title="Text color">
          </div>
          <div class="chat-theme-picker__custom-row">
            <label>Accent</label>
            <input type="color" id="customAccent" value="${custom.accent || '#1877f2'}">
          </div>
          <div class="chat-theme-picker__custom-row">
            <label>Background</label>
            <input type="file" id="customBgFile" accept="image/*">
            <div class="chat-theme-picker__bg-preview" id="customBgPreview" style="${custom.backgroundImage ? `background-image:url(${custom.backgroundImage})` : 'background:var(--bg)'}"></div>
            ${custom.backgroundImage ? `<button class="chat-theme-picker__close" onclick="removeCustomBg('${userId}')" title="Remove background" style="font-size:0.75rem;">✕</button>` : ''}
          </div>

          <p class="chat-theme-picker__section-title" style="margin-top:var(--space-md);">Background Pattern</p>
          <div class="chat-theme-picker__patterns" id="bgPatternGrid">
            ${CHAT_BG_PATTERNS.map(p => `
              <div class="chat-theme-picker__pattern-item ${(custom.bgPattern || 'none') === p.id ? 'active' : ''} ${p.id === 'none' ? 'chat-theme-picker__pattern-none' : ''}" data-pattern="${p.id}" onclick="selectBgPattern('${p.id}')" title="${p.label}" style="${p.id !== 'none' ? `background-image:var(--bg-pattern-${p.id}, none)` : ''}">
                ${p.id === 'none' ? 'Off' : p.icon}
              </div>
            `).join('')}
          </div>

          <p class="chat-theme-picker__section-title">Background Animation</p>
          <div class="chat-theme-picker__anim-grid" id="bgAnimGrid">
            ${CHAT_BG_ANIMATIONS.map(a => `
              <div class="chat-theme-picker__anim-item ${(custom.bgAnimation || 'none') === a.id ? 'active' : ''}" data-anim="${a.id}" onclick="selectBgAnim('${a.id}')">
                <span class="chat-theme-picker__anim-icon">${a.icon}</span>
                ${a.label}
              </div>
            `).join('')}
          </div>

          <div class="chat-theme-picker__dim-row">
            <label>Dim</label>
            <input type="range" class="chat-theme-picker__dim-slider" id="customBgDim" min="0" max="0.7" step="0.05" value="${custom.bgDim || 0}">
            <span class="chat-theme-picker__dim-value" id="customBgDimValue">${Math.round((custom.bgDim || 0) * 100)}%</span>
          </div>

          <button class="chat-theme-picker__save-btn" onclick="saveCustomThemeFromPicker('${userId}')">Apply Custom Theme</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const fileInput = document.getElementById('customBgFile');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const preview = document.getElementById('customBgPreview');
      if (preview) {
        const reader = new FileReader();
        reader.onload = (ev) => { preview.style.backgroundImage = `url(${ev.target.result})`; };
        reader.readAsDataURL(file);
      }
      try {
        const formData = new FormData();
        formData.append('background', file);
        const res = await fetch(API + '/upload/chat-bg', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          currentUser.chatThemeCustom = currentUser.chatThemeCustom || {};
          currentUser.chatThemeCustom.backgroundImage = data.url;
          showToast('Background uploaded! Apply custom theme to use it.', 'success');
        }
      } catch (err) {
        showToast('Upload failed', 'error');
      }
    });
  }

  // Dim slider live update
  const dimSlider = document.getElementById('customBgDim');
  const dimValue = document.getElementById('customBgDimValue');
  if (dimSlider && dimValue) {
    dimSlider.addEventListener('input', () => {
      dimValue.textContent = `${Math.round(parseFloat(dimSlider.value) * 100)}%`;
    });
  }
}

function selectBgPattern(patternId) {
  document.querySelectorAll('#bgPatternGrid .chat-theme-picker__pattern-item').forEach(el => {
    el.classList.toggle('active', el.dataset.pattern === patternId);
  });
}

function selectBgAnim(animId) {
  document.querySelectorAll('#bgAnimGrid .chat-theme-picker__anim-item').forEach(el => {
    el.classList.toggle('active', el.dataset.anim === animId);
  });
}

function getThemePreviewBg(theme) {
  const bgs = {
    default: 'var(--primary)',
    whatsapp: '#075e54',
    midnight: '#16213e',
    sunset: 'linear-gradient(135deg,#ff6b35,#e94560)',
    ocean: '#006994',
    lavender: '#7c4dff',
    forest: '#2d7d46',
    rosegold: 'linear-gradient(135deg,#e8a0b4,#d4738a)',
    galaxy: 'linear-gradient(135deg,#1a1a4e,#2d1b69)'
  };
  return bgs[theme] || 'var(--primary)';
}

function selectPresetTheme(userId, themeName) {
  document.querySelectorAll('.chat-theme-picker__item').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === themeName);
  });
  saveChatTheme(userId, themeName);
  showToast(`Theme set to ${CHAT_THEMES[themeName].name}`, 'success');
}

function removeCustomBg(userId) {
  if (currentUser.chatThemeCustom) {
    delete currentUser.chatThemeCustom.backgroundImage;
  }
  document.getElementById('customBgPreview').style.background = 'var(--bg)';
  const removeBtn = document.querySelector('.chat-theme-picker__custom-row button');
  if (removeBtn) removeBtn.remove();
  // Reset dim when removing background
  const dimSlider = document.getElementById('customBgDim');
  if (dimSlider) { dimSlider.value = '0'; dimSlider.dispatchEvent(new Event('input')); }
  saveCustomTheme(userId, currentUser.chatThemeCustom || {});
}

function saveCustomThemeFromPicker(userId) {
  const activePattern = document.querySelector('#bgPatternGrid .active');
  const activeAnim = document.querySelector('#bgAnimGrid .active');
  const dimSlider = document.getElementById('customBgDim');
  const customData = {
    headerBg: document.getElementById('customHeaderBg').value,
    sentBg: document.getElementById('customSentBg').value,
    sentText: document.getElementById('customSentText').value,
    receivedBg: document.getElementById('customReceivedBg').value,
    receivedText: document.getElementById('customReceivedText').value,
    accent: document.getElementById('customAccent').value,
    backgroundImage: (currentUser.chatThemeCustom && currentUser.chatThemeCustom.backgroundImage) || null,
    bgPattern: activePattern ? activePattern.dataset.pattern : 'none',
    bgAnimation: activeAnim ? activeAnim.dataset.anim : 'none',
    bgDim: dimSlider ? parseFloat(dimSlider.value) : 0,
  };
  document.querySelectorAll('.chat-theme-picker__item').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === 'custom');
  });
  saveCustomTheme(userId, customData);
  showToast('Custom theme applied!', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

async function init() {
  try {
    // Load all data in parallel for fast render
    await Promise.all([
      loadCurrentUser(),
      loadFeed(),
      loadNotifications(),
      loadFriendRequests(),
      loadSuggestions(),
      loadEmojiData(),
      loadGifLibrary(),
      loadStickerLibrary()
    ]);

    // Load online friends after we have users
    renderOnlineFriends();

    // Setup advanced post button after DOM
    setupAdvancedPostButton();
  } catch (err) {
    console.error('Dashboard init error:', err);
    showToast('Something went wrong loading the dashboard', 'error');
  }
}

// Expose socket + appendChatBubble globally for AdvancedAttach and other modules
window.__socket = socket;
window.__appendChatBubble = appendChatBubble;

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

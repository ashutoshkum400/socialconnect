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
const socket = io();
socket.emit('authenticate', token);

// ─── State ───────────────────────────────────────────────────────────────────
const API = '/api';
const HEADERS = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

let allUsers = [];             // cache from /api/users
let allNotifications = [];     // cache from /api/notifications
let onlineUserIds = new Set(); // user IDs currently online
let pendingRequests = [];      // pending friend requests list
let openChatWindows = {};      // { userId: windowElement }
let chatListAllUsers = [];     // all users for chat list
let lastMatchedUserId = null;  // for "send message" after match banner

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

  // Persist freshest user data
  localStorage.setItem('sc_user', JSON.stringify(user));

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

  const div = document.createElement('article');
  div.className = 'post-card card';
  div.setAttribute('data-post-id', post.id);
  div.setAttribute('role', 'article');
  div.setAttribute('aria-label', `Post by ${author.name || 'Unknown'}`);

  div.innerHTML = `
    <div class="post-card__header">
      <a href="/profile.html?id=${authorId}" class="post-card__avatar-link" style="flex-shrink:0;">
        <img
          src="${authorAvatar}"
          alt="${authorName}"
          class="post-card__avatar"
          onerror="this.src='${avatarUrl(author.name || 'U')}'"
        >
      </a>
      <div class="post-card__meta">
        <a href="/profile.html?id=${authorId}" class="post-card__name">${authorName}</a>
        ${authorUsername ? `<span style="font-size:var(--font-size-xs);color:var(--text-secondary);">@${authorUsername}</span>` : ''}
        <span class="post-card__time" title="${post.time || post.timestamp || ''}">${timeAgo(post.time || post.timestamp)}</span>
      </div>
      ${isOwn ? `
        <div class="dropdown" style="margin-left:auto;">
          <button
            class="post-card__options"
            onclick="togglePostOptionsMenu(event, '${post.id}')"
            aria-label="Post options"
            aria-haspopup="true"
          >•••</button>
          <div class="dropdown__menu hidden" id="postMenu_${post.id}" style="right:0;min-width:160px;">
            <div class="dropdown__item dropdown__item--danger" onclick="deletePost('${post.id}')">
              <span class="dropdown__icon">🗑️</span> Delete Post
            </div>
          </div>
        </div>
      ` : `
        <div style="margin-left:auto;">
          <button
            class="post-card__options"
            onclick="togglePostOptionsMenu(event, '${post.id}')"
            aria-label="Post options"
            aria-haspopup="true"
          >•••</button>
          <div class="dropdown__menu hidden" id="postMenu_${post.id}" style="right:0;min-width:160px;position:absolute;z-index:var(--z-dropdown);">
            <div class="dropdown__item" onclick="sendFriendRequest('${authorId}'); closeAllMenus();">
              <span class="dropdown__icon">👥</span> Add Friend
            </div>
            <div class="dropdown__item" onclick="followUser('${authorId}'); closeAllMenus();">
              <span class="dropdown__icon">➕</span> Follow
            </div>
            <div class="dropdown__item" onclick="openChat('${authorId}', '${authorName}', '${authorAvatar}'); closeAllMenus();">
              <span class="dropdown__icon">💬</span> Message
            </div>
          </div>
        </div>
      `}
    </div>                <!-- Feeling / Activity badges -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
                  ${post.feeling ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.feeling}</span>` : ''}
                  ${post.activity ? `<span class="tag" style="font-size:12px;padding:3px 10px;">${post.activity}</span>` : ''}
                  ${post.location ? `<span class="tag" style="font-size:12px;padding:3px 10px;">📍 ${post.location.name}</span>` : ''}
                </div>

                <div class="post-card__content${!post.image && (!post.media || !post.media.photos || !post.media.photos.length) && post.text && post.text.length < 120 ? ' large-text' : ''}">
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
          onclick="openPostModal('${post.id}')"
          style="cursor:pointer;"
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
          <div class="post-card__reactions-icons">👍❤️</div>
          <span>${likeCount} ${likeCount === 1 ? 'like' : 'likes'}</span>
        </div>
      ` : ''}
      ${commentCount > 0 ? `
        <button class="post-card__show-comments" onclick="toggleComments('${post.id}')">
          ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}
        </button>
      ` : ''}
    </div>

    <div class="post-card__actions">
      <button
        class="post-card__action-btn${liked ? ' liked' : ''}"
        id="likeBtn_${post.id}"
        onclick="likePost('${post.id}')"
        aria-label="${liked ? 'Unlike' : 'Like'} post"
        aria-pressed="${liked}"
      >
        <span aria-hidden="true">${liked ? '👍' : '👍'}</span>
        <span id="likeLabel_${post.id}">${liked ? 'Liked' : 'Like'}</span>
      </button>
      <button
        class="post-card__action-btn"
        onclick="toggleComments('${post.id}')"
        aria-label="Comment on post"
      >
        <span aria-hidden="true">💬</span> Comment
      </button>
      <button
        class="post-card__action-btn"
        onclick="sharePost('${post.id}')"
        aria-label="Share post"
      >
        <span aria-hidden="true">↗️</span> Share
      </button>
    </div>

    <!-- Comments Section (hidden by default) -->
    <div class="post-card__comments hidden" id="comments_${post.id}">
      <div id="commentList_${post.id}">
        ${comments.map(c => renderComment(c)).join('')}
      </div>
      <div class="post-card__comment-input">
        <img
          src="${currentUser.avatar || avatarUrl(currentUser.name || 'Me')}"
          alt="Your avatar"
          class="post-card__comment-avatar"
          style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
          onerror="this.src='${avatarUrl(currentUser.name || 'Me')}'"
        >
        <input
          type="text"
          placeholder="Write a comment..."
          aria-label="Write a comment"
          data-post-id="${post.id}"
          onkeydown="handleCommentKeydown(event, '${post.id}')"
        >
      </div>
    </div>
  `;

  return div;
}

function renderComment(comment) {
  const user = comment.user || {};
  const name = escapeHtml(user.name || 'Unknown');
  const avatar = user.avatar || avatarUrl(user.name || 'U');
  return `
    <div class="post-card__comment" data-comment-id="${comment.id || ''}">
      <img
        src="${avatar}"
        alt="${name}"
        class="post-card__comment-avatar"
        onerror="this.src='${avatarUrl(user.name || 'U')}'"
      >
      <div class="post-card__comment-bubble">
        <span class="post-card__comment-name">${name}</span>
        <p class="post-card__comment-text">${escapeHtml(comment.text || '')}</p>
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
         <p class="empty-state__text">No notifications yet</p>
       </div>
     `;
     return;
   }

   list.innerHTML = notifs.map(n => {
     const iconMap = {
       like: `<span class="notification-item__icon notification-item__icon--like">👍</span>`,
       comment: `<span class="notification-item__icon notification-item__icon--comment">💬</span>`,
       friend_request: `<span class="notification-item__icon notification-item__icon--friend">👥</span>`,
       friend_accept: `<span class="notification-item__icon notification-item__icon--friend">✅</span>`,
       follow: `<span class="notification-item__icon notification-item__icon--friend">➕</span>`,
       connect: `<span class="notification-item__icon notification-item__icon--match">💜</span>`,
       match: `<span class="notification-item__icon notification-item__icon--match">💕</span>`,
       message: `<span class="notification-item__icon">💬</span>`,
     };
     const icon = iconMap[n.type] || `<span class="notification-item__icon">🔔</span>`;

     let actionButtons = '';
     
     // Add action buttons based on notification type
     if (n.type === 'friend_request' && n.fromId) {
       actionButtons = `
         <div class="notification-item__actions">
           <button class="btn btn--primary btn--xs" onclick="acceptFriendRequest('${n.fromId}')">Accept</button>
         </div>
       `;
     } else if (n.type === 'follow' && n.fromId) {
       actionButtons = `
         <div class="notification-item__actions">
           <button class="btn btn--outline-primary btn--xs" onclick="followUser('${n.fromId}')">Follow Back</button>
         </div>
       `;
     } else if (n.type === 'connect' && n.fromId) {
       actionButtons = `
         <div class="notification-item__actions">
           <button class="btn btn--match btn--xs" onclick="acceptConnection('${n.fromId}')">Accept Connection</button>
         </div>
       `;
     } else if (n.type === 'like' || n.type === 'comment') {
       // Make notification clickable to go to the post
       const postId = n.postId || n.relatedId;
       if (postId) {
         return `
           <div class="notification-item${n.read ? '' : ' unread'}" data-notif-id="${n.id}" onclick="window.location.href='/post.html?id=${postId}'" style="cursor:pointer;">
             <div class="notification-item__avatar-wrap">
               ${icon}
             </div>
             <div class="notification-item__content">
               <p class="notification-item__text">${n.text || ''}</p>
               <span class="notification-item__time">${timeAgo(n.time)}</span>
             </div>
             ${!n.read ? `<span class="notification-item__unread-dot" aria-label="Unread"></span>` : ''}
           </div>
         `;
       }
     }

     return `
       <div class="notification-item${n.read ? '' : ' unread'}" data-notif-id="${n.id}">
         <div class="notification-item__avatar-wrap">
           ${icon}
         </div>
         <div class="notification-item__content">
           <p class="notification-item__text">${n.text || ''}</p>
           <span class="notification-item__time">${timeAgo(n.time)}</span>
         </div>
         ${actionButtons}
         ${!n.read ? `<span class="notification-item__unread-dot" aria-label="Unread"></span>` : ''}
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

async function markAllNotifsRead() {
  await apiFetch('/notifications/read', { method: 'PUT' });
  allNotifications = allNotifications.map(n => ({ ...n, read: true }));
  renderNotifications(allNotifications);
  updateNotifBadge();
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
  const modalList = document.getElementById('friendReqList');
  const sidebarList = document.getElementById('sidebarRequestsList');
  const sidebarWrap = document.getElementById('sidebarRequests');

  if (!pendingRequests.length) {
    const empty = `
      <div class="empty-state" style="padding:var(--space-lg) 0;">
        <div class="empty-state__icon">👥</div>
        <p class="empty-state__text">No pending friend requests</p>
      </div>
    `;
    if (modalList) modalList.innerHTML = empty;
    if (sidebarWrap) sidebarWrap.style.display = 'none';
    return;
  }

  const html = pendingRequests.map(req => {
    const user = req.user || {};
    const fromId = req.from || user.id || '';
    return `
      <div class="friend-request-item" data-from-id="${fromId}">
        <img
          src="${user.avatar || avatarUrl(user.name || 'U')}"
          alt="${escapeHtml(user.name || 'User')}"
          class="friend-request-item__avatar"
          onerror="this.src='${avatarUrl(user.name || 'U')}'"
        >
        <div class="friend-request-item__info">
          <a href="/profile.html?id=${fromId}" class="friend-request-item__name">
            ${escapeHtml(user.name || 'Unknown User')}
          </a>
          <span class="friend-request-item__mutual">
            ${timeAgo(req.time)}
          </span>
        </div>
        <div class="friend-request-item__actions">
          <button class="btn btn--primary btn--sm" onclick="acceptFriendRequest('${fromId}')">Confirm</button>
          <button class="btn btn--outline-secondary btn--sm" onclick="rejectFriendRequest('${fromId}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  if (modalList) modalList.innerHTML = html;

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
  const statsBar = card.querySelector('.post-card__stats');
  if (!statsBar) return;

  const count = Array.isArray(likes) ? likes.length : likes;
  if (count > 0) {
    let reactEl = statsBar.querySelector('.post-card__reactions');
    if (!reactEl) {
      reactEl = document.createElement('div');
      reactEl.className = 'post-card__reactions';
      statsBar.prepend(reactEl);
    }
    reactEl.innerHTML = `
      <div class="post-card__reactions-icons">👍❤️</div>
      <span>${count} ${count === 1 ? 'like' : 'likes'}</span>
    `;
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
    const statsBar = card.querySelector('.post-card__stats');
    if (statsBar) {
      let showBtn = statsBar.querySelector('.post-card__show-comments');
      if (!showBtn) {
        showBtn = document.createElement('button');
        showBtn.className = 'post-card__show-comments';
        showBtn.onclick = () => toggleComments(postId);
        statsBar.appendChild(showBtn);
      }
      const count = (document.getElementById(`commentList_${postId}`)?.children.length) || 1;
      showBtn.textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
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
  allNotifications.unshift(notif);
  updateNotifBadge();

  // If notif dropdown is open, refresh it
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    renderNotifications(allNotifications);
  }

  // Show toast for the notification
  showToast(notif.text || 'New notification', 'info', 4000);
});

socket.on('new_message_notif', ({ from, text, time }) => {
  const chatBadge = document.getElementById('chatLauncherBadge');
  if (chatBadge) {
    const current = parseInt(chatBadge.textContent) || 0;
    chatBadge.textContent = current + 1;
    chatBadge.classList.remove('hidden');
  }

  // Find sender name from allUsers
  const sender = allUsers.find(u => u.id === from);
  const senderName = sender ? sender.name : 'Someone';

  showToast(`💬 ${senderName}: ${text}`, 'info', 5000);
});

// ═══════════════════════════════════════════════════════════════════
// CHAT SYSTEM
// ═══════════════════════════════════════════════════════════════════

// --- Chat List Panel ---
function toggleChatListPanel() {
  const panel = document.getElementById('chatListPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);

  if (isHidden) {
    // Populate chat list
    renderChatList(chatListAllUsers);
    // Reset badge
    const msgBadge = document.getElementById('msgBadge');
    const chatBadge = document.getElementById('chatLauncherBadge');
    if (msgBadge) msgBadge.classList.add('hidden');
    if (chatBadge) chatBadge.classList.add('hidden');
  }
}

function renderChatList(users) {
  const list = document.getElementById('chatListItems');
  if (!list) return;

  const others = users.filter(u => u.id !== currentUser.id);
  if (!others.length) {
    list.innerHTML = `<div style="padding:var(--space-lg);text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">No conversations yet</div>`;
    return;
  }

  list.innerHTML = others.map(u => `
    <div
      class="chat-list-item"
      role="listitem"
      onclick="openChat('${u.id}', '${escapeHtml(u.name)}', '${u.avatar || avatarUrl(u.name)}')"
      tabindex="0"
      onkeydown="if(event.key==='Enter') openChat('${u.id}', '${escapeHtml(u.name)}', '${u.avatar || avatarUrl(u.name)}')"
      aria-label="Chat with ${escapeHtml(u.name)}"
    >
      <div class="chat-list-item__avatar-wrap" style="position:relative;">
        <img
          src="${u.avatar || avatarUrl(u.name)}"
          alt="${escapeHtml(u.name)}"
          class="chat-list-item__avatar"
          onerror="this.src='${avatarUrl(u.name)}'"
        >
        ${onlineUserIds.has(u.id) ? `<span class="online-dot online-dot--sm" style="position:absolute;bottom:0;right:0;"></span>` : ''}
      </div>
      <div class="chat-list-item__info">
        <span class="chat-list-item__name">${escapeHtml(u.name)}</span>
        <span class="chat-list-item__preview">${onlineUserIds.has(u.id) ? 'Active now' : 'Tap to message'}</span>
      </div>
    </div>
  `).join('');
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
        <button class="chat-window__header-btn" onclick="minimizeChatWindow('${userId}')" aria-label="Minimize">—</button>
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
    </div>
    <div class="chat-window__input-area">
      <button class="chat-window__emoji-btn" aria-label="Emoji">😊</button>
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
      <button class="chat-window__send-btn" onclick="sendMessageFromInput('${userId}')" aria-label="Send message">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  const container = document.getElementById('chatWindowsContainer');
  if (container) container.appendChild(win);
  openChatWindows[userId] = win;

  // Load history
  loadChatHistory(userId);

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

function renderChatHistory(userId, messages) {
  const msgContainer = document.getElementById(`chatMessages_${userId}`);
  if (!msgContainer) return;

  if (!messages.length) {
    msgContainer.innerHTML = `<div style="text-align:center;padding:var(--space-lg);color:var(--text-muted);font-size:var(--font-size-sm);">No messages yet. Say hello! 👋</div>`;
    return;
  }

  let lastDate = null;
  msgContainer.innerHTML = messages.map(msg => {
    const isSent = msg.senderId === currentUser.id;
    const msgDate = new Date(msg.time).toDateString();
    let separator = '';

    if (msgDate !== lastDate) {
      lastDate = msgDate;
      separator = `<div class="chat-date-separator"><span>${formatChatDate(msg.time)}</span></div>`;
    }

    return `
      ${separator}
      <div class="chat-bubble chat-bubble--${isSent ? 'sent' : 'received'}">
        ${escapeHtml(msg.text || '')}
        <span class="chat-bubble__time">${formatTime(msg.time)}</span>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// --- Send Message ---
function sendMessageFromInput(userId) {
  const input = document.getElementById(`chatInput_${userId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(userId, text);
}

function sendMessage(toUserId, text) {
  if (!text.trim()) return;

  socket.emit('send_message', { toUserId, text });

  // Optimistically append sent message
  appendChatBubble(toUserId, {
    text,
    senderId: currentUser.id,
    time: new Date().toISOString()
  });
}

function appendChatBubble(userId, msg) {
  const msgContainer = document.getElementById(`chatMessages_${userId}`);
  if (!msgContainer) return;

  // Remove "no messages" placeholder
  const placeholder = msgContainer.querySelector('div[style*="text-align:center"]');
  if (placeholder) placeholder.remove();

  const isSent = msg.senderId === currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble--${isSent ? 'sent' : 'received'}`;
  bubble.innerHTML = `
    ${escapeHtml(msg.text || '')}
    <span class="chat-bubble__time">${formatTime(msg.time)}</span>
  `;
  msgContainer.appendChild(bubble);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// --- Socket: Incoming Messages ---
socket.on('message', ({ chatKey, message }) => {
  // Determine the other user's ID from the chatKey
  const parts = chatKey.split('_');
  const otherUserId = parts.find(id => id !== currentUser.id);
  if (!otherUserId) return;

  // If chat window is open, append message
  if (openChatWindows[otherUserId]) {
    appendChatBubble(otherUserId, message);
  } else {
    // Otherwise show notification toast
    const sender = allUsers.find(u => u.id === message.senderId);
    const senderName = sender ? sender.name : 'Someone';
    const senderAvatar = sender ? (sender.avatar || avatarUrl(sender.name)) : '';
    showToast(`💬 ${senderName}: ${message.text}`, 'info', 5000, () => {
      openChat(message.senderId, senderName, senderAvatar);
    });
  }
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

function handleChatKeydown(event, userId) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessageFromInput(userId);
  }
}

function openChatFromMatch() {
  if (lastMatchedUserId) {
    const user = allUsers.find(u => u.id === lastMatchedUserId);
    if (user) openChat(user.id, user.name, user.avatar || avatarUrl(user.name));
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
  const btn = document.getElementById('notifBtn');
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  closeAllDropdowns();

  if (isHidden) {
    dropdown.classList.remove('hidden');
    btn && btn.setAttribute('aria-expanded', 'true');
    // Mark as read when opened
    if (allNotifications.some(n => !n.read)) {
      setTimeout(markAllNotifsRead, 2000);
    }
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

// Toggle post options menu
function togglePostOptionsMenu(event, postId) {
  event.stopPropagation();
  closeAllMenus();
  const menu = document.getElementById(`postMenu_${postId}`);
  if (menu) menu.classList.toggle('hidden');
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown') && !e.target.closest('.notifications-dropdown')) {
    closeAllDropdowns();
    closeAllMenus();
  }
});

// Escape key closes all
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllDropdowns();
    closeAllMenus();
    document.getElementById('searchResults')?.classList.add('hidden');
  }
});

// ═══════════════════════════════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function toggleFriendReqModal() {
  const modal = document.getElementById('friendReqModal');
  if (!modal) return;
  const isHidden = modal.classList.contains('hidden');
  if (isHidden) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    closeFriendReqModal();
  }
}

function closeFriendReqModal() {
  const modal = document.getElementById('friendReqModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

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
    if (modalId === 'friendReqModal') closeFriendReqModal();
    if (modalId === 'postModal') closePostModal();
  }
}

// ═══════════════════════════════════════════════════════════════════
// MATCH BANNER
// ═══════════════════════════════════════════════════════════════════

function showMatchBanner() {
  const banner = document.getElementById('matchBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Auto-close after 8 seconds
  setTimeout(closeMatchBanner, 8000);
}

function closeMatchBanner() {
  const banner = document.getElementById('matchBanner');
  if (banner) banner.classList.add('hidden');
  document.body.style.overflow = '';
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

function avatarUrl(name) {
  const initials = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=60`;
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
      loadSuggestions()
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

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

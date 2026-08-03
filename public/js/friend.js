// SocialConnect - Friend Management Page

SC.requireAuth();

const currentUser = SC.getCurrentUser();
const token = SC.getToken();

let pendingRequests = [];
let sentRequests = [];
let myFriends = [];
let allUsersCache = [];
let currentTab = 'requests';

function avatarUrl(name) {
  const initials = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=256`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  try {
    const res = await fetch((window.API_BASE || '') + '/api' + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) { SC.logout(); return null; }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null };
  }
}

// ─── Tab System ───────────────────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.friends-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.setAttribute('aria-selected', t.dataset.tab === tab);
  });
  document.getElementById('friendPageSubtitle').textContent = getSubtitle(tab);
  document.getElementById('friendSearch').value = '';
  loadTab(tab);
}

function getSubtitle(tab) {
  const map = { requests: 'Pending friend requests', suggestions: 'People you may know', sent: 'Sent friend requests', all: 'All your friends', discover: 'Find and connect with people', followers: 'People who follow you' };
  return map[tab] || '';
}

async function loadTab(tab) {
  const grid = document.getElementById('friendsGrid');
  showSkeletons(grid);
  try {
    switch (tab) {
      case 'requests': await renderRequests(); break;
      case 'suggestions': await renderSuggestions(); break;
      case 'sent': await renderSent(); break;
      case 'all': await renderAllFriends(); break;
      case 'discover': await renderDiscover(); break;
      case 'followers': await renderFollowers(); break;
    }
  } catch (e) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">Something went wrong</div><div class="empty-state__text">Please try again later</div></div>`;
  }
}

function showSkeletons(grid) {
  grid.innerHTML = Array(3).fill(`
    <div class="friend-skeleton">
      <div class="friend-skeleton__avatar"></div>
      <div class="friend-skeleton__lines">
        <div class="friend-skeleton__line"></div>
        <div class="friend-skeleton__line"></div>
      </div>
    </div>
  `).join('');
}

// ─── Load Data ────────────────────────────────────────────────────────────────

async function loadAllUsers() {
  if (allUsersCache.length) return;
  const result = await apiFetch('/users');
  if (result && result.ok) allUsersCache = result.data || [];
}

async function loadRequests() {
  const result = await apiFetch('/friends/requests');
  if (result && result.ok) pendingRequests = result.data || [];
  else pendingRequests = [];
  document.getElementById('requestsCount').textContent = pendingRequests.length;
}

async function loadSent() {
  const result = await apiFetch('/friends/sent');
  if (result && result.ok) sentRequests = result.data || [];
  else sentRequests = [];
}

async function loadFriends() {
  const result = await apiFetch('/friends/list');
  if (result && result.ok) myFriends = result.data || [];
  else myFriends = [];
  const countEl = document.getElementById('allFriendsCount');
  if (countEl) countEl.textContent = myFriends.length;
}

// ─── Render Functions ─────────────────────────────────────────────────────────

async function renderRequests() {
  await loadRequests();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();
  let items = pendingRequests;
  if (q) items = items.filter(r => (r.user?.name || '').toLowerCase().includes(q));
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">👥</div><div class="empty-state__title">${q ? 'No matching requests' : 'No pending requests'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'When someone sends you a friend request, it will appear here'}</div></div>`;
    return;
  }
  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${items.map(r => {
    const u = r.user || {};
    const fromId = r.from || u.id || '';
    return `
      <div class="friend-card" data-from-id="${fromId}">
        <a href="/profile.html?id=${fromId}"><img class="friend-card__avatar" src="${u.avatar || avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" onerror="this.src='${avatarUrl(u.name)}'"></a>
        <a href="/profile.html?id=${fromId}" class="friend-card__name">${escapeHtml(u.name || 'Unknown')}</a>
        <div class="friend-card__meta">${SC.timeAgo(r.time)}</div>
        <div class="friend-card__actions">
          <button class="btn btn--primary btn--sm" onclick="acceptRequest('${fromId}')">Confirm</button>
          <button class="btn btn--outline-secondary btn--sm" onclick="rejectRequest('${fromId}')">Delete</button>
        </div>
      </div>
    `;
  }).join('')}</div></div>`;
}

async function renderSuggestions() {
  await loadAllUsers();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();
  await loadFriends();
  await loadRequests();
  await loadSent();
  const myId = currentUser.id;
  const friendIds = new Set((myFriends || []).map(f => f.id));
  const requestIds = new Set(pendingRequests.map(r => r.from || r.user?.id));
  const sentIds = new Set(sentRequests.map(r => r.to || r.user?.id));

  let suggestions = allUsersCache.filter(u =>
    u.id !== myId &&
    !friendIds.has(u.id) &&
    !requestIds.has(u.id) &&
    !sentIds.has(u.id) &&
    u.role !== 'admin'
  );
  if (q) suggestions = suggestions.filter(u => (u.name || '').toLowerCase().includes(q));
  suggestions = suggestions.slice(0, 30);

  if (!suggestions.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">🔍</div><div class="empty-state__title">${q ? 'No matching people' : 'No suggestions'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'Check back later for new suggestions'}</div></div>`;
    return;
  }
  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${suggestions.map(u => `
    <div class="friend-card" data-user-id="${u.id}">
      <a href="/profile.html?id=${u.id}"><img class="friend-card__avatar" src="${u.avatar || avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" onerror="this.src='${avatarUrl(u.name)}'"></a>
      <a href="/profile.html?id=${u.id}" class="friend-card__name">${escapeHtml(u.name || 'Unknown')}</a>
      <div class="friend-card__meta">${u.location || ''}</div>
      <div class="friend-card__actions">
        <button class="btn btn--outline-primary btn--sm" data-friend-btn="${u.id}" onclick="addFriend('${u.id}')">Add Friend</button>
      </div>
    </div>
  `).join('')}</div></div>`;
}

async function renderSent() {
  await loadSent();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();
  let items = sentRequests;
  if (q) items = items.filter(r => (r.user?.name || '').toLowerCase().includes(q));
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">📤</div><div class="empty-state__title">${q ? 'No matching sent requests' : 'No sent requests'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'Friend requests you send will appear here'}</div></div>`;
    return;
  }
  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${items.map(r => {
    const u = r.user || {};
    const toId = r.to || u.id || '';
    return `
      <div class="friend-card" data-to-id="${toId}">
        <a href="/profile.html?id=${toId}"><img class="friend-card__avatar" src="${u.avatar || avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" onerror="this.src='${avatarUrl(u.name)}'"></a>
        <a href="/profile.html?id=${toId}" class="friend-card__name">${escapeHtml(u.name || 'Unknown')}</a>
        <div class="friend-card__meta">${SC.timeAgo(r.time)}</div>
        <div class="friend-card__actions">
          <button class="btn btn--outline-secondary btn--sm" onclick="cancelRequest('${toId}')">Cancel Request</button>
        </div>
      </div>
    `;
  }).join('')}</div></div>`;
}

async function renderAllFriends() {
  await loadFriends();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();
  let items = myFriends;
  if (q) items = items.filter(f => (f.name || '').toLowerCase().includes(q));
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">👫</div><div class="empty-state__title">${q ? 'No matching friends' : 'No friends yet'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'Start connecting with people to build your network'}</div></div>`;
    return;
  }
  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${items.map(f => `
    <div class="friend-card" data-friend-id="${f.id}">
      <a href="/profile.html?id=${f.id}"><img class="friend-card__avatar" src="${f.avatar || avatarUrl(f.name)}" alt="${escapeHtml(f.name)}" onerror="this.src='${avatarUrl(f.name)}'"></a>
      <a href="/profile.html?id=${f.id}" class="friend-card__name">${escapeHtml(f.name || 'Unknown')}</a>
      <div class="friend-card__meta">${f.location || f.bio ? escapeHtml(f.location || '') + (f.location && f.bio ? ' · ' : '') + escapeHtml(f.bio || '') : 'Friend'}</div>
      <div class="friend-card__actions">
        <button class="btn btn--outline-secondary btn--sm" onclick="removeFriend('${f.id}')">Unfriend</button>
      </div>
    </div>
  `).join('')}</div></div>`;
}

// ─── Followers ────────────────────────────────────────────────────────────────

async function renderFollowers() {
  await loadAllUsers();
  await loadMyRelations();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();

  const userMap = new Map(allUsersCache.map(u => [u.id, u]));
  let items = myFollowers.map(id => userMap.get(id)).filter(Boolean);
  if (q) items = items.filter(u => (u.name || '').toLowerCase().includes(q));

  const countEl = document.getElementById('followersCount');
  if (countEl) countEl.textContent = items.length;

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">👥</div><div class="empty-state__title">${q ? 'No matching followers' : 'No followers yet'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'When someone follows you, they will appear here'}</div></div>`;
    return;
  }

  const followingSet = new Set(myFollowing);

  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${items.map(u => {
    const isFollowing = followingSet.has(u.id);
    const followBtn = isFollowing
      ? `<button class="btn btn--secondary btn--sm" onclick="unfollowUser('${u.id}')">Following</button>`
      : `<button class="btn btn--outline-primary btn--sm" onclick="followUser('${u.id}')">Follow Back</button>`;

    return `
    <div class="friend-card" data-user-id="${u.id}">
      <a href="/profile.html?id=${u.id}"><img class="friend-card__avatar" src="${u.avatar || avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" onerror="this.src='${avatarUrl(u.name)}'"></a>
      <a href="/profile.html?id=${u.id}" class="friend-card__name">${escapeHtml(u.name || 'Unknown')}</a>
      <div class="friend-card__meta">${escapeHtml(u.location || '')}</div>
      <div class="friend-card__actions">${followBtn}</div>
    </div>`;
  }).join('')}</div></div>`;
}

// ─── Discover (Find People) ───────────────────────────────────────────────────

let myFollowing = [];
let myFollowers = [];
let myConnections = [];

async function loadMyRelations() {
  const result = await apiFetch('/me');
  if (result && result.ok && result.data) {
    const u = result.data;
    myFollowing = u.following || [];
    myFollowers = u.followers || [];
    myConnections = u.connections || [];
  }
}

async function renderDiscover() {
  await loadAllUsers();
  await loadMyRelations();
  await loadFriends();
  await loadRequests();
  await loadSent();
  const grid = document.getElementById('friendsGrid');
  const q = document.getElementById('friendSearch').value.toLowerCase().trim();
  const myId = currentUser.id;

  const friendIds = new Set((myFriends || []).map(f => f.id));
  const incomingIds = new Map();
  pendingRequests.forEach(r => { const id = r.from || r.user?.id; if (id) incomingIds.set(id, r); });
  const sentIds = new Set(sentRequests.map(r => r.to || r.user?.id));
  const followingSet = new Set(myFollowing);
  const followersSet = new Set(myFollowers);
  const connectionsSet = new Set(myConnections);

  let items = allUsersCache.filter(u => u.id !== myId && u.role !== 'admin');
  if (q) items = items.filter(u => (u.name || '').toLowerCase().includes(q));
  items.sort((a, b) => {
    const relA = friendIds.has(a.id) || incomingIds.has(a.id) || sentIds.has(a.id) || followingSet.has(a.id) || followersSet.has(a.id) || connectionsSet.has(a.id) ? 1 : 0;
    const relB = friendIds.has(b.id) || incomingIds.has(b.id) || sentIds.has(b.id) || followingSet.has(b.id) || followersSet.has(b.id) || connectionsSet.has(b.id) ? 1 : 0;
    return relA - relB;
  });

  const total = document.getElementById('discoverCount');
  if (total) total.textContent = items.length;

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state--friends"><div class="empty-state__icon">🔍</div><div class="empty-state__title">${q ? 'No matching people' : 'No users found'}</div><div class="empty-state__text">${q ? 'Try a different name' : 'Invite your friends to join SocialConnect'}</div></div>`;
    return;
  }

  grid.innerHTML = `<div class="friends-box"><div class="friends-box__grid">${items.map(u => {
    const isFriend = friendIds.has(u.id);
    const hasIncoming = incomingIds.has(u.id);
    const hasSent = sentIds.has(u.id);
    const isFollowing = followingSet.has(u.id);
    const isFollower = followersSet.has(u.id);
    const isConnected = connectionsSet.has(u.id);

    let friendBtn = '';
    if (isFriend) {
      friendBtn = `<button class="btn btn--secondary btn--sm" disabled style="width:100%;">Friends</button>`;
    } else if (hasIncoming) {
      const fromId = incomingIds.get(u.id).from || u.id;
      friendBtn = `<button class="btn btn--primary btn--sm" onclick="acceptRequest('${fromId}')" style="width:100%;">Confirm</button>`;
    } else if (hasSent) {
      friendBtn = `<button class="btn btn--outline-secondary btn--sm" disabled style="width:100%;">Requested</button>`;
    } else {
      friendBtn = `<button class="btn btn--outline-primary btn--sm" data-friend-btn="${u.id}" onclick="addFriend('${u.id}')" style="width:100%;">Add Friend</button>`;
    }

    let followBtn = '';
    if (isFollowing) {
      followBtn = `<button class="btn btn--secondary btn--sm" onclick="unfollowUser('${u.id}')">Following</button>`;
    } else {
      followBtn = `<button class="btn btn--outline-secondary btn--sm" onclick="followUser('${u.id}')">Follow</button>`;
    }

    let connectBtn = '';
    if (isConnected) {
      connectBtn = `<button class="btn btn--secondary btn--sm" disabled>Connected</button>`;
    } else {
      connectBtn = `<button class="btn btn--outline-secondary btn--sm" onclick="connectUser('${u.id}')">Connect</button>`;
    }

    return `
    <div class="friend-card" data-user-id="${u.id}">
      <a href="/profile.html?id=${u.id}"><img class="friend-card__avatar" src="${u.avatar || avatarUrl(u.name)}" alt="${escapeHtml(u.name)}" onerror="this.src='${avatarUrl(u.name)}'"></a>
      <a href="/profile.html?id=${u.id}" class="friend-card__name">${escapeHtml(u.name || 'Unknown')}</a>
      <div class="friend-card__meta">${escapeHtml(u.location || '')}</div>
      <div class="friend-card__actions" style="flex-direction:column;gap:6px;">
        <div style="width:100%;">${friendBtn}</div>
        <div style="display:flex;gap:6px;width:100%;justify-content:center;">${followBtn}${connectBtn}</div>
      </div>
    </div>`;
  }).join('')}</div></div>`;
}

async function followUser(userId) {
  const result = await apiFetch(`/follow/${userId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not follow user'); return; }
  SC.showSuccess('Following!');
  if (currentTab === 'discover') renderDiscover();
  else if (currentTab === 'followers') renderFollowers();
}

async function unfollowUser(userId) {
  const result = await apiFetch(`/unfollow/${userId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not unfollow'); return; }
  SC.showSuccess('Unfollowed');
  if (currentTab === 'discover') renderDiscover();
  else if (currentTab === 'followers') renderFollowers();
}

async function connectUser(userId) {
  const result = await apiFetch(`/connect/${userId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not send connection request'); return; }
  if (result.data?.match) {
    SC.showSuccess("It's a match! 🎉");
  } else {
    SC.showSuccess('Connection request sent!');
  }
  renderDiscover();
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function acceptRequest(fromId) {
  const result = await apiFetch(`/friends/accept/${fromId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not accept request'); return; }
  SC.showSuccess('Friend request accepted! 🎉');
  document.querySelectorAll(`[data-from-id="${fromId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  pendingRequests = pendingRequests.filter(r => (r.from || '') !== fromId);
  document.getElementById('requestsCount').textContent = pendingRequests.length;
  if (currentTab === 'discover') { renderDiscover(); return; }
  if (!pendingRequests.length && currentTab === 'requests') renderRequests();
}

async function rejectRequest(fromId) {
  const result = await apiFetch(`/friends/reject/${fromId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not reject request'); return; }
  document.querySelectorAll(`[data-from-id="${fromId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  pendingRequests = pendingRequests.filter(r => (r.from || '') !== fromId);
  document.getElementById('requestsCount').textContent = pendingRequests.length;
  if (currentTab === 'discover') { renderDiscover(); return; }
  if (!pendingRequests.length && currentTab === 'requests') renderRequests();
}

async function cancelRequest(toId) {
  const result = await apiFetch(`/friends/cancel/${toId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not cancel request'); return; }
  document.querySelectorAll(`[data-to-id="${toId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  sentRequests = sentRequests.filter(r => (r.to || '') !== toId);
  if (currentTab === 'discover') { renderDiscover(); return; }
  if (!sentRequests.length && currentTab === 'sent') renderSent();
}

async function removeFriend(friendId) {
  if (!confirm('Are you sure you want to remove this friend?')) return;
  const result = await apiFetch(`/friends/remove/${friendId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not remove friend'); return; }
  document.querySelectorAll(`[data-friend-id="${friendId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  myFriends = myFriends.filter(f => f.id !== friendId);
  const countEl = document.getElementById('allFriendsCount');
  if (countEl) countEl.textContent = myFriends.length;
  if (currentTab === 'discover') { renderDiscover(); return; }
  if (!myFriends.length && currentTab === 'all') renderAllFriends();
  SC.showSuccess('Friend removed');
}

async function rejectRequest(fromId) {
  const result = await apiFetch(`/friends/reject/${fromId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not reject request'); return; }
  document.querySelectorAll(`[data-from-id="${fromId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  pendingRequests = pendingRequests.filter(r => (r.from || '') !== fromId);
  document.getElementById('requestsCount').textContent = pendingRequests.length;
  if (!pendingRequests.length && currentTab === 'requests') renderRequests();
}

async function addFriend(userId) {
  const result = await apiFetch(`/friends/request/${userId}`, { method: 'POST' });
  if (!result) return;
  if (!result.ok) { SC.showWarning(result.data?.error || 'Could not send request'); return; }
  if (currentTab !== 'discover') {
    document.querySelectorAll(`[data-friend-btn="${userId}"]`).forEach(btn => {
      btn.textContent = 'Requested';
      btn.disabled = true;
      btn.classList.remove('btn--outline-primary');
      btn.classList.add('btn--outline-secondary');
    });
  }
  SC.showSuccess('Friend request sent!');
  if (currentTab === 'discover') renderDiscover();
}

async function cancelRequest(toId) {
  const result = await apiFetch(`/friends/cancel/${toId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not cancel request'); return; }
  document.querySelectorAll(`[data-to-id="${toId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  sentRequests = sentRequests.filter(r => (r.to || '') !== toId);
  if (!sentRequests.length && currentTab === 'sent') renderSent();
}

async function removeFriend(friendId) {
  if (!confirm('Are you sure you want to remove this friend?')) return;
  const result = await apiFetch(`/friends/remove/${friendId}`, { method: 'POST' });
  if (!result || !result.ok) { SC.showError('Could not remove friend'); return; }
  document.querySelectorAll(`[data-friend-id="${friendId}"]`).forEach(el => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  });
  myFriends = myFriends.filter(f => f.id !== friendId);
  const countEl = document.getElementById('allFriendsCount');
  if (countEl) countEl.textContent = myFriends.length;
  if (!myFriends.length && currentTab === 'all') renderAllFriends();
  SC.showSuccess('Friend removed');
}

// ─── Search ───────────────────────────────────────────────────────────────────

let searchDebounce;
document.getElementById('friendSearch').addEventListener('input', function() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadTab(currentTab), 200);
});

// ─── Navbar Helpers ───────────────────────────────────────────────────────────

function logout() { SC.logout(); }

function goToProfile() {
  window.location.href = `/profile.html?id=${currentUser.id}`;
}

function toggleProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (!dd) return;
  const btn = document.getElementById('navAvatar');
  dd.classList.toggle('hidden');
  btn.setAttribute('aria-expanded', !dd.classList.contains('hidden'));
}

document.addEventListener('click', function(e) {
  const wrap = document.getElementById('profileDropdownWrap');
  const dd = document.getElementById('profileDropdown');
  if (wrap && dd && !wrap.contains(e.target)) {
    dd.classList.add('hidden');
    const btn = document.getElementById('navAvatar');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  // Set navbar avatar
  const navAvatar = document.getElementById('navAvatar');
  if (navAvatar && currentUser) {
    const src = currentUser.avatar || avatarUrl(currentUser.name || 'User');
    navAvatar.style.backgroundImage = `url('${src}')`;
    navAvatar.style.backgroundSize = 'cover';
    navAvatar.style.backgroundPosition = 'center';
  }
  await loadRequests();
  await loadFriends();
  switchTab('requests');
})();

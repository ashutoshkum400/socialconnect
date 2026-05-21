'use strict';

// ─── Auth Guard ───────────────────────────────────────────────────────────────
const token       = localStorage.getItem('sc_token');
const currentUser = JSON.parse(localStorage.getItem('sc_user') || '{}');
if (!token || currentUser.role !== 'admin') {
  window.location.href = '/index.html';
}

// ─── State ────────────────────────────────────────────────────────────────────
let allUsers      = [];
let allPosts      = [];
let filteredUsers = [];
let currentPage   = 1;
const PAGE_SIZE   = 10;
let sortCol       = 'joinedAt';
let sortDir       = 'desc';
let currentSection = 'dashboard';
let socket        = null;
let onlineUserIds = new Set();

// ─── API helper ───────────────────────────────────────────────────────────────
function api(path, opts = {}) {
  const headers = { 'Authorization': 'Bearer ' + token, ...opts.headers };
  if (opts.body && typeof opts.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(path, { ...opts, headers });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Populate admin info in UI
  const name   = currentUser.name || 'Admin User';
  const avatar = currentUser.avatar ||
    'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=1877f2&color=fff&size=128';

  document.getElementById('sidebarName').textContent  = name;
  document.getElementById('topbarName').textContent   = name;
  document.getElementById('sidebarAvatar').src        = avatar;
  document.getElementById('topbarAvatar').src         = avatar;

  // Wire up modal overlay clicks (close on backdrop)
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Load data
  await Promise.all([loadStats(), loadUsers()]);

  // Socket
  initSocket();

  // Handle hash navigation on load
  const hash = window.location.hash.replace('#', '');
  if (hash && ['dashboard','users','posts','messages','analytics','settings'].includes(hash)) {
    switchSection(hash);
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
function initSocket() {
  try {
    socket = io();

    socket.emit('authenticate', token);

    socket.on('authenticated', function() {
      console.log('[admin] Socket authenticated');
    });

    socket.on('auth_error', function(data) {
      console.warn('[admin] Socket auth error:', data.error);
    });

    // Real-time online presence
    socket.on('user_online', function(data) {
      if (data.online) {
        onlineUserIds.add(data.userId);
      } else {
        onlineUserIds.delete(data.userId);
      }
      // Update online dots in any visible table row
      document.querySelectorAll('.online-dot-badge[data-uid="' + data.userId + '"]').forEach(function(dot) {
        dot.style.background = data.online ? 'var(--success)' : 'var(--border)';
        dot.title = data.online ? 'Online' : 'Offline';
      });
      // Update the active users stat card
      var el = document.getElementById('statActiveUsers');
      if (el) el.textContent = onlineUserIds.size;
    });

    // Real-time new post — prepend to posts table if section is open
    socket.on('new_post', function(post) {
      allPosts.unshift(post);
      if (currentSection === 'posts') {
        renderPostsTable(allPosts);
        var cnt = document.getElementById('postsCount');
        if (cnt) cnt.textContent = allPosts.length + ' posts';
      }
      // bump badge
      var badge = document.getElementById('navPostsBadge');
      if (badge) { badge.textContent = allPosts.length; badge.style.display = 'inline-flex'; }
      showToast('New post published!', 'info');
    });

    // Post deleted remotely
    socket.on('delete_post', function(postId) {
      allPosts = allPosts.filter(function(p) { return p.id !== postId; });
      if (currentSection === 'posts') renderPostsTable(allPosts);
    });

  } catch (e) {
    console.warn('[admin] Socket.IO not available:', e.message);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    var res = await api('/api/admin/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    var s = await res.json();

    setText('statTotalUsers',    s.totalUsers);
    setText('statActiveUsers',   s.activeUsers);
    setText('statBlockedUsers',  s.blockedUsers);
    setText('statTotalPosts',    s.totalPosts);
    setText('statTotalMessages', s.totalMessages);
    setText('messagesTotal',     s.totalMessages);

    var ub = document.getElementById('navUsersBadge');
    if (ub) { ub.textContent = s.totalUsers; ub.style.display = 'inline-flex'; }

    var pb = document.getElementById('navPostsBadge');
    if (pb) { pb.textContent = s.totalPosts; pb.style.display = 'inline-flex'; }

  } catch (err) {
    console.error('loadStats:', err);
    showToast('Failed to load statistics', 'error');
  }
}

// ─── Users: load + render ─────────────────────────────────────────────────────
async function loadUsers() {
  try {
    var res = await api('/api/users/all');
    if (!res.ok) throw new Error('Failed to load users');
    allUsers = await res.json();
    renderRecentUsers();
    applyFilters();
  } catch (err) {
    console.error('loadUsers:', err);
    showToast('Failed to load users', 'error');
    var rb = document.getElementById('recentUsersBody');
    if (rb) rb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--danger);">Failed to load users</td></tr>';
    var ub = document.getElementById('usersTableBody');
    if (ub) ub.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--danger);">Failed to load users</td></tr>';
  }
}

function renderRecentUsers() {
  var sorted = allUsers.slice().sort(function(a, b) {
    return new Date(b.joinedAt) - new Date(a.joinedAt);
  }).slice(0, 10);

  var tbody = document.getElementById('recentUsersBody');
  if (!tbody) return;

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">No users yet</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(function(u) {
    return '<tr>' +
      '<td>' + userCell(u) + '</td>' +
      '<td style="color:var(--text-secondary);font-size:0.8125rem;">@' + esc(u.username) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.8125rem;">' + esc(u.location || '—') + '</td>' +
      '<td>' + roleBadge(u.role) + '</td>' +
      '<td>' + statusBadge(u.blocked) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">' + formatDate(u.joinedAt) + '</td>' +
      '</tr>';
  }).join('');
}

// ─── Users: filters + sort ────────────────────────────────────────────────────
function applyFilters() {
  var search = ((document.getElementById('usersSearch') || {}).value || '').toLowerCase().trim();
  var role   = ((document.getElementById('filterRole')   || {}).value || '');
  var status = ((document.getElementById('filterStatus') || {}).value || '');

  filteredUsers = allUsers.filter(function(u) {
    var matchSearch = !search ||
      (u.name     || '').toLowerCase().includes(search) ||
      (u.username || '').toLowerCase().includes(search) ||
      (u.email    || '').toLowerCase().includes(search) ||
      (u.location || '').toLowerCase().includes(search);
    var matchRole   = !role   || u.role === role;
    var matchStatus = !status ||
      (status === 'active'  && !u.blocked) ||
      (status === 'blocked' &&  u.blocked);
    return matchSearch && matchRole && matchStatus;
  });

  filteredUsers = sortUsers(filteredUsers, sortCol, sortDir);
  currentPage = 1;
  renderUsersTable(filteredUsers);
  renderPagination();

  var cnt = document.getElementById('usersCount');
  if (cnt) cnt.textContent = filteredUsers.length + ' of ' + allUsers.length + ' users';
}

function sortUsers(users, col, dir) {
  return users.slice().sort(function(a, b) {
    var av = a[col] == null ? '' : a[col];
    var bv = b[col] == null ? '' : b[col];
    if (col === 'joinedAt') {
      av = new Date(av).getTime() || 0;
      bv = new Date(bv).getTime() || 0;
      return dir === 'asc' ? av - bv : bv - av;
    }
    av = String(av).toLowerCase();
    bv = String(bv).toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

function sortTable(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = 'asc';
  }
  // Reset all sort icons
  document.querySelectorAll('.sort-icon').forEach(function(el) {
    el.textContent = '↕';
    el.classList.remove('asc', 'desc');
  });
  var icon = document.getElementById('sort-' + col);
  if (icon) {
    icon.textContent = sortDir === 'asc' ? '↑' : '↓';
    icon.classList.add(sortDir);
  }
  applyFilters();
}

function clearFilters() {
  var s = document.getElementById('usersSearch');
  var r = document.getElementById('filterRole');
  var t = document.getElementById('filterStatus');
  if (s) s.value = '';
  if (r) r.value = '';
  if (t) t.value = '';
  applyFilters();
}

// ─── Users: table rendering ───────────────────────────────────────────────────
function renderUsersTable(users) {
  var tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  var start = (currentPage - 1) * PAGE_SIZE;
  var page  = users.slice(start, start + PAGE_SIZE);

  if (!page.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:48px;color:var(--text-muted);">' +
      '<div style="font-size:2.5rem;margin-bottom:12px;">🔍</div>' +
      '<div style="font-weight:600;">No users match your search or filters</div>' +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = page.map(function(u) {
    var blockBtn = u.blocked
      ? '<button class="action-btn action-btn--unblock" onclick="unblockUser(\'' + escJs(u.id) + '\',\'' + escJs(u.name) + '\')" title="Unblock user">✅ Unblock</button>'
      : '<button class="action-btn action-btn--block"   onclick="blockUser(\''   + escJs(u.id) + '\',\'' + escJs(u.name) + '\')" title="Block user">🚫 Block</button>';

    var deleteBtn = (u.id !== 'admin' && u.id !== currentUser.id)
      ? '<button class="action-btn action-btn--delete" onclick="deleteUser(\'' + escJs(u.id) + '\',\'' + escJs(u.name) + '\')" title="Delete user">🗑️</button>'
      : '';

    return '<tr data-userid="' + u.id + '">' +
      '<td>' + userCell(u) + '</td>' +
      '<td style="color:var(--text-secondary);font-size:0.8125rem;">@' + esc(u.username) + '</td>' +
      '<td style="font-size:0.8rem;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(u.email) + '</td>' +
      '<td>' + roleBadge(u.role) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.8rem;">' + esc(u.location || '—') + '</td>' +
      '<td>' + statusBadge(u.blocked) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">' + formatDate(u.joinedAt) + '</td>' +
      '<td>' +
        '<div class="admin-table__actions">' +
          '<button class="action-btn action-btn--view"   onclick="viewUser(\''       + escJs(u.id) + '\')" title="View profile">👁️ View</button>' +
          '<button class="action-btn action-btn--edit"   onclick="openEditUserModal(\'' + escJs(u.id) + '\')" title="Edit user">✏️ Edit</button>' +
          blockBtn + deleteBtn +
        '</div>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ─── Users: pagination ────────────────────────────────────────────────────────
function renderPagination() {
  var total      = filteredUsers.length;
  var totalPages = Math.ceil(total / PAGE_SIZE);
  var start      = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  var end        = Math.min(currentPage * PAGE_SIZE, total);

  var info    = document.getElementById('paginationInfo');
  var buttons = document.getElementById('paginationButtons');
  if (!info || !buttons) return;

  info.textContent = total === 0 ? 'No results' : 'Showing ' + start + '–' + end + ' of ' + total;

  if (totalPages <= 1) { buttons.innerHTML = ''; return; }

  var html = '';
  html += '<button class="btn btn--secondary btn--sm" onclick="goToPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>&#8249;</button>';

  var range = getPageRange(currentPage, totalPages);
  range.forEach(function(p) {
    if (p === '...') {
      html += '<span style="padding:6px 8px;color:var(--text-muted);">…</span>';
    } else {
      var cls = p === currentPage ? 'btn--primary' : 'btn--secondary';
      html += '<button class="btn ' + cls + ' btn--sm" onclick="goToPage(' + p + ')">' + p + '</button>';
    }
  });

  html += '<button class="btn btn--secondary btn--sm" onclick="goToPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>&#8250;</button>';
  buttons.innerHTML = html;
}

function getPageRange(current, total) {
  if (total <= 7) {
    var r = [];
    for (var i = 1; i <= total; i++) r.push(i);
    return r;
  }
  if (current <= 4)        return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total-4, total-3, total-2, total-1, total];
  return [1, '...', current-1, current, current+1, '...', total];
}

function goToPage(page) {
  var totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderUsersTable(filteredUsers);
  renderPagination();
  var wrap = document.querySelector('#usersSection .admin-table-wrap:last-of-type');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Add User ─────────────────────────────────────────────────────────────────
function openAddUserModal() {
  document.getElementById('addUserForm').reset();
  hideEl('addUserError');
  var btn = document.getElementById('addUserSubmitBtn');
  btn.disabled    = false;
  btn.textContent = '✅ Create User';
  openModal('addUserModal');
  setTimeout(function() {
    var f = document.getElementById('addName');
    if (f) f.focus();
  }, 120);
}

async function submitAddUser() {
  var btn    = document.getElementById('addUserSubmitBtn');
  var errEl  = document.getElementById('addUserError');

  var name     = document.getElementById('addName').value.trim();
  var username = document.getElementById('addUsername').value.trim();
  var email    = document.getElementById('addEmail').value.trim();
  var password = document.getElementById('addPassword').value;
  var role     = document.getElementById('addRole').value;
  var gender   = document.getElementById('addGender').value;
  var location = document.getElementById('addLocation').value.trim();

  hideEl('addUserError');
  if (!name)     return showInlineError(errEl, 'Full name is required.');
  if (!username) return showInlineError(errEl, 'Username is required.');
  if (!email)    return showInlineError(errEl, 'Email address is required.');
  if (!password) return showInlineError(errEl, 'Password is required.');
  if (password.length < 8) return showInlineError(errEl, 'Password must be at least 8 characters.');

  btn.disabled    = true;
  btn.textContent = '⏳ Creating…';

  try {
    var res = await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, role, gender, location })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create user');

    showToast('User "' + name + '" created successfully!', 'success');
    closeModal('addUserModal');
    await loadUsers();
    await loadStats();

  } catch (err) {
    showInlineError(errEl, err.message);
    btn.disabled    = false;
    btn.textContent = '✅ Create User';
  }
}

// ─── Edit User ────────────────────────────────────────────────────────────────
async function openEditUserModal(userId) {
  hideEl('editUserError');
  document.getElementById('editUserStats').innerHTML =
    '<div style="color:var(--text-muted);font-size:0.8rem;grid-column:1/-1;text-align:center;padding:8px;">' +
    '<span class="loading-spinner"></span>Loading…</div>';
  openModal('editUserModal');

  try {
    var res = await api('/api/users/' + userId);
    if (!res.ok) throw new Error('User not found');
    var user = await res.json();

    document.getElementById('editUserId').value              = user.id;
    document.getElementById('editName').value                = user.name || '';
    document.getElementById('editUsername').value            = user.username || '';
    document.getElementById('editEmail').value               = user.email || '';
    document.getElementById('editBio').value                 = user.bio || '';
    document.getElementById('editLocation').value            = user.location || '';
    document.getElementById('editRole').value                = user.role || 'user';
    document.getElementById('editGender').value              = user.gender || '';
    document.getElementById('editLookingFor').value          = user.lookingFor || '';
    document.getElementById('editRelationshipStatus').value  = user.relationshipStatus || '';

    var postsCount = allPosts.filter(function(p) {
      return p.authorId === user.id || (p.author && p.author.id === user.id);
    }).length;

    document.getElementById('editUserStats').innerHTML =
      statMini((user.friends || []).length,   'Friends') +
      statMini((user.followers || []).length, 'Followers') +
      statMini(postsCount,                    'Posts') +
      statMiniSmall(formatDate(user.joinedAt), 'Joined');

    var btn = document.getElementById('editUserSubmitBtn');
    btn.disabled    = false;
    btn.textContent = '💾 Save Changes';

  } catch (err) {
    showToast('Failed to load user data: ' + err.message, 'error');
    closeModal('editUserModal');
  }
}

async function submitEditUser() {
  var userId = document.getElementById('editUserId').value;
  var btn    = document.getElementById('editUserSubmitBtn');
  var errEl  = document.getElementById('editUserError');

  var name               = document.getElementById('editName').value.trim();
  var username           = document.getElementById('editUsername').value.trim();
  var email              = document.getElementById('editEmail').value.trim();
  var bio                = document.getElementById('editBio').value.trim();
  var location           = document.getElementById('editLocation').value.trim();
  var role               = document.getElementById('editRole').value;
  var gender             = document.getElementById('editGender').value;
  var lookingFor         = document.getElementById('editLookingFor').value;
  var relationshipStatus = document.getElementById('editRelationshipStatus').value;

  hideEl('editUserError');
  if (!name)     return showInlineError(errEl, 'Full name is required.');
  if (!username) return showInlineError(errEl, 'Username is required.');
  if (!email)    return showInlineError(errEl, 'Email address is required.');

  btn.disabled    = true;
  btn.textContent = '⏳ Saving…';

  try {
    var res = await api('/api/users/' + userId, {
      method: 'PUT',
      body: JSON.stringify({ name, username, email, bio, location, role, gender, lookingFor, relationshipStatus })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update user');

    showToast('User "' + name + '" updated successfully!', 'success');
    closeModal('editUserModal');
    await loadUsers();

  } catch (err) {
    showInlineError(errEl, err.message);
    btn.disabled    = false;
    btn.textContent = '💾 Save Changes';
  }
}

// ─── Block / Unblock ──────────────────────────────────────────────────────────
async function blockUser(userId, userName) {
  if (!confirm('Block "' + userName + '"? They will be unable to log in.')) return;
  try {
    var res = await api('/api/users/' + userId + '/block', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to block user');
    showToast('"' + userName + '" has been blocked.', 'warning');
    await loadUsers();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function unblockUser(userId, userName) {
  try {
    var res = await api('/api/users/' + userId + '/unblock', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to unblock user');
    showToast('"' + userName + '" has been unblocked.', 'success');
    await loadUsers();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────────
function deleteUser(userId, userName) {
  document.getElementById('deleteUserName').textContent = '"' + userName + '"';

  // Clone to strip stale listeners
  var oldBtn = document.getElementById('deleteConfirmBtn');
  var newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.addEventListener('click', async function() {
    newBtn.disabled    = true;
    newBtn.textContent = '⏳ Deleting…';
    try {
      var res = await api('/api/users/' + userId, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      showToast('"' + userName + '" has been permanently deleted.', 'success');
      closeModal('deleteConfirmModal');
      await loadUsers();
      await loadStats();
    } catch (err) {
      showToast(err.message, 'error');
      newBtn.disabled    = false;
      newBtn.textContent = '🗑️ Yes, Delete';
    }
  });

  openModal('deleteConfirmModal');
}

// ─── View User ────────────────────────────────────────────────────────────────
async function viewUser(userId) {
  document.getElementById('viewUserContent').innerHTML =
    '<div style="text-align:center;padding:48px;color:var(--text-muted);"><span class="loading-spinner"></span>Loading profile…</div>';
  openModal('viewUserModal');

  document.getElementById('viewEditBtn').onclick = function() {
    closeModal('viewUserModal');
    openEditUserModal(userId);
  };

  try {
    var res = await api('/api/users/' + userId);
    if (!res.ok) throw new Error('User not found');
    var user = await res.json();

    var postsCount = allPosts.filter(function(p) {
      return p.authorId === userId || (p.author && p.author.id === userId);
    }).length;

    var interestsHtml = (user.interests || []).map(function(i) {
      return '<span class="tag">' + esc(i) + '</span>';
    }).join('');

    var coverUrl = esc(user.coverPhoto || 'https://picsum.photos/seed/' + userId + '/800/300');
    var avatarFallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User') + '&background=random&size=128';

    document.getElementById('viewUserContent').innerHTML =
      '<img class="view-user-cover" src="' + coverUrl + '" alt="Cover photo" onerror="this.style.display=\'none\'">' +
      '<div class="view-user-body">' +
        '<div class="view-user-avatar-row">' +
          '<img class="view-user-avatar" src="' + esc(user.avatar || avatarFallback) + '" alt="' + esc(user.name) + '" onerror="this.src=\'' + avatarFallback + '\'">' +
          '<div>' +
            '<div class="view-user-name">' + esc(user.name) + '</div>' +
            '<div class="view-user-username">' +
              '@' + esc(user.username) + ' ' +
              roleBadge(user.role) + ' ' + statusBadge(user.blocked) +
            '</div>' +
          '</div>' +
        '</div>' +

        (user.bio ? '<p style="color:var(--text-secondary);font-size:0.9375rem;margin-bottom:14px;line-height:1.5;">' + esc(user.bio) + '</p>' : '') +

        '<div class="view-user-stats">' +
          viewStat((user.friends || []).length,   'Friends') +
          viewStat((user.followers || []).length, 'Followers') +
          viewStat((user.following || []).length, 'Following') +
          viewStat(postsCount,                    'Posts') +
        '</div>' +

        '<div class="view-user-info-grid">' +
          infoRow('📧 Email',        user.email) +
          infoRow('📍 Location',     user.location || '—') +
          infoRow('⚧ Gender',        capitalize(user.gender)) +
          infoRow('🎂 Birth Date',    user.birthDate || '—') +
          infoRow('📅 Joined',        formatDate(user.joinedAt)) +
          infoRow('🕐 Last Seen',     timeAgo(user.lastSeen)) +
          infoRow('💑 Looking For',   capitalize(user.lookingFor)) +
          infoRow('💝 Status',        capitalize((user.relationshipStatus || '').replace('_', ' '))) +
        '</div>' +

        (interestsHtml
          ? '<div style="margin-top:16px;">' +
              '<div class="view-user-info-label" style="margin-bottom:8px;">🎯 Interests</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + interestsHtml + '</div>' +
            '</div>'
          : '') +
      '</div>';

  } catch (err) {
    document.getElementById('viewUserContent').innerHTML =
      '<div style="text-align:center;padding:48px;color:var(--danger);">❌ ' + esc(err.message) + '</div>';
  }
}

// ─── Posts ────────────────────────────────────────────────────────────────────
async function loadPosts() {
  var tbody = document.getElementById('postsTableBody');
  if (tbody) tbody.innerHTML = '<tr class="loading-row"><td colspan="7"><span class="loading-spinner"></span>Loading posts…</td></tr>';

  try {
    var res = await api('/api/posts');
    if (!res.ok) throw new Error('Failed to load posts');
    allPosts = await res.json();
    renderPostsTable(allPosts);
    var cnt = document.getElementById('postsCount');
    if (cnt) cnt.textContent = allPosts.length + ' posts';
  } catch (err) {
    console.error('loadPosts:', err);
    showToast('Failed to load posts', 'error');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--danger);">❌ Failed to load posts</td></tr>';
  }
}

function renderPostsTable(posts) {
  var tbody = document.getElementById('postsTableBody');
  if (!tbody) return;

  if (!posts || !posts.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--text-muted);">' +
      '<div style="font-size:2.5rem;margin-bottom:12px;">📝</div><div style="font-weight:600;">No posts found</div>' +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = posts.map(function(p) {
    var author   = p.author || {};
    var text     = (p.text || '');
    var preview  = text.length > 90 ? text.slice(0, 90) + '…' : text;
    var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(author.name || 'User') + '&background=random&size=128';

    var mediaHtml = p.image
      ? '<img src="' + esc(p.image) + '" class="post-thumb" alt="Post image" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    return '<tr>' +
      '<td>' +
        '<div class="admin-table__user">' +
          '<img src="' + esc(author.avatar || fallback) + '" class="admin-table__avatar" alt="" onerror="this.src=\'' + fallback + '\'">' +
          '<div>' +
            '<div class="admin-table__name">' + esc(author.name || 'Unknown') + '</div>' +
            '<div class="admin-table__email">@' + esc(author.username || '—') + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="max-width:260px;font-size:0.8rem;color:var(--text-secondary);">' +
        (preview ? esc(preview) : '<em style="color:var(--text-muted);">No text</em>') +
      '</td>' +
      '<td>' + mediaHtml + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--secondary);">' + (p.likes || []).length + '</td>' +
      '<td style="text-align:center;font-weight:700;color:var(--primary);">'   + (p.comments || []).length + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap;">' + timeAgo(p.time) + '</td>' +
      '<td>' +
        '<button class="action-btn action-btn--delete" onclick="deletePost(\'' + escJs(p.id) + '\')">🗑️ Delete</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function filterPosts(query) {
  var q = query.toLowerCase().trim();
  var filtered = q
    ? allPosts.filter(function(p) {
        return (p.text || '').toLowerCase().includes(q) ||
               ((p.author && p.author.name)     || '').toLowerCase().includes(q) ||
               ((p.author && p.author.username) || '').toLowerCase().includes(q);
      })
    : allPosts;
  renderPostsTable(filtered);
  var cnt = document.getElementById('postsCount');
  if (cnt) cnt.textContent = filtered.length + (q ? ' of ' + allPosts.length : '') + ' posts';
}

async function deletePost(postId) {
  var post    = allPosts.find(function(p) { return p.id === postId; });
  var preview = post ? '"' + (post.text || 'image post').slice(0, 50) + '"' : 'this post';
  if (!confirm('Delete ' + preview + '?\n\nThis cannot be undone.')) return;

  try {
    var res = await api('/api/posts/' + postId, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete post');
    allPosts = allPosts.filter(function(p) { return p.id !== postId; });
    renderPostsTable(allPosts);
    var cnt = document.getElementById('postsCount');
    if (cnt) cnt.textContent = allPosts.length + ' posts';
    showToast('Post deleted successfully.', 'success');
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  var container = document.getElementById('analyticsContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:56px;color:var(--text-muted);"><span class="loading-spinner"></span>Loading analytics…</div>';

  try {
    if (!allUsers.length) await loadUsers();
    if (!allPosts.length) await loadPosts();
    renderAnalytics(allUsers, allPosts);
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--danger);">❌ Failed to load analytics</div>';
  }
}

function renderAnalytics(users, posts) {
  var container = document.getElementById('analyticsContent');
  if (!container) return;

  var nonAdmins = users.filter(function(u) { return u.role !== 'admin'; });
  var total     = nonAdmins.length || 1;

  // ── Gender counts ────────────────────────────────────────────────────────────
  var gc = { male: 0, female: 0, other: 0, unknown: 0 };
  nonAdmins.forEach(function(u) {
    var g = (u.gender || '').toLowerCase();
    if      (g === 'male')   gc.male++;
    else if (g === 'female') gc.female++;
    else if (g === 'other')  gc.other++;
    else                     gc.unknown++;
  });
  var mPct = Math.round(gc.male   / total * 100);
  var fPct = Math.round(gc.female / total * 100);
  var oPct = Math.round(gc.other  / total * 100);
  var uPct = 100 - mPct - fPct - oPct;

  // ── Location counts (top 6) ──────────────────────────────────────────────────
  var locCounts = {};
  nonAdmins.forEach(function(u) {
    var loc = (u.location || 'Unknown').trim();
    locCounts[loc] = (locCounts[loc] || 0) + 1;
  });
  var topLocs = Object.entries(locCounts).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 6);
  var maxLoc  = (topLocs[0] || [,1])[1];

  // ── Join trend (last 6 months) ───────────────────────────────────────────────
  var now = new Date();
  var months = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      key:   d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      count: 0
    });
  }
  nonAdmins.forEach(function(u) {
    var d   = new Date(u.joinedAt);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var m   = months.find(function(m) { return m.key === key; });
    if (m) m.count++;
  });
  var maxJoin = Math.max.apply(null, months.map(function(m) { return m.count; }).concat([1]));

  // ── Top posters ──────────────────────────────────────────────────────────────
  var byUser = {};
  posts.forEach(function(p) {
    var id = p.authorId || (p.author && p.author.id);
    if (id) byUser[id] = (byUser[id] || 0) + 1;
  });
  var topPosters = Object.entries(byUser)
    .sort(function(a,b) { return b[1]-a[1]; })
    .slice(0, 5)
    .map(function(entry) {
      var u = users.find(function(u) { return u.id === entry[0]; });
      return { name: u ? u.name : 'Unknown', count: entry[1] };
    });
  var maxPosts = (topPosters[0] || { count: 1 }).count;

  // ── Most liked posts ─────────────────────────────────────────────────────────
  var topLiked = posts.slice().sort(function(a,b) {
    return (b.likes || []).length - (a.likes || []).length;
  }).slice(0, 5);
  var maxLikes = ((topLiked[0] || {}).likes || []).length || 1;

  // ── CSS conic gradient for gender pie ────────────────────────────────────────
  var pieCss = 'conic-gradient(' +
    '#1877f2 0% ' + mPct + '%, ' +
    '#e4405f ' + mPct + '% ' + (mPct + fPct) + '%, ' +
    '#f7b928 ' + (mPct + fPct) + '% ' + (mPct + fPct + oPct) + '%, ' +
    '#8a8d91 ' + (mPct + fPct + oPct) + '% 100%)';

  var barColors = ['blue', 'green', 'pink', 'purple', 'orange', 'teal'];

  function bar(label, count, max, colorIdx) {
    var pct = max > 0 ? Math.max(count / max * 100, count > 0 ? 8 : 0) : 0;
    return '<div class="bar-row">' +
      '<div class="bar-label" title="' + esc(label) + '">' + esc(label) + '</div>' +
      '<div class="bar-track">' +
        '<div class="bar-fill bar-fill--' + barColors[colorIdx % barColors.length] + '" style="width:' + pct.toFixed(1) + '%;">' +
          (count > 0 ? count : '') +
        '</div>' +
      '</div>' +
      '</div>';
  }

  var adminCnt   = users.filter(function(u) { return u.role === 'admin'; }).length;
  var userCnt    = users.length - adminCnt;
  var blockedCnt = users.filter(function(u) { return u.blocked; }).length;

  container.innerHTML =

    // Summary row
    '<div class="admin-stats-grid" style="margin-bottom:24px;">' +
      statCard('blue',   'Total Users',    nonAdmins.length, '👥') +
      statCard('green',  'Male Users',     gc.male,          '👨') +
      statCard('pink',   'Female Users',   gc.female,        '👩') +
      statCard('purple', 'Total Posts',    posts.length,     '📝') +
    '</div>' +

    '<div class="analytics-grid">' +

      // User growth
      '<div class="analytics-card">' +
        '<div class="analytics-card__title">📈 User Growth (Last 6 Months)</div>' +
        '<div class="bar-chart">' +
          months.map(function(m, i) { return bar(m.label, m.count, maxJoin, i); }).join('') +
        '</div>' +
      '</div>' +

      // Gender pie
      '<div class="analytics-card" style="display:flex;flex-direction:column;align-items:center;">' +
        '<div class="analytics-card__title" style="align-self:flex-start;">⚧ Gender Distribution</div>' +
        '<div class="pie-chart" style="background:' + pieCss + ';"></div>' +
        '<div class="pie-legend" style="align-self:flex-start;width:100%;">' +
          '<div class="pie-legend-item"><div class="pie-legend-dot" style="background:#1877f2;"></div>Male &mdash; <strong>' + gc.male + '</strong> (' + mPct + '%)</div>' +
          '<div class="pie-legend-item"><div class="pie-legend-dot" style="background:#e4405f;"></div>Female &mdash; <strong>' + gc.female + '</strong> (' + fPct + '%)</div>' +
          '<div class="pie-legend-item"><div class="pie-legend-dot" style="background:#f7b928;"></div>Other &mdash; <strong>' + gc.other + '</strong> (' + oPct + '%)</div>' +
          '<div class="pie-legend-item"><div class="pie-legend-dot" style="background:#8a8d91;"></div>Unknown &mdash; <strong>' + gc.unknown + '</strong> (' + uPct + '%)</div>' +
        '</div>' +
      '</div>' +

      // Top locations
      '<div class="analytics-card">' +
        '<div class="analytics-card__title">📍 Top Locations</div>' +
        '<div class="bar-chart">' +
          (topLocs.length
            ? topLocs.map(function(e, i) { return bar(e[0], e[1], maxLoc, i); }).join('')
            : '<p style="color:var(--text-muted);font-size:0.875rem;">No location data available</p>') +
        '</div>' +
      '</div>' +

      // Top posters
      '<div class="analytics-card">' +
        '<div class="analytics-card__title">🏆 Most Active Posters</div>' +
        '<div class="bar-chart">' +
          (topPosters.length
            ? topPosters.map(function(u, i) { return bar(u.name, u.count, maxPosts, i); }).join('')
            : '<p style="color:var(--text-muted);font-size:0.875rem;">No post data available</p>') +
        '</div>' +
      '</div>' +

      // Most liked posts
      '<div class="analytics-card">' +
        '<div class="analytics-card__title">❤️ Most Liked Posts</div>' +
        '<div class="bar-chart">' +
          (topLiked.length
            ? topLiked.map(function(p, i) {
                var lbl   = (p.text || 'Image post').slice(0, 28) + ((p.text || '').length > 28 ? '…' : '');
                var count = (p.likes || []).length;
                return bar(lbl, count, maxLikes, i);
              }).join('')
            : '<p style="color:var(--text-muted);font-size:0.875rem;">No posts yet</p>') +
        '</div>' +
      '</div>' +

      // Account breakdown
      '<div class="analytics-card">' +
        '<div class="analytics-card__title">🔐 Account Breakdown</div>' +
        '<div class="bar-chart">' +
          bar('Regular Users', userCnt,    users.length, 0) +
          bar('Admins',        adminCnt,   users.length, 3) +
          bar('Blocked',       blockedCnt, users.length, 2) +
          bar('Active',        users.length - blockedCnt, users.length, 1) +
        '</div>' +
      '</div>' +

    '</div>';
}

// ─── Section Switching ────────────────────────────────────────────────────────
function switchSection(sectionId) {
  currentSection = sectionId;

  ['dashboard','users','posts','messages','analytics','settings'].forEach(function(id) {
    var el = document.getElementById(id + 'Section');
    if (el) el.classList.add('hidden');
  });

  var target = document.getElementById(sectionId + 'Section');
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.admin-nav__item').forEach(function(item) {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });

  var titles = {
    dashboard: 'Dashboard',
    users:     'Users',
    posts:     'Posts',
    messages:  'Messages',
    analytics: 'Analytics',
    settings:  'Settings'
  };
  setText('pageTitle', titles[sectionId] || sectionId);

  // Lazy-load data
  if (sectionId === 'posts'     && !allPosts.length) loadPosts();
  if (sectionId === 'analytics')                     loadAnalytics();
  if (sectionId === 'messages')                      loadStats();

  // Update URL hash without a page reload
  try { history.replaceState(null, '', '#' + sectionId); } catch (_) {}

  closeSidebar();
}

function navClick(event, sectionId) {
  event.preventDefault();
  switchSection(sectionId);
}

// ─── Topbar search ────────────────────────────────────────────────────────────
function adminSearchHandler(query) {
  if (currentSection !== 'users') switchSection('users');
  var s = document.getElementById('usersSearch');
  if (s) { s.value = query; applyFilters(); }
}

// ─── Settings ────────────────────────────────────────────────────────────────
function saveSettings(event) {
  event.preventDefault();
  showToast('Settings saved successfully!', 'success');
}

function resetSettings() {
  var fields = {
    settingSiteName:          'SocialConnect',
    settingTagline:           'Connect, Date, Belong.',
    settingContactEmail:      'support@socialconnect.com',
    settingMaxPost:           '2000'
  };
  Object.entries(fields).forEach(function(e) {
    var el = document.getElementById(e[0]);
    if (el) el.value = e[1];
  });
  setText('maxPostVal', '2000');
  var reg  = document.getElementById('settingRegistrations');
  var mnt  = document.getElementById('settingMaintenance');
  var eml  = document.getElementById('settingEmailNotifications');
  if (reg) reg.checked = true;
  if (mnt) mnt.checked = false;
  if (eml) eml.checked = true;
  showToast('Settings reset to defaults.', 'info');
}

// ─── Mobile sidebar ───────────────────────────────────────────────────────────
function toggleSidebar() {
  var sidebar = document.getElementById('adminSidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var open    = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !open);
  overlay.classList.toggle('visible', !open);
}

function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('visible');
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
}

// ─── Password toggle ──────────────────────────────────────────────────────────
function togglePasswordVisibility(inputId, btn) {
  var input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁️'; }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function logout() {
  if (!confirm('Are you sure you want to log out?')) return;
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_user');
  window.location.href = '/index.html';
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Escape HTML special chars */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for use inside a JS string literal in an inline onclick */
function escJs(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function hideEl(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showInlineError(el, msg) {
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
}

function capitalize(str) {
  if (!str) return '—';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) { return '—'; }
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  try {
    var diff  = Date.now() - new Date(dateStr).getTime();
    var mins  = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days  = Math.floor(diff / 86400000);
    var weeks = Math.floor(days / 7);
    var mons  = Math.floor(days / 30);
    if (diff < 0)      return 'just now';
    if (mins  < 1)     return 'just now';
    if (mins  < 60)    return mins  + 'm ago';
    if (hours < 24)    return hours + 'h ago';
    if (days  < 7)     return days  + 'd ago';
    if (weeks < 5)     return weeks + 'w ago';
    if (mons  < 12)    return mons  + 'mo ago';
    return formatDate(dateStr);
  } catch (_) { return '—'; }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;

  var icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  var titles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

  var toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.innerHTML =
    '<div class="toast__icon">' + (icons[type] || 'ℹ️') + '</div>' +
    '<div class="toast__content">' +
      '<div class="toast__title">' + (titles[type] || 'Info') + '</div>' +
      '<div class="toast__message">' + esc(message) + '</div>' +
    '</div>' +
    '<button class="toast__close" onclick="removeToast(this.parentElement)" title="Dismiss">✕</button>' +
    '<div class="toast__progress"></div>';

  container.appendChild(toast);
  setTimeout(function() { removeToast(toast); }, 4500);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(function() { if (toast.parentElement) toast.remove(); }, 310);
}

// ─── HTML building helpers ────────────────────────────────────────────────────

/** Builds the user cell (avatar + name + online dot) */
function userCell(u) {
  var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'User') + '&background=random&size=128';
  var isOnline = onlineUserIds.has(u.id);
  return '<div class="admin-table__user">' +
    '<div style="position:relative;flex-shrink:0;">' +
      '<img src="' + esc(u.avatar || fallback) + '" class="admin-table__avatar" alt="" ' +
        'onerror="this.src=\'' + fallback + '\'">' +
      '<span class="online-dot-badge" data-uid="' + u.id + '" ' +
        'style="width:10px;height:10px;border-radius:50%;position:absolute;bottom:0;right:0;' +
        'background:' + (isOnline ? 'var(--success)' : 'var(--border)') + ';' +
        'border:2px solid var(--card-bg);" ' +
        'title="' + (isOnline ? 'Online' : 'Offline') + '">' +
      '</span>' +
    '</div>' +
    '<div>' +
      '<div class="admin-table__name">' + esc(u.name) + '</div>' +
    '</div>' +
  '</div>';
}

function roleBadge(role) {
  return role === 'admin'
    ? '<span class="badge badge--admin">Admin</span>'
    : '<span class="badge badge--plain">User</span>';
}

function statusBadge(blocked) {
  return blocked
    ? '<span class="badge badge--blocked">Blocked</span>'
    : '<span class="badge badge--active">Active</span>';
}

function statMini(value, label) {
  return '<div class="user-stat-mini">' +
    '<div class="user-stat-mini__value">' + esc(value) + '</div>' +
    '<div class="user-stat-mini__label">' + esc(label) + '</div>' +
  '</div>';
}

function statMiniSmall(value, label) {
  return '<div class="user-stat-mini">' +
    '<div class="user-stat-mini__value" style="font-size:0.85rem;">' + esc(value) + '</div>' +
    '<div class="user-stat-mini__label">' + esc(label) + '</div>' +
  '</div>';
}

function viewStat(value, label) {
  return '<div class="view-user-stat">' +
    '<div class="view-user-stat__value">' + esc(value) + '</div>' +
    '<div class="view-user-stat__label">' + esc(label) + '</div>' +
  '</div>';
}

function infoRow(label, value) {
  return '<div class="view-user-info-item">' +
    '<span class="view-user-info-label">' + label + '</span>' +
    '<span class="view-user-info-value">' + esc(value) + '</span>' +
  '</div>';
}

/** Mini stat card for analytics summary row */
function statCard(color, label, value, icon) {
  return '<div class="admin-stat-card admin-stat-card--' + color + '" style="padding:16px;">' +
    '<div class="admin-stat-card__label">' + label + '</div>' +
    '<div class="admin-stat-card__value" style="font-size:2rem;">' + value + '</div>' +
    '<div class="admin-stat-card__icon" style="font-size:2rem;">' + icon + '</div>' +
  '</div>';
}

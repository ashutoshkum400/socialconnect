/**
 * SocialConnect — Admin Popup (triple-space trigger)
 *
 * Typing three consecutive spaces (   ) anywhere on the login page
 * opens the admin portal popup where an admin can log in or register.
 */

/* ==========================================================================
   Constants
   ========================================================================== */

const ADMIN_POPUP_EL      = document.getElementById('adminPopup');
const ADMIN_POPUP_ERROR   = document.getElementById('adminPopupError');
const ADMIN_POPUP_ERR_TEXT = document.getElementById('adminPopupErrorText');

/* ==========================================================================
   Triple-space detection
   ========================================================================== */

let spaceBuffer = '';
let spaceTimer  = null;

const AUTH_PAGES = new Set(['login', 'signup']);

function resetSpaceBuffer() {
  spaceBuffer = '';
  clearTimeout(spaceTimer);
}

function processSpaceKey() {
  spaceBuffer += ' ';
  clearTimeout(spaceTimer);
  spaceTimer = setTimeout(() => { spaceBuffer = ''; }, 600);

  if (spaceBuffer.length >= 3) {
    resetSpaceBuffer();
    openAdminPopup();
  }
}

function isAuthPage() {
  return AUTH_PAGES.has(document.body.dataset.page);
}

document.addEventListener('keydown', (e) => {
  if (!ADMIN_POPUP_EL || !ADMIN_POPUP_EL.classList.contains('hidden')) return;
  if (!isAuthPage()) return;

  if (e.key === ' ' || e.key === 'Spacebar') {
    processSpaceKey();
  } else {
    resetSpaceBuffer();
  }
});

// Some mobile/tablet keyboards may not dispatch the same key events inside input fields.
// Monitor the signup username field directly so triple-space still opens the admin popup.
const regUsernameInput = document.getElementById('regUsername');
if (regUsernameInput) {
  regUsernameInput.addEventListener('input', (e) => {
    const value = e.target.value || '';
    if (value.endsWith('   ')) {
      resetSpaceBuffer();
      openAdminPopup();
    }
  });
}

/* ==========================================================================
   Triple-tap detection (mobile & tablet)
   ========================================================================== */

let tapCount = 0;
let tapTimer = null;

document.addEventListener('click', (e) => {
  // Only trigger on the login page when the popup is hidden
  if (!ADMIN_POPUP_EL || !ADMIN_POPUP_EL.classList.contains('hidden')) return;
  if (document.body.dataset.page !== 'login') return;

  // Only track taps on the email input field
  const emailInput = document.getElementById('loginEmail');
  if (!emailInput || e.target !== emailInput) {
    // Reset if tap is outside the email field
    tapCount = 0;
    clearTimeout(tapTimer);
    return;
  }

  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 600);

  // Triple-tap detected
  if (tapCount >= 3) {
    tapCount = 0;
    clearTimeout(tapTimer);
    openAdminPopup();
  }
});

/* ==========================================================================
   Popup open / close
   ========================================================================== */

function openAdminPopup() {
  if (!ADMIN_POPUP_EL) return;
  ADMIN_POPUP_EL.classList.remove('hidden');
  hideAdminPopupError();
  // Default to the login tab
  switchAdminTab('login');
}

function closeAdminPopup() {
  if (!ADMIN_POPUP_EL) return;
  ADMIN_POPUP_EL.classList.add('hidden');
  hideAdminPopupError();
}

/** Close popup when clicking outside it */
document.addEventListener('click', (e) => {
  if (!ADMIN_POPUP_EL || ADMIN_POPUP_EL.classList.contains('hidden')) return;
  if (!ADMIN_POPUP_EL.contains(e.target)) {
    closeAdminPopup();
  }
});

/** Close popup on Escape key */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAdminPopup();
});

/* ==========================================================================
   Tab switching
   ========================================================================== */

function switchAdminTab(tab) {
  const loginTab  = document.getElementById('adminLoginTab');
  const signupTab = document.getElementById('adminSignupTab');
  const loginForm = document.getElementById('adminLoginForm');
  const signupForm = document.getElementById('adminSignupForm');

  if (!loginTab || !signupTab || !loginForm || !signupForm) return;

  hideAdminPopupError();

  if (tab === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.style.display = '';
    signupForm.style.display = 'none';
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.style.display = '';
    loginForm.style.display = 'none';
  }
}

/* ==========================================================================
   Error helpers
   ========================================================================== */

function showAdminPopupError(msg) {
  if (!ADMIN_POPUP_ERROR) return;
  ADMIN_POPUP_ERROR.style.display = 'flex';
  if (ADMIN_POPUP_ERR_TEXT) ADMIN_POPUP_ERR_TEXT.textContent = msg;
}

function hideAdminPopupError() {
  if (!ADMIN_POPUP_ERROR) return;
  ADMIN_POPUP_ERROR.style.display = 'none';
}

/* ==========================================================================
   Admin Login
   ========================================================================== */

async function adminLogin(event) {
  event.preventDefault();
  hideAdminPopupError();

  const email    = document.getElementById('adminLoginEmail').value.trim();
  const password = document.getElementById('adminLoginPassword').value;
  const btn      = document.getElementById('adminLoginBtn');

  if (!email || !password) {
    showAdminPopupError('Please enter both email and password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Logging in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAdminPopupError(data.error || 'Login failed.');
      btn.disabled = false;
      btn.textContent = 'Log In as Admin';
      return;
    }

    // Ensure the user is an admin
    if (data.user.role !== 'admin') {
      showAdminPopupError('Access denied. This portal is for administrators only.');
      btn.disabled = false;
      btn.textContent = 'Log In as Admin';
      return;
    }

    // Use shared auth helpers from auth.js
    storeAuthData(data.token, data.user);
    redirectByRole(data.user);
  } catch {
    showAdminPopupError('Network error — please check your connection.');
    btn.disabled = false;
    btn.textContent = 'Log In as Admin';
  }
}

/* ==========================================================================
   Admin Registration
   ========================================================================== */

async function adminRegister(event) {
  event.preventDefault();
  hideAdminPopupError();

  const name     = document.getElementById('adminRegName').value.trim();
  const email    = document.getElementById('adminRegEmail').value.trim();
  const password = document.getElementById('adminRegPassword').value;
  const secret   = document.getElementById('adminRegSecret').value;
  const btn      = document.getElementById('adminRegBtn');

  if (!name || !email || !password || !secret) {
    showAdminPopupError('All fields are required.');
    return;
  }

  if (password.length < 8) {
    showAdminPopupError('Password must be at least 8 characters.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Registering…';

  try {
    const res = await fetch('/api/auth/admin-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, adminSecret: secret }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAdminPopupError(data.error || 'Registration failed.');
      btn.disabled = false;
      btn.textContent = 'Register as Admin';
      return;
    }

    // Success — store auth and redirect
    storeAuthData(data.token, data.user);
    redirectByRole(data.user);
  } catch {
    showAdminPopupError('Network error — please check your connection.');
    btn.disabled = false;
    btn.textContent = 'Register as Admin';
  }
}
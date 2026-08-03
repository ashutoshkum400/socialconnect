/**
 * SocialConnect — Auth JavaScript
 * Handles: Login page (data-page="login")
 *          Signup page (data-page="signup")
 */

// ─────────────────────────────────────────────────────────────────────────────
// fillCredentials — called from login page demo box onclick attributes
// Must be defined before the auth-check redirect so it's always in scope.
// ─────────────────────────────────────────────────────────────────────────────
function fillCredentials(email, password) {
  const emailEl    = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  if (emailEl)    emailEl.value    = email;
  if (passwordEl) passwordEl.value = password;
  // Briefly highlight the fields so the user knows they were filled
  [emailEl, passwordEl].forEach(el => {
    if (!el) return;
    el.style.transition = 'border-color 0.2s';
    el.style.borderColor = 'var(--success)';
    setTimeout(() => { el.style.borderColor = ''; }, 900);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect page
// ─────────────────────────────────────────────────────────────────────────────
const page = document.body.dataset.page;

// ─────────────────────────────────────────────────────────────────────────────
// Redirect if already authenticated
// ─────────────────────────────────────────────────────────────────────────────
(function checkAlreadyLoggedIn() {
  const token = localStorage.getItem('sc_token');
  if (!token) return;
  try {
    const user = JSON.parse(localStorage.getItem('sc_user') || '{}');
    window.location.href = (user.role === 'admin') ? '/admin.html' : '/dashboard.html';
  } catch {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
  }
}());

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show an error banner.
 * @param {HTMLElement} errorEl  - The container element (gets class "visible")
 * @param {HTMLElement|null} textEl - Inner <span> to receive the message text
 * @param {string} message
 */
function showError(errorEl, textEl, message) {
  if (!errorEl) return;
  if (textEl) textEl.textContent = message;
  else errorEl.textContent = message;
  errorEl.classList.add('visible');
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Hide an error banner. */
function hideError(errorEl) {
  if (errorEl) errorEl.classList.remove('visible');
}

/** Persist auth data to localStorage using the project conventions. */
function storeAuthData(token, user) {
  localStorage.setItem('sc_token', token);
  localStorage.setItem('sc_user', JSON.stringify(user));
}

/** Redirect to the correct page based on role. */
function redirectByRole(user) {
  window.location.href = (user.role === 'admin') ? '/admin.html' : '/dashboard.html';
}

// ═════════════════════════════════════════════════════════════════════════════
//  GOOGLE SIGN-IN (Continue with Gmail)
//  Works on both the login and signup pages. Renders the GSI button inside
//  #googleButtonContainer when a GOOGLE_CLIENT_ID is configured server-side.
// ═════════════════════════════════════════════════════════════════════════════

let googleSignInInited = false;

/**
 * Send the verified Google credential to the server, which either logs in an
 * existing user or auto-creates a new account, then redirects by role.
 */
async function handleGoogleCredential(credential) {
  const btn = document.getElementById('googleSignInBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch((window.API_BASE || '') + '/api/auth/google', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ credential }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errEl     = document.getElementById('googleSignInError');
      const errTextEl = document.getElementById('googleSignInErrorText');
      showError(errEl, errTextEl, data.error || 'Google sign-in failed. Please try again.');
      if (btn) btn.disabled = false;
      return;
    }

    storeAuthData(data.token, data.user);
    redirectByRole(data.user);
  } catch {
    const errEl     = document.getElementById('googleSignInError');
    const errTextEl = document.getElementById('googleSignInErrorText');
    showError(errEl, errTextEl, 'Network error — please check your connection and try again.');
    if (btn) btn.disabled = false;
  }
}

/** Global callback invoked by Google Identity Services with the JWT credential. */
window.handleGoogleCredentialCallback = async (response) => {
  if (response && response.credential) {
    await handleGoogleCredential(response.credential);
  }
};

/**
 * Initialize the "Sign in with Google" button.
 * - Fetches the client ID from the server config endpoint.
 * - If none is configured, shows a small note and hides the button.
 * - Otherwise loads the GSI script and renders the button.
 */
async function initGoogleSignIn() {
  const container = document.getElementById('googleButtonContainer');
  const note      = document.getElementById('googleNotConfiguredNote');
  if (!container) return;

  try {
    const res  = await fetch((window.API_BASE || '') + '/api/auth/config');
    const data = await res.json();

    if (!data || !data.googleEnabled || !data.googleClientId) {
      container.style.display = 'none';
      if (note) {
        note.style.display  = 'block';
        note.textContent    = 'Google sign-in is not configured yet.';
      }
      return;
    }

    // Show the button area and hide the note
    container.style.display = 'block';
    if (note) note.style.display = 'none';

    if (typeof google !== 'undefined' && google.accounts) {
      renderGoogleButton(data.googleClientId);
      return;
    }

    // Load Google Identity Services once
    if (googleSignInInited) return;
    googleSignInInited = true;

    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => renderGoogleButton(data.googleClientId);
    script.onerror = () => {
      container.style.display = 'none';
      if (note) {
        note.style.display = 'block';
        note.textContent   = 'Could not load Google Sign-In. Please try again later.';
      }
    };
    document.head.appendChild(script);
  } catch {
    container.style.display = 'none';
    if (note) {
      note.style.display = 'block';
      note.textContent   = 'Google sign-in is temporarily unavailable.';
    }
  }
}

/** Render the official Google button inside the container. */
function renderGoogleButton(clientId) {
  const container = document.getElementById('googleButtonContainer');
  if (!container || typeof google === 'undefined' || !google.accounts) return;
  container.innerHTML = '';
  try {
    google.accounts.id.initialize({
      client_id: clientId,
      callback:  window.handleGoogleCredentialCallback,
      auto_select: false,
    });
    google.accounts.id.renderButton(container, {
      type:        'standard',
      theme:       'outline',
      size:        'large',
      text:        'continue_with',
      shape:       'pill',
      logo_alignment: 'left',
      width:        '100%',
    });
  } catch (err) {
    container.style.display = 'none';
    const note = document.getElementById('googleNotConfiguredNote');
    if (note) {
      note.style.display = 'block';
      note.textContent = 'Google sign-in failed to initialize. Ensure "' +
        window.location.origin + '" is added as an Authorized JavaScript origin\n' +
        'in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.';
    }
    console.error('[auth] GSI renderButton error:', err);
  }

// Boot Google sign-in on login & signup pages
if (page === 'login' || page === 'signup') {
  initGoogleSignIn();
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
if (page === 'login') {

  const loginForm      = document.getElementById('loginForm');
  const loginEmail     = document.getElementById('loginEmail');
  const loginPassword  = document.getElementById('loginPassword');
  const loginBtn       = document.getElementById('loginBtn');
  const loginBtnText   = document.getElementById('loginBtnText');
  const loginSpinner   = document.getElementById('loginSpinner');
  const loginError     = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  const togglePassword = document.getElementById('togglePassword');
  const eyeOff         = document.getElementById('eyeOff');
  const eyeOn          = document.getElementById('eyeOn');

  // ── Password visibility toggle ──────────────────────────────
  togglePassword.addEventListener('click', () => {
    const isHidden = loginPassword.type === 'password';
    loginPassword.type       = isHidden ? 'text' : 'password';
    eyeOff.style.display     = isHidden ? 'none' : '';
    eyeOn.style.display      = isHidden ? ''     : 'none';
    loginPassword.focus();
  });

  // Clear error on input
  [loginEmail, loginPassword].forEach(el => {
    el.addEventListener('input', () => hideError(loginError));
  });

  // ── Form submit ─────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(loginError);

    const email    = loginEmail.value.trim();
    const password = loginPassword.value;

    // Client-side presence check
    if (!email || !password) {
      showError(loginError, loginErrorText, 'Please enter both your email and password.');
      return;
    }

    // Loading state
    loginBtn.disabled          = true;
    loginBtnText.textContent   = 'Logging in…';
    loginSpinner.style.display = '';

    try {
      const res = await fetch((window.API_BASE || '') + '/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(loginError, loginErrorText, data.error || 'Login failed. Please try again.');
        return;
      }

      // Success — store and redirect
      storeAuthData(data.token, data.user);
      redirectByRole(data.user);

    } catch {
      showError(
        loginError,
        loginErrorText,
        'Network error — please check your connection and try again.'
      );
    } finally {
      loginBtn.disabled          = false;
      loginBtnText.textContent   = 'Log In';
      loginSpinner.style.display = 'none';
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  SIGNUP PAGE
// ═════════════════════════════════════════════════════════════════════════════
if (page === 'signup') {

  // ── State ────────────────────────────────────────────────────
  let currentStep         = 1;
  const selectedInterests = [];
  const formData          = {};   // accumulates data across steps

  // ── Error elements ───────────────────────────────────────────
  const signupError     = document.getElementById('signupError');
  const signupErrorText = document.getElementById('signupErrorText');

  // ── Step panels ──────────────────────────────────────────────
  const stepPanels = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
  ];

  // ── Step indicators ──────────────────────────────────────────
  const stepIndicators = [
    document.getElementById('stepIndicator1'),
    document.getElementById('stepIndicator2'),
    document.getElementById('stepIndicator3'),
  ];

  // ── Step 1 inputs ────────────────────────────────────────────
  const regName     = document.getElementById('regName');
  const regUsername = document.getElementById('regUsername');
  const regEmail    = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  const regConfirm  = document.getElementById('regConfirm');

  // ── Step 2 inputs ────────────────────────────────────────────
  const regGender     = document.getElementById('regGender');
  const regBirthDate  = document.getElementById('regBirthDate');
  const regLocation   = document.getElementById('regLocation');
  const regBio        = document.getElementById('regBio');
  const regLookingFor = document.getElementById('regLookingFor');

  // ── Buttons ──────────────────────────────────────────────────
  const step1Next   = document.getElementById('step1Next');
  const step2Back   = document.getElementById('step2Back');
  const step2Next   = document.getElementById('step2Next');
  const step3Back   = document.getElementById('step3Back');
  const step3Submit = document.getElementById('step3Submit');

  // ── Password strength elements ───────────────────────────────
  const strengthWrap  = document.getElementById('passwordStrength');
  const strengthFill  = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');

  // ── Password toggle (signup) ─────────────────────────────────
  const signupTogglePassword = document.getElementById('signupTogglePassword');
  const signupEyeOff         = document.getElementById('signupEyeOff');
  const signupEyeOn          = document.getElementById('signupEyeOn');

  // ── Set max birthDate to 18 years ago (enforces 18+ in picker) ──
  const maxBirth = new Date();
  maxBirth.setFullYear(maxBirth.getFullYear() - 18);
  regBirthDate.max = maxBirth.toISOString().split('T')[0];

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  /** Evaluate password strength: 'weak' | 'medium' | 'strong' */
  function getPasswordStrength(password) {
    if (!password || password.length < 6) return 'weak';
    const checks = [
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];
    const score = checks.filter(Boolean).length;
    if (password.length >= 8 && score >= 3) return 'strong';
    if (password.length >= 8 && score >= 2) return 'medium';
    return 'weak';
  }

  /** Update the password strength bar and label. */
  function updateStrengthIndicator(password) {
    if (!password) { strengthWrap.style.display = 'none'; return; }
    strengthWrap.style.display = 'block';
    const level = getPasswordStrength(password);
    const cfg = {
      weak:   { width: '33%',  bg: 'var(--danger)',  text: '⚠️ Weak — add uppercase & symbols',  color: 'var(--danger)'  },
      medium: { width: '66%',  bg: 'var(--warning)', text: '🟡 Medium — could be stronger',       color: '#9a6f00'        },
      strong: { width: '100%', bg: 'var(--success)', text: '✅ Strong password',                  color: 'var(--success)' },
    }[level];
    strengthFill.style.width      = cfg.width;
    strengthFill.style.background = cfg.bg;
    strengthLabel.textContent     = cfg.text;
    strengthLabel.style.color     = cfg.color;
  }

  /**
   * Mark a field as invalid and inject a .form-error message
   * directly inside the nearest .form-group.
   */
  function showFieldError(input, message) {
    input.classList.add('error');
    const group = input.closest('.form-group');
    if (!group) return;
    let errEl = group.querySelector('.form-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'form-error';
      group.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  /** Remove all inline validation errors from the form. */
  function clearFieldErrors() {
    hideError(signupError);
    document.querySelectorAll(
      '#signupForm .form-input.error, #signupForm .form-select.error, #signupForm .form-textarea.error'
    ).forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#signupForm .form-error').forEach(el => el.remove());
  }

  /**
   * Animate a step transition.
   * @param {number} fromStep - 1-indexed step being left
   * @param {number} toStep   - 1-indexed step being entered
   * @param {number} direction - +1 = forward, -1 = backward
   */
  function goToStep(fromStep, toStep, direction) {
    const fromPanel = stepPanels[fromStep - 1];
    const toPanel   = stepPanels[toStep   - 1];

    // Slide current panel out
    fromPanel.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    fromPanel.style.opacity    = '0';
    fromPanel.style.transform  = `translateX(${direction > 0 ? '-28px' : '28px'})`;

    setTimeout(() => {
      fromPanel.style.display    = 'none';
      fromPanel.style.transition = '';
      fromPanel.style.opacity    = '';
      fromPanel.style.transform  = '';

      // Prepare next panel
      toPanel.style.display    = 'block';
      toPanel.style.opacity    = '0';
      toPanel.style.transform  = `translateX(${direction > 0 ? '28px' : '-28px'})`;
      toPanel.style.transition = '';

      // Slide it in on the next two animation frames (ensures the
      // display:block has been painted before we begin the transition)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toPanel.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          toPanel.style.opacity    = '1';
          toPanel.style.transform  = 'translateX(0)';
        });
      });

      setTimeout(() => { toPanel.style.transition = ''; }, 220);

      // Scroll the card into view for mobile
      toPanel.closest('.auth-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    }, 190);

    // Update step indicators
    currentStep = toStep;
    stepIndicators.forEach((ind, i) => {
      const n = i + 1;
      ind.classList.toggle('active',    n === toStep);
      ind.classList.toggle('completed', n < toStep);
      const circle = ind.querySelector('.auth-steps__circle');
      circle.innerHTML = (n < toStep) ? '&#10003;' : String(n);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Step 1 validation
  // ─────────────────────────────────────────────────────────────
  function validateStep1() {
    clearFieldErrors();
    let ok = true;

    const name = regName.value.trim();
    if (name.length < 2) {
      showFieldError(regName, 'Name must be at least 2 characters.');
      ok = false;
    }

    const username = regUsername.value.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showFieldError(regUsername, 'Username: 3–20 chars, letters / numbers / underscores only.');
      ok = false;
    }

    const email = regEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(regEmail, 'Please enter a valid email address.');
      ok = false;
    }

    const pwd = regPassword.value;
    if (pwd.length < 8) {
      showFieldError(regPassword, 'Password must be at least 8 characters.');
      ok = false;
    } else if (!/[0-9]/.test(pwd)) {
      showFieldError(regPassword, 'Password must include at least one number.');
      ok = false;
    }

    if (regConfirm.value !== pwd) {
      showFieldError(regConfirm, 'Passwords do not match.');
      ok = false;
    }

    return ok;
  }

  // ─────────────────────────────────────────────────────────────
  // Step 2 validation
  // ─────────────────────────────────────────────────────────────
  function validateStep2() {
    clearFieldErrors();
    let ok = true;

    if (!regGender.value) {
      showFieldError(regGender, 'Please select your gender.');
      ok = false;
    }

    const bd = regBirthDate.value;
    if (!bd) {
      showFieldError(regBirthDate, 'Please enter your date of birth.');
      ok = false;
    } else {
      const today = new Date();
      const born  = new Date(bd);
      let age     = today.getFullYear() - born.getFullYear();
      const m     = today.getMonth()    - born.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
      if (age < 18) {
        showFieldError(regBirthDate, 'You must be at least 18 years old to join.');
        ok = false;
      }
    }

    if (!regLocation.value.trim()) {
      showFieldError(regLocation, 'Please enter your location.');
      ok = false;
    }

    return ok;
  }

  // ─────────────────────────────────────────────────────────────
  // Step 3 validation
  // ─────────────────────────────────────────────────────────────
  function validateStep3() {
    clearFieldErrors();
    if (selectedInterests.length < 3) {
      showError(
        signupError,
        signupErrorText,
        `Please select at least 3 interests (${selectedInterests.length} / 3 selected).`
      );
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Event listeners
  // ─────────────────────────────────────────────────────────────

  // Password strength live feedback
  regPassword.addEventListener('input', () => updateStrengthIndicator(regPassword.value));

  // Password visibility toggle
  signupTogglePassword.addEventListener('click', () => {
    const show             = regPassword.type === 'password';
    regPassword.type       = show ? 'text' : 'password';
    signupEyeOff.style.display = show ? 'none' : '';
    signupEyeOn.style.display  = show ? ''     : 'none';
    regPassword.focus();
  });

  // Step 1 → 2
  step1Next.addEventListener('click', () => {
    if (!validateStep1()) return;
    // Save step 1 data
    formData.name     = regName.value.trim();
    formData.username = regUsername.value.trim();
    formData.email    = regEmail.value.trim();
    formData.password = regPassword.value;
    goToStep(1, 2, 1);
  });

  // Step 2 → 1
  step2Back.addEventListener('click', () => goToStep(2, 1, -1));

  // Step 2 → 3
  step2Next.addEventListener('click', () => {
    if (!validateStep2()) return;
    // Save step 2 data
    formData.gender     = regGender.value;
    formData.birthDate  = regBirthDate.value;
    formData.location   = regLocation.value.trim();
    formData.bio        = regBio.value.trim();
    formData.lookingFor = regLookingFor.value || null;
    goToStep(2, 3, 1);
  });

  // Step 3 → 2
  step3Back.addEventListener('click', () => goToStep(3, 2, -1));

  // Interest tag toggle
  document.querySelectorAll('.interest-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const interest = tag.dataset.interest;
      const idx      = selectedInterests.indexOf(interest);

      if (idx === -1) {
        selectedInterests.push(interest);
        tag.classList.add('tag--selected');
      } else {
        selectedInterests.splice(idx, 1);
        tag.classList.remove('tag--selected');
      }

      // Update counter badge
      const counter = document.getElementById('interestCount');
      if (counter) {
        const n = selectedInterests.length;
        counter.textContent  = `${n} selected`;
        counter.style.color  = n >= 3 ? 'var(--success)' : 'var(--text-muted)';
        counter.style.fontWeight = n >= 3 ? '600' : '';
      }

      // Hide the error once the minimum is met
      if (selectedInterests.length >= 3) hideError(signupError);
    });
  });

  // Final submit
  step3Submit.addEventListener('click', async () => {
    if (!validateStep3()) return;

    formData.interests = [...selectedInterests];

    // Loading state
    const originalHTML   = step3Submit.innerHTML;
    step3Submit.disabled = true;
    step3Submit.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           style="margin-right:6px;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Creating Account…`;
    hideError(signupError);

    try {
      const res = await fetch((window.API_BASE || '') + '/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(signupError, signupErrorText, data.error || 'Registration failed. Please try again.');
        step3Submit.disabled  = false;
        step3Submit.innerHTML = originalHTML;
        return;
      }

      // All new users land on dashboard
      storeAuthData(data.token, data.user);
      window.location.href = '/dashboard.html';

    } catch {
      showError(
        signupError,
        signupErrorText,
        'Network error — please check your connection and try again.'
      );
      step3Submit.disabled  = false;
      step3Submit.innerHTML = originalHTML;
    }
  });
}

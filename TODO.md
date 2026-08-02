# TODO — Add "Sign in with Gmail" (Google OAuth)

- [x] **Step 1:** `server.js` — Add Google auth config + `/api/auth/google` + `/api/auth/config` endpoints
- [x] **Step 2:** `server.js` — Guard login route against Google-only accounts (null password)
- [x] **Step 3:** `public/js/auth.js` — Add Google button init + credential callback handler
- [x] **Step 4:** `public/index.html` — Add Google sign-in button (login page)
- [x] **Step 5:** `public/signup.html` — Add Google sign-in button (signup page)
- [x] **Step 6:** `public/css/style.css` — Add styles for the Google sign-in block
- [x] **Step 7:** Docs — Update `ENV_SETUP.md`, `render.yaml`, `DEPLOYMENT_GUIDE.md` with `GOOGLE_CLIENT_ID`
- [x] **Step 8:** Restart server + verify `/api/auth/config` endpoint


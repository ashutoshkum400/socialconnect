# TODO — Deployment Status

## Architecture: Single Render deployment
Frontend + Backend on Render: `https://biko.work.gd/` → Render (via Cloudflare)

## Steps

- [x] **Step 1:** Created `public/js/config.js` with `API_BASE` + `SOCKET_URL`
- [x] **Step 2:** Updated all frontend JS files to use `window.API_BASE` / `window.SOCKET_URL`
- [x] **Step 3:** Updated all HTML files to load `config.js` + CDN Socket.IO client
- [x] **Step 4:** Replaced root `index.html` with redirect
- [x] **Step 5:** Added `.github/workflows/deploy.yml` (GitHub Actions → GitHub Pages)
- [x] **Step 6:** Added `public/CNAME` + `public/.nojekyll`
- [x] **Step 7:** Updated docs (`ENV_SETUP.md`, `DEPLOYMENT_GUIDE.md`)
- [x] **Step 8:** Sync `master` → `main` branch (Render watches `main`)
- [x] **Step 9:** SEO assets (favicon, OG image, manifest, meta tags, JSON-LD, sitemap.xml, robots.txt)
- [x] **Step 10:** GSI error handling in `auth.js`
- [ ] **DNS:** Update A records for `biko.work.gd` (apex) → 216.24.57.7, 216.24.57.15 (Render via Cloudflare)
- [ ] **DNS:** Change CNAME for `www.biko.work.gd` → `socialconnect-g0it.onrender.com` (Render)
- [ ] **Google Console:** Add `https://biko.work.gd` to Authorized JavaScript origins
- [ ] **Google Console:** Add test user email if OAuth consent screen is in Testing mode
- [ ] **Hosts file:** Update local entries from GitHub Pages IPs → Render IPs (216.24.57.7)

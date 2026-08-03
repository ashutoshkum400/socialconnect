# TODO — GitHub Pages Deployment (Custom Domain: biko.work.gd)

Backend on Render: `https://socialconnect-g0it.onrender.com`
Frontend on GitHub Pages: `https://www.biko.work.gd`

## Steps

- [x] **Step 1:** Created `public/js/config.js` with `API_BASE` + `SOCKET_URL`
- [x] **Step 2:** Updated all frontend JS files to use `window.API_BASE` / `window.SOCKET_URL`
- [x] **Step 3:** Updated all HTML files to load `config.js` + CDN Socket.IO client
- [x] **Step 4:** Replaced root `index.html` (removed Firebase placeholder, redirect to `/`)
- [x] **Step 5:** Added `.github/workflows/deploy.yml` (GitHub Actions → GitHub Pages)
- [x] **Step 6:** Added `public/CNAME` (biko.work.gd) + `public/.nojekyll`
- [x] **Step 7:** Updated docs (ENV_SETUP.md, DEPLOYMENT_GUIDE.md)
- [ ] **DNS:** Configure DNS records for `biko.work.gd` → GitHub Pages IPs (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153)
- [ ] **Step 8:** Enable GitHub Pages in repo settings, verify deployment
- [ ] **Google Console:** Add `https://www.biko.work.gd` to Authorized JavaScript origins

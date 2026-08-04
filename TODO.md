# Supabase Integration — Task List

## Goal
Connect SocialConnect to Supabase so all data (users, posts, chats, reels, notifications, etc.) flows live from Supabase.

## Steps
- [x] 1. Get Supabase credentials from user (URL + publishable key)
- [x] 2. Install `@supabase/supabase-js` package
- [x] 3. Create `supabase/schema.sql` (SQL tables for all data collections)
- [x] 4. Create `supabase-store.js` (load/save module using Supabase)
- [x] 5. Modify `server.js` to use Supabase store (load on boot, save on changes)
- [x] 6. Update `.env.example` / `ENV_SETUP.md` / `render.yaml` with Supabase config
- [x] 7. Add a setup script to run the SQL schema
- [x] 8. Test the server boots and connects to Supabase
- [x] 9. Fix env var detection to support multiple key names (publishable/anon/service_role)
- [x] 10. Push everything to GitHub
- [x] 11. **LIVE DEPLOYMENT VERIFIED** — Render shows:
      - `✅ Supabase data loaded (1449 entries)`
      - `📦 Using Supabase as the live data source`
      - `📦 Using persisted data from Supabase`

## ✅ COMPLETE — Live on https://sathi.fun
The app is now fully connected to Supabase and serving live data!

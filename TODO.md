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
- [x] 7. Add a setup script (scripts/setup-supabase.js) to test connection & print schema
- [x] 8. Test the server boots and connects to Supabase (connection verified ✅)

## Remaining (user action needed)
- [x] 9. Run `supabase/schema.sql` in the Supabase SQL Editor to create the tables
- [x] 10. Run `supabase/fix-rls.sql` to fix Row Level Security for the publishable key
- [x] 11. Restart the server — data now loads from and saves to Supabase

## ✅ COMPLETE
The site is now fully connected to Supabase.

## Notes
- The publishable key (`sb_publishable_...`) can read/write the tables but **cannot run DDL** (CREATE TABLE). So the schema must be run in the Supabase SQL Editor manually.
- Verified working: `/api/control/status` shows `supabase.enabled: true`, `loads: 1`, `saves: 3`, `errors: 0`.
- All data (users, posts, chats, reels, notifications) now persists to Supabase and loads live on server start.

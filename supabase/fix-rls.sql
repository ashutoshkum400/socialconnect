-- ═══════════════════════════════════════════════════════════════════════════
-- SocialConnect — Fix Row Level Security (RLS) for the publishable key
--
-- The publishable key (sb_publishable_...) acts as the `anon` role.
-- Even though we disabled RLS in schema.sql, some Supabase projects still
-- enforce RLS on writes. Re-run this script to make sure the anon role can
-- read/write all tables. Paste this into the Supabase SQL Editor and Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Disable RLS on all tables (belt and suspenders)
alter table public.users                  disable row level security;
alter table public.posts                 disable row level security;
alter table public.reels                 disable row level security;
alter table public.chats                 disable row level security;
alter table public.notifications         disable row level security;
alter table public.friend_requests       disable row level security;
alter table public.relationships         disable row level security;
alter table public.power_bot_interactions disable row level security;

-- 2) Grant all privileges to the anon role (used by the publishable key)
grant all on all tables in schema public to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- 3) Re-grant default privileges for future tables
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

-- 4) If RLS is still enforced, create explicit ALL policies for the anon role
do $$
declare
  t text;
begin
  foreach t in array array['users','posts','reels','chats','notifications','friend_requests','relationships','power_bot_interactions']
  loop
    execute format('drop policy if exists "anon_all_%s" on public.%I', t, t);
    execute format(
      'create policy "anon_all_%s" on public.%I for all to anon, authenticated, service_role using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- 5) Make sure the anon role is usable
grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Note: For a production app, you would use a proper Supabase auth model and
-- tighten these policies. This is intentionally permissive so the server-side
-- Node.js backend (which already validates users via JWT) can read/write all data.
-- ═══════════════════════════════════════════════════════════════════════════

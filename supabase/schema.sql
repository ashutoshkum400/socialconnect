-- ═══════════════════════════════════════════════════════════════════════════
-- SocialConnect — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- This schema stores each in-memory Map collection as a table with a
-- jsonb "value" column, preserving the exact data shapes used by server.js.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── USERS ──────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id      text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── POSTS ──────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id      text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── REELS ──────────────────────────────────────────────────────────────────
create table if not exists public.reels (
  id      text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── CHATS ──────────────────────────────────────────────────────────────────
-- key = `${uid1}_${uid2}` sorted; value = array of messages
create table if not exists public.chats (
  key     text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
-- key = userId; value = array of notifications
create table if not exists public.notifications (
  user_id text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── FRIEND REQUESTS ────────────────────────────────────────────────────────
-- key = userId; value = array of {from, time}
create table if not exists public.friend_requests (
  user_id text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── RELATIONSHIPS ──────────────────────────────────────────────────────────
-- key = userId; value = array of {withUserId, type, time}
create table if not exists public.relationships (
  user_id text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── POWER BOT INTERACTIONS ────────────────────────────────────────────────
-- key = botId; value = { friends:[], followers:[], following:[], connections:[] }
create table if not exists public.power_bot_interactions (
  bot_id  text primary key,
  value   jsonb not null,
  updated_at timestamptz default now()
);

-- ─── INDEXES (optional, for faster lookups on large tables) ────────────────
create index if not exists idx_users_updated    on public.users (updated_at);
create index if not exists idx_posts_updated    on public.posts (updated_at);
create index if not exists idx_reels_updated    on public.reels (updated_at);
create index if not exists idx_chats_updated    on public.chats (updated_at);

-- ─── RLS (Row Level Security) ───────────────────────────────────────────────
-- For a server-side app using the service role / publishable key with the
-- default anon/authenticated roles, we disable RLS so the backend can
-- read/write all rows. If you want stricter security, enable RLS and add
-- policies that fit your auth model.
alter table public.users                  disable row level security;
alter table public.posts                 disable row level security;
alter table public.reels                 disable row level security;
alter table public.chats                 disable row level security;
alter table public.notifications         disable row level security;
alter table public.friend_requests       disable row level security;
alter table public.relationships         disable row level security;
alter table public.power_bot_interactions disable row level security;

-- ─── GRANTS ─────────────────────────────────────────────────────────────────
-- Grant access to anon & authenticated roles (used by publishable key).
grant all on all tables in schema public to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

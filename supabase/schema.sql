-- Run this in the Supabase SQL editor once you've created a project.
-- Persistence is optional: the dashboard works without it (live-fetch only),
-- but this gives you history, faster loads, and lets /api/ingest run on a cron.

create table if not exists incidents (
  id text primary key,
  title text not null,
  url text not null,
  source text not null,
  category text not null check (category in ('violence', 'extremism', 'cyber')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  country text,
  published_at timestamptz not null,
  snippet text,
  created_at timestamptz not null default now()
);

create index if not exists incidents_published_at_idx on incidents (published_at desc);
create index if not exists incidents_category_idx on incidents (category);

-- Row Level Security: service role (used by the app's server routes) bypasses
-- RLS automatically, so this just blocks anonymous/public access by default.
alter table incidents enable row level security;

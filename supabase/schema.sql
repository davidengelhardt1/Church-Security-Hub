-- Run this in the Supabase SQL editor after creating a project.
--
-- Persistence is optional: the dashboard works without it (live-fetch per
-- request), but this gives you history, faster page loads, and enables
-- alerting on newly-seen incidents.

create table if not exists incidents (
  id text primary key,
  title text not null,
  url text not null,
  source text not null,
  category text not null check (category in ('physical', 'extremism', 'cyber')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  country text,
  published_at timestamptz not null,
  snippet text,
  created_at timestamptz not null default now(),

  -- Alerting state. `alerted` is set once an incident has been dispatched to
  -- the webhook, so the same story is never sent twice - even though every
  -- ingest run re-fetches the same 90-day window from the news sources.
  alerted boolean not null default false,
  alerted_at timestamptz,

  -- Map coordinates, matched offline against a local gazetteer
  -- (lib/geocode.ts) rather than a live geocoding API. Null when the
  -- title doesn't name a place in the gazetteer's coverage.
  location_name text,
  lat double precision,
  lng double precision
);

create index if not exists incidents_published_at_idx on incidents (published_at desc);
create index if not exists incidents_category_idx on incidents (category);
create index if not exists incidents_alert_queue_idx
  on incidents (alerted, severity, published_at desc);

-- Service role (used by the app's server routes) bypasses RLS automatically.
-- This just blocks anonymous/public access by default.
alter table incidents enable row level security;

-- ---------------------------------------------------------------------
-- Migration: if you created this table BEFORE alerting was added, run
-- these two statements instead of recreating it.
-- ---------------------------------------------------------------------
-- alter table incidents add column if not exists alerted boolean not null default false;
-- alter table incidents add column if not exists alerted_at timestamptz;

-- ---------------------------------------------------------------------
-- Migration: if your table predates the map feature, run this. Your
-- grants (service_role select/insert/update/delete) already cover the
-- new columns automatically - no re-grant needed.
-- ---------------------------------------------------------------------
alter table incidents add column if not exists location_name text;
alter table incidents add column if not exists lat double precision;
alter table incidents add column if not exists lng double precision;

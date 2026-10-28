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

-- ---------------------------------------------------------------------
-- Migration: duplicate suppression. Google News returns one URL per outlet,
-- so one story arrives as many rows with different ids but the same
-- headline, and the CIS feed re-publishes advisories under new numbers.
--
--   title_key       normalized headline, computed by Postgres. lib/dedupe.ts
--                   titleKey() must produce the same value.
--   duplicate_of    id of the canonical row when this row is a copy. Rows are
--                   flagged rather than deleted so alert history is preserved;
--                   the board and alert queue read only `duplicate_of is null`.
--   alert_sent_at   set only when an alert actually went out (webhook/email),
--                   as opposed to `alerted`, which also covers items retired
--                   from the queue. Later runs compare candidates against it.
-- ---------------------------------------------------------------------
alter table incidents
  add column if not exists title_key text generated always as (
    btrim(regexp_replace(lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g')), '\s+', ' ', 'g'))
  ) stored,
  add column if not exists duplicate_of text,
  add column if not exists alert_sent_at timestamptz;

create index if not exists incidents_dedupe_idx
  on incidents (category, title_key, published_at);
create index if not exists incidents_duplicate_of_idx
  on incidents (duplicate_of) where duplicate_of is not null;
create index if not exists incidents_alert_sent_idx
  on incidents (alert_sent_at) where alert_sent_at is not null;

-- One-time backfill for rows that predate this migration. Same category +
-- same headline within 14 days (news) / 1 day (cyber advisories, which reuse
-- titles for genuinely different bulletins) = same story. The canonical row
-- prefers one already alerted, then the earliest published.
with ordered as (
  select id, category, title_key, published_at, alerted,
         case when category = 'cyber' then interval '1 day' else interval '14 days' end as win,
         published_at - lag(published_at) over (
           partition by category, title_key order by published_at, id
         ) as gap
  from incidents
), clustered as (
  select *,
         sum(case when gap is null or gap > win then 1 else 0 end) over (
           partition by category, title_key order by published_at, id
         ) as cid
  from ordered
), ranked as (
  select id,
         first_value(id) over (
           partition by category, title_key, cid
           order by alerted desc, published_at, id
         ) as canon
  from clustered
)
update incidents i
set duplicate_of = r.canon
from ranked r
where i.id = r.id and r.canon <> i.id;

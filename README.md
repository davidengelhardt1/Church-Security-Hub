# Watch Board — Church Security Dashboard

A live situational-awareness dashboard for a church security team: tracks
violence at houses of worship, extremist/hate-crime activity near
congregations, and cyberattacks on churches/nonprofits, pulled from free
public sources.

## Data sources (all free, no paid keys required)

- **GDELT DOC 2.0 API** — global news search, updated every 15 min, no key.
  Covers the "violence" and "extremism" categories.
- **CISA Cybersecurity Advisories** feed — US government cyber advisories.
- **CIS / MS-ISAC Advisories** feed — nonprofit-relevant cyber threats.

Each incident is auto-tagged with a severity (high/medium/low) using a
keyword lexicon in `lib/classify.ts` — tune that file as you see false
positives/negatives.

**Known limitation:** GDELT's DOC API returns a source *country*, not
coordinates, so v1 doesn't have a literal map — it's a filterable log. Adding
a map is a reasonable next step (see "Next steps" below).

## Quickstart (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it'll fetch live data immediately, no setup
required. Without Supabase configured, every page load re-fetches from
GDELT/RSS directly (fine for a small team checking in periodically; see
below if you want it always-fresh in the background).

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project** → import the repo → it auto-detects Next.js →
   Deploy. No env vars are required for a working deployment.
3. Done. Visit the deployed URL.

## Optional: add persistence + background refresh (Supabase)

Without this, the dashboard re-fetches from GDELT/RSS every time someone
loads the page — works fine, but there's no history and nothing runs when no
one's looking at it.

With Supabase wired up: a Vercel Cron job hits `/api/ingest` every 30
minutes, stores incidents in Postgres, and the dashboard reads from that
table (fast, has history, doesn't hammer GDELT on every page view).

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/schema.sql` from this repo.
3. In Supabase → Project Settings → API, copy the **Project URL** and the
   **service_role key** (not the anon key — this needs write access).
4. In Vercel → your project → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` — any random string you generate (`openssl rand -hex 16`)
5. Redeploy. Vercel Cron (already configured in `vercel.json`) will start
   hitting `/api/ingest` every 30 minutes automatically — no extra setup.

## Tuning it for your church specifically

- **Keywords**: `lib/gdelt.ts` has the three search queries. Consider adding
  your denomination name, city/region, or state to narrow relevance, e.g.
  appending `("Texas" OR "Dallas")` if hyperlocal signal matters more than
  national trends.
- **Severity lexicon**: `lib/classify.ts` — add words specific to patterns
  you actually care about (e.g. "swatting" already included; add "protest,"
  "picket," etc. if that's relevant to your context).
- **Refresh rate**: `REFRESH_MS` in `app/page.tsx` (client polling) and the
  cron schedule in `vercel.json` (background ingestion).

## Next steps worth considering

- **Map view**: GDELT's separate GEO 2.0 API returns coordinates and could
  power an actual map layer alongside the log.
- **Alerting**: a Zapier/Composio webhook off new high-severity rows in
  Supabase could push to Slack/email/SMS for your team — natural fit given
  the stack you're already exploring.
- **AI triage**: an LLM pass (Claude API) over new incidents to write a
  1-line "why this matters for us" note, instead of just keyword severity.
- **Denomination-specific sources**: outlets like the Faith Based Security
  Network or Sheepdog Church Security publish incident roundups that aren't
  in GDELT's index — worth adding as another RSS source in `lib/feeds.ts` if
  they publish one.

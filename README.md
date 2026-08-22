# Watch Board — Church Security Dashboard

A live situational-awareness dashboard for a church security team. It
aggregates physical-security incidents at houses of worship, extremist and
hate-crime activity targeting religious sites, and cyber threats relevant to
churches and small nonprofits — all from free public sources, with no paid
API keys.

Built because our security team had no practical way to see what was
happening at houses of worship elsewhere.

**Live:** https://church-security-hub.vercel.app

<!-- Add a screenshot here before sharing publicly:
![Watch Board](docs/screenshot.png)
-->

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), React, TypeScript |
| Hosting | Vercel (auto-deploy on push to `main`) |
| Persistence | Supabase / Postgres — **optional** |
| Scheduling | Vercel Cron → `/api/ingest` |
| Parsing | `fast-xml-parser` for RSS |

No paid services. The whole thing runs on free tiers.

---

## How the feeds work together

Three independent public sources are normalized into a single `Incident`
shape (`lib/types.ts`) and served from one endpoint, `/api/events`.

**1. Google News RSS** — `lib/googlenews.ts` (primary source)
About 20 short, targeted searches rather than one broad query: `church
arson`, `synagogue attack`, `diocese cyberattack`, and so on. Keyless, no
boolean-syntax quirks, no query-length ceiling. Each search is scoped to the
last 90 days.

**2. GDELT DOC 2.0** — `lib/gdelt.ts` (supplement)
Global news index covering 100+ languages. Keyless. Used to catch
international incidents that Google News may not surface. Queries are kept
deliberately short here — see [Notes on GDELT](#notes-on-gdelt).

**3. CIS / MS-ISAC advisories** — `lib/feeds.ts` (cyber)
Standard RSS. Capped to the last 90 days and 20 items per feed, because
these publish every vendor patch bulletin and will otherwise bury everything
else on the board.

### The pipeline

```
fetch all sources in parallel  (Promise.allSettled)
        ↓
classify severity              (lib/classify.ts — keyword lexicon)
        ↓
verify relevance               (regex re-check, see below)
        ↓
deduplicate                    (by URL, then by normalized title)
        ↓
sort by publish date → single JSON array
```

Two design decisions worth calling out:

**Sources fail independently.** Everything runs through
`Promise.allSettled`, so a dead or slow feed degrades the board instead of
breaking it.

**Relevance is re-verified locally.** Search APIs return loosely-matched
results — early versions surfaced a Frank Sinatra anniversary concert under
"cyber." So upstream results are treated as a candidate pool, and each title
must independently match both a religious-context term *and* a
category-appropriate incident term (`isRelevant()` in `lib/gdelt.ts`) before
it reaches the board.

---

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000. It fetches live data immediately — no
configuration, no API keys, no database required.

## Deploying

1. Push to a GitHub repo.
2. Vercel → **New Project** → import it. Next.js is auto-detected.
3. Deploy. No environment variables are required.

## Optional: persistence and background refresh

Without Supabase, the dashboard re-fetches on every page load. That works
fine for a small team, but there's no history and nothing runs when nobody
is looking at it.

With Supabase configured, Vercel Cron hits `/api/ingest` on a schedule,
incidents accumulate in Postgres, and the dashboard reads from that table.

1. Create a free project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. From Supabase → Project Settings → API, copy the **Project URL** and the
   **service_role key** (not the anon key — ingestion needs write access).
4. In Vercel → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` — any random string (`openssl rand -hex 16`)
5. Redeploy.

> **Vercel Hobby plan note:** cron jobs are limited to once per day. The
> schedule in `vercel.json` is set to `0 6 * * *` accordingly. A more
> frequent schedule will cause the deployment to fail with a plan-limit
> error.

---

## Tuning it for a specific congregation

- **Searches** — `SEARCHES` in `lib/googlenews.ts`. Add your city, state, or
  denomination for hyperlocal signal. Keep each query short and specific;
  many narrow searches outperform one broad one.
- **Severity lexicon** — `lib/classify.ts`. Add terms that match what your
  team actually cares about.
- **Relevance filters** — the regexes in `lib/gdelt.ts` control what's
  allowed through. Loosen or tighten per category.
- **Refresh rate** — `REFRESH_MS` in `app/page.tsx` (client polling) and the
  cron schedule in `vercel.json`.

---

## Notes on GDELT

Documented here because these cost real debugging time.

**Query length is capped.** Long boolean queries are rejected with an HTML
page reading `Your query was too short or too long` — not JSON, and not an
HTTP error status. A JSON parser catches the failure and returns an empty
array, which is indistinguishable from a legitimate zero-result search. This
silently produced an empty board through several deploys. Keep GDELT queries
short.

**Boolean logic is unreliable.** Grouped `AND`-of-`OR` queries are not
consistently respected, which is why relevance is re-verified locally rather
than trusted from the API.

**User-Agent matters.** Non-browser User-Agent strings have been reported to
trigger rate limiting. This project sends a standard browser UA.

**The general lesson:** a public API returning `200 OK` with an unexpected
body is the failure mode to design for. `/api/events` therefore reports
per-source and per-category counts in its response:

```json
{
  "sources": { "googleNews": 41, "gdelt": 12, "cyberFeeds": 20 },
  "byCategory": { "physical": 28, "extremism": 9, "cyber": 31 }
}
```

Which source went quiet is now one request away instead of an afternoon.

---

## Known limitations

- **Coverage is news-dependent.** Incidents that don't get reported online
  don't appear. This is a monitoring aid, not a comprehensive incident
  database — no such free, structured source exists for this domain.
- **Severity is keyword-based**, not semantic. It's a triage hint, not a
  judgment.
- **No map view.** GDELT returns source country, not coordinates.
- **No alerting.** Nobody is notified; someone has to look at the board.

## Possible next steps

- **Alerting** — push high-severity items to SMS, email, or Slack via a
  webhook off new Supabase rows.
- **Map view** — GDELT's GEO 2.0 API returns coordinates.
- **LLM triage** — a short "why this matters for us" note per incident,
  replacing keyword-only severity.
- **Denomination-specific sources** — organizations like the Faith Based
  Security Network publish incident roundups outside mainstream news
  indexes; add them in `lib/feeds.ts`.

## License

MIT

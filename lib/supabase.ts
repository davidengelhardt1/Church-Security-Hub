import { createClient } from "@supabase/supabase-js";
import { Incident } from "./types";

// The Supabase-Vercel integration provisions credentials under its own
// variable names, which differ from the ones you'd set by hand. Accept
// either, preferring the integration's (those stay in sync automatically if
// a key is ever rotated). Empty strings are skipped so a leftover blank
// variable doesn't shadow a working one.
function firstSet(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim() !== "") return v;
  }
  return undefined;
}

const url = firstSet("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");

// SUPABASE_SECRET_KEY is Supabase's newer name for the service_role key.
// Both bypass row-level security, which server-side ingestion requires.
// The publishable/anon keys deliberately are NOT accepted here - they
// can't write to the table.
const key = firstSet("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

export const supabaseEnabled = Boolean(url && key);

/** Which env var names were actually found - for diagnostics, never values. */
export const supabaseConfigSource = {
  url: url
    ? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : "SUPABASE_URL"
    : null,
  key: key
    ? process.env.SUPABASE_SECRET_KEY?.trim()
      ? "SUPABASE_SECRET_KEY"
      : "SUPABASE_SERVICE_ROLE_KEY"
    : null,
};

export const supabase = supabaseEnabled
  ? createClient(url as string, key as string)
  : null;

function toRow(i: Incident) {
  return {
    id: i.id,
    title: i.title,
    url: i.url,
    source: i.source,
    category: i.category,
    severity: i.severity,
    country: i.country ?? null,
    published_at: i.publishedAt,
    snippet: i.snippet ?? null,
  };
}

function fromRow(r: any): Incident {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    source: r.source,
    category: r.category,
    severity: r.severity,
    country: r.country ?? undefined,
    publishedAt: r.published_at,
    snippet: r.snippet ?? undefined,
  };
}

/**
 * Inserts incidents and reports which ones we had never seen before.
 *
 * The news sources return the same rolling 90-day window on every run, so
 * "new to us" can't be inferred from publish date - it has to be determined
 * against what's already stored. That distinction is what makes alerting
 * possible without spamming the same story every 24 hours.
 *
 * Implementation note: an earlier version pre-queried which IDs already
 * existed via `.in("id", [...])`. That silently failed - Google News IDs
 * embed a full encoded article URL (up to ~750 chars), so a few hundred of
 * them blew past the maximum URL length and the request errored out.
 * Instead we let Postgres do the work: `ON CONFLICT DO NOTHING` combined
 * with `.select()` returns exactly the rows that were actually inserted,
 * with no ID list in the request URL at all.
 */
export async function persistIncidents(
  incidents: Incident[]
): Promise<{ persisted: boolean; count: number; newIds: string[]; isFirstRun: boolean }> {
  const empty = { persisted: false, count: 0, newIds: [], isFirstRun: false };
  if (!supabase || incidents.length === 0) return empty;

  // Is the table empty? If so this is a first run / backfill, and we must
  // not fire alerts for the entire historical window.
  const { count: existingTotal, error: countError } = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("Supabase count failed:", countError.message);
    return empty;
  }
  const isFirstRun = (existingTotal ?? 0) === 0;

  // Insert in batches. These are POST bodies, not URLs, so length is not a
  // constraint here - batching just keeps individual requests reasonable.
  const CHUNK = 100;
  const newIds: string[] = [];
  let attempted = 0;

  for (let i = 0; i < incidents.length; i += CHUNK) {
    const batch = incidents.slice(i, i + CHUNK).map(toRow);

    const { data, error } = await supabase
      .from("incidents")
      .upsert(batch, { onConflict: "id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error(
        `Supabase insert failed (batch ${Math.floor(i / CHUNK) + 1}):`,
        error.message
      );
      continue; // one bad batch shouldn't discard the rest
    }

    // With ignoreDuplicates, only genuinely-new rows are returned.
    for (const row of data ?? []) newIds.push(row.id);
    attempted += batch.length;
  }

  if (attempted === 0) return empty;

  return { persisted: true, count: attempted, newIds, isFirstRun };
}

export async function loadRecentIncidents(days = 90): Promise<Incident[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error || !data) return [];
  return data.map(fromRow);
}

/**
 * Returns incidents that should be alerted on: high severity, recently
 * published, and not yet dispatched. Capped so a backlog can't produce a
 * hundred notifications at once.
 */
export async function getPendingAlerts(
  candidateIds: string[],
  maxAlerts = 8,
  maxAgeDays = 3
): Promise<Incident[]> {
  if (!supabase || candidateIds.length === 0) return [];
  const since = new Date(Date.now() - maxAgeDays * 86400000).toISOString();

  // Deliberately NOT filtering by candidateIds here: incident IDs embed full
  // article URLs and a list of them would overflow the request URL. The
  // `alerted = false` flag already scopes this to undispatched incidents,
  // which is equivalent - anything previously seen is already marked.
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("alerted", false)
    .eq("severity", "high")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(maxAlerts);

  if (error || !data) {
    if (error) console.error("Alert query failed:", error.message);
    return [];
  }
  return data.map(fromRow);
}

/**
 * Marks incidents as alerted so they're never dispatched twice.
 *
 * IDs go one per request rather than as an `.in()` list: they embed full
 * article URLs, and batching them overflows the maximum request URL length.
 * The alert cap (8 per run) keeps this to a handful of small requests.
 */
export async function markAlerted(ids: string[]) {
  if (!supabase || ids.length === 0) return;
  for (const id of ids) {
    const { error } = await supabase
      .from("incidents")
      .update({ alerted: true, alerted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error("Failed to mark alerted:", error.message);
  }
}

/**
 * Marks everything as alerted WITHOUT sending anything. Used on the first
 * ingest run so the initial 90-day backfill doesn't blast the whole team.
 *
 * Applied as a single filtered UPDATE rather than by ID list - same reason
 * as above, and it also covers rows written by a concurrent page load.
 */
export async function suppressAlertsForBackfill(_ids?: string[]) {
  if (!supabase) return;
  const { error } = await supabase
    .from("incidents")
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq("alerted", false);
  if (error) console.error("Backfill suppression failed:", error.message);
}

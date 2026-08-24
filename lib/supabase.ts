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
 * Upserts incidents and reports which ones we had never seen before.
 *
 * The news sources return the same rolling 90-day window on every run, so
 * "new to us" can't be inferred from publish date - it has to be determined
 * against what's already stored. That distinction is what makes alerting
 * possible without spamming the same story every 24 hours.
 */
export async function persistIncidents(
  incidents: Incident[]
): Promise<{ persisted: boolean; count: number; newIds: string[]; isFirstRun: boolean }> {
  const empty = { persisted: false, count: 0, newIds: [], isFirstRun: false };
  if (!supabase || incidents.length === 0) return empty;

  // Is the table empty? If so this is a first run / backfill, and we must
  // not fire alerts for the entire historical window.
  const { count: existingTotal } = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true });
  const isFirstRun = (existingTotal ?? 0) === 0;

  // Which of these IDs do we already have?
  const ids = incidents.map((i) => i.id);
  const known = new Set<string>();
  const CHUNK = 200; // keep the `in` filter (and URL length) reasonable
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("incidents")
      .select("id")
      .in("id", slice);
    if (error) {
      console.error("Supabase lookup failed:", error.message);
      return empty;
    }
    for (const row of data ?? []) known.add(row.id);
  }

  const newIds = ids.filter((id) => !known.has(id));

  const { error } = await supabase
    .from("incidents")
    .upsert(incidents.map(toRow), { onConflict: "id" });

  if (error) {
    console.error("Supabase upsert failed:", error.message);
    return empty;
  }

  return { persisted: true, count: incidents.length, newIds, isFirstRun };
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

  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .in("id", candidateIds.slice(0, 500))
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

/** Marks incidents as alerted so they're never dispatched twice. */
export async function markAlerted(ids: string[]) {
  if (!supabase || ids.length === 0) return;
  const { error } = await supabase
    .from("incidents")
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) console.error("Failed to mark alerted:", error.message);
}

/**
 * Marks everything as alerted WITHOUT sending anything. Used on the first
 * ingest run so the initial 90-day backfill doesn't blast the whole team.
 */
export async function suppressAlertsForBackfill(ids: string[]) {
  if (!supabase || ids.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from("incidents")
      .update({ alerted: true, alerted_at: new Date().toISOString() })
      .in("id", ids.slice(i, i + CHUNK));
    if (error) console.error("Backfill suppression failed:", error.message);
  }
}

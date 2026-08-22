import { createClient } from "@supabase/supabase-js";
import { Incident } from "./types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseEnabled = Boolean(url && key);

export const supabase = supabaseEnabled
  ? createClient(url as string, key as string)
  : null;

// Upserts incidents into the `incidents` table (see supabase/schema.sql).
// Safe to call even when Supabase isn't configured - it just skips.
export async function persistIncidents(incidents: Incident[]) {
  if (!supabase) return { persisted: false, count: 0 };

  const rows = incidents.map((i) => ({
    id: i.id,
    title: i.title,
    url: i.url,
    source: i.source,
    category: i.category,
    severity: i.severity,
    country: i.country ?? null,
    published_at: i.publishedAt,
    snippet: i.snippet ?? null,
  }));

  const { error } = await supabase
    .from("incidents")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Supabase upsert failed:", error.message);
    return { persisted: false, count: 0 };
  }
  return { persisted: true, count: rows.length };
}

export async function loadRecentIncidents(days = 14): Promise<Incident[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    source: r.source,
    category: r.category,
    severity: r.severity,
    country: r.country ?? undefined,
    publishedAt: r.published_at,
    snippet: r.snippet ?? undefined,
  }));
}

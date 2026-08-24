import { NextResponse } from "next/server";
import { fetchAllGdelt } from "@/lib/gdelt";
import { fetchAllGoogleNews } from "@/lib/googlenews";
import { fetchAllCyberFeeds } from "@/lib/feeds";
import {
  persistIncidents,
  loadRecentIncidents,
  supabaseEnabled,
  supabaseConfigSource,
} from "@/lib/supabase";
import { Incident } from "@/lib/types";
import { attachLocations } from "@/lib/attachLocations";

export const dynamic = "force-dynamic"; // always fetch fresh, this is a live watch board
// The first request (empty table) fetches every source AND writes several
// hundred rows, so it needs headroom. Subsequent requests read from
// Supabase and are fast.
export const maxDuration = 60;

// Wire stories get syndicated across a dozen local-news domains with the
// exact same headline. Keep only the first (most recent) copy of each.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(incidents: Incident[]): Incident[] {
  const byId = new Map<string, Incident>();
  for (const inc of incidents) {
    if (!byId.has(inc.id)) byId.set(inc.id, inc);
  }
  const sorted = Array.from(byId.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const seenTitles = new Set<string>();
  const result: Incident[] = [];
  for (const inc of sorted) {
    const key = normalizeTitle(inc.title);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    result.push(inc);
  }
  return result;
}

export async function GET() {
  try {
    // If Supabase is configured, prefer serving from it - it's fast and holds
    // history beyond what a single live fetch returns. /api/ingest (run on a
    // schedule via Vercel Cron) is what keeps it fresh.
    if (supabaseEnabled) {
      const historical = await loadRecentIncidents();
      if (historical.length > 0) {
        return NextResponse.json({
          incidents: historical,
          fetchedAt: new Date().toISOString(),
          sources: { persistence: true, mode: "supabase" },
        });
      }
      // Fall through to a live fetch if the table is empty (first run).
    }

    const [gdelt, googleNews, feeds] = await Promise.all([
      fetchAllGdelt(),
      fetchAllGoogleNews(),
      fetchAllCyberFeeds(),
    ]);

    const live = attachLocations(dedupe([...googleNews, ...gdelt, ...feeds]));

    // Must be awaited: Vercel freezes the function as soon as the response
    // is sent, so a fire-and-forget write would silently never complete.
    // This only costs latency on the first load - once the table is
    // populated, requests are served from Supabase and skip the live fetch.
    if (supabaseEnabled) {
      try {
        await persistIncidents(live);
      } catch (e) {
        console.error("persist error", e);
      }
    }

    // Per-source and per-category counts are exposed here deliberately: when
    // one source silently returns nothing, this is the fastest way to see it.
    const byCategory = { physical: 0, extremism: 0, cyber: 0 };
    for (const i of live) byCategory[i.category]++;

    return NextResponse.json({
      incidents: live,
      fetchedAt: new Date().toISOString(),
      sources: {
        googleNews: googleNews.length,
        gdelt: gdelt.length,
        cyberFeeds: feeds.length,
        persistence: supabaseEnabled,
        // Which env var names supplied the credentials (never the values).
        persistenceConfig: supabaseConfigSource,
        mode: "live",
      },
      byCategory,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch events", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

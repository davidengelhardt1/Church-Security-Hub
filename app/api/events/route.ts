import { NextResponse } from "next/server";
import { fetchAllGdelt } from "@/lib/gdelt";
import { fetchAllGoogleNews } from "@/lib/googlenews";
import { fetchAllCyberFeeds } from "@/lib/feeds";
import { loadRecentIncidents, supabaseEnabled } from "@/lib/supabase";
import { cleanIncidents } from "@/lib/safe";
import { Incident } from "@/lib/types";
import { attachLocations } from "@/lib/attachLocations";

export const dynamic = "force-dynamic"; // always fetch fresh, this is a live watch board
// If the table is empty this falls back to a live fetch of every source,
// which needs headroom. Normal requests read from Supabase and are fast.
export const maxDuration = 60;

// This route is public, so it must not do anything expensive or write
// anything on a visitor's behalf. Letting the CDN cache the answer for a
// minute keeps repeated or hostile requests from reaching the database or
// the upstream news sources. Writes happen only in /api/ingest, which
// requires the cron secret.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

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
        return NextResponse.json(
          {
            incidents: historical,
            fetchedAt: new Date().toISOString(),
            sources: { persistence: true, mode: "supabase" },
          },
          { headers: CACHE_HEADERS }
        );
      }
      // Fall through to a live fetch if the table is empty (before the first ingest run).
    }

    const [gdelt, googleNews, feeds] = await Promise.all([
      fetchAllGdelt(),
      fetchAllGoogleNews(),
      fetchAllCyberFeeds(),
    ]);

    const live = cleanIncidents(attachLocations(dedupe([...googleNews, ...gdelt, ...feeds])));

    // Per-source and per-category counts are exposed here deliberately: when
    // one source silently returns nothing, this is the fastest way to see it.
    const byCategory = { physical: 0, extremism: 0, cyber: 0 };
    for (const i of live) byCategory[i.category]++;

    return NextResponse.json(
      {
        incidents: live,
        fetchedAt: new Date().toISOString(),
        sources: {
          googleNews: googleNews.length,
          gdelt: gdelt.length,
          cyberFeeds: feeds.length,
          persistence: supabaseEnabled,
          mode: "live",
        },
        byCategory,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err: any) {
    // Details go to the server log, not to the visitor.
    console.error("events route failed:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

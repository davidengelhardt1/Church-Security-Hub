import { NextResponse } from "next/server";
import { fetchAllGdelt } from "@/lib/gdelt";
import { fetchAllCyberFeeds } from "@/lib/feeds";
import { persistIncidents, loadRecentIncidents, supabaseEnabled } from "@/lib/supabase";
import { Incident } from "@/lib/types";

export const dynamic = "force-dynamic"; // always fetch fresh, this is a live watch board
export const maxDuration = 30;

function dedupe(incidents: Incident[]): Incident[] {
  const seen = new Map<string, Incident>();
  for (const inc of incidents) {
    if (!seen.has(inc.id)) seen.set(inc.id, inc);
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
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

    const [gdelt, feeds] = await Promise.all([
      fetchAllGdelt(),
      fetchAllCyberFeeds(),
    ]);

    const live = dedupe([...gdelt, ...feeds]);

    if (supabaseEnabled) {
      persistIncidents(live).catch((e) => console.error("persist error", e));
    }

    return NextResponse.json({
      incidents: live,
      fetchedAt: new Date().toISOString(),
      sources: {
        gdelt: gdelt.length,
        cyberFeeds: feeds.length,
        persistence: supabaseEnabled,
        mode: "live",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch events", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

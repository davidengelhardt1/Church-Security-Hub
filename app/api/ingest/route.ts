import { NextResponse } from "next/server";
import { fetchAllGdelt } from "@/lib/gdelt";
import { fetchAllCyberFeeds } from "@/lib/feeds";
import { persistIncidents, supabaseEnabled } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Hit by Vercel Cron (see vercel.json). Requires Supabase env vars to do
// anything useful - without them there's nowhere to persist to, so this is
// a no-op and /api/events will just fetch live on each page load instead.
export async function GET(request: Request) {
  // Basic protection so this can't be spammed by anyone who finds the URL.
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseEnabled) {
    return NextResponse.json({ skipped: true, reason: "Supabase not configured" });
  }

  const [gdelt, feeds] = await Promise.all([fetchAllGdelt(), fetchAllCyberFeeds()]);
  const all = [...gdelt, ...feeds];
  const result = await persistIncidents(all);

  return NextResponse.json({
    fetched: all.length,
    ...result,
    ranAt: new Date().toISOString(),
  });
}

import { NextResponse } from "next/server";
import { fetchAllGdelt } from "@/lib/gdelt";
import { fetchAllGoogleNews } from "@/lib/googlenews";
import { fetchAllCyberFeeds } from "@/lib/feeds";
import {
  persistIncidents,
  getPendingAlerts,
  markAlerted,
  suppressAlertsForBackfill,
  backfillLocations,
  supabaseEnabled,
} from "@/lib/supabase";
import { sendAlerts, alertsEnabled } from "@/lib/alerts";
import { isAlertWorthy, dedupeEvents } from "@/lib/alertFilter";
import { attachLocations } from "@/lib/attachLocations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled ingestion (see vercel.json). Fetches every source, stores what's
 * new, and dispatches alerts for newly-seen high-severity incidents.
 *
 * Can also be triggered manually to test:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/ingest
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseEnabled) {
    return NextResponse.json({
      skipped: true,
      reason:
        "Supabase not configured - set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const [gdelt, googleNews, feeds] = await Promise.all([
    fetchAllGdelt(),
    fetchAllGoogleNews(),
    fetchAllCyberFeeds(),
  ]);
  const all = attachLocations([...googleNews, ...gdelt, ...feeds]);

  const { persisted, count, newIds, isFirstRun } = await persistIncidents(all);

  if (!persisted) {
    return NextResponse.json(
      { error: "Persistence failed - see logs" },
      { status: 500 }
    );
  }

  // One-time-ish catch-up for rows written before the map feature existed.
  // Cheap to run every time (no network call, just a title match), and it
  // naturally stops finding work once the backlog is caught up.
  const backfill = await backfillLocations();

  // First run backfills a 90-day window. Alerting on all of it would send a
  // wall of notifications about incidents the team has long since seen, so
  // mark them dispatched without sending anything.
  if (isFirstRun) {
    await suppressAlertsForBackfill(newIds);
    return NextResponse.json({
      fetched: all.length,
      stored: count,
      newIncidents: newIds.length,
      alerting:
        newIds.length > 0
          ? `suppressed - table appeared empty, so ${newIds.length} incident(s) were stored but marked as already-alerted rather than dispatched`
          : "no incidents were new this run - nothing to alert on regardless",
      locationsBackfilled: backfill.updated,
      ranAt: new Date().toISOString(),
    });
  }

  // Pull a generous candidate pool, then apply the alert-specific filters.
  // These are deliberately stricter than the board's: aftermath coverage and
  // duplicate reporting are fine on a dashboard but wrong in a notification.
  const candidates = await getPendingAlerts(newIds, 40);
  const worthy = candidates.filter((i) => isAlertWorthy(i.title));
  const pending = dedupeEvents(worthy).slice(0, 8);

  // Anything considered but not sent gets marked anyway, so it doesn't sit
  // in the queue being re-evaluated on every future run.
  const rejectedIds = candidates
    .filter((c) => !pending.some((p) => p.id === c.id))
    .map((c) => c.id);
  if (rejectedIds.length > 0) await markAlerted(rejectedIds);

  let alertResult: { sent: boolean; reason?: string } = {
    sent: false,
    reason: alertsEnabled ? "no qualifying incidents" : "ALERT_WEBHOOK_URL not set",
  };

  if (pending.length > 0 && alertsEnabled) {
    alertResult = await sendAlerts(pending);
    // Only mark as alerted on success, so a transient webhook failure
    // retries on the next run instead of silently dropping the alert.
    if (alertResult.sent) {
      await markAlerted(pending.map((i) => i.id));
    }
  }

  return NextResponse.json({
    fetched: all.length,
    stored: count,
    newIncidents: newIds.length,
    alertCandidates: candidates.length,
    afterFiltering: worthy.length,
    afterEventDedupe: pending.length,
    alertsSent: alertResult.sent ? pending.length : 0,
    alertNote: alertResult.reason,
    locationsBackfilled: backfill.updated,
    ranAt: new Date().toISOString(),
  });
}

import { Incident } from "./types";

// Alerting is intentionally webhook-based rather than tied to one provider.
// Set ALERT_WEBHOOK_URL to a Slack incoming webhook, a Discord webhook, or a
// Zapier/Make catch-hook (which can then fan out to SMS, email, whatever the
// team actually uses). The payload shape adapts to the destination.

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export const alertsEnabled = Boolean(WEBHOOK_URL);

const CATEGORY_LABEL: Record<Incident["category"], string> = {
  physical: "Physical Security",
  extremism: "Extremism",
  cyber: "Cyber",
};

function plainTextSummary(incidents: Incident[]): string {
  const lines = incidents.map(
    (i) => `• [${CATEGORY_LABEL[i.category]}] ${i.title}\n  ${i.url}`
  );
  const header =
    incidents.length === 1
      ? "New high-severity incident on the Watch Board:"
      : `${incidents.length} new high-severity incidents on the Watch Board:`;
  return `${header}\n\n${lines.join("\n\n")}`;
}

function buildPayload(incidents: Incident[], url: string): unknown {
  const text = plainTextSummary(incidents);

  // Slack and Discord both accept a simple body, but under different keys.
  if (url.includes("hooks.slack.com")) return { text };
  if (url.includes("discord.com/api/webhooks")) return { content: text };

  // Generic (Zapier, Make, IFTTT, custom): send structured data so the
  // receiving automation can format it however it likes.
  return {
    summary: text,
    count: incidents.length,
    incidents: incidents.map((i) => ({
      title: i.title,
      url: i.url,
      source: i.source,
      category: i.category,
      categoryLabel: CATEGORY_LABEL[i.category],
      severity: i.severity,
      country: i.country ?? null,
      publishedAt: i.publishedAt,
    })),
  };
}

export async function sendAlerts(
  incidents: Incident[]
): Promise<{ sent: boolean; reason?: string }> {
  if (!WEBHOOK_URL) return { sent: false, reason: "ALERT_WEBHOOK_URL not set" };
  if (incidents.length === 0) return { sent: false, reason: "nothing to send" };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(incidents, WEBHOOK_URL)),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const reason = `webhook returned ${res.status}: ${body.slice(0, 200)}`;
      console.error("Alert dispatch failed:", reason);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err: any) {
    const reason = String(err?.message ?? err);
    console.error("Alert dispatch errored:", reason);
    return { sent: false, reason };
  }
}

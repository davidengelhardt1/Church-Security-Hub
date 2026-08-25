import { Resend } from "resend";
import { Incident } from "./types";

// Separate from lib/alerts.ts (the webhook) - this is the new per-user
// delivery channel. Resend, not Supabase's built-in email: Supabase's
// email sending is scoped to auth flows (magic links, password resets),
// not arbitrary custom content like an alert digest.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Resend requires sending from a domain you've verified with them. Falls
// back to their shared testing address, which only delivers to the
// Resend account owner's own email - fine for initial setup, not for
// real subscribers. See README for the verified-domain setup step.
const FROM_ADDRESS = process.env.ALERT_FROM_EMAIL || "onboarding@resend.dev";

export const emailAlertsEnabled = Boolean(RESEND_API_KEY);

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const CATEGORY_LABEL: Record<Incident["category"], string> = {
  physical: "Physical Security",
  extremism: "Extremism",
  cyber: "Cyber",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(incidents: Incident[]): string {
  const rows = incidents
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #2a3441;">
          <div style="font-size:11px;letter-spacing:0.05em;color:${
            i.severity === "high" ? "#c2452f" : "#d9a441"
          };text-transform:uppercase;margin-bottom:4px;">
            ${CATEGORY_LABEL[i.category]} · ${i.severity}
          </div>
          <div style="font-size:15px;color:#e8eaec;margin-bottom:6px;">
            ${escapeHtml(i.title)}
          </div>
          <a href="${escapeHtml(i.url)}" style="font-size:13px;color:#4c7ea8;text-decoration:none;">
            Read more →
          </a>
        </td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:-apple-system,sans-serif;background:#0e1319;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#161d25;border:1px solid #2a3441;border-radius:8px;padding:24px;">
        <div style="font-size:18px;font-weight:700;color:#e8eaec;margin-bottom:4px;">
          Watch Board Alert
        </div>
        <div style="font-size:13px;color:#8ea0ac;margin-bottom:16px;">
          ${incidents.length} new incident${incidents.length === 1 ? "" : "s"} matching your alert preferences
        </div>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #2a3441;font-size:12px;color:#5a6b78;">
          Manage your alert preferences at your Watch Board dashboard → /preferences
        </div>
      </div>
    </div>`;
}

export async function sendAlertEmail(
  toEmail: string,
  incidents: Incident[]
): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not set" };
  if (incidents.length === 0) return { sent: false, reason: "nothing to send" };

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject:
        incidents.length === 1
          ? `Watch Board: ${incidents[0].title.slice(0, 80)}`
          : `Watch Board: ${incidents.length} new high-severity incidents`,
      html: buildEmailHtml(incidents),
    });

    if (error) {
      console.error(`Email send failed for ${toEmail}:`, error.message);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err: any) {
    const reason = String(err?.message ?? err);
    console.error(`Email send errored for ${toEmail}:`, reason);
    return { sent: false, reason };
  }
}

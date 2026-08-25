import { Incident } from "@/lib/types";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Ribbon({
  incidents,
  fetchedAt,
  loading,
}: {
  incidents: Incident[];
  fetchedAt: string | null;
  loading: boolean;
}) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of incidents) counts[i.severity]++;

  const stat = (label: string, value: number, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 72 }}>
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.08em" }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 36,
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <header className="ribbon">
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 26,
              margin: 0,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Watch Board
          </h1>
          <p
            className="mono"
            style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-dim)" }}
          >
            church security · situational awareness
          </p>
        </div>
      </div>

      <div className="ribbon__stats">
        {stat("HIGH", counts.high, "var(--sev-high)")}
        {stat("MED", counts.medium, "var(--sev-medium)")}
        {stat("LOW", counts.low, "var(--sev-low)")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a
          href="/login"
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            padding: "6px 12px",
            textDecoration: "none",
          }}
        >
          Get Alerts →
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: loading ? "var(--text-dim)" : "var(--sev-low)",
          }}
        />
        <span className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {loading ? "syncing…" : fetchedAt ? `synced ${timeAgo(fetchedAt)}` : "not synced"}
        </span>
        </div>
      </div>
    </header>
  );
}

import { Incident } from "@/lib/types";
import { SeverityDot, CategoryTag } from "./Badges";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export function WatchLog({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div
        style={{
          padding: "60px 24px",
          textAlign: "center",
          color: "var(--text-dim)",
        }}
      >
        <p className="mono" style={{ fontSize: 13 }}>
          No incidents match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      {incidents.map((inc, idx) => (
        <a
          key={inc.id}
          href={inc.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "grid",
            gridTemplateColumns: "150px 16px 96px 1fr 140px",
            alignItems: "start",
            gap: 14,
            padding: "12px 24px",
            textDecoration: "none",
            color: "inherit",
            borderBottom: "1px solid var(--hairline)",
            background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
          }}
          className="watch-row"
        >
          <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", paddingTop: 2 }}>
            {formatTimestamp(inc.publishedAt)}
          </span>
          <span style={{ paddingTop: 5 }}>
            <SeverityDot severity={inc.severity} />
          </span>
          <span style={{ paddingTop: 1 }}>
            <CategoryTag category={inc.category} />
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.4, color: "var(--text-primary)" }}>
            {inc.title}
            {inc.country && (
              <span className="mono" style={{ color: "var(--text-dim)", fontSize: 12 }}>
                {"  ·  " + inc.country}
              </span>
            )}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textAlign: "right",
              paddingTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {inc.source}
          </span>
        </a>
      ))}
    </div>
  );
}

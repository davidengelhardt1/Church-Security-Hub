import { Incident } from "@/lib/types";
import { SeverityDot, CategoryTag } from "./Badges";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export function WatchLog({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-dim)" }}>
        <p className="mono" style={{ fontSize: 13 }}>
          No incidents match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      {incidents.map((inc) => (
        <a
          key={inc.id}
          href={inc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="watch-row"
        >
          <span className="watch-row__time mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {formatTimestamp(inc.publishedAt)}
          </span>
          <span className="watch-row__sev">
            <SeverityDot severity={inc.severity} />
          </span>
          <span className="watch-row__cat">
            <CategoryTag category={inc.category} />
          </span>
          <span className="watch-row__title" style={{ color: "var(--text-primary)" }}>
            {inc.title}
            {inc.country && (
              <span className="mono" style={{ color: "var(--text-dim)", fontSize: 12 }}>
                {"  ·  " + inc.country}
              </span>
            )}
          </span>
          <span
            className="watch-row__source mono"
            style={{ fontSize: 11, color: "var(--text-dim)" }}
          >
            {inc.source}
          </span>
        </a>
      ))}
    </div>
  );
}

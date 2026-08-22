import { Category, Severity } from "@/lib/types";

interface Props {
  activeCategories: Set<Category>;
  activeSeverities: Set<Severity>;
  onToggleCategory: (c: Category) => void;
  onToggleSeverity: (s: Severity) => void;
  search: string;
  onSearch: (v: string) => void;
}

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "violence", label: "Violence", color: "var(--cat-violence)" },
  { key: "extremism", label: "Extremism", color: "var(--cat-extremism)" },
  { key: "cyber", label: "Cyber", color: "var(--cat-cyber)" },
];

const SEVERITIES: { key: Severity; label: string; color: string }[] = [
  { key: "high", label: "High", color: "var(--sev-high)" },
  { key: "medium", label: "Medium", color: "var(--sev-medium)" },
  { key: "low", label: "Low", color: "var(--sev-low)" },
];

function sectionLabel(text: string) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        color: "var(--text-dim)",
        marginBottom: 10,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
}

export function FilterRail({
  activeCategories,
  activeSeverities,
  onToggleCategory,
  onToggleSeverity,
  search,
  onSearch,
}: Props) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--hairline)",
        background: "var(--panel)",
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <div>
        {sectionLabel("Search")}
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter by keyword…"
          style={{
            width: "100%",
            background: "var(--panel-raised)",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            padding: "8px 10px",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "var(--font-body)",
          }}
        />
      </div>

      <div>
        {sectionLabel("Category")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CATEGORIES.map((c) => {
            const active = activeCategories.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => onToggleCategory(c.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                  color: active ? "var(--text-primary)" : "var(--text-dim)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    border: `1.5px solid ${c.color}`,
                    background: active ? c.color : "transparent",
                    flexShrink: 0,
                  }}
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sectionLabel("Severity")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SEVERITIES.map((s) => {
            const active = activeSeverities.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => onToggleSeverity(s.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                  color: active ? "var(--text-primary)" : "var(--text-dim)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: `1.5px solid ${s.color}`,
                    background: active ? s.color : "transparent",
                    flexShrink: 0,
                  }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

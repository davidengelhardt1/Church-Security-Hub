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
  { key: "physical", label: "Physical Security", color: "var(--cat-physical)" },
  { key: "extremism", label: "Extremism", color: "var(--cat-extremism)" },
  { key: "cyber", label: "Cyber", color: "var(--cat-cyber)" },
];

const SEVERITIES: { key: Severity; label: string; color: string }[] = [
  { key: "high", label: "High", color: "var(--sev-high)" },
  { key: "medium", label: "Medium", color: "var(--sev-medium)" },
  { key: "low", label: "Low", color: "var(--sev-low)" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
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
      {children}
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
  const toggleStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "none",
    padding: "4px 0",
    color: active ? "var(--text-primary)" : "var(--text-dim)",
    fontSize: 13,
    textAlign: "left",
    whiteSpace: "nowrap",
  });

  return (
    <aside className="filter-rail">
      <div className="filter-rail__section filter-rail__section--search">
        <SectionLabel>Search</SectionLabel>
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
            // 16px prevents iOS Safari from auto-zooming on focus
            fontSize: 16,
            fontFamily: "var(--font-body)",
          }}
        />
      </div>

      <div className="filter-rail__section">
        <SectionLabel>Category</SectionLabel>
        <div className="filter-rail__group">
          {CATEGORIES.map((c) => {
            const active = activeCategories.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => onToggleCategory(c.key)}
                aria-pressed={active}
                style={toggleStyle(active)}
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

      <div className="filter-rail__section">
        <SectionLabel>Severity</SectionLabel>
        <div className="filter-rail__group">
          {SEVERITIES.map((s) => {
            const active = activeSeverities.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => onToggleSeverity(s.key)}
                aria-pressed={active}
                style={toggleStyle(active)}
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

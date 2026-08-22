import { Category, Severity } from "@/lib/types";

const SEV_LABEL: Record<Severity, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const CAT_LABEL: Record<Category, string> = {
  violence: "VIOLENCE",
  extremism: "EXTREMISM",
  cyber: "CYBER",
};

export function SeverityDot({ severity }: { severity: Severity }) {
  const color =
    severity === "high" ? "var(--sev-high)" : severity === "medium" ? "var(--sev-medium)" : "var(--sev-low)";
  return (
    <span
      aria-label={`Severity: ${SEV_LABEL[severity]}`}
      title={`Severity: ${SEV_LABEL[severity]}`}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

export function CategoryTag({ category }: { category: Category }) {
  const color =
    category === "violence"
      ? "var(--cat-violence)"
      : category === "extremism"
      ? "var(--cat-extremism)"
      : "var(--cat-cyber)";
  return (
    <span
      className="mono"
      style={{
        fontSize: 11,
        letterSpacing: "0.06em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 3,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {CAT_LABEL[category]}
    </span>
  );
}

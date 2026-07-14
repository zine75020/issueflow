import type { Severity } from "@/lib/types";

const LABELS: Record<Severity, string> = {
  CRITICAL: "Critique",
  MAJOR: "Majeur",
  MINOR: "Mineur",
};

const CLASS: Record<Severity, string> = {
  CRITICAL: "badge-critical",
  MAJOR: "badge-major",
  MINOR: "badge-minor",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge ${CLASS[severity]}`}>{LABELS[severity]}</span>;
}

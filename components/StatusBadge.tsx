type BadgeTone = "todo" | "inprogress" | "done" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  todo: "badge-todo",
  inprogress: "badge-inprogress",
  done: "badge-done",
  neutral: "badge-status",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{label}</span>;
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEffortMeta(
  storyPoints: number | null,
  remainingEffort: number | null
): string | null {
  const parts: string[] = [];
  if (storyPoints !== null) parts.push(`${storyPoints} pts`);
  if (remainingEffort !== null) parts.push(`${remainingEffort} SP restants`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

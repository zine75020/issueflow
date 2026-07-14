export function countSprintDays(start: Date, end: Date) {
  let workingDays = 0;
  let nonWorkingDays = 0;
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const endDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );

  while (cursor <= endDay) {
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) nonWorkingDays++;
    else workingDays++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { workingDays, nonWorkingDays };
}

export function computeSprintProgress(
  stories: { storyPoints: number | null; statusColumnId: string }[],
  bugs: { statusColumnId: string }[],
  endColumnId: string | null
) {
  const isDone = (statusColumnId: string) =>
    endColumnId !== null && statusColumnId === endColumnId;

  const pointsCommitted = stories.reduce(
    (sum, s) => sum + (s.storyPoints ?? 0),
    0
  );
  const pointsDone = stories
    .filter((s) => isDone(s.statusColumnId))
    .reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);

  const itemsCommitted = stories.length + bugs.length;
  const itemsDone =
    stories.filter((s) => isDone(s.statusColumnId)).length +
    bugs.filter((b) => isDone(b.statusColumnId)).length;

  return { pointsCommitted, pointsDone, itemsCommitted, itemsDone };
}

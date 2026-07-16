"use client";

import { useState } from "react";
import { ChevronIcon } from "@/components/icons";
import type { Epic, Story, Bug, Sprint, Status } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { SprintBadge } from "@/components/SprintBadge";
import { formatEffortMeta } from "@/lib/format";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/constants";
import { useColumns } from "@/lib/useColumns";

const NO_EPIC_KEY = "__no_epic__";

interface StoryGroup {
  key: string;
  title: string;
  status: Status | null;
  stories: Story[];
}

function groupStoriesByEpic(epics: Epic[], stories: Story[]): StoryGroup[] {
  const byEpic = new Map<string, Story[]>();
  const orphans: Story[] = [];

  for (const story of stories) {
    if (story.epicId) {
      const list = byEpic.get(story.epicId) ?? [];
      list.push(story);
      byEpic.set(story.epicId, list);
    } else {
      orphans.push(story);
    }
  }

  const groups: StoryGroup[] = epics.map((epic) => ({
    key: epic.id,
    title: epic.title,
    status: epic.status,
    stories: (byEpic.get(epic.id) ?? []).sort(
      (a, b) => a.backlogPosition - b.backlogPosition
    ),
  }));

  if (orphans.length > 0) {
    groups.push({
      key: NO_EPIC_KEY,
      title: "Sans epic",
      status: null,
      stories: orphans.sort((a, b) => a.backlogPosition - b.backlogPosition),
    });
  }

  groups.sort((a, b) => {
    const aMin = a.stories[0]?.backlogPosition ?? Number.POSITIVE_INFINITY;
    const bMin = b.stories[0]?.backlogPosition ?? Number.POSITIVE_INFINITY;
    if (aMin !== bMin) return aMin - bMin;
    return a.title.localeCompare(b.title);
  });

  return groups;
}

export function ListView({
  epics,
  stories,
  bugs,
  sprints,
  onOpenStory,
  onOpenBug,
  onOpenEpic,
}: {
  epics: Epic[];
  stories: Story[];
  bugs: Bug[];
  sprints: Sprint[];
  onOpenStory: (id: string) => void;
  onOpenBug: (id: string) => void;
  onOpenEpic: (id: string) => void;
}) {
  const groups = groupStoriesByEpic(epics, stories);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const sprintNameById = new Map(sprints.map((sprint) => [sprint.id, sprint.name]));
  const { columns } = useColumns();
  const columnNameById = new Map(columns.map((col) => [col.id, col.name]));

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sortedBugs = [...bugs].sort(
    (a, b) => a.backlogPosition - b.backlogPosition
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
          Stories
        </h2>
        {groups.length === 0 && (
          <p className="text-sm text-muted">Aucune story dans le backlog.</p>
        )}
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <div
                key={group.key}
                className="border border-border rounded-lg overflow-hidden bg-surface"
              >
                <div
                  onClick={() => toggle(group.key)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-2 hover:opacity-90 cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ChevronIcon collapsed={isCollapsed} className="h-4 w-4" />
                    {group.key !== NO_EPIC_KEY ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEpic(group.key);
                        }}
                        className="hover:underline"
                      >
                        {group.title}
                      </button>
                    ) : (
                      group.title
                    )}
                    <span className="text-xs text-muted font-normal">
                      ({group.stories.length})
                    </span>
                  </span>
                  {group.status && (
                    <StatusBadge
                      label={STATUS_LABELS[group.status]}
                      tone={STATUS_TONE[group.status]}
                    />
                  )}
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {group.stories.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted">
                        Aucune story dans cet epic.
                      </p>
                    )}
                    {group.stories.map((story) => (
                      <div
                        key={story.id}
                        onClick={() => onOpenStory(story.id)}
                        className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-surface-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">
                            {story.title}
                          </p>
                          {formatEffortMeta(story.storyPoints, story.remainingEffort) && (
                            <p className="text-xs text-muted">
                              {formatEffortMeta(story.storyPoints, story.remainingEffort)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap md:shrink-0">
                          {story.sprintId && sprintNameById.has(story.sprintId) && (
                            <SprintBadge name={sprintNameById.get(story.sprintId)!} />
                          )}
                          <StatusBadge
                            label={columnNameById.get(story.statusColumnId) ?? "…"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
          Bugs
        </h2>
        {sortedBugs.length === 0 && (
          <p className="text-sm text-muted">Aucun bug dans le backlog.</p>
        )}
        {sortedBugs.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border bg-surface overflow-hidden">
            {sortedBugs.map((bug) => (
              <div
                key={bug.id}
                onClick={() => onOpenBug(bug.id)}
                className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{bug.title}</p>
                  {formatEffortMeta(null, bug.remainingEffort) && (
                    <p className="text-xs text-muted">
                      {formatEffortMeta(null, bug.remainingEffort)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap md:shrink-0">
                  {bug.sprintId && sprintNameById.has(bug.sprintId) && (
                    <SprintBadge name={sprintNameById.get(bug.sprintId)!} />
                  )}
                  <SeverityBadge severity={bug.severity} />
                  <StatusBadge
                    label={columnNameById.get(bug.statusColumnId) ?? "…"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

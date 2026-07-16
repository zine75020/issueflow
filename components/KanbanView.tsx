"use client";

import { useState } from "react";
import { BugTypeIcon, StoryTypeIcon } from "@/components/icons";
import { SeverityBadge } from "@/components/SeverityBadge";
import { SprintBadge } from "@/components/SprintBadge";
import { ColumnManagerPanel } from "@/components/ColumnManagerPanel";
import { formatEffortMeta } from "@/lib/format";
import { useColumns } from "@/lib/useColumns";
import type { Epic, Story, Bug, Sprint } from "@/lib/types";

type CardItem =
  | { type: "story"; data: Story }
  | { type: "bug"; data: Bug };

export function KanbanView({
  stories,
  bugs,
  epics,
  sprints,
  onOpenStory,
  onOpenBug,
  onStoryStatusChange,
  onBugStatusChange,
}: {
  stories: Story[];
  bugs: Bug[];
  epics: Epic[];
  sprints?: Sprint[];
  onOpenStory: (id: string) => void;
  onOpenBug: (id: string) => void;
  onStoryStatusChange?: (storyId: string, statusColumnId: string) => void;
  onBugStatusChange?: (bugId: string, statusColumnId: string) => void;
}) {
  const { columns, loading: columnsLoading } = useColumns();
  const [showManager, setShowManager] = useState(false);
  const [draggedItem, setDraggedItem] = useState<
    { type: "story" | "bug"; id: string; sourceColumnId: string } | null
  >(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const epicTitleById = new Map(epics.map((epic) => [epic.id, epic.title]));
  const sprintNameById = new Map((sprints ?? []).map((sprint) => [sprint.id, sprint.name]));

  const items: CardItem[] = [
    ...stories.map((data) => ({ type: "story" as const, data })),
    ...bugs.map((data) => ({ type: "bug" as const, data })),
  ];

  function handleDragStart(item: CardItem) {
    setDraggedItem({
      type: item.type,
      id: item.data.id,
      sourceColumnId: item.data.statusColumnId,
    });
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverColumnId(null);
  }

  function handleColumnDragOver(e: React.DragEvent, columnId: string) {
    if (!draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) setDragOverColumnId(columnId);
  }

  function handleColumnDragLeave(columnId: string) {
    setDragOverColumnId((current) => (current === columnId ? null : current));
  }

  function handleColumnDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    setDragOverColumnId(null);
    if (!draggedItem) return;

    if (draggedItem.sourceColumnId !== columnId) {
      if (draggedItem.type === "story") {
        onStoryStatusChange?.(draggedItem.id, columnId);
      } else {
        onBugStatusChange?.(draggedItem.id, columnId);
      }
    }
    setDraggedItem(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowManager(true)}
          className="btn-secondary text-sm"
        >
          Gérer les colonnes
        </button>
      </div>

      {columnsLoading ? (
        <p className="text-sm text-muted">Chargement des colonnes…</p>
      ) : (
        <div className="relative">
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))`,
              }}
            >
              {columns.map((col) => {
              const colItems = items
                .filter((item) => item.data.statusColumnId === col.id)
                .sort((a, b) => a.data.backlogPosition - b.data.backlogPosition);

              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1 gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted truncate">
                      {col.name}
                    </h3>
                    <span className="text-xs text-muted shrink-0">
                      {colItems.length}
                    </span>
                  </div>
                  <div
                    onDragOver={(e) => handleColumnDragOver(e, col.id)}
                    onDragLeave={() => handleColumnDragLeave(col.id)}
                    onDrop={(e) => handleColumnDrop(e, col.id)}
                    className={`flex flex-col gap-2 min-h-16 rounded-lg transition-colors ${
                      dragOverColumnId === col.id ? "bg-accent/10 ring-2 ring-accent" : ""
                    }`}
                  >
                    {colItems.length === 0 && (
                      <p className="text-xs text-muted border border-dashed border-border rounded-lg px-3 py-4 text-center">
                        Vide
                      </p>
                    )}
                    {colItems.map((item) =>
                      item.type === "story" ? (
                        <div
                          key={item.data.id}
                          onClick={() => onOpenStory(item.data.id)}
                          draggable={Boolean(onStoryStatusChange)}
                          onDragStart={() => handleDragStart(item)}
                          onDragEnd={handleDragEnd}
                          className={`rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3 py-2 hover:opacity-90 ${
                            onStoryStatusChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                          } ${draggedItem?.id === item.data.id ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                            <StoryTypeIcon className="h-3.5 w-3.5" />
                            Story
                          </div>
                          <p className="font-medium text-sm">{item.data.title}</p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <span className="text-xs text-muted truncate">
                              {item.data.epicId
                                ? epicTitleById.get(item.data.epicId) ?? ""
                                : "Sans epic"}
                            </span>
                            {formatEffortMeta(item.data.storyPoints, item.data.remainingEffort) && (
                              <span className="text-xs font-medium text-accent shrink-0">
                                {formatEffortMeta(item.data.storyPoints, item.data.remainingEffort)}
                              </span>
                            )}
                          </div>
                          {item.data.sprintId && sprintNameById.has(item.data.sprintId) && (
                            <div className="mt-2">
                              <SprintBadge name={sprintNameById.get(item.data.sprintId)!} />
                            </div>
                          )}
                          {onStoryStatusChange && (
                            <select
                              value={item.data.statusColumnId}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                onStoryStatusChange(item.data.id, e.target.value)
                              }
                              className="mt-2 w-full rounded-md border border-border bg-bg text-fg text-xs px-2 py-1"
                            >
                              {columns.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div
                          key={item.data.id}
                          onClick={() => onOpenBug(item.data.id)}
                          draggable={Boolean(onBugStatusChange)}
                          onDragStart={() => handleDragStart(item)}
                          onDragEnd={handleDragEnd}
                          className={`rounded-lg border border-border border-l-4 border-l-severity-major bg-surface px-3 py-2 hover:opacity-90 ${
                            onBugStatusChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                          } ${draggedItem?.id === item.data.id ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                            <BugTypeIcon className="h-3.5 w-3.5" />
                            Bug
                          </div>
                          <p className="font-medium text-sm">{item.data.title}</p>
                          {formatEffortMeta(null, item.data.remainingEffort) && (
                            <p className="text-xs text-muted mt-0.5">
                              {formatEffortMeta(null, item.data.remainingEffort)}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <SeverityBadge severity={item.data.severity} />
                            {item.data.sprintId && sprintNameById.has(item.data.sprintId) && (
                              <SprintBadge name={sprintNameById.get(item.data.sprintId)!} />
                            )}
                          </div>
                          {onBugStatusChange && (
                            <select
                              value={item.data.statusColumnId}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                onBugStatusChange(item.data.id, e.target.value)
                              }
                              className="mt-2 w-full rounded-md border border-border bg-bg text-fg text-xs px-2 py-1"
                            >
                              {columns.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-bg to-transparent md:hidden"
          />
        </div>
      )}

      {showManager && (
        <ColumnManagerPanel onClose={() => setShowManager(false)} />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { StoryDetail } from "@/components/detail/StoryDetail";
import { BugDetail } from "@/components/detail/BugDetail";
import { EpicDetail } from "@/components/detail/EpicDetail";
import type { Epic, Sprint } from "@/lib/types";

export type DetailTarget = { type: "story" | "bug" | "epic"; id: string };

export function DetailPanel({
  initialTarget,
  epics,
  sprints,
  onClose,
  onChanged,
}: {
  initialTarget: DetailTarget;
  epics: Epic[];
  sprints: Sprint[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<DetailTarget>(initialTarget);

  if (target.type === "story") {
    return (
      <StoryDetail
        id={target.id}
        epics={epics}
        sprints={sprints}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }

  if (target.type === "bug") {
    return (
      <BugDetail
        id={target.id}
        sprints={sprints}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }

  return (
    <EpicDetail
      id={target.id}
      onClose={onClose}
      onChanged={onChanged}
      onNavigateToStory={(storyId) => setTarget({ type: "story", id: storyId })}
    />
  );
}

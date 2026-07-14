"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { KanbanView } from "@/components/KanbanView";
import { Modal } from "@/components/Modal";
import type { Epic, Sprint, SprintDetail } from "@/lib/types";
import { AssignPanel } from "./AssignPanel";
import { DetailPanel, type DetailTarget } from "@/components/DetailPanel";

export function SprintBoard({
  sprint,
  epics,
  sprints,
  onReload,
  planningBanner,
}: {
  sprint: SprintDetail;
  epics: Epic[];
  sprints: Sprint[];
  onReload: () => void;
  planningBanner?: ReactNode;
}) {
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DetailTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showAddButton = !sprint.completedAt;
  const showCompleteButton = sprint.isActive;

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/complete`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la clôture du sprint.");
        return;
      }
      setShowCompleteConfirm(false);
      onReload();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleStoryStatusChange(storyId: string, statusColumnId: string) {
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusColumnId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la mise à jour de la story.");
        return;
      }
      onReload();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    }
  }

  async function handleBugStatusChange(bugId: string, statusColumnId: string) {
    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusColumnId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la mise à jour du bug.");
        return;
      }
      onReload();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    }
  }

  return (
    <>
      {planningBanner}

      {error && (
        <div className="rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3">
          {error}
        </div>
      )}

      {(showAddButton || showCompleteButton) && (
        <div className="flex justify-end gap-2 flex-wrap">
          {showAddButton && (
            <button
              onClick={() => setShowAssignPanel(true)}
              className="btn-secondary"
            >
              + Ajouter au sprint
            </button>
          )}
          {showCompleteButton && (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              className="btn-danger"
            >
              Terminer le sprint
            </button>
          )}
        </div>
      )}

      <KanbanView
        stories={sprint.stories}
        bugs={sprint.bugs}
        epics={epics}
        onOpenStory={(id) => setSelectedItem({ type: "story", id })}
        onOpenBug={(id) => setSelectedItem({ type: "bug", id })}
        onStoryStatusChange={handleStoryStatusChange}
        onBugStatusChange={handleBugStatusChange}
      />

      {showAssignPanel && (
        <AssignPanel
          sprintId={sprint.id}
          onClose={() => setShowAssignPanel(false)}
          onAssigned={() => {
            setShowAssignPanel(false);
            onReload();
          }}
        />
      )}

      {showCompleteConfirm && (
        <Modal
          title="Terminer le sprint"
          onClose={() => setShowCompleteConfirm(false)}
        >
          <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-severity-critical">{error}</p>}
            <p className="text-sm">
              Le sprint « {sprint.name} » sera clôturé. Il ne sera plus
              possible d&apos;y ajouter des items ni de le réactiver.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="btn-danger"
              >
                {completing ? "Clôture…" : "Confirmer"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedItem && (
        <DetailPanel
          initialTarget={selectedItem}
          epics={epics}
          sprints={sprints}
          onClose={() => setSelectedItem(null)}
          onChanged={onReload}
        />
      )}
    </>
  );
}

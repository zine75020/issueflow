"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { SeverityBadge } from "@/components/SeverityBadge";
import type { Story, Bug } from "@/lib/types";

export function AssignPanel({
  sprintId,
  onClose,
  onAssigned,
}: {
  sprintId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [selectedBugIds, setSelectedBugIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [storiesRes, bugsRes] = await Promise.all([
          fetch("/api/stories?backlog=true"),
          fetch("/api/bugs?backlog=true"),
        ]);

        if (!storiesRes.ok || !bugsRes.ok) {
          throw new Error("Erreur lors du chargement du backlog.");
        }

        const [storiesData, bugsData] = await Promise.all([
          storiesRes.json(),
          bugsRes.json(),
        ]);

        if (cancelled) return;
        setStories(storiesData);
        setBugs(bugsData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleStory(id: string) {
    setSelectedStoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBug(id: string) {
    setSelectedBugIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/sprints/${sprintId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyIds:
            selectedStoryIds.size > 0 ? Array.from(selectedStoryIds) : undefined,
          bugIds: selectedBugIds.size > 0 ? Array.from(selectedBugIds) : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'assignation au sprint.");
        return;
      }

      onAssigned();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalSelected = selectedStoryIds.size + selectedBugIds.size;
  const backlogEmpty = !loading && stories.length === 0 && bugs.length === 0;

  return (
    <Modal title="Ajouter au sprint" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-severity-critical">{error}</p>}
        {loading && <p className="text-sm text-muted">Chargement du backlog…</p>}
        {backlogEmpty && (
          <p className="text-sm text-muted">Le Product Backlog est vide.</p>
        )}

        {!loading && stories.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              Stories
            </h3>
            <div className="flex flex-col max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {stories.map((story) => (
                <label
                  key={story.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedStoryIds.has(story.id)}
                    onChange={() => toggleStory(story.id)}
                  />
                  <span className="truncate">{story.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {!loading && bugs.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              Bugs
            </h3>
            <div className="flex flex-col max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {bugs.map((bug) => (
                <label
                  key={bug.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedBugIds.has(bug.id)}
                    onChange={() => toggleBug(bug.id)}
                  />
                  <span className="truncate flex-1">{bug.title}</span>
                  <SeverityBadge severity={bug.severity} />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || totalSelected === 0}
            className="btn-primary"
          >
            {submitting ? "Ajout…" : `Ajouter (${totalSelected})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

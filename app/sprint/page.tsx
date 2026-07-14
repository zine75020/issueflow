"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Sprint } from "@/lib/types";
import { SprintFormModal } from "./components/SprintFormModal";
import { formatDateShort } from "@/lib/format";
import { onDataChanged } from "@/lib/events";

function sprintStatusMeta(sprint: Sprint) {
  if (sprint.isActive) return { label: "Actif", badgeClass: "badge-inprogress" };
  if (sprint.completedAt) return { label: "Terminé", badgeClass: "badge-done" };
  return { label: "Planifié", badgeClass: "badge-todo" };
}

// Actif d'abord, puis Planifié (le plus proche dans le temps en premier),
// puis Terminé (le plus récemment clôturé en premier).
function sortSprints(sprints: Sprint[]): Sprint[] {
  const active = sprints.filter((s) => s.isActive);
  const planned = sprints
    .filter((s) => !s.isActive && !s.completedAt)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const completed = sprints
    .filter((s) => !s.isActive && s.completedAt)
    .sort(
      (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );
  return [...active, ...planned, ...completed];
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((token) => token + 1);

  useEffect(() => onDataChanged(reload), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (reloadToken === 0) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sprints");
        if (!res.ok) {
          throw new Error("Erreur lors du chargement des sprints.");
        }
        const data: Sprint[] = await res.json();
        if (cancelled) return;
        setSprints(data);
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
  }, [reloadToken]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sprints</h1>
          <p className="text-sm text-muted">
            {sprints.length} sprint{sprints.length > 1 ? "s" : ""}
          </p>
        </div>

        <button onClick={() => setShowSprintForm(true)} className="btn-primary">
          + Nouveau Sprint
        </button>
      </div>

      <div className="flex-1 p-6">
        {loading && <p className="text-muted">Chargement…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3 flex items-center gap-3">
            <span>{error}</span>
            <button onClick={reload} className="underline shrink-0">
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && sprints.length === 0 && (
          <p className="text-sm text-muted">
            Aucun sprint pour l&apos;instant. Crée le premier avec le bouton
            ci-dessus.
          </p>
        )}

        {!loading && !error && sprints.length > 0 && (
          <div className="flex flex-col gap-3">
            {sortSprints(sprints).map((sprint) => {
              const status = sprintStatusMeta(sprint);
              return (
                <Link
                  key={sprint.id}
                  href={sprint.isActive ? "/sprint/active" : `/sprint/${sprint.id}`}
                  className="text-left border border-border rounded-lg bg-surface hover:bg-surface-2 transition-colors px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{sprint.name}</p>
                      <p className="text-xs text-muted">
                        {formatDateShort(sprint.startDate)} →{" "}
                        {formatDateShort(sprint.endDate)} ·{" "}
                        {sprint.workingDays ?? 0}j ouvrés ·{" "}
                        {sprint.nonWorkingDays ?? 0}j non-ouvrés
                      </p>
                    </div>
                    <span className={`badge ${status.badgeClass} shrink-0`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>
                      {sprint.pointsDone ?? 0}/{sprint.pointsCommitted ?? 0} pts
                      faits
                    </span>
                    <span>
                      {sprint.itemsDone ?? 0}/{sprint.itemsCommitted ?? 0}{" "}
                      items faits
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showSprintForm && (
        <SprintFormModal
          onClose={() => setShowSprintForm(false)}
          onCreated={() => {
            setShowSprintForm(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

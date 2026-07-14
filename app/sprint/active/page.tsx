"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Epic, Sprint, SprintDetail } from "@/lib/types";
import { SprintFormModal } from "../components/SprintFormModal";
import { SprintBoard } from "../components/SprintBoard";
import { emitDataChanged, onDataChanged } from "@/lib/events";

export default function ActiveSprintPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<SprintDetail | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((token) => token + 1);
  const notifyChanged = () => {
    reload();
    emitDataChanged();
  };

  useEffect(() => onDataChanged(reload), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (reloadToken === 0) setLoading(true);
      setError(null);
      try {
        const [sprintsRes, epicsRes] = await Promise.all([
          fetch("/api/sprints"),
          fetch("/api/epics"),
        ]);

        if (!sprintsRes.ok || !epicsRes.ok) {
          throw new Error("Erreur lors du chargement des sprints.");
        }

        const [sprintsData, epicsData]: [Sprint[], Epic[]] = await Promise.all([
          sprintsRes.json(),
          epicsRes.json(),
        ]);

        const active = sprintsData.find((sprint) => sprint.isActive) ?? null;
        let detail: SprintDetail | null = null;

        if (active) {
          const detailRes = await fetch(`/api/sprints/${active.id}`);
          if (!detailRes.ok) {
            throw new Error("Erreur lors du chargement du sprint actif.");
          }
          detail = await detailRes.json();
        }

        if (cancelled) return;
        setSprints(sprintsData);
        setEpics(epicsData);
        setActiveSprint(detail);
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
          <h1 className="text-xl font-semibold">Sprint en cours</h1>
          <p className="text-sm text-muted">
            {activeSprint
              ? `${activeSprint.name} · ${activeSprint.stories.length} stories · ${activeSprint.bugs.length} bugs`
              : "Aucun sprint actif"}
          </p>
        </div>

        <button onClick={() => setShowSprintForm(true)} className="btn-primary">
          + Nouveau Sprint
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6">
        {loading && <p className="text-muted">Chargement…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3 flex items-center gap-3">
            <span>{error}</span>
            <button onClick={reload} className="underline shrink-0">
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && (
          activeSprint ? (
            <SprintBoard
              sprint={activeSprint}
              epics={epics}
              sprints={sprints}
              onReload={notifyChanged}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-xl px-6 py-16 text-center">
              <p className="font-medium">Aucun sprint actif</p>
              <p className="text-sm text-muted max-w-sm">
                Retourne sur la liste des sprints pour en activer un, ou
                crée-en un nouveau.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Link href="/sprint" className="btn-secondary">
                  Voir les sprints
                </Link>
                <button
                  onClick={() => setShowSprintForm(true)}
                  className="btn-primary"
                >
                  + Nouveau Sprint
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {showSprintForm && (
        <SprintFormModal
          onClose={() => setShowSprintForm(false)}
          onCreated={() => {
            setShowSprintForm(false);
            notifyChanged();
          }}
        />
      )}
    </div>
  );
}

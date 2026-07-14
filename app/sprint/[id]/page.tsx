"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Epic, Sprint, SprintDetail } from "@/lib/types";
import { SprintBoard } from "../components/SprintBoard";
import { formatDateShort } from "@/lib/format";
import { emitDataChanged, onDataChanged } from "@/lib/events";

export default function SprintDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [sprint, setSprint] = useState<SprintDetail | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
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
        const [sprintRes, sprintsRes, epicsRes] = await Promise.all([
          fetch(`/api/sprints/${params.id}`),
          fetch("/api/sprints"),
          fetch("/api/epics"),
        ]);

        if (sprintRes.status === 404) {
          throw new Error("Sprint introuvable.");
        }
        if (!sprintRes.ok || !sprintsRes.ok || !epicsRes.ok) {
          throw new Error("Erreur lors du chargement du sprint.");
        }

        const [sprintData, sprintsData, epicsData]: [
          SprintDetail,
          Sprint[],
          Epic[],
        ] = await Promise.all([
          sprintRes.json(),
          sprintsRes.json(),
          epicsRes.json(),
        ]);

        if (cancelled) return;
        setSprint(sprintData);
        setSprints(sprintsData);
        setEpics(epicsData);
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
  }, [reloadToken, params.id]);

  useEffect(() => {
    if (sprint?.isActive) {
      router.replace("/sprint/active");
    }
  }, [sprint, router]);

  async function handleActivate() {
    if (!sprint) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de l'activation du sprint.");
        return;
      }
      emitDataChanged();
      router.push("/sprint/active");
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setActivating(false);
    }
  }

  const anotherSprintActive = sprints.some(
    (s) => s.isActive && s.id !== params.id
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-4">
        <Link href="/sprint" className="text-xs text-muted hover:text-fg">
          ← Sprints
        </Link>
        <h1 className="text-xl font-semibold">{sprint?.name ?? "Sprint"}</h1>
        {sprint && (
          <p className="text-sm text-muted">
            {formatDateShort(sprint.startDate)} →{" "}
            {formatDateShort(sprint.endDate)} · {sprint.stories.length}{" "}
            stories · {sprint.bugs.length} bugs
          </p>
        )}
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

        {!loading && !error && sprint?.isActive && (
          <p className="text-muted">Redirection vers le sprint actif…</p>
        )}

        {!loading && !error && sprint && !sprint.isActive && (
          <SprintBoard
            sprint={sprint}
            epics={epics}
            sprints={sprints}
            onReload={notifyChanged}
            planningBanner={
              !sprint.completedAt ? (
                <div className="border border-dashed border-border rounded-lg px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-muted">
                    Ce sprint n&apos;est pas encore actif.
                  </p>
                  {!anotherSprintActive ? (
                    <button
                      onClick={handleActivate}
                      disabled={activating}
                      className="btn-primary text-sm"
                    >
                      {activating ? "Activation…" : "Activer"}
                    </button>
                  ) : (
                    <p className="text-xs text-muted">
                      Un autre sprint est déjà actif.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border border-border rounded-lg px-4 py-3 bg-surface">
                  <p className="text-sm text-muted">
                    Sprint terminé le {formatDateShort(sprint.completedAt!)}.
                  </p>
                </div>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

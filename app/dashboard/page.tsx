"use client";

import { useEffect, useState } from "react";
import { SEVERITY_OPTIONS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { onDataChanged } from "@/lib/events";
import type { Severity } from "@/lib/types";

interface DashboardData {
  totals: { epics: number; stories: number; bugs: number };
  statusBreakdown: { columnId: string; columnName: string; count: number }[];
  velocity: {
    average: number;
    bySprint: { sprintId: string; sprintName: string; endDate: string; pointsDone: number }[];
  };
  sprintCounts: { completed: number; active: number; planned: number };
  bugSeverity: { severity: Severity; count: number }[];
  topEpics: { epicId: string; epicTitle: string; unfinishedCount: number }[];
}

const SEVERITY_LABELS: Record<Severity, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((opt) => [opt.value, opt.label])
) as Record<Severity, string>;

const SEVERITY_BAR_COLOR: Record<Severity, string> = {
  CRITICAL: "bg-severity-critical",
  MAJOR: "bg-severity-major",
  MINOR: "bg-severity-minor",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg bg-surface px-4 py-3 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function HorizontalBar({
  label,
  count,
  max,
  barClassName = "bg-accent",
}: {
  label: string;
  count: number;
  max: number;
  barClassName?: string;
}) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-40 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm text-muted w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

function VelocityChart({
  data,
}: {
  data: { sprintId: string; sprintName: string; endDate: string; pointsDone: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucun sprint terminé pour l&apos;instant — le graphique de vélocité
        apparaîtra ici une fois un premier sprint clôturé.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.pointsDone), 1);

  return (
    <div className="flex items-end gap-4 h-40 overflow-x-auto pb-1">
      {data.map((d) => {
        const height = Math.round((d.pointsDone / max) * 100);
        return (
          <div
            key={d.sprintId}
            className="flex flex-col items-center justify-end h-full gap-1 shrink-0 w-20"
          >
            <span className="text-xs font-medium">{d.pointsDone}</span>
            <div
              className="w-8 rounded-t bg-accent"
              style={{ height: `${Math.max(height, 2)}%` }}
            />
            <span className="text-xs text-muted truncate w-full text-center" title={d.sprintName}>
              {d.sprintName}
            </span>
            <span className="text-[10px] text-muted">{formatDateShort(d.endDate)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((token) => token + 1);
  useEffect(() => onDataChanged(reload), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (reloadToken === 0) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) {
          throw new Error("Erreur lors du chargement du dashboard.");
        }
        const json: DashboardData = await res.json();
        if (cancelled) return;
        setData(json);
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
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">Vue d&apos;ensemble du projet</p>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-8">
        {loading && <p className="text-muted">Chargement…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3 flex items-center gap-3">
            <span>{error}</span>
            <button onClick={reload} className="underline shrink-0">
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Epics" value={data.totals.epics} />
              <StatCard label="Stories" value={data.totals.stories} />
              <StatCard label="Bugs" value={data.totals.bugs} />
              <StatCard
                label="Vélocité moyenne"
                value={`${Math.round(data.velocity.average * 10) / 10} pts`}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Sprints terminés" value={data.sprintCounts.completed} />
              <StatCard label="Sprints en cours" value={data.sprintCounts.active} />
              <StatCard label="Sprints planifiés" value={data.sprintCounts.planned} />
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Répartition par statut (stories + bugs)
              </h2>
              <div className="border border-border rounded-lg bg-surface px-4 py-4 flex flex-col gap-3">
                {data.statusBreakdown.map((col) => (
                  <HorizontalBar
                    key={col.columnId}
                    label={col.columnName}
                    count={col.count}
                    max={Math.max(...data.statusBreakdown.map((c) => c.count), 1)}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Bugs par sévérité
              </h2>
              <div className="border border-border rounded-lg bg-surface px-4 py-4 flex flex-col gap-3">
                {data.bugSeverity.map((s) => (
                  <HorizontalBar
                    key={s.severity}
                    label={SEVERITY_LABELS[s.severity]}
                    count={s.count}
                    max={Math.max(...data.bugSeverity.map((b) => b.count), 1)}
                    barClassName={SEVERITY_BAR_COLOR[s.severity]}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Vélocité par sprint (points faits)
              </h2>
              <div className="border border-border rounded-lg bg-surface px-4 py-4">
                <VelocityChart data={data.velocity.bySprint} />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Top 3 epics avec le plus de stories non terminées
              </h2>
              <div className="border border-border rounded-lg bg-surface divide-y divide-border overflow-hidden">
                {data.topEpics.length === 0 ? (
                  <p className="text-sm text-muted px-4 py-3">
                    Aucune story en cours rattachée à un epic pour l&apos;instant.
                  </p>
                ) : (
                  data.topEpics.map((epic, index) => (
                    <div
                      key={epic.epicId}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted w-4 shrink-0">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {epic.epicTitle}
                        </span>
                      </div>
                      <span className="text-sm text-muted shrink-0">
                        {epic.unfinishedCount} non terminée
                        {epic.unfinishedCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Epic, Story, Bug, Sprint } from "@/lib/types";
import { ListView } from "./components/ListView";
import { KanbanView } from "@/components/KanbanView";
import { StoryFormModal } from "@/components/StoryFormModal";
import { BugFormModal } from "@/components/BugFormModal";
import { EpicFormModal } from "./components/EpicFormModal";
import { DetailPanel, type DetailTarget } from "@/components/DetailPanel";
import { emitDataChanged, onDataChanged } from "@/lib/events";

type ViewMode = "list" | "kanban";

export default function BacklogPage() {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [showBugForm, setShowBugForm] = useState(false);
  const [showEpicForm, setShowEpicForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DetailTarget | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = () => setReloadToken((token) => token + 1);
  const notifyChanged = () => {
    reload();
    emitDataChanged();
  };

  useEffect(() => onDataChanged(reload), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // On ne réaffiche l'état de chargement plein écran qu'au tout premier
      // montage : les rechargements déclenchés en arrière-plan par
      // emitDataChanged() (ex. depuis le panneau de gestion des colonnes)
      // ne doivent pas démonter Kanban/Liste et fermer un panneau ouvert.
      if (reloadToken === 0) setLoading(true);
      setError(null);
      try {
        const [epicsRes, storiesRes, bugsRes, sprintsRes] = await Promise.all([
          fetch("/api/epics"),
          fetch("/api/stories"),
          fetch("/api/bugs"),
          fetch("/api/sprints"),
        ]);

        if (!epicsRes.ok || !storiesRes.ok || !bugsRes.ok || !sprintsRes.ok) {
          throw new Error("Erreur lors du chargement du backlog.");
        }

        const [epicsData, storiesData, bugsData, sprintsData] = await Promise.all([
          epicsRes.json(),
          storiesRes.json(),
          bugsRes.json(),
          sprintsRes.json(),
        ]);

        if (cancelled) return;
        setEpics(epicsData);
        setStories(storiesData);
        setBugs(bugsData);
        setSprints(sprintsData);
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

  async function handleStoryStatusChange(storyId: string, statusColumnId: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusColumnId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? "Erreur lors de la mise à jour de la story.");
        return;
      }
      notifyChanged();
    } catch {
      setActionError("Erreur réseau, veuillez réessayer.");
    }
  }

  async function handleBugStatusChange(bugId: string, statusColumnId: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusColumnId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error ?? "Erreur lors de la mise à jour du bug.");
        return;
      }
      notifyChanged();
    } catch {
      setActionError("Erreur réseau, veuillez réessayer.");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Product Backlog</h1>
          <p className="text-sm text-muted">
            {stories.length} stor{stories.length > 1 ? "ies" : "y"} · {bugs.length} bug
            {bugs.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 transition-colors ${
                view === "list" ? "bg-accent text-accent-fg" : "hover:bg-surface-2"
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 transition-colors border-l border-border ${
                view === "kanban" ? "bg-accent text-accent-fg" : "hover:bg-surface-2"
              }`}
            >
              Kanban
            </button>
          </div>

          <button onClick={() => setShowEpicForm(true)} className="btn-secondary">
            + Nouvel Epic
          </button>
          <button onClick={() => setShowStoryForm(true)} className="btn-primary">
            + Nouvelle Story
          </button>
          <button onClick={() => setShowBugForm(true)} className="btn-secondary">
            + Nouveau Bug
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        {loading && <p className="text-muted">Chargement du backlog…</p>}

        {error && !loading && (
          <div className="rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3 flex items-center gap-3">
            <span>{error}</span>
            <button onClick={reload} className="underline shrink-0">
              Réessayer
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-lg border border-severity-critical bg-severity-critical/10 text-severity-critical px-4 py-3 flex items-center gap-3">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="underline shrink-0">
              Fermer
            </button>
          </div>
        )}

        {!loading && !error && (
          view === "list" ? (
            <ListView
              epics={epics}
              stories={stories}
              bugs={bugs}
              sprints={sprints}
              onOpenStory={(id) => setSelectedItem({ type: "story", id })}
              onOpenBug={(id) => setSelectedItem({ type: "bug", id })}
              onOpenEpic={(id) => setSelectedItem({ type: "epic", id })}
            />
          ) : (
            <KanbanView
              stories={stories}
              bugs={bugs}
              epics={epics}
              sprints={sprints}
              onOpenStory={(id) => setSelectedItem({ type: "story", id })}
              onOpenBug={(id) => setSelectedItem({ type: "bug", id })}
              onStoryStatusChange={handleStoryStatusChange}
              onBugStatusChange={handleBugStatusChange}
            />
          )
        )}
      </div>

      {showStoryForm && (
        <StoryFormModal
          epics={epics}
          sprints={sprints}
          onClose={() => setShowStoryForm(false)}
          onCreated={() => {
            setShowStoryForm(false);
            notifyChanged();
          }}
        />
      )}

      {showBugForm && (
        <BugFormModal
          sprints={sprints}
          onClose={() => setShowBugForm(false)}
          onCreated={() => {
            setShowBugForm(false);
            notifyChanged();
          }}
        />
      )}

      {showEpicForm && (
        <EpicFormModal
          onClose={() => setShowEpicForm(false)}
          onCreated={() => {
            setShowEpicForm(false);
            notifyChanged();
          }}
        />
      )}

      {selectedItem && (
        <DetailPanel
          initialTarget={selectedItem}
          epics={epics}
          sprints={sprints}
          onClose={() => setSelectedItem(null)}
          onChanged={notifyChanged}
        />
      )}
    </div>
  );
}

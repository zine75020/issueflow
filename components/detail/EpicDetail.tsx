"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_OPTIONS, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";
import { useColumns } from "@/lib/useColumns";
import type { Epic, Status, Story } from "@/lib/types";

type EpicWithStories = Epic & { stories: Story[] };

export function EpicDetail({
  id,
  onClose,
  onChanged,
  onNavigateToStory,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onNavigateToStory: (storyId: string) => void;
}) {
  const [epic, setEpic] = useState<EpicWithStories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("TODO");
  const { columns } = useColumns();
  const columnNameById = new Map(columns.map((col) => [col.id, col.name]));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/epics/${id}`);
        if (!res.ok) {
          throw new Error("Erreur lors du chargement de l'epic.");
        }
        const data: EpicWithStories = await res.json();
        if (cancelled) return;
        setEpic(data);
        setTitle(data.title);
        setDescription(data.description);
        setStatus(data.status);
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
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/epics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        return;
      }

      onChanged();
      onClose();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/epics/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la suppression.");
        return;
      }

      onChanged();
      onClose();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal title={!loading && epic ? epic.title : "Epic"} onClose={onClose}>
      {loading && <p className="text-sm text-muted">Chargement…</p>}

      {!loading && !epic && (
        <p className="text-sm text-severity-critical">
          {error ?? "Epic introuvable."}
        </p>
      )}

      {!loading && epic && (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-severity-critical">{error}</p>}

          <Field label="Titre" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={TITLE_MAX_LENGTH}
              className="input"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={TEXT_MAX_LENGTH}
              className="input"
            />
          </Field>

          <Field label="Statut">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="input"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              Stories rattachées ({epic.stories.length})
            </h3>
            {epic.stories.length === 0 ? (
              <p className="text-sm text-muted">Aucune story rattachée.</p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {epic.stories.map((story) => (
                  <button
                    type="button"
                    key={story.id}
                    onClick={() => onNavigateToStory(story.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left hover:bg-surface-2"
                  >
                    <span className="truncate">{story.title}</span>
                    <StatusBadge
                      label={columnNameById.get(story.statusColumnId) ?? "…"}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <p className="text-sm text-severity-critical">
                Supprimer cet epic ? Ses stories seront détachées, pas supprimées.
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger"
                >
                  {deleting ? "Suppression…" : "Confirmer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="btn-danger"
              >
                Supprimer
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Fermer
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

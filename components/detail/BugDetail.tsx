"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { CommentSection } from "@/components/CommentSection";
import { AttachmentSection } from "@/components/AttachmentSection";
import { SEVERITY_OPTIONS, FIBONACCI_OPTIONS, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";
import { useColumns } from "@/lib/useColumns";
import type { Attachment, Bug, Comment, Severity, Sprint } from "@/lib/types";

type BugWithComments = Bug & { comments: Comment[]; attachments: Attachment[] };

export function BugDetail({
  id,
  sprints,
  onClose,
  onChanged,
}: {
  id: string;
  sprints: Sprint[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [bug, setBug] = useState<BugWithComments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("MAJOR");
  const [remainingEffort, setRemainingEffort] = useState("");
  const [statusColumnId, setStatusColumnId] = useState("");
  const [sprintId, setSprintId] = useState("");
  const { columns } = useColumns();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bugs/${id}`);
        if (!res.ok) {
          throw new Error("Erreur lors du chargement du bug.");
        }
        const data: BugWithComments = await res.json();
        if (cancelled) return;
        setBug(data);
        setTitle(data.title);
        setDescription(data.description);
        setSeverity(data.severity);
        setRemainingEffort(
          data.remainingEffort !== null ? String(data.remainingEffort) : ""
        );
        setStatusColumnId(data.statusColumnId);
        setSprintId(data.sprintId ?? "");
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
      const res = await fetch(`/api/bugs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          severity,
          remainingEffort: remainingEffort ? Number(remainingEffort) : null,
          statusColumnId,
          sprintId: sprintId || null,
        }),
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
      const res = await fetch(`/api/bugs/${id}`, { method: "DELETE" });

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
    <Modal title={!loading && bug ? bug.title : "Bug"} onClose={onClose}>
      {loading && <p className="text-sm text-muted">Chargement…</p>}

      {!loading && !bug && (
        <p className="text-sm text-severity-critical">
          {error ?? "Bug introuvable."}
        </p>
      )}

      {!loading && bug && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sévérité" required>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="input"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select
                value={statusColumnId}
                onChange={(e) => setStatusColumnId(e.target.value)}
                className="input"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Remaining Effort (Story Points)">
              <select
                value={remainingEffort}
                onChange={(e) => setRemainingEffort(e.target.value)}
                className="input"
              >
                {FIBONACCI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sprint">
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="input"
              >
                <option value="">Aucun sprint</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <CommentSection
            key={id}
            itemType="bug"
            itemId={id}
            initialComments={bug.comments}
          />

          <AttachmentSection
            key={id}
            itemType="bug"
            itemId={id}
            initialAttachments={bug.attachments}
          />

          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <p className="text-sm text-severity-critical">
                Supprimer définitivement ce bug ?
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

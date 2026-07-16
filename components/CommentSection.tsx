"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { COMMENT_MAX_LENGTH } from "@/lib/constants";
import type { Comment } from "@/lib/types";

export function CommentSection({
  itemType,
  itemId,
  initialComments,
}: {
  itemType: "story" | "bug";
  itemId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          storyId: itemType === "story" ? itemId : undefined,
          bugId: itemType === "bug" ? itemId : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'ajout du commentaire.");
        return;
      }

      setComments((prev) => [...prev, data]);
      setContent("");
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la suppression du commentaire.");
        return;
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setConfirmingId(null);
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Commentaires ({comments.length})
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-muted">Aucun commentaire pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                <p className="text-xs text-muted mt-1">
                  {formatDateTime(comment.createdAt)}
                </p>
              </div>

              {confirmingId === comment.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="btn-danger text-xs px-2 py-1"
                  >
                    {deletingId === comment.id ? "…" : "Confirmer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="btn-secondary text-xs px-2 py-1"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(comment.id)}
                  aria-label="Supprimer le commentaire"
                  className="shrink-0 flex items-center justify-center h-8 w-8 max-md:h-11 max-md:w-11 rounded text-muted hover:text-severity-critical hover:bg-surface transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-severity-critical">{error}</p>}

      <div className="flex flex-col gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder="Ajouter un commentaire…"
          className="input resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting || !content.trim()}
          className="btn-secondary self-end"
        >
          {submitting ? "Ajout…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}

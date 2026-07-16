"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { TrashIcon, PaperclipIcon, FileIcon } from "@/components/icons";
import { formatFileSize } from "@/lib/format";
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_PER_ITEM,
  ATTACHMENT_MAX_SIZE_BYTES,
} from "@/lib/constants";
import type { Attachment } from "@/lib/types";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function AttachmentSection({
  itemType,
  itemId,
  initialAttachments,
}: {
  itemType: "story" | "bug";
  itemId: string;
  initialAttachments: Attachment[];
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    // Pré-validation côté client : purement pour un retour immédiat à l'utilisateur, sans
    // attendre l'aller-retour réseau. Ne remplace jamais la validation serveur (taille
    // réelle vérifiée via head(), type réel vérifié par lecture des octets du fichier
    // stocké dans POST /api/attachments) : un client malveillant peut ignorer ce contrôle.
    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      setError(
        `Le fichier dépasse la taille maximale autorisée (${ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)} Mo).`
      );
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? "";
      const pathname = `attachments/${crypto.randomUUID()}${extension}`;

      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/attachments/token",
        clientPayload: JSON.stringify({
          storyId: itemType === "story" ? itemId : undefined,
          bugId: itemType === "bug" ? itemId : undefined,
        }),
        onUploadProgress: (event) => setProgress(event.percentage),
      });

      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          filename: file.name,
          storyId: itemType === "story" ? itemId : undefined,
          bugId: itemType === "bug" ? itemId : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement de la pièce jointe.");
        return;
      }

      setAttachments((prev) => [...prev, data]);
    } catch (err) {
      // Le rejet pour taille excessive a lieu côté Vercel Blob avant même d'atteindre notre
      // serveur (voir /api/attachments/token) : son message n'est pas dans notre contrôle,
      // on le remplace donc par un message clair et cohérent avec le reste de l'app.
      const rawMessage = err instanceof Error ? err.message : "";
      setError(
        rawMessage.includes("too large")
          ? `Le fichier dépasse la taille maximale autorisée (${ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)} Mo).`
          : rawMessage || "Erreur lors de l'upload."
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete(attachmentId: string) {
    setDeletingId(attachmentId);
    setError(null);
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la suppression de la pièce jointe.");
        return;
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
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
        Pièces jointes ({attachments.length})
      </h3>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted">Aucune pièce jointe pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 flex items-center justify-between gap-2"
            >
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-w-0 hover:opacity-80"
              >
                {isImage(attachment.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.url}
                    alt=""
                    className="h-10 w-10 rounded object-cover shrink-0 border border-border"
                  />
                ) : (
                  <span className="h-10 w-10 rounded flex items-center justify-center shrink-0 border border-border text-muted">
                    <FileIcon className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <p className="text-sm truncate">{attachment.filename}</p>
                  <p className="text-xs text-muted">{formatFileSize(attachment.size)}</p>
                </span>
              </a>

              {confirmingId === attachment.id ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDelete(attachment.id)}
                    disabled={deletingId === attachment.id}
                    className="btn-danger text-xs px-2 py-1"
                  >
                    {deletingId === attachment.id ? "…" : "Confirmer"}
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
                  onClick={() => setConfirmingId(attachment.id)}
                  aria-label="Supprimer la pièce jointe"
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

      <div className="flex items-center gap-3">
        <label className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
          <PaperclipIcon className="h-4 w-4" />
          {uploading ? `Envoi… ${progress}%` : "Ajouter un fichier"}
          <input
            type="file"
            accept={ATTACHMENT_ALLOWED_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={uploading || attachments.length >= ATTACHMENT_MAX_PER_ITEM}
            className="hidden"
          />
        </label>
        <span className="text-xs text-muted">
          {attachments.length >= ATTACHMENT_MAX_PER_ITEM
            ? `Limite de ${ATTACHMENT_MAX_PER_ITEM} pièces jointes atteinte.`
            : "JPEG, PNG, WebP ou PDF, 5 Mo max."}
        </span>
      </div>
    </div>
  );
}

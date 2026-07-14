"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { LockIcon, ArrowUpIcon, ArrowDownIcon } from "@/components/icons";
import { useColumns } from "@/lib/useColumns";
import { emitDataChanged } from "@/lib/events";

export function ColumnManagerPanel({ onClose }: { onClose: () => void }) {
  const { columns, loading } = useColumns();

  const [newName, setNewName] = useState("");
  const [afterColumnId, setAfterColumnId] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !afterColumnId) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), afterColumnId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création de la colonne.");
        return;
      }

      setNewName("");
      setAfterColumnId("");
      emitDataChanged();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/columns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors du renommage de la colonne.");
        return;
      }

      setRenamingId(null);
      emitDataChanged();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const index = columns.findIndex((c) => c.id === id);
    if (index === -1) return;
    const targetOrder = index + direction;
    if (targetOrder < 0 || targetOrder >= columns.length) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/columns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: targetOrder }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors du déplacement de la colonne.");
        return;
      }

      emitDataChanged();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/columns/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la suppression de la colonne.");
        return;
      }

      setConfirmingDeleteId(null);
      emitDataChanged();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Gérer les colonnes" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-severity-critical">{error}</p>}

        {loading && <p className="text-sm text-muted">Chargement…</p>}

        {!loading && (
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {columns.map((col, index) => (
              <div key={col.id} className="flex flex-col gap-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  {col.isLocked && (
                    <LockIcon className="h-3.5 w-3.5 text-muted shrink-0" />
                  )}

                  {renamingId === col.id ? (
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="input flex-1 py-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">{col.name}</span>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => handleMove(col.id, -1)}
                      aria-label="Déplacer vers le haut"
                      className="rounded border border-border p-1 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === columns.length - 1}
                      onClick={() => handleMove(col.id, 1)}
                      aria-label="Déplacer vers le bas"
                      className="rounded border border-border p-1 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    </button>

                    {!col.isLocked && renamingId === col.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRename(col.id)}
                          disabled={busy}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          Annuler
                        </button>
                      </>
                    )}

                    {!col.isLocked && renamingId !== col.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(col.id);
                          setRenameValue(col.name);
                        }}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Renommer
                      </button>
                    )}

                    {!col.isLocked && confirmingDeleteId !== col.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(col.id)}
                        className="btn-danger text-xs px-2 py-1"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {confirmingDeleteId === col.id && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <p className="text-xs text-severity-critical">
                      Les items de « {col.name} » seront déplacés vers « À faire ».
                      Confirmer ?
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(col.id)}
                        disabled={busy}
                        className="btn-danger text-xs px-2 py-1"
                      >
                        {busy ? "Suppression…" : "Confirmer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-2 pt-2 border-t border-border"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Ajouter une colonne
          </h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom de la colonne"
              className="input flex-1"
            />
            <select
              value={afterColumnId}
              onChange={(e) => setAfterColumnId(e.target.value)}
              className="input flex-1"
            >
              <option value="">Insérer après…</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !newName.trim() || !afterColumnId}
            className="btn-primary self-end"
          >
            {busy ? "Ajout…" : "Ajouter"}
          </button>
        </form>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}

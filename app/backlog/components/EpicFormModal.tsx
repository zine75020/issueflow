"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";

export function EpicFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/epics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création de l'epic.");
        return;
      }

      onCreated();
    } catch {
      setError("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Nouvel Epic" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Création…" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

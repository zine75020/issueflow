"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";

export function SprintFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du sprint.");
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
    <Modal title="Nouveau Sprint" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="text-sm text-severity-critical">{error}</p>}

        <Field label="Nom" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
            placeholder="Sprint 1"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date de début" required>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="input"
            />
          </Field>

          <Field label="Date de fin" required>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

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

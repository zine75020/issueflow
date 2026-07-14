"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { formatDateShort } from "@/lib/format";
import { FIBONACCI_OPTIONS, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";
import type { Epic, Sprint } from "@/lib/types";

export function StoryFormModal({
  epics,
  sprints,
  defaultSprintId,
  onClose,
  onCreated,
}: {
  epics: Epic[];
  sprints: Sprint[];
  defaultSprintId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [remainingEffort, setRemainingEffort] = useState("");
  const [epicId, setEpicId] = useState("");
  const [assignToSprint, setAssignToSprint] = useState(Boolean(defaultSprintId));
  const [sprintId, setSprintId] = useState(defaultSprintId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          acceptanceCriteria,
          storyPoints: storyPoints ? Number(storyPoints) : undefined,
          remainingEffort: remainingEffort ? Number(remainingEffort) : undefined,
          epicId: epicId || undefined,
          sprintId: assignToSprint && sprintId ? sprintId : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création de la story.");
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
    <Modal title="Nouvelle Story" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="text-sm text-severity-critical">{error}</p>}

        <Field label="Titre" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={TITLE_MAX_LENGTH}
            className="input"
            placeholder="En tant que... je veux... afin de..."
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

        <Field label="Critères d'acceptation">
          <textarea
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            rows={3}
            maxLength={TEXT_MAX_LENGTH}
            className="input"
            placeholder="Étant donné... quand... alors..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Story points">
            <select
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              className="input"
            >
              {FIBONACCI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

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
        </div>

        <Field label="Epic">
          <select
            value={epicId}
            onChange={(e) => setEpicId(e.target.value)}
            className="input"
          >
            <option value="">Aucun epic</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
        </Field>

        {sprints.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assignToSprint}
                onChange={(e) => setAssignToSprint(e.target.checked)}
              />
              Ajouter à un sprint ?
            </label>

            {assignToSprint && (
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                required
                className="input"
              >
                <option value="" disabled>
                  Choisir un sprint
                </option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({formatDateShort(sprint.startDate)} →{" "}
                    {formatDateShort(sprint.endDate)})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

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

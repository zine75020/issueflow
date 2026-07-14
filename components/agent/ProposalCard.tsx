"use client";

import { SparkleIcon } from "@/components/icons";
import type { AgentProposal } from "@/lib/agentTypes";
import type { Epic, Story } from "@/lib/types";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "error";

export function ProposalCard({
  proposal,
  status,
  busy,
  error,
  epics,
  stories,
  onAccept,
  onReject,
}: {
  proposal: AgentProposal;
  status: ProposalStatus;
  busy: boolean;
  error: string | null;
  epics: Epic[];
  stories: Story[];
  onAccept: () => void;
  onReject: () => void;
}) {
  const epic =
    proposal.type === "create_story" && proposal.epicId
      ? epics.find((e) => e.id === proposal.epicId)
      : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-surface">
        <SparkleIcon className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-medium text-muted">
          {proposal.type === "create_story"
            ? "Proposition · Nouvelle story"
            : "Proposition · Réorganisation du backlog"}
        </span>
      </div>

      <div className="px-3 py-3 flex flex-col gap-2 text-sm">
        {proposal.type === "create_story" ? (
          <>
            <p className="font-medium">{proposal.title}</p>
            {proposal.description && (
              <p className="text-muted whitespace-pre-wrap">{proposal.description}</p>
            )}
            {proposal.acceptanceCriteria && (
              <div>
                <p className="text-xs font-medium text-muted mb-0.5">
                  Critères d&apos;acceptation
                </p>
                <p className="whitespace-pre-wrap">{proposal.acceptanceCriteria}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {proposal.storyPoints !== undefined && (
                <span className="badge badge-status">{proposal.storyPoints} pts</span>
              )}
              {epic && <span className="badge badge-status">{epic.title}</span>}
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{proposal.instructions}</p>
            <div>
              <p className="text-xs font-medium text-muted mb-1">
                Items concernés ({proposal.affectedItemIds.length})
              </p>
              <ul className="flex flex-col gap-0.5">
                {proposal.affectedItemIds.map((id, index) => {
                  const story = stories.find((s) => s.id === id);
                  return (
                    <li key={id} className="text-xs text-muted truncate">
                      {index + 1}. {story ? story.title : id}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {error && <p className="text-xs text-severity-critical">{error}</p>}

        {status === "pending" && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-1">
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="btn-secondary !px-3 !py-1 text-xs"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={busy}
              className="btn-primary !px-3 !py-1 text-xs"
            >
              {busy ? "Application…" : "Valider"}
            </button>
          </div>
        )}

        {status === "accepted" && (
          <p className="text-xs text-status-done pt-2 border-t border-border mt-1">
            ✓{" "}
            {proposal.type === "create_story"
              ? "Story créée dans le backlog."
              : "Backlog réorganisé."}
          </p>
        )}

        {status === "rejected" && (
          <p className="text-xs text-muted pt-2 border-t border-border mt-1">
            Proposition refusée.
          </p>
        )}
      </div>
    </div>
  );
}

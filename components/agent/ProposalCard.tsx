"use client";

import { SparkleIcon } from "@/components/icons";
import type { AgentProposal } from "@/lib/agentTypes";
import type { BoardColumn, Epic, Severity, Story } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { SeverityBadge } from "@/components/SeverityBadge";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "error";

function isSeverity(value: string | undefined): value is Severity {
  return value === "CRITICAL" || value === "MAJOR" || value === "MINOR";
}

export function ProposalCard({
  proposal,
  status,
  busy,
  error,
  epics,
  stories,
  columns,
  onAccept,
  onReject,
}: {
  proposal: AgentProposal;
  status: ProposalStatus;
  busy: boolean;
  error: string | null;
  epics: Epic[];
  stories: Story[];
  columns: BoardColumn[];
  onAccept: () => void;
  onReject: () => void;
}) {
  const epic =
    proposal.type === "create_story" && proposal.epicId
      ? epics.find((e) => e.id === proposal.epicId)
      : undefined;

  const isDelete = proposal.type === "delete_item";
  const columnName =
    proposal.type === "delete_item" && proposal.itemSnapshot.statusColumnId
      ? columns.find((c) => c.id === proposal.itemSnapshot.statusColumnId)?.name
      : undefined;

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isDelete ? "border-severity-critical/50 bg-surface-2" : "border-border bg-surface-2"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 px-3 py-2 border-b bg-surface ${
          isDelete ? "border-severity-critical/50" : "border-border"
        }`}
      >
        <SparkleIcon
          className={`h-3.5 w-3.5 ${isDelete ? "text-severity-critical" : "text-accent"}`}
        />
        <span
          className={`text-xs font-medium ${isDelete ? "text-severity-critical" : "text-muted"}`}
        >
          {proposal.type === "create_story" && "Proposition · Nouvelle story"}
          {proposal.type === "reorder_backlog" && "Proposition · Réorganisation du backlog"}
          {proposal.type === "delete_item" &&
            `Proposition · Suppression ${proposal.itemType === "story" ? "de story" : "de bug"}`}
        </span>
      </div>

      <div className="px-3 py-3 flex flex-col gap-2 text-sm">
        {proposal.type === "create_story" && (
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
        )}

        {proposal.type === "reorder_backlog" && (
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

        {proposal.type === "delete_item" && (
          <>
            <p className="font-medium">{proposal.itemSnapshot.title}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="badge badge-status">
                {proposal.itemType === "story" ? "Story" : "Bug"}
              </span>
              {columnName && <StatusBadge label={columnName} />}
              {isSeverity(proposal.itemSnapshot.severity) && (
                <SeverityBadge severity={proposal.itemSnapshot.severity} />
              )}
              {proposal.itemSnapshot.storyPoints != null && (
                <span className="badge badge-status">
                  {proposal.itemSnapshot.storyPoints} pts
                </span>
              )}
            </div>
            {proposal.reason && (
              <p className="text-muted whitespace-pre-wrap">{proposal.reason}</p>
            )}
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
              className={`!px-3 !py-1 text-xs ${isDelete ? "btn-danger" : "btn-primary"}`}
            >
              {busy ? "Application…" : isDelete ? "Supprimer" : "Valider"}
            </button>
          </div>
        )}

        {status === "accepted" && (
          <p className="text-xs text-status-done pt-2 border-t border-border mt-1">
            ✓{" "}
            {proposal.type === "create_story" && "Story créée dans le backlog."}
            {proposal.type === "reorder_backlog" && "Backlog réorganisé."}
            {proposal.type === "delete_item" &&
              (proposal.itemType === "story"
                ? "Story supprimée du backlog."
                : "Bug supprimé du backlog.")}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, SparkleIcon, SendIcon } from "@/components/icons";
import { emitDataChanged } from "@/lib/events";
import { labelForTool } from "@/lib/agentTypes";
import type { AgentChatMessage, AgentChatResponse, AgentProposal, AgentStep } from "@/lib/agentTypes";
import type { Epic, Story } from "@/lib/types";
import { ProposalCard, type ProposalStatus } from "@/components/agent/ProposalCard";
import { AgentMarkdown } from "@/components/agent/AgentMarkdown";
import { useColumns } from "@/lib/useColumns";

type ChatTurn =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      steps: AgentStep[];
      proposals: AgentProposal[];
      isError?: boolean;
    };

type ProposalUiState = { status: ProposalStatus; busy: boolean; error: string | null };

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const TEXTAREA_MAX_HEIGHT_PX = 160; // ~7 lignes avant scroll interne

const DEFAULT_PANEL_WIDTH_PX = 440;
const MIN_PANEL_WIDTH_PX = 360;

function getMaxPanelWidthPx() {
  return Math.min(900, window.innerWidth * 0.6);
}

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [apiMessages, setApiMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposalState, setProposalState] = useState<Record<string, ProposalUiState>>({});
  const [epics, setEpics] = useState<Epic[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const { columns } = useColumns();
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH_PX);
  const [isResizing, setIsResizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeStartRef = useRef({ startX: 0, startWidth: DEFAULT_PANEL_WIDTH_PX });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [epicsRes, storiesRes] = await Promise.all([
          fetch("/api/epics"),
          fetch("/api/stories"),
        ]);
        if (!epicsRes.ok || !storiesRes.ok) return;
        const [epicsData, storiesData] = await Promise.all([
          epicsRes.json(),
          storiesRes.json(),
        ]);
        if (cancelled) return;
        setEpics(epicsData);
        setStories(storiesData);
      } catch {
        // Utilisé seulement pour l'affichage des cartes de proposition (nom d'epic,
        // titres de stories) : en cas d'échec, elles retombent sur les identifiants bruts.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [input]);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  useEffect(() => {
    function handleWindowResize() {
      setPanelWidth((w) => Math.min(w, getMaxPanelWidthPx()));
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    resizeStartRef.current = { startX: e.clientX, startWidth: panelWidth };
    setIsResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isResizing) return;
    const { startX, startWidth } = resizeStartRef.current;
    const desired = startWidth + (startX - e.clientX);
    const clamped = Math.min(Math.max(desired, MIN_PANEL_WIDTH_PX), getMaxPanelWidthPx());
    setPanelWidth(clamped);
  }

  function handleResizeEnd(e: React.PointerEvent<HTMLDivElement>) {
    setIsResizing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userTurn: ChatTurn = { id: makeId(), role: "user", text };
    const nextApiMessages: AgentChatMessage[] = [...apiMessages, { role: "user", content: text }];

    setTurns((t) => [...t, userTurn]);
    setApiMessages(nextApiMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextApiMessages }),
      });
      const data: AgentChatResponse = await res.json();
      const message = data.message;

      if (!res.ok || typeof message !== "string") {
        throw new Error(data.error ?? "Erreur lors de l'appel à l'assistant.");
      }

      setTurns((t) => [
        ...t,
        {
          id: makeId(),
          role: "assistant",
          text: message,
          steps: data.steps ?? [],
          proposals: data.proposals ?? [],
        },
      ]);
      setApiMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          id: makeId(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Erreur inconnue.",
          steps: [],
          proposals: [],
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function getProposalState(key: string): ProposalUiState {
    return proposalState[key] ?? { status: "pending", busy: false, error: null };
  }

  async function handleAccept(key: string, proposal: AgentProposal) {
    setProposalState((s) => ({ ...s, [key]: { status: "pending", busy: true, error: null } }));

    try {
      if (proposal.type === "create_story") {
        const res = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: proposal.title,
            description: proposal.description,
            acceptanceCriteria: proposal.acceptanceCriteria,
            storyPoints: proposal.storyPoints ?? undefined,
            epicId: proposal.epicId ?? undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Erreur lors de la création de la story.");
        }
      } else if (proposal.type === "reorder_backlog") {
        const res = await fetch("/api/stories/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: proposal.affectedItemIds }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Erreur lors de la réorganisation du backlog.");
        }
      } else {
        const routeSegment = proposal.itemType === "story" ? "stories" : "bugs";
        const res = await fetch(`/api/${routeSegment}/${proposal.itemId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Erreur lors de la suppression de l'item.");
        }
      }

      setProposalState((s) => ({ ...s, [key]: { status: "accepted", busy: false, error: null } }));
      emitDataChanged();
    } catch (err) {
      setProposalState((s) => ({
        ...s,
        [key]: {
          status: "pending",
          busy: false,
          error: err instanceof Error ? err.message : "Erreur inconnue.",
        },
      }));
    }
  }

  function handleReject(key: string) {
    setProposalState((s) => ({ ...s, [key]: { status: "rejected", busy: false, error: null } }));
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-full flex-col border-l border-border bg-surface shadow-xl sm:w-(--panel-width)"
      style={{ "--panel-width": `${panelWidth}px` } as React.CSSProperties}
    >
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        className={`absolute left-0 top-0 bottom-0 z-10 hidden w-1.5 -translate-x-1/2 cursor-col-resize touch-none transition-colors sm:block ${
          isResizing ? "bg-accent" : "bg-transparent hover:bg-accent/50"
        }`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner le panneau"
      />

      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <SparkleIcon className="h-4 w-4 text-accent" />
          <span className="font-semibold text-sm">Assistant Backlog</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer l'assistant"
          className="text-muted hover:text-fg"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {turns.length === 0 && (
          <p className="text-sm text-muted">
            Pose une question sur le backlog (ex. « trouve les stories liées au paiement »),
            ou demande une nouvelle story ou une réorganisation — toute action d&apos;écriture
            te sera proposée pour validation, jamais appliquée directement.
          </p>
        )}

        {turns.map((turn) => {
          if (turn.role === "user") {
            return (
              <div key={turn.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-accent text-accent-fg px-3 py-2 text-sm whitespace-pre-wrap">
                  {turn.text}
                </div>
              </div>
            );
          }

          return (
            <div key={turn.id} className="flex flex-col gap-2">
              <div
                className={`max-w-[92%] rounded-lg px-3 py-2 ${
                  turn.isError
                    ? "border border-severity-critical text-severity-critical bg-surface-2 text-sm whitespace-pre-wrap"
                    : "bg-surface-2"
                }`}
              >
                {turn.isError ? turn.text : <AgentMarkdown text={turn.text} />}
              </div>

              {turn.steps.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-1">
                  {turn.steps.map((step, i) => (
                    <p key={i} className="text-xs text-muted">
                      {labelForTool(step.tool)}
                      {step.resultSummary ? ` · ${step.resultSummary}` : ""}
                    </p>
                  ))}
                </div>
              )}

              {turn.proposals.map((proposal, i) => {
                const key = `${turn.id}-${i}`;
                const state = getProposalState(key);
                return (
                  <ProposalCard
                    key={key}
                    proposal={proposal}
                    status={state.status}
                    busy={state.busy}
                    error={state.error}
                    epics={epics}
                    stories={stories}
                    columns={columns}
                    onAccept={() => handleAccept(key, proposal)}
                    onReject={() => handleReject(key)}
                  />
                );
              })}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" />
            </span>
            L&apos;assistant réfléchit…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="border-t border-border p-3 flex gap-2 items-end shrink-0"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Écris ta question… (Maj+Entrée pour un saut de ligne)"
          disabled={loading}
          rows={1}
          className="input flex-1 resize-none overflow-y-auto"
          style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Envoyer"
          className="btn-primary !px-3 !py-2.5"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

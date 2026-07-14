export type AgentStep = {
  tool: string;
  input: unknown;
  resultSummary?: string;
};

export type CreateStoryProposal = {
  type: "create_story";
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints?: number;
  epicId?: string;
};

export type ReorderBacklogProposal = {
  type: "reorder_backlog";
  instructions: string;
  affectedItemIds: string[];
};

export type AgentProposal = CreateStoryProposal | ReorderBacklogProposal;

export type AgentChatMessage = { role: "user" | "assistant"; content: string };

export type AgentChatResponse = {
  message?: string;
  proposals?: AgentProposal[];
  steps?: AgentStep[];
  error?: string;
};

const TOOL_LABELS: Record<string, string> = {
  search_backlog: "Recherche dans le backlog",
  get_item_details: "Récupération des détails d'un item",
  propose_create_story: "Préparation d'une proposition de story",
  propose_reorder_backlog: "Préparation d'une proposition de réorganisation",
};

export function labelForTool(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

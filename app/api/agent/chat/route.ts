import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `Tu es l'Assistant Backlog de ZineBoard, un outil de gestion de backlog agile.

Tu aides l'utilisateur à explorer et faire évoluer son backlog (epics, stories, bugs). Avant de répondre à une question sur le contenu du backlog, cherche l'information avec l'outil search_backlog plutôt que de deviner. Utilise get_item_details quand tu as besoin des détails complets d'un item précis (par exemple après une recherche, pour vérifier son contenu avant de proposer une modification).

Tu ne peux JAMAIS créer, modifier ou réorganiser quoi que ce soit directement. Les outils propose_create_story et propose_reorder_backlog ne font qu'enregistrer une proposition structurée : c'est l'utilisateur qui doit explicitement valider cette proposition dans l'interface avant qu'une quelconque écriture ait lieu en base de données. Ne dis jamais que tu as "créé" une story ou "réorganisé" le backlog — dis que tu proposes cette action et qu'elle attend la validation de l'utilisateur.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_backlog",
    description:
      "Recherche sémantique (RAG) dans le backlog. Retourne les epics/stories/bugs les plus pertinents pour une requête en langage naturel, avec leur score de similarité. À utiliser avant de répondre à toute question sur le contenu du backlog.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La requête de recherche, en langage naturel.",
        },
        types: {
          type: "array",
          items: { type: "string", enum: ["STORY", "BUG", "EPIC"] },
          description:
            "Types d'items à inclure dans la recherche. Si omis, tous les types sont inclus.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_item_details",
    description:
      "Récupère les détails complets d'un item du backlog (story, bug ou epic) à partir de son type et de son identifiant.",
    input_schema: {
      type: "object",
      properties: {
        itemType: { type: "string", enum: ["story", "bug", "epic"] },
        itemId: { type: "string", description: "Identifiant de l'item." },
      },
      required: ["itemType", "itemId"],
    },
  },
  {
    name: "propose_create_story",
    description:
      "Propose la création d'une nouvelle user story. N'écrit RIEN en base : retourne une proposition structurée que l'utilisateur devra valider explicitement dans l'interface avant toute création réelle.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        acceptanceCriteria: { type: "string" },
        storyPoints: {
          type: "number",
          description: "Optionnel. Échelle Fibonacci : 0, 1, 2, 3, 5, 8, 13, 21.",
        },
        epicId: { type: "string", description: "Optionnel. Epic à associer à la story." },
      },
      required: ["title", "description", "acceptanceCriteria"],
    },
  },
  {
    name: "propose_reorder_backlog",
    description:
      "Propose une réorganisation du backlog selon une instruction en langage naturel. N'écrit RIEN en base : retourne une proposition structurée que l'utilisateur devra valider explicitement dans l'interface avant toute réorganisation réelle.",
    input_schema: {
      type: "object",
      properties: {
        instructions: {
          type: "string",
          description: "Description en langage naturel de la réorganisation proposée.",
        },
        affectedItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Identifiants des items concernés par la réorganisation, dans l'ordre proposé.",
        },
      },
      required: ["instructions", "affectedItemIds"],
    },
  },
];

const ITEM_TYPE_ROUTE: Record<string, string> = {
  story: "stories",
  bug: "bugs",
  epic: "epics",
};

type AgentStep = {
  tool: string;
  input: unknown;
  resultSummary?: string;
};

type Proposal =
  | {
      type: "create_story";
      title: string;
      description: string;
      acceptanceCriteria: string;
      storyPoints?: number;
      epicId?: string;
    }
  | {
      type: "reorder_backlog";
      instructions: string;
      affectedItemIds: string[];
    };

async function runSearchBacklog(
  origin: string,
  input: { query?: unknown; types?: unknown }
): Promise<{ result: unknown; isError: boolean }> {
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim()) {
    return { result: "Le paramètre query est obligatoire.", isError: true };
  }

  const url = new URL("/api/search", origin);
  url.searchParams.set("q", query);
  if (Array.isArray(input.types) && input.types.length > 0) {
    url.searchParams.set("types", input.types.join(","));
  }

  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  return { result: data, isError: !res.ok };
}

function buildResultSummary(
  toolName: string,
  toolResult: { result: unknown; isError: boolean }
): string | undefined {
  if (toolResult.isError) return "Erreur";

  switch (toolName) {
    case "search_backlog":
      return Array.isArray(toolResult.result)
        ? `${toolResult.result.length} résultat${toolResult.result.length > 1 ? "s" : ""} trouvé${toolResult.result.length > 1 ? "s" : ""}`
        : undefined;
    case "get_item_details": {
      const item = toolResult.result as { title?: unknown } | null;
      return typeof item?.title === "string" ? `« ${item.title} »` : undefined;
    }
    case "propose_create_story":
    case "propose_reorder_backlog":
      return "Proposition enregistrée";
    default:
      return undefined;
  }
}

async function runGetItemDetails(
  origin: string,
  input: { itemType?: unknown; itemId?: unknown }
): Promise<{ result: unknown; isError: boolean }> {
  const itemType = typeof input.itemType === "string" ? input.itemType : "";
  const itemId = typeof input.itemId === "string" ? input.itemId : "";
  const routeSegment = ITEM_TYPE_ROUTE[itemType];

  if (!routeSegment || !itemId) {
    return {
      result: "itemType doit être story, bug ou epic, et itemId est obligatoire.",
      isError: true,
    };
  }

  const url = new URL(`/api/${routeSegment}/${itemId}`, origin);
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  return { result: data, isError: !res.ok };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 }
    );
  }

  const { messages } = (body ?? {}) as { messages?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Le champ messages est obligatoire et doit être un tableau non vide." },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur." },
      { status: 500 }
    );
  }

  const client = new Anthropic();
  const origin = request.nextUrl.origin;

  const conversation: Anthropic.MessageParam[] = [...(messages as Anthropic.MessageParam[])];
  const steps: AgentStep[] = [];
  const proposals: Proposal[] = [];

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversation,
      });

      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        return NextResponse.json({ message: text, proposals, steps });
      }

      conversation.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const input = (block.input ?? {}) as Record<string, unknown>;
        let toolResult: { result: unknown; isError: boolean };

        switch (block.name) {
          case "search_backlog":
            toolResult = await runSearchBacklog(origin, input);
            break;
          case "get_item_details":
            toolResult = await runGetItemDetails(origin, input);
            break;
          case "propose_create_story": {
            const proposal: Proposal = {
              type: "create_story",
              title: String(input.title ?? ""),
              description: String(input.description ?? ""),
              acceptanceCriteria: String(input.acceptanceCriteria ?? ""),
              ...(typeof input.storyPoints === "number" ? { storyPoints: input.storyPoints } : {}),
              ...(typeof input.epicId === "string" && input.epicId ? { epicId: input.epicId } : {}),
            };
            proposals.push(proposal);
            toolResult = {
              result: {
                status: "proposition_enregistrée",
                proposal,
                note: "Cette story n'a pas été créée. Elle attend la validation de l'utilisateur dans l'interface.",
              },
              isError: false,
            };
            break;
          }
          case "propose_reorder_backlog": {
            const proposal: Proposal = {
              type: "reorder_backlog",
              instructions: String(input.instructions ?? ""),
              affectedItemIds: Array.isArray(input.affectedItemIds)
                ? input.affectedItemIds.map((id) => String(id))
                : [],
            };
            proposals.push(proposal);
            toolResult = {
              result: {
                status: "proposition_enregistrée",
                proposal,
                note: "Le backlog n'a pas été réorganisé. Cette proposition attend la validation de l'utilisateur dans l'interface.",
              },
              isError: false,
            };
            break;
          }
          default:
            toolResult = { result: `Outil inconnu : ${block.name}`, isError: true };
        }

        steps.push({
          tool: block.name,
          input: block.input,
          resultSummary: buildResultSummary(block.name, toolResult),
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(toolResult.result),
          is_error: toolResult.isError,
        });
      }

      conversation.push({ role: "user", content: toolResults });
    }

    return NextResponse.json(
      {
        error: `L'agent a atteint la limite de ${MAX_ITERATIONS} itérations sans produire de réponse finale.`,
        steps,
        proposals,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("POST /api/agent/chat failed:", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Erreur de l'API Anthropic : ${error.message}`
        : "Erreur serveur lors de l'exécution de l'agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

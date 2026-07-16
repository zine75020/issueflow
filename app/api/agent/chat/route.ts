import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { searchBacklog, getItemDetails, VoyageError, type BacklogItemType } from "@/lib/backlog-queries";
import { checkAgentChatIpLimit, checkAgentChatGlobalLimit, getClientIp } from "@/lib/rateLimit";
import { ItemType } from "@/app/generated/prisma/client";

// Le client Redis (voir lib/rateLimit.ts) ouvre une vraie connexion TCP, incompatible avec
// le runtime Edge de Vercel — cette route doit rester en Node.js.
export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `Tu es l'Assistant Backlog de ZineBoard, un outil de gestion de backlog agile.

Tu aides l'utilisateur à explorer et faire évoluer son backlog (epics, stories, bugs). Avant de répondre à une question sur le contenu du backlog, cherche l'information avec l'outil search_backlog plutôt que de deviner. Utilise get_item_details quand tu as besoin des détails complets d'un item précis (par exemple après une recherche, pour vérifier son contenu avant de proposer une modification).

Tu ne peux JAMAIS créer, modifier, supprimer ou réorganiser quoi que ce soit directement. Les outils propose_create_story, propose_reorder_backlog et propose_delete_item ne font qu'enregistrer une proposition structurée : c'est l'utilisateur qui doit explicitement valider cette proposition dans l'interface avant qu'une quelconque écriture ait lieu en base de données. Ne dis jamais que tu as "créé" une story, "réorganisé" le backlog ou "supprimé" un item — dis que tu proposes cette action et qu'elle attend la validation de l'utilisateur.

Tu peux proposer la suppression d'un ou plusieurs items (stories ou bugs) avec propose_delete_item, mais uniquement pour des items que tu as bien identifiés au préalable via search_backlog ou get_item_details. N'appelle jamais propose_delete_item sur un identifiant que tu n'as pas vérifié au préalable dans la conversation.

Quand tu présentes une liste de stories ou de bugs (par exemple sous forme de tableau Markdown), affiche toujours le nom lisible de la colonne de statut (champ statusColumn.name), jamais son identifiant technique (statusColumnId). Quand tu construis un tableau Markdown, sépare bien chaque en-tête de colonne par " | ", par exemple : "| Titre | Points | Statut |" suivi de la ligne de séparation "| --- | --- | --- |" — ne fusionne jamais deux en-têtes en un seul mot.`;

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
      "Récupère les détails complets d'un item du backlog (story, bug ou epic) à partir de son type et de son identifiant. Pour une story ou un bug, la réponse inclut aussi ses commentaires (champ comments, triés du plus ancien au plus récent).",
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
  {
    name: "propose_delete_item",
    description:
      "Propose la suppression d'une story ou d'un bug déjà identifié (via search_backlog ou get_item_details). N'écrit RIEN en base : retourne une proposition structurée que l'utilisateur devra valider explicitement dans l'interface avant toute suppression réelle.",
    input_schema: {
      type: "object",
      properties: {
        itemType: { type: "string", enum: ["story", "bug"] },
        itemId: { type: "string", description: "Identifiant de l'item à supprimer." },
        reason: {
          type: "string",
          description: "Optionnel. Raison de la suppression proposée, à afficher à l'utilisateur.",
        },
      },
      required: ["itemType", "itemId"],
    },
  },
];

const VALID_ITEM_TYPES = new Set<BacklogItemType>(["story", "bug", "epic"]);

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
    }
  | {
      type: "delete_item";
      itemType: "story" | "bug";
      itemId: string;
      reason?: string;
      itemSnapshot: {
        title: string;
        statusColumnId?: string;
        severity?: string;
        storyPoints?: number | null;
      };
    };

async function runSearchBacklog(
  input: { query?: unknown; types?: unknown }
): Promise<{ result: unknown; isError: boolean }> {
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim()) {
    return { result: "Le paramètre query est obligatoire.", isError: true };
  }

  const itemTypes =
    Array.isArray(input.types) && input.types.length > 0
      ? (input.types as unknown[]).map((t) => String(t)) as ItemType[]
      : undefined;

  try {
    const results = await searchBacklog(query, { itemTypes });
    return { result: results, isError: false };
  } catch (error) {
    const message =
      error instanceof VoyageError
        ? `Service de recherche sémantique (Voyage AI) indisponible : ${error.message}`
        : `Erreur lors de la recherche dans le backlog : ${(error as Error).message}`;
    console.error("Outil search_backlog en échec — input:", input, "erreur:", error);
    return { result: message, isError: true };
  }
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
    case "propose_delete_item":
      return "Proposition enregistrée";
    default:
      return undefined;
  }
}

async function runGetItemDetails(
  input: { itemType?: unknown; itemId?: unknown }
): Promise<{ result: unknown; isError: boolean }> {
  const itemType = typeof input.itemType === "string" ? input.itemType : "";
  const itemId = typeof input.itemId === "string" ? input.itemId : "";

  if (!VALID_ITEM_TYPES.has(itemType as BacklogItemType) || !itemId) {
    return {
      result: "itemType doit être story, bug ou epic, et itemId est obligatoire.",
      isError: true,
    };
  }

  try {
    const item = await getItemDetails(itemType as BacklogItemType, itemId);
    if (!item) {
      return { result: `Aucun ${itemType} trouvé avec l'identifiant ${itemId}.`, isError: true };
    }
    return { result: item, isError: false };
  } catch (error) {
    console.error(
      `Outil get_item_details en échec — itemType: ${itemType}, itemId: ${itemId}, erreur:`,
      error
    );
    return {
      result: `Erreur lors de la récupération de l'item : ${(error as Error).message}`,
      isError: true,
    };
  }
}

export async function POST(request: NextRequest) {
  // Protection des coûts de l'API Anthropic (voir CLAUDE.md pour le détail des limites) :
  // vérifiées avant toute autre chose, pour ne jamais parser/traiter une requête qu'on va
  // de toute façon rejeter. Le plafond global n'est consommé que si la limite par IP est
  // elle-même respectée, pour qu'il reflète le nombre réel d'appels faits à Anthropic (pas
  // les tentatives déjà bloquées par ailleurs).
  const clientIp = getClientIp(request);

  const ipLimitResult = await checkAgentChatIpLimit(clientIp);
  if (!ipLimitResult.success) {
    return NextResponse.json(
      { error: "Trop de messages pour l'instant, réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const globalLimitResult = await checkAgentChatGlobalLimit();
  if (!globalLimitResult.success) {
    return NextResponse.json(
      { error: "L'assistant a atteint sa limite d'utilisation pour aujourd'hui, reviens demain." },
      { status: 429 }
    );
  }

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

        try {
          switch (block.name) {
            case "search_backlog":
              toolResult = await runSearchBacklog(input);
              break;
            case "get_item_details":
              toolResult = await runGetItemDetails(input);
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
            case "propose_delete_item": {
              const itemType = input.itemType === "story" || input.itemType === "bug" ? input.itemType : null;
              const itemId = typeof input.itemId === "string" ? input.itemId : "";

              if (!itemType || !itemId) {
                toolResult = {
                  result: "itemType doit être 'story' ou 'bug', et itemId est obligatoire.",
                  isError: true,
                };
                break;
              }

              const details = await runGetItemDetails({ itemType, itemId });
              const item = details.result as Record<string, unknown> | null;

              if (details.isError || !item || typeof item !== "object") {
                toolResult = {
                  result: `Item introuvable (${itemType} ${itemId}). Vérifie l'identifiant avec search_backlog ou get_item_details avant de proposer une suppression.`,
                  isError: true,
                };
                break;
              }

              const proposal: Proposal = {
                type: "delete_item",
                itemType,
                itemId,
                ...(typeof input.reason === "string" && input.reason ? { reason: input.reason } : {}),
                itemSnapshot: {
                  title: String(item.title ?? ""),
                  ...(typeof item.statusColumnId === "string" ? { statusColumnId: item.statusColumnId } : {}),
                  ...(typeof item.severity === "string" ? { severity: item.severity } : {}),
                  ...(item.storyPoints !== undefined
                    ? { storyPoints: item.storyPoints as number | null }
                    : {}),
                },
              };
              proposals.push(proposal);
              toolResult = {
                result: {
                  status: "proposition_enregistrée",
                  proposal,
                  note: "Cet item n'a pas été supprimé. Cette proposition attend la validation de l'utilisateur dans l'interface.",
                },
                isError: false,
              };
              break;
            }
            default:
              toolResult = { result: `Outil inconnu : ${block.name}`, isError: true };
          }
        } catch (error) {
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? (error as { status: unknown }).status
              : undefined;
          const responseBody =
            typeof error === "object" && error !== null && "body" in error
              ? (error as { body: unknown }).body
              : undefined;
          console.error(
            `Outil ${block.name} a levé une exception inattendue — input:`,
            input,
            "statut HTTP:",
            status ?? "n/a",
            "corps de la réponse:",
            responseBody ?? "n/a",
            "erreur:",
            error
          );
          toolResult = {
            result: `Erreur inattendue lors de l'exécution de l'outil ${block.name} : ${
              error instanceof Error ? error.message : String(error)
            }`,
            isError: true,
          };
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

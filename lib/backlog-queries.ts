import { prisma } from "@/lib/prisma";
import { embedText, VoyageError } from "@/lib/voyage";
import { ItemType } from "@/app/generated/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";

export { VoyageError };

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const ALL_ITEM_TYPES = Object.values(ItemType);

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type SearchBacklogResult = {
  itemType: ItemType;
  score: number;
  item: unknown;
};

export type SearchBacklogOptions = {
  limit?: number;
  itemTypes?: ItemType[];
};

/**
 * Recherche sémantique (RAG) dans le backlog par similarité cosinus sur les
 * embeddings stockés en base. Peut lancer une VoyageError (service Voyage AI
 * indisponible) : à charge de l'appelant de la traduire en réponse adaptée à
 * son propre contexte (route HTTP, outil de l'agent...).
 */
export async function searchBacklog(
  query: string,
  options: SearchBacklogOptions = {}
): Promise<SearchBacklogResult[]> {
  const limit = Math.min(options.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
  const itemTypes =
    options.itemTypes && options.itemTypes.length > 0 ? options.itemTypes : ALL_ITEM_TYPES;

  const embeddings = await prisma.embedding.findMany({
    where: { itemType: { in: itemTypes } },
  });

  if (embeddings.length === 0) return [];

  const queryVector = await embedText(query, "query");

  const scored = embeddings
    .map((embedding) => ({
      itemType: embedding.itemType,
      itemId: embedding.itemId,
      score: cosineSimilarity(queryVector, JSON.parse(embedding.vector) as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const idsByType = new Map<ItemType, string[]>();
  for (const result of scored) {
    const ids = idsByType.get(result.itemType) ?? [];
    ids.push(result.itemId);
    idsByType.set(result.itemType, ids);
  }

  const storyIds = idsByType.get(ItemType.STORY) ?? [];
  const bugIds = idsByType.get(ItemType.BUG) ?? [];
  const epicIds = idsByType.get(ItemType.EPIC) ?? [];

  const [stories, bugs, epics] = await Promise.all([
    storyIds.length > 0
      ? prisma.story.findMany({ where: { id: { in: storyIds } }, include: { statusColumn: true } })
      : Promise.resolve([]),
    bugIds.length > 0
      ? prisma.bug.findMany({ where: { id: { in: bugIds } }, include: { statusColumn: true } })
      : Promise.resolve([]),
    epicIds.length > 0 ? prisma.epic.findMany({ where: { id: { in: epicIds } } }) : Promise.resolve([]),
  ]);

  const itemByKey = new Map<string, unknown>();
  for (const story of stories) itemByKey.set(`STORY:${story.id}`, story);
  for (const bug of bugs) itemByKey.set(`BUG:${bug.id}`, bug);
  for (const epic of epics) itemByKey.set(`EPIC:${epic.id}`, epic);

  return scored
    .map((result): SearchBacklogResult | null => {
      const item = itemByKey.get(`${result.itemType}:${result.itemId}`);
      // Embedding orphelin : l'item source a été supprimé depuis la génération de l'embedding.
      if (!item) return null;
      return { itemType: result.itemType, score: result.score, item };
    })
    .filter((result): result is SearchBacklogResult => result !== null);
}

export type StoryWithEpic = Prisma.StoryGetPayload<{ include: { epic: true; statusColumn: true } }>;
export type EpicWithStories = Prisma.EpicGetPayload<{ include: { stories: true } }>;

export function getStoryById(id: string): Promise<StoryWithEpic | null> {
  return prisma.story.findUnique({ where: { id }, include: { epic: true, statusColumn: true } });
}

export function getBugById(id: string) {
  return prisma.bug.findUnique({ where: { id }, include: { statusColumn: true } });
}

export function getEpicById(id: string): Promise<EpicWithStories | null> {
  return prisma.epic.findUnique({ where: { id }, include: { stories: true } });
}

export type BacklogItemType = "story" | "bug" | "epic";

/** Dispatch par type pour l'outil get_item_details de l'agent et les routes de détail. */
export function getItemDetails(itemType: BacklogItemType, itemId: string) {
  switch (itemType) {
    case "story":
      return getStoryById(itemId);
    case "bug":
      return getBugById(itemId);
    case "epic":
      return getEpicById(itemId);
  }
}

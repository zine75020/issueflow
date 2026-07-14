import { prisma } from "@/lib/prisma";
import { embedText, VOYAGE_EMBEDDING_MODEL } from "@/lib/voyage";
import { ItemType } from "@/app/generated/prisma/client";

type EmbeddableItem = {
  title: string;
  description: string;
  acceptanceCriteria?: string | null;
};

export function buildEmbeddingText(itemType: ItemType, item: EmbeddableItem): string {
  const parts = [item.title, item.description];
  if (itemType === ItemType.STORY && item.acceptanceCriteria) {
    parts.push(item.acceptanceCriteria);
  }
  return parts.filter((part) => part && part.trim().length > 0).join("\n\n");
}

async function upsertEmbedding(
  itemType: ItemType,
  itemId: string,
  text: string
): Promise<void> {
  try {
    const vector = await embedText(text, "document");
    await prisma.embedding.upsert({
      where: { itemType_itemId: { itemType, itemId } },
      create: {
        itemType,
        itemId,
        vector: JSON.stringify(vector),
        model: VOYAGE_EMBEDDING_MODEL,
      },
      update: {
        vector: JSON.stringify(vector),
        model: VOYAGE_EMBEDDING_MODEL,
      },
    });
  } catch (error) {
    console.error(`Échec de la génération d'embedding pour ${itemType} ${itemId} :`, error);
  }
}

/** Lance la génération d'embedding en arrière-plan, sans bloquer la réponse HTTP appelante. */
export function scheduleEmbedding(itemType: ItemType, itemId: string, text: string): void {
  void upsertEmbedding(itemType, itemId, text);
}

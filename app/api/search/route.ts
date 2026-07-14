import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { embedText, VoyageError } from "@/lib/voyage";
import { ItemType } from "@/app/generated/prisma/client";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Le paramètre q est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  let limit = DEFAULT_LIMIT;
  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "Le paramètre limit doit être un entier positif." },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  let itemTypes: ItemType[] = ALL_ITEM_TYPES;
  const typesParam = searchParams.get("types");
  if (typesParam !== null && typesParam.trim().length > 0) {
    const requested = typesParam.split(",").map((t) => t.trim().toUpperCase());
    const invalid = requested.filter((t) => !ALL_ITEM_TYPES.includes(t as ItemType));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Valeur(s) invalide(s) pour types : ${invalid.join(", ")}. Valeurs autorisées : ${ALL_ITEM_TYPES.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    itemTypes = requested as ItemType[];
  }

  try {
    const embeddings = await prisma.embedding.findMany({
      where: { itemType: { in: itemTypes } },
    });

    if (embeddings.length === 0) {
      return NextResponse.json([]);
    }

    let queryVector: number[];
    try {
      queryVector = await embedText(q, "query");
    } catch (error) {
      console.error("GET /api/search: échec de l'appel Voyage AI:", error);
      const message =
        error instanceof VoyageError
          ? error.message
          : "Erreur inconnue lors de l'appel à Voyage AI.";
      return NextResponse.json(
        {
          error: `Le service de recherche sémantique (Voyage AI) est momentanément indisponible : ${message}`,
        },
        { status: 503 }
      );
    }

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
        ? prisma.story.findMany({ where: { id: { in: storyIds } } })
        : Promise.resolve([]),
      bugIds.length > 0
        ? prisma.bug.findMany({ where: { id: { in: bugIds } } })
        : Promise.resolve([]),
      epicIds.length > 0
        ? prisma.epic.findMany({ where: { id: { in: epicIds } } })
        : Promise.resolve([]),
    ]);

    const itemByKey = new Map<string, unknown>();
    for (const story of stories) itemByKey.set(`STORY:${story.id}`, story);
    for (const bug of bugs) itemByKey.set(`BUG:${bug.id}`, bug);
    for (const epic of epics) itemByKey.set(`EPIC:${epic.id}`, epic);

    const results = scored
      .map((result) => {
        const item = itemByKey.get(`${result.itemType}:${result.itemId}`);
        // Embedding orphelin : l'item source a été supprimé depuis la génération de l'embedding.
        if (!item) return null;
        return {
          itemType: result.itemType,
          score: result.score,
          item,
        };
      })
      .filter((result): result is NonNullable<typeof result> => result !== null);

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/search failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche sémantique." },
      { status: 500 }
    );
  }
}

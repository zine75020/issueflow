import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ItemType } from "@/app/generated/prisma/client";

type CoverageStats = { total: number; upToDate: number };

async function computeCoverage(
  itemType: ItemType,
  items: { id: string; updatedAt: Date }[]
): Promise<CoverageStats> {
  const embeddings = await prisma.embedding.findMany({
    where: { itemType },
    select: { itemId: true, updatedAt: true },
  });
  const embeddingByItemId = new Map(embeddings.map((e) => [e.itemId, e.updatedAt]));

  const upToDate = items.filter((item) => {
    const embeddedAt = embeddingByItemId.get(item.id);
    return embeddedAt !== undefined && embeddedAt >= item.updatedAt;
  }).length;

  return { total: items.length, upToDate };
}

export async function GET() {
  try {
    const [stories, bugs, epics] = await Promise.all([
      prisma.story.findMany({ select: { id: true, updatedAt: true } }),
      prisma.bug.findMany({ select: { id: true, updatedAt: true } }),
      prisma.epic.findMany({ select: { id: true, updatedAt: true } }),
    ]);

    const [story, bug, epic] = await Promise.all([
      computeCoverage(ItemType.STORY, stories),
      computeCoverage(ItemType.BUG, bugs),
      computeCoverage(ItemType.EPIC, epics),
    ]);

    return NextResponse.json({ story, bug, epic });
  } catch (error) {
    console.error("GET /api/embeddings/status failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération du statut des embeddings." },
      { status: 500 }
    );
  }
}

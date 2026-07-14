import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { ItemType } from "@/app/generated/prisma/client";

export type EpicWithStoryCount = Prisma.EpicGetPayload<{
  include: { _count: { select: { stories: true } } };
}>;

export async function GET() {
  try {
    const epics: EpicWithStoryCount[] = await prisma.epic.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { stories: true } } },
    });

    return NextResponse.json(epics);
  } catch (error) {
    console.error("GET /api/epics failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des epics." },
      { status: 500 }
    );
  }
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

  const { title, description } = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
  };

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "Le champ title est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  if (title.trim().length > TITLE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ title ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json(
      { error: "Le champ description doit être une chaîne de caractères." },
      { status: 400 }
    );
  }

  if (typeof description === "string" && description.length > TEXT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ description ne peut pas dépasser ${TEXT_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  try {
    const epic = await prisma.epic.create({
      data: {
        title: title.trim(),
        description: description ?? "",
      },
    });

    scheduleEmbedding(ItemType.EPIC, epic.id, buildEmbeddingText(ItemType.EPIC, epic));

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    console.error("POST /api/epics failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création de l'epic." },
      { status: 500 }
    );
  }
}

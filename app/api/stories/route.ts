import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { FIBONACCI_VALUES, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH, isFibonacciValue } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { ItemType } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const epicId = searchParams.get("epicId");
    const sprintId = searchParams.get("sprintId");
    const backlogOnly = searchParams.get("backlog") === "true";

    const where: Prisma.StoryWhereInput = {};
    if (epicId) where.epicId = epicId;
    if (backlogOnly) {
      where.sprintId = null;
    } else if (sprintId) {
      where.sprintId = sprintId;
    }

    const stories = await prisma.story.findMany({
      where,
      orderBy: { backlogPosition: "asc" },
    });

    return NextResponse.json(stories);
  } catch (error) {
    console.error("GET /api/stories failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des stories." },
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

  const {
    title,
    description,
    acceptanceCriteria,
    storyPoints,
    remainingEffort,
    epicId,
    sprintId,
    statusColumnId,
  } = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    acceptanceCriteria?: unknown;
    storyPoints?: unknown;
    remainingEffort?: unknown;
    epicId?: unknown;
    sprintId?: unknown;
    statusColumnId?: unknown;
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

  if (typeof description !== "string") {
    return NextResponse.json(
      { error: "Le champ description est obligatoire et doit être une chaîne de caractères." },
      { status: 400 }
    );
  }

  if (description.length > TEXT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ description ne peut pas dépasser ${TEXT_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  if (typeof acceptanceCriteria !== "string") {
    return NextResponse.json(
      {
        error:
          "Le champ acceptanceCriteria est obligatoire et doit être une chaîne de caractères.",
      },
      { status: 400 }
    );
  }

  if (acceptanceCriteria.length > TEXT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ acceptanceCriteria ne peut pas dépasser ${TEXT_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  if (
    storyPoints !== undefined &&
    storyPoints !== null &&
    (typeof storyPoints !== "number" || !isFibonacciValue(storyPoints))
  ) {
    return NextResponse.json(
      { error: `Le champ storyPoints doit être l'une des valeurs suivantes : ${FIBONACCI_VALUES.join(", ")}, ou être vide.` },
      { status: 400 }
    );
  }

  if (
    remainingEffort !== undefined &&
    remainingEffort !== null &&
    (typeof remainingEffort !== "number" || !isFibonacciValue(remainingEffort))
  ) {
    return NextResponse.json(
      { error: `Le champ remainingEffort doit être l'une des valeurs suivantes : ${FIBONACCI_VALUES.join(", ")}, ou être vide.` },
      { status: 400 }
    );
  }

  if (
    epicId !== undefined &&
    epicId !== null &&
    typeof epicId !== "string"
  ) {
    return NextResponse.json(
      { error: "Le champ epicId doit être une chaîne de caractères." },
      { status: 400 }
    );
  }

  if (
    sprintId !== undefined &&
    sprintId !== null &&
    typeof sprintId !== "string"
  ) {
    return NextResponse.json(
      { error: "Le champ sprintId doit être une chaîne de caractères." },
      { status: 400 }
    );
  }

  if (statusColumnId !== undefined && typeof statusColumnId !== "string") {
    return NextResponse.json(
      { error: "Le champ statusColumnId doit être une chaîne de caractères." },
      { status: 400 }
    );
  }

  try {
    let resolvedStatusColumnId: string;
    if (statusColumnId) {
      const column = await prisma.boardColumn.findUnique({
        where: { id: statusColumnId },
      });
      if (!column) {
        return NextResponse.json(
          { error: "Colonne (statusColumnId) introuvable." },
          { status: 404 }
        );
      }
      resolvedStatusColumnId = column.id;
    } else {
      const startColumn = await prisma.boardColumn.findFirst({
        where: { isLocked: true },
        orderBy: { order: "asc" },
      });
      if (!startColumn) {
        return NextResponse.json(
          { error: "Aucune colonne de départ n'est configurée." },
          { status: 500 }
        );
      }
      resolvedStatusColumnId = startColumn.id;
    }

    if (epicId) {
      const epic = await prisma.epic.findUnique({ where: { id: epicId } });
      if (!epic) {
        return NextResponse.json(
          { error: "Epic introuvable." },
          { status: 404 }
        );
      }
    }

    if (sprintId) {
      const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
      if (!sprint) {
        return NextResponse.json(
          { error: "Sprint introuvable." },
          { status: 404 }
        );
      }
    }

    const { _max } = await prisma.story.aggregate({
      where: { sprintId: null },
      _max: { backlogPosition: true },
    });
    const backlogPosition = (_max.backlogPosition ?? 0) + 1;

    const story = await prisma.story.create({
      data: {
        title: title.trim(),
        description,
        acceptanceCriteria,
        storyPoints: storyPoints ?? null,
        remainingEffort: remainingEffort ?? null,
        epicId: epicId ?? null,
        sprintId: sprintId ?? null,
        statusColumnId: resolvedStatusColumnId,
        backlogPosition,
      },
    });

    scheduleEmbedding(ItemType.STORY, story.id, buildEmbeddingText(ItemType.STORY, story));

    return NextResponse.json(story, { status: 201 });
  } catch (error) {
    console.error("POST /api/stories failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création de la story." },
      { status: 500 }
    );
  }
}

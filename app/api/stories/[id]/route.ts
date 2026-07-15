import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { FIBONACCI_VALUES, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH, isFibonacciValue } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { getStoryById } from "@/lib/backlog-queries";
import { ItemType } from "@/app/generated/prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const story = await getStoryById(id);

    if (!story) {
      return NextResponse.json(
        { error: "Story introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(story);
  } catch (error) {
    console.error(`GET /api/stories/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération de la story." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

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
    statusColumnId,
    epicId,
    sprintId,
    backlogPosition,
  } = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    acceptanceCriteria?: unknown;
    storyPoints?: unknown;
    remainingEffort?: unknown;
    statusColumnId?: unknown;
    epicId?: unknown;
    sprintId?: unknown;
    backlogPosition?: unknown;
  };

  const data: Prisma.StoryUncheckedUpdateInput = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Le champ title ne peut pas être vide." },
        { status: 400 }
      );
    }
    if (title.trim().length > TITLE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Le champ title ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères.` },
        { status: 400 }
      );
    }
    data.title = title.trim();
  }

  if (description !== undefined) {
    if (typeof description !== "string") {
      return NextResponse.json(
        { error: "Le champ description doit être une chaîne de caractères." },
        { status: 400 }
      );
    }
    if (description.length > TEXT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Le champ description ne peut pas dépasser ${TEXT_MAX_LENGTH} caractères.` },
        { status: 400 }
      );
    }
    data.description = description;
  }

  if (acceptanceCriteria !== undefined) {
    if (typeof acceptanceCriteria !== "string") {
      return NextResponse.json(
        {
          error:
            "Le champ acceptanceCriteria doit être une chaîne de caractères.",
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
    data.acceptanceCriteria = acceptanceCriteria;
  }

  if (storyPoints !== undefined) {
    if (
      storyPoints !== null &&
      (typeof storyPoints !== "number" || !isFibonacciValue(storyPoints))
    ) {
      return NextResponse.json(
        { error: `Le champ storyPoints doit être l'une des valeurs suivantes : ${FIBONACCI_VALUES.join(", ")}, ou null.` },
        { status: 400 }
      );
    }
    data.storyPoints = storyPoints;
  }

  if (remainingEffort !== undefined) {
    if (
      remainingEffort !== null &&
      (typeof remainingEffort !== "number" || !isFibonacciValue(remainingEffort))
    ) {
      return NextResponse.json(
        { error: `Le champ remainingEffort doit être l'une des valeurs suivantes : ${FIBONACCI_VALUES.join(", ")}, ou null.` },
        { status: 400 }
      );
    }
    data.remainingEffort = remainingEffort;
  }

  if (statusColumnId !== undefined) {
    if (typeof statusColumnId !== "string" || statusColumnId.length === 0) {
      return NextResponse.json(
        { error: "Le champ statusColumnId doit être une chaîne de caractères non vide." },
        { status: 400 }
      );
    }
    data.statusColumnId = statusColumnId;
  }

  if (backlogPosition !== undefined) {
    if (
      typeof backlogPosition !== "number" ||
      !Number.isInteger(backlogPosition)
    ) {
      return NextResponse.json(
        { error: "Le champ backlogPosition doit être un nombre entier." },
        { status: 400 }
      );
    }
    data.backlogPosition = backlogPosition;
  }

  if (epicId !== undefined) {
    if (epicId !== null && typeof epicId !== "string") {
      return NextResponse.json(
        { error: "Le champ epicId doit être une chaîne de caractères ou null." },
        { status: 400 }
      );
    }
    data.epicId = epicId;
  }

  if (sprintId !== undefined) {
    if (sprintId !== null && typeof sprintId !== "string") {
      return NextResponse.json(
        { error: "Le champ sprintId doit être une chaîne de caractères ou null." },
        { status: 400 }
      );
    }
    data.sprintId = sprintId;
  }

  try {
    const existing = await prisma.story.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Story introuvable." },
        { status: 404 }
      );
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

    if (statusColumnId !== undefined) {
      const column = await prisma.boardColumn.findUnique({
        where: { id: statusColumnId as string },
      });
      if (!column) {
        return NextResponse.json(
          { error: "Colonne (statusColumnId) introuvable." },
          { status: 404 }
        );
      }
    }

    const story = await prisma.story.update({
      where: { id },
      data,
    });

    scheduleEmbedding(ItemType.STORY, story.id, buildEmbeddingText(ItemType.STORY, story));

    return NextResponse.json(story);
  } catch (error) {
    console.error(`PATCH /api/stories/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour de la story." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.story.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Story introuvable." },
        { status: 404 }
      );
    }

    await prisma.story.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/stories/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression de la story." },
      { status: 500 }
    );
  }
}

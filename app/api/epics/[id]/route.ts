import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, Status } from "@/app/generated/prisma/client";
import { TITLE_MAX_LENGTH, TEXT_MAX_LENGTH } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { ItemType } from "@/app/generated/prisma/client";

export type EpicWithStories = Prisma.EpicGetPayload<{
  include: { stories: true };
}>;

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_VALUES = Object.values(Status);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const epic: EpicWithStories | null = await prisma.epic.findUnique({
      where: { id },
      include: { stories: true },
    });

    if (!epic) {
      return NextResponse.json(
        { error: "Epic introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(epic);
  } catch (error) {
    console.error(`GET /api/epics/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération de l'epic." },
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

  const { title, description, status } = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    status?: unknown;
  };

  const data: Prisma.EpicUpdateInput = {};

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

  if (status !== undefined) {
    if (
      typeof status !== "string" ||
      !STATUS_VALUES.includes(status as Status)
    ) {
      return NextResponse.json(
        {
          error: `Le champ status doit être l'une des valeurs suivantes : ${STATUS_VALUES.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    data.status = status as Status;
  }

  try {
    const existing = await prisma.epic.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Epic introuvable." },
        { status: 404 }
      );
    }

    const epic = await prisma.epic.update({
      where: { id },
      data,
    });

    scheduleEmbedding(ItemType.EPIC, epic.id, buildEmbeddingText(ItemType.EPIC, epic));

    return NextResponse.json(epic);
  } catch (error) {
    console.error(`PATCH /api/epics/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour de l'epic." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.epic.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Epic introuvable." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.story.updateMany({
        where: { epicId: id },
        data: { epicId: null },
      }),
      prisma.epic.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/epics/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression de l'epic." },
      { status: 500 }
    );
  }
}

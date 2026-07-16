import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, Severity } from "@/app/generated/prisma/client";
import { FIBONACCI_VALUES, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH, isFibonacciValue } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { getBugById } from "@/lib/backlog-queries";
import { deleteAttachmentBlobs } from "@/lib/attachments";
import { ItemType } from "@/app/generated/prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const SEVERITY_VALUES = Object.values(Severity);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const bug = await getBugById(id);

    if (!bug) {
      return NextResponse.json(
        { error: "Bug introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(bug);
  } catch (error) {
    console.error(`GET /api/bugs/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération du bug." },
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
    severity,
    remainingEffort,
    statusColumnId,
    sprintId,
    backlogPosition,
  } = (body ?? {}) as {
    title?: unknown;
    description?: unknown;
    severity?: unknown;
    remainingEffort?: unknown;
    statusColumnId?: unknown;
    sprintId?: unknown;
    backlogPosition?: unknown;
  };

  const data: Prisma.BugUncheckedUpdateInput = {};

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

  if (severity !== undefined) {
    if (
      typeof severity !== "string" ||
      !SEVERITY_VALUES.includes(severity as Severity)
    ) {
      return NextResponse.json(
        {
          error: `Le champ severity doit être l'une des valeurs suivantes : ${SEVERITY_VALUES.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    data.severity = severity as Severity;
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

  if (sprintId !== undefined) {
    if (sprintId !== null && typeof sprintId !== "string") {
      return NextResponse.json(
        {
          error: "Le champ sprintId doit être une chaîne de caractères ou null.",
        },
        { status: 400 }
      );
    }
    data.sprintId = sprintId;
  }

  try {
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Bug introuvable." },
        { status: 404 }
      );
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

    const bug = await prisma.bug.update({
      where: { id },
      data,
    });

    scheduleEmbedding(ItemType.BUG, bug.id, buildEmbeddingText(ItemType.BUG, bug));

    return NextResponse.json(bug);
  } catch (error) {
    console.error(`PATCH /api/bugs/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour du bug." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.bug.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Bug introuvable." },
        { status: 404 }
      );
    }

    // Voir le commentaire équivalent dans DELETE /api/stories/[id] : cascade DB automatique
    // via Prisma, mais les blobs Vercel Blob doivent être supprimés explicitement, en
    // best-effort pour ne pas bloquer la suppression du bug si un blob ne répond pas.
    const attachments = await prisma.attachment.findMany({
      where: { bugId: id },
      select: { url: true },
    });
    if (attachments.length > 0) {
      try {
        await deleteAttachmentBlobs(attachments.map((a) => a.url));
      } catch (error) {
        console.error(`Échec de la suppression des blobs du bug ${id}:`, error);
      }
    }

    await prisma.bug.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/bugs/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression du bug." },
      { status: 500 }
    );
  }
}

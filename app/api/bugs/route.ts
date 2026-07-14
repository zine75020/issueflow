import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, Severity } from "@/app/generated/prisma/client";
import { FIBONACCI_VALUES, TITLE_MAX_LENGTH, TEXT_MAX_LENGTH, isFibonacciValue } from "@/lib/constants";
import { buildEmbeddingText, scheduleEmbedding } from "@/lib/embeddings";
import { ItemType } from "@/app/generated/prisma/client";

const SEVERITY_VALUES = Object.values(Severity);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sprintId = searchParams.get("sprintId");
    const backlogOnly = searchParams.get("backlog") === "true";

    const where: Prisma.BugWhereInput = {};
    if (backlogOnly) {
      where.sprintId = null;
    } else if (sprintId) {
      where.sprintId = sprintId;
    }

    const bugs = await prisma.bug.findMany({
      where,
      orderBy: { backlogPosition: "asc" },
    });

    return NextResponse.json(bugs);
  } catch (error) {
    console.error("GET /api/bugs failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des bugs." },
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

  const { title, description, severity, remainingEffort, sprintId, statusColumnId } =
    (body ?? {}) as {
      title?: unknown;
      description?: unknown;
      severity?: unknown;
      remainingEffort?: unknown;
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
      {
        error:
          "Le champ description est obligatoire et doit être une chaîne de caractères.",
      },
      { status: 400 }
    );
  }

  if (description.length > TEXT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ description ne peut pas dépasser ${TEXT_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  if (
    typeof severity !== "string" ||
    !SEVERITY_VALUES.includes(severity as Severity)
  ) {
    return NextResponse.json(
      {
        error: `Le champ severity est obligatoire et doit être l'une des valeurs suivantes : ${SEVERITY_VALUES.join(", ")}.`,
      },
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
    if (sprintId) {
      const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
      if (!sprint) {
        return NextResponse.json(
          { error: "Sprint introuvable." },
          { status: 404 }
        );
      }
    }

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

    // Chaque type d'item (Bug, Story) a son propre espace de numérotation
    // de backlogPosition : ce sont deux tables distinctes, donc un simple
    // MAX(backlogPosition)+1 par table est suffisant et évite d'avoir à
    // synchroniser un compteur partagé entre modèles.
    const { _max } = await prisma.bug.aggregate({
      where: { sprintId: null },
      _max: { backlogPosition: true },
    });
    const backlogPosition = (_max.backlogPosition ?? 0) + 1;

    const bug = await prisma.bug.create({
      data: {
        title: title.trim(),
        description,
        severity: severity as Severity,
        remainingEffort: remainingEffort ?? null,
        sprintId: sprintId ?? null,
        statusColumnId: resolvedStatusColumnId,
        backlogPosition,
      },
    });

    scheduleEmbedding(ItemType.BUG, bug.id, buildEmbeddingText(ItemType.BUG, bug));

    return NextResponse.json(bug, { status: 201 });
  } catch (error) {
    console.error("POST /api/bugs failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création du bug." },
      { status: 500 }
    );
  }
}

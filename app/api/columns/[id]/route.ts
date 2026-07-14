import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

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

  const { name, order } = (body ?? {}) as { name?: unknown; order?: unknown };

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "Le champ name ne peut pas être vide." },
      { status: 400 }
    );
  }

  if (
    order !== undefined &&
    (typeof order !== "number" || !Number.isInteger(order) || order < 0)
  ) {
    return NextResponse.json(
      { error: "Le champ order doit être un nombre entier positif ou nul." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.boardColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Colonne introuvable." },
        { status: 404 }
      );
    }

    if (name !== undefined && existing.isLocked) {
      return NextResponse.json(
        { error: "Impossible de renommer une colonne verrouillée." },
        { status: 400 }
      );
    }

    let result;

    if (order !== undefined) {
      const columns = await prisma.boardColumn.findMany({
        orderBy: { order: "asc" },
      });
      const others = columns.filter((c) => c.id !== id);
      const clampedIndex = Math.max(0, Math.min(order, others.length));
      others.splice(clampedIndex, 0, existing);

      await prisma.$transaction(
        others.map((col, index) =>
          prisma.boardColumn.update({
            where: { id: col.id },
            data: {
              order: index,
              ...(col.id === id && name !== undefined
                ? { name: (name as string).trim() }
                : {}),
            },
          })
        )
      );

      result = await prisma.boardColumn.findUnique({ where: { id } });
    } else if (name !== undefined) {
      result = await prisma.boardColumn.update({
        where: { id },
        data: { name: (name as string).trim() },
      });
    } else {
      result = existing;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`PATCH /api/columns/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour de la colonne." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.boardColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Colonne introuvable." },
        { status: 404 }
      );
    }

    if (existing.isLocked) {
      return NextResponse.json(
        { error: "Impossible de supprimer une colonne verrouillée." },
        { status: 400 }
      );
    }

    const startColumn = await prisma.boardColumn.findFirst({
      where: { isLocked: true },
      orderBy: { order: "asc" },
    });

    if (!startColumn) {
      return NextResponse.json(
        { error: "Colonne de départ introuvable." },
        { status: 500 }
      );
    }

    await prisma.$transaction([
      prisma.story.updateMany({
        where: { statusColumnId: id },
        data: { statusColumnId: startColumn.id },
      }),
      prisma.bug.updateMany({
        where: { statusColumnId: id },
        data: { statusColumnId: startColumn.id },
      }),
      prisma.boardColumn.delete({ where: { id } }),
      prisma.boardColumn.updateMany({
        where: { order: { gt: existing.order } },
        data: { order: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/columns/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression de la colonne." },
      { status: 500 }
    );
  }
}

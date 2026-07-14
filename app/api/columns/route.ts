import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const columns = await prisma.boardColumn.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(columns);
  } catch (error) {
    console.error("GET /api/columns failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des colonnes." },
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

  const { name, afterColumnId } = (body ?? {}) as {
    name?: unknown;
    afterColumnId?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Le champ name est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  if (typeof afterColumnId !== "string" || afterColumnId.trim().length === 0) {
    return NextResponse.json(
      { error: "Le champ afterColumnId est obligatoire." },
      { status: 400 }
    );
  }

  try {
    const columns = await prisma.boardColumn.findMany({
      orderBy: { order: "asc" },
    });

    const afterColumn = columns.find((c) => c.id === afterColumnId);
    if (!afterColumn) {
      return NextResponse.json(
        { error: "La colonne de référence (afterColumnId) n'existe pas." },
        { status: 400 }
      );
    }

    // Rien ne peut être inséré avant la première colonne verrouillée : comme
    // l'API n'insère qu'"après" une colonne existante et que la première
    // colonne (verrouillée) a toujours l'order le plus bas, ce cas est
    // structurellement inatteignable ici — seul le cas symétrique
    // (insertion après la dernière colonne verrouillée) est réellement
    // possible et doit être explicitement refusé.
    const lastColumn = columns[columns.length - 1];
    if (afterColumn.id === lastColumn.id) {
      return NextResponse.json(
        {
          error:
            "Impossible d'insérer une colonne après la dernière colonne (verrouillée).",
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.boardColumn.updateMany({
        where: { order: { gt: afterColumn.order } },
        data: { order: { increment: 1 } },
      });

      return tx.boardColumn.create({
        data: {
          name: name.trim(),
          order: afterColumn.order + 1,
          isLocked: false,
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/columns failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création de la colonne." },
      { status: 500 }
    );
  }
}

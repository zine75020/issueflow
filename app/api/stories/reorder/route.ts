import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide." },
      { status: 400 }
    );
  }

  const { orderedIds } = (body ?? {}) as { orderedIds?: unknown };

  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    !orderedIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return NextResponse.json(
      {
        error:
          "Le champ orderedIds doit être un tableau non vide d'identifiants (chaînes de caractères).",
      },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.story.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((story) => story.id));
    const missingIds = orderedIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error: `Les stories suivantes n'existent pas : ${missingIds.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.story.update({
          where: { id },
          data: { backlogPosition: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true, updated: orderedIds.length });
  } catch (error) {
    console.error("PATCH /api/stories/reorder failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la réorganisation du backlog." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.sprint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Sprint introuvable." },
        { status: 404 }
      );
    }

    if (existing.completedAt) {
      return NextResponse.json(
        { error: "Ce sprint est déjà terminé." },
        { status: 400 }
      );
    }

    const sprint = await prisma.sprint.update({
      where: { id },
      data: {
        completedAt: new Date(),
        isActive: false,
      },
    });

    return NextResponse.json(sprint);
  } catch (error) {
    console.error(`PATCH /api/sprints/${id}/complete failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la clôture du sprint." },
      { status: 500 }
    );
  }
}

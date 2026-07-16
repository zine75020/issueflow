import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Commentaire introuvable." },
        { status: 404 }
      );
    }

    await prisma.comment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/comments/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression du commentaire." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteAttachmentBlobs } from "@/lib/attachments";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.attachment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });
    }

    // Suppression individuelle explicitement demandée par l'utilisateur : si le blob ne
    // peut pas être supprimé, on n'efface pas la ligne en base non plus (sinon l'entrée
    // disparaît de l'UI alors que le fichier reste stocké, sans plus aucun moyen de le
    // retrouver pour réessayer). Contraste avec la suppression en masse d'un item entier,
    // où bloquer toute la suppression pour un seul blob en échec serait pire.
    try {
      await deleteAttachmentBlobs([existing.url]);
    } catch (error) {
      console.error(`Échec de la suppression du blob pour l'attachment ${id}:`, error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du fichier sur le stockage. Réessaie." },
        { status: 500 }
      );
    }

    await prisma.attachment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/attachments/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression de la pièce jointe." },
      { status: 500 }
    );
  }
}

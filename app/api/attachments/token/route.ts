import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_PER_ITEM,
  ATTACHMENT_MAX_SIZE_BYTES,
} from "@/lib/constants";

/**
 * Génère le token client à usage unique dont @vercel/blob a besoin pour uploader
 * directement depuis le navigateur vers Vercel Blob, sans repasser par notre serveur
 * (contourne la limite de taille de requête des fonctions Vercel). Les octets réels du
 * fichier ne transitent donc jamais ici : la vraie validation de contenu (magic bytes)
 * a lieu après coup dans POST /api/attachments, une fois le blob effectivement stocké.
 * Ici, on ne peut valider que ce que le client déclare (taille, type, item cible) —
 * dernier filet avant de gaspiller du quota sur un upload qui sera de toute façon rejeté.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        let storyId: string | undefined;
        let bugId: string | undefined;
        try {
          const parsed = JSON.parse(clientPayloadRaw ?? "{}") as {
            storyId?: unknown;
            bugId?: unknown;
          };
          storyId = typeof parsed.storyId === "string" ? parsed.storyId : undefined;
          bugId = typeof parsed.bugId === "string" ? parsed.bugId : undefined;
        } catch {
          throw new Error("clientPayload invalide.");
        }

        if ((storyId ? 1 : 0) + (bugId ? 1 : 0) !== 1) {
          throw new Error("Il faut fournir exactement un des deux champs storyId ou bugId.");
        }

        if (storyId) {
          const story = await prisma.story.findUnique({ where: { id: storyId } });
          if (!story) throw new Error("Story introuvable.");
        } else if (bugId) {
          const bug = await prisma.bug.findUnique({ where: { id: bugId } });
          if (!bug) throw new Error("Bug introuvable.");
        }

        const count = await prisma.attachment.count({
          where: storyId ? { storyId } : { bugId },
        });
        if (count >= ATTACHMENT_MAX_PER_ITEM) {
          throw new Error(
            `Limite de ${ATTACHMENT_MAX_PER_ITEM} pièces jointes atteinte pour cet item.`
          );
        }

        return {
          allowedContentTypes: [...ATTACHMENT_ALLOWED_MIME_TYPES],
          maximumSizeInBytes: ATTACHMENT_MAX_SIZE_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ storyId, bugId }),
        };
      },
      // La création de l'Attachment en base se fait dans POST /api/attachments, appelé
      // explicitement par le client une fois upload() résolu — pas ici. onUploadCompleted
      // est un webhook serveur-à-serveur déclenché par l'infra Vercel Blob, qui ne
      // fonctionne pas en local (localhost injoignable depuis l'extérieur) : on ne peut
      // donc pas s'y fier pour le chemin critique sans casser le test en développement.
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("POST /api/attachments/token failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la génération du token d'upload." },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { sniffAttachmentMimeType, deleteAttachmentBlobs, BLOB_TOKEN } from "@/lib/attachments";
import {
  ATTACHMENT_MAX_PER_ITEM,
  ATTACHMENT_MAX_SIZE_BYTES,
  TITLE_MAX_LENGTH,
} from "@/lib/constants";

/**
 * Confirme un upload effectué côté client vers Vercel Blob (voir /api/attachments/token
 * et components/AttachmentSection.tsx) : c'est ICI, une fois le fichier réellement stocké,
 * qu'a lieu la seule validation qui fait foi. On ignore tout ce que le client a déclaré
 * (nom, taille, type) sauf pour l'affichage du nom : la taille et le type viennent
 * respectivement de head() (mesuré par Vercel Blob) et d'une lecture des premiers octets
 * du fichier (magic bytes), jamais de ce que le navigateur prétend. En cas de rejet, le
 * blob déjà uploadé est supprimé immédiatement pour ne pas laisser d'orphelin sur le quota.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }

  const { url, filename, storyId, bugId } = (body ?? {}) as {
    url?: unknown;
    filename?: unknown;
    storyId?: unknown;
    bugId?: unknown;
  };

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Le champ url est obligatoire." }, { status: 400 });
  }

  const hasStoryId = typeof storyId === "string" && storyId.length > 0;
  const hasBugId = typeof bugId === "string" && bugId.length > 0;

  if (hasStoryId === hasBugId) {
    return NextResponse.json(
      { error: "Il faut fournir exactement un des deux champs storyId ou bugId." },
      { status: 400 }
    );
  }

  const displayName =
    typeof filename === "string" && filename.trim()
      ? filename.trim().slice(0, TITLE_MAX_LENGTH)
      : "fichier";

  try {
    const blobInfo = await head(url, { token: BLOB_TOKEN });

    if (blobInfo.size > ATTACHMENT_MAX_SIZE_BYTES) {
      await deleteAttachmentBlobs([url]);
      return NextResponse.json(
        { error: `Le fichier dépasse la taille maximale autorisée (${ATTACHMENT_MAX_SIZE_BYTES / (1024 * 1024)} Mo).` },
        { status: 400 }
      );
    }

    const rangeRes = await fetch(url, { headers: { Range: "bytes=0-31" } });
    const headBytes = new Uint8Array(await rangeRes.arrayBuffer());
    const sniffedMimeType = sniffAttachmentMimeType(headBytes);

    if (!sniffedMimeType) {
      await deleteAttachmentBlobs([url]);
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Seuls JPEG, PNG, WebP et PDF sont acceptés." },
        { status: 400 }
      );
    }

    if (hasStoryId) {
      const story = await prisma.story.findUnique({ where: { id: storyId as string } });
      if (!story) {
        await deleteAttachmentBlobs([url]);
        return NextResponse.json({ error: "Story introuvable." }, { status: 404 });
      }
    } else {
      const bug = await prisma.bug.findUnique({ where: { id: bugId as string } });
      if (!bug) {
        await deleteAttachmentBlobs([url]);
        return NextResponse.json({ error: "Bug introuvable." }, { status: 404 });
      }
    }

    const count = await prisma.attachment.count({
      where: hasStoryId ? { storyId: storyId as string } : { bugId: bugId as string },
    });
    if (count >= ATTACHMENT_MAX_PER_ITEM) {
      await deleteAttachmentBlobs([url]);
      return NextResponse.json(
        { error: `Limite de ${ATTACHMENT_MAX_PER_ITEM} pièces jointes atteinte pour cet item.` },
        { status: 400 }
      );
    }

    const attachment = await prisma.attachment.create({
      data: {
        filename: displayName,
        url: blobInfo.url,
        blobPathname: blobInfo.pathname,
        mimeType: sniffedMimeType,
        size: blobInfo.size,
        storyId: hasStoryId ? (storyId as string) : null,
        bugId: hasBugId ? (bugId as string) : null,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("POST /api/attachments failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'enregistrement de la pièce jointe." },
      { status: 500 }
    );
  }
}

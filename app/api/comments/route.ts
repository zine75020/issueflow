import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMMENT_MAX_LENGTH } from "@/lib/constants";

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

  const { content, storyId, bugId } = (body ?? {}) as {
    content?: unknown;
    storyId?: unknown;
    bugId?: unknown;
  };

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Le champ content est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  if (content.trim().length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le champ content ne peut pas dépasser ${COMMENT_MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }

  const hasStoryId = typeof storyId === "string" && storyId.length > 0;
  const hasBugId = typeof bugId === "string" && bugId.length > 0;

  if (hasStoryId === hasBugId) {
    return NextResponse.json(
      { error: "Il faut fournir exactement un des deux champs storyId ou bugId." },
      { status: 400 }
    );
  }

  try {
    if (hasStoryId) {
      const story = await prisma.story.findUnique({ where: { id: storyId as string } });
      if (!story) {
        return NextResponse.json({ error: "Story introuvable." }, { status: 404 });
      }
    } else {
      const bug = await prisma.bug.findUnique({ where: { id: bugId as string } });
      if (!bug) {
        return NextResponse.json({ error: "Bug introuvable." }, { status: 404 });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        storyId: hasStoryId ? (storyId as string) : null,
        bugId: hasBugId ? (bugId as string) : null,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST /api/comments failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création du commentaire." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ItemType } from "@/app/generated/prisma/client";
import { buildEmbeddingText, upsertEmbeddingNow } from "@/lib/embeddings";
import { seedTurso } from "@/prisma/seed-demo.mjs";

export const runtime = "nodejs";
// Vide toutes les tables de contenu puis les repeuple avec le jeu de démo, ce qui
// implique ensuite de régénérer un embedding par item (appels séquentiels à l'API
// Voyage) : dépasse largement la durée par défaut d'une fonction Vercel.
export const maxDuration = 60;

/**
 * Reset quotidien de la base de démo (production, Turso). Le site étant public et
 * partagé entre visiteurs sans isolation par session, ce cron vide puis repeuple le
 * backlog pour repartir d'un état propre chaque jour. Déclenché par Vercel Cron
 * (voir vercel.json) avec le header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  const receivedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  // Diagnostic temporaire (retirer une fois le 401 en prod résolu) : ne logue que des
  // longueurs, jamais les valeurs, pour détecter un espace/retour à la ligne en trop
  // ou une troncature sans exposer le secret.
  console.log(
    `[reset-demo auth] header présent: ${authHeader !== null}, longueur token reçu: ${
      receivedToken?.length ?? "n/a"
    }, longueur CRON_SECRET configuré: ${cronSecret?.length ?? "n/a"}`
  );

  if (!cronSecret || receivedToken !== cronSecret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    // Ordre imposé par les contraintes de clé étrangère (Story/Bug -> BoardColumn en
    // onDelete: Restrict, Story -> Epic, Story/Bug -> Sprint) : on vide les tables qui
    // référencent avant celles qui sont référencées.
    await prisma.embedding.deleteMany();
    await prisma.story.deleteMany();
    await prisma.bug.deleteMany();
    await prisma.sprint.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.boardColumn.deleteMany();

    await seedTurso();

    const [stories, bugs, epics] = await Promise.all([
      prisma.story.findMany(),
      prisma.bug.findMany(),
      prisma.epic.findMany(),
    ]);

    let embeddingsGenerated = 0;
    for (const story of stories) {
      await upsertEmbeddingNow(ItemType.STORY, story.id, buildEmbeddingText(ItemType.STORY, story));
      embeddingsGenerated += 1;
    }
    for (const bug of bugs) {
      await upsertEmbeddingNow(ItemType.BUG, bug.id, buildEmbeddingText(ItemType.BUG, bug));
      embeddingsGenerated += 1;
    }
    for (const epic of epics) {
      await upsertEmbeddingNow(ItemType.EPIC, epic.id, buildEmbeddingText(ItemType.EPIC, epic));
      embeddingsGenerated += 1;
    }

    return NextResponse.json({
      success: true,
      resetAt: new Date().toISOString(),
      epics: epics.length,
      stories: stories.length,
      bugs: bugs.length,
      embeddingsGenerated,
    });
  } catch (error) {
    console.error("GET /api/cron/reset-demo failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du reset de la démo." },
      { status: 500 }
    );
  }
}

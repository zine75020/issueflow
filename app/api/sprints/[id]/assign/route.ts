import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

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

  const { storyIds, bugIds } = (body ?? {}) as {
    storyIds?: unknown;
    bugIds?: unknown;
  };

  if (storyIds !== undefined && !isStringArray(storyIds)) {
    return NextResponse.json(
      { error: "Le champ storyIds doit être un tableau d'identifiants (chaînes de caractères)." },
      { status: 400 }
    );
  }

  if (bugIds !== undefined && !isStringArray(bugIds)) {
    return NextResponse.json(
      { error: "Le champ bugIds doit être un tableau d'identifiants (chaînes de caractères)." },
      { status: 400 }
    );
  }

  const storyIdList = (storyIds as string[] | undefined) ?? [];
  const bugIdList = (bugIds as string[] | undefined) ?? [];

  if (storyIdList.length === 0 && bugIdList.length === 0) {
    return NextResponse.json(
      { error: "Au moins un identifiant doit être fourni dans storyIds ou bugIds." },
      { status: 400 }
    );
  }

  try {
    const sprint = await prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      return NextResponse.json(
        { error: "Sprint introuvable." },
        { status: 404 }
      );
    }

    if (storyIdList.length > 0) {
      const existingStories = await prisma.story.findMany({
        where: { id: { in: storyIdList } },
        select: { id: true },
      });
      const existingIds = new Set(existingStories.map((s) => s.id));
      const missingIds = storyIdList.filter((sid) => !existingIds.has(sid));
      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: `Les stories suivantes n'existent pas : ${missingIds.join(", ")}.` },
          { status: 404 }
        );
      }
    }

    if (bugIdList.length > 0) {
      const existingBugs = await prisma.bug.findMany({
        where: { id: { in: bugIdList } },
        select: { id: true },
      });
      const existingIds = new Set(existingBugs.map((b) => b.id));
      const missingIds = bugIdList.filter((bid) => !existingIds.has(bid));
      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: `Les bugs suivants n'existent pas : ${missingIds.join(", ")}.` },
          { status: 404 }
        );
      }
    }

    await prisma.$transaction([
      ...(storyIdList.length > 0
        ? [
            prisma.story.updateMany({
              where: { id: { in: storyIdList } },
              data: { sprintId: id },
            }),
          ]
        : []),
      ...(bugIdList.length > 0
        ? [
            prisma.bug.updateMany({
              where: { id: { in: bugIdList } },
              data: { sprintId: id },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      assignedStories: storyIdList.length,
      assignedBugs: bugIdList.length,
    });
  } catch (error) {
    console.error(`PATCH /api/sprints/${id}/assign failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'assignation au sprint." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { computeSprintProgress, countSprintDays } from "@/lib/sprintStats";

export type SprintWithBacklog = Prisma.SprintGetPayload<{
  include: { stories: true; bugs: true };
}>;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const sprint: SprintWithBacklog | null = await prisma.sprint.findUnique({
      where: { id },
      include: { stories: true, bugs: true },
    });

    if (!sprint) {
      return NextResponse.json(
        { error: "Sprint introuvable." },
        { status: 404 }
      );
    }

    const endColumn = await prisma.boardColumn.findFirst({
      where: { isLocked: true },
      orderBy: { order: "desc" },
    });

    const { workingDays, nonWorkingDays } = countSprintDays(
      sprint.startDate,
      sprint.endDate
    );
    const progress = computeSprintProgress(
      sprint.stories,
      sprint.bugs,
      endColumn?.id ?? null
    );

    return NextResponse.json({
      ...sprint,
      workingDays,
      nonWorkingDays,
      ...progress,
    });
  } catch (error) {
    console.error(`GET /api/sprints/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération du sprint." },
      { status: 500 }
    );
  }
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

  const { name, startDate, endDate, isActive } = (body ?? {}) as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isActive?: unknown;
  };

  const data: Prisma.SprintUpdateInput = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Le champ name ne peut pas être vide." },
        { status: 400 }
      );
    }
    data.name = name.trim();
  }

  if (startDate !== undefined) {
    if (typeof startDate !== "string" || Number.isNaN(Date.parse(startDate))) {
      return NextResponse.json(
        { error: "Le champ startDate doit être une date valide." },
        { status: 400 }
      );
    }
    data.startDate = new Date(startDate);
  }

  if (endDate !== undefined) {
    if (typeof endDate !== "string" || Number.isNaN(Date.parse(endDate))) {
      return NextResponse.json(
        { error: "Le champ endDate doit être une date valide." },
        { status: 400 }
      );
    }
    data.endDate = new Date(endDate);
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Le champ isActive doit être un booléen." },
        { status: 400 }
      );
    }
    data.isActive = isActive;
  }

  try {
    const existing = await prisma.sprint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Sprint introuvable." },
        { status: 404 }
      );
    }

    const effectiveStart = (data.startDate as Date | undefined) ?? existing.startDate;
    const effectiveEnd = (data.endDate as Date | undefined) ?? existing.endDate;

    if (effectiveStart >= effectiveEnd) {
      return NextResponse.json(
        { error: "Le champ startDate doit être antérieur au champ endDate." },
        { status: 400 }
      );
    }

    if (data.isActive === true && existing.completedAt) {
      return NextResponse.json(
        { error: "Ce sprint est terminé et ne peut plus être réactivé." },
        { status: 400 }
      );
    }

    let sprint;
    if (data.isActive === true) {
      // Un seul sprint actif à la fois : on désactive tous les autres sprints
      // actifs et on active celui-ci dans la même transaction, pour ne
      // jamais laisser passer un état intermédiaire avec deux actifs.
      const [, updated] = await prisma.$transaction([
        prisma.sprint.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        }),
        prisma.sprint.update({ where: { id }, data }),
      ]);
      sprint = updated;
    } else {
      sprint = await prisma.sprint.update({ where: { id }, data });
    }

    return NextResponse.json(sprint);
  } catch (error) {
    console.error(`PATCH /api/sprints/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour du sprint." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const existing = await prisma.sprint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Sprint introuvable." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.story.updateMany({
        where: { sprintId: id },
        data: { sprintId: null },
      }),
      prisma.bug.updateMany({
        where: { sprintId: id },
        data: { sprintId: null },
      }),
      prisma.sprint.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/sprints/${id} failed:`, error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la suppression du sprint." },
      { status: 500 }
    );
  }
}

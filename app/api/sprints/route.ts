import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { computeSprintProgress, countSprintDays } from "@/lib/sprintStats";

export type SprintWithCounts = Prisma.SprintGetPayload<{
  include: { _count: { select: { stories: true; bugs: true } } };
}>;

export async function GET() {
  try {
    const endColumn = await prisma.boardColumn.findFirst({
      where: { isLocked: true },
      orderBy: { order: "desc" },
    });

    const sprints = await prisma.sprint.findMany({
      orderBy: { startDate: "desc" },
      include: {
        stories: { select: { storyPoints: true, statusColumnId: true } },
        bugs: { select: { statusColumnId: true } },
      },
    });

    const enriched = sprints.map(({ stories, bugs, ...sprint }) => {
      const { workingDays, nonWorkingDays } = countSprintDays(
        sprint.startDate,
        sprint.endDate
      );
      const progress = computeSprintProgress(
        stories,
        bugs,
        endColumn?.id ?? null
      );

      return {
        ...sprint,
        _count: { stories: stories.length, bugs: bugs.length },
        workingDays,
        nonWorkingDays,
        ...progress,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/sprints failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la récupération des sprints." },
      { status: 500 }
    );
  }
}

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

  const { name, startDate, endDate } = (body ?? {}) as {
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Le champ name est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  if (typeof startDate !== "string" || Number.isNaN(Date.parse(startDate))) {
    return NextResponse.json(
      { error: "Le champ startDate est obligatoire et doit être une date valide." },
      { status: 400 }
    );
  }

  if (typeof endDate !== "string" || Number.isNaN(Date.parse(endDate))) {
    return NextResponse.json(
      { error: "Le champ endDate est obligatoire et doit être une date valide." },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return NextResponse.json(
      { error: "Le champ startDate doit être antérieur au champ endDate." },
      { status: 400 }
    );
  }

  try {
    const sprint = await prisma.sprint.create({
      data: {
        name: name.trim(),
        startDate: start,
        endDate: end,
        isActive: false,
      },
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    console.error("POST /api/sprints failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la création du sprint." },
      { status: 500 }
    );
  }
}

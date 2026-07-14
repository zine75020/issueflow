import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Severity } from "@/app/generated/prisma/client";
import { computeSprintProgress } from "@/lib/sprintStats";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "MAJOR", "MINOR"];

export async function GET() {
  try {
    const [epics, columns, stories, bugs, sprints] = await Promise.all([
      prisma.epic.findMany({ select: { id: true, title: true } }),
      prisma.boardColumn.findMany({ orderBy: { order: "asc" } }),
      prisma.story.findMany({
        select: { storyPoints: true, statusColumnId: true, epicId: true },
      }),
      prisma.bug.findMany({
        select: { severity: true, statusColumnId: true },
      }),
      prisma.sprint.findMany({
        orderBy: { startDate: "asc" },
        include: {
          stories: { select: { storyPoints: true, statusColumnId: true } },
          bugs: { select: { statusColumnId: true } },
        },
      }),
    ]);

    const lockedColumns = columns.filter((c) => c.isLocked).sort((a, b) => b.order - a.order);
    const endColumnId = lockedColumns[0]?.id ?? null;

    const statusBreakdown = columns.map((col) => ({
      columnId: col.id,
      columnName: col.name,
      count:
        stories.filter((s) => s.statusColumnId === col.id).length +
        bugs.filter((b) => b.statusColumnId === col.id).length,
    }));

    const completedSprints = sprints.filter((s) => s.completedAt !== null);
    const activeSprints = sprints.filter((s) => s.isActive);
    const plannedSprints = sprints.filter((s) => !s.completedAt && !s.isActive);

    const velocityBySprint = completedSprints.map((s) => {
      const { pointsDone } = computeSprintProgress(s.stories, s.bugs, endColumnId);
      return {
        sprintId: s.id,
        sprintName: s.name,
        endDate: s.endDate,
        pointsDone,
      };
    });

    const averageVelocity =
      velocityBySprint.length > 0
        ? velocityBySprint.reduce((sum, v) => sum + v.pointsDone, 0) /
          velocityBySprint.length
        : 0;

    const bugSeverity = SEVERITY_ORDER.map((severity) => ({
      severity,
      count: bugs.filter((b) => b.severity === severity).length,
    }));

    const topEpics = epics
      .map((epic) => ({
        epicId: epic.id,
        epicTitle: epic.title,
        unfinishedCount: stories.filter(
          (s) => s.epicId === epic.id && s.statusColumnId !== endColumnId
        ).length,
      }))
      .filter((e) => e.unfinishedCount > 0)
      .sort((a, b) => b.unfinishedCount - a.unfinishedCount)
      .slice(0, 3);

    return NextResponse.json({
      totals: {
        epics: epics.length,
        stories: stories.length,
        bugs: bugs.length,
      },
      statusBreakdown,
      velocity: {
        average: averageVelocity,
        bySprint: velocityBySprint,
      },
      sprintCounts: {
        completed: completedSprints.length,
        active: activeSprints.length,
        planned: plannedSprints.length,
      },
      bugSeverity,
      topEpics,
    });
  } catch (error) {
    console.error("GET /api/dashboard failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du calcul des indicateurs du dashboard." },
      { status: 500 }
    );
  }
}

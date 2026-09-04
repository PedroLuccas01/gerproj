import { NextResponse } from "next/server";
import { assertCanViewProject } from "@/lib/access";
import { handleApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    const { id: projectId } = await params;
    await assertCanViewProject(access, projectId);

    const [project, grouped] = await Promise.all([
      prisma.projectHistoryEntry.count({ where: { projectId, taskId: null } }),
      prisma.projectHistoryEntry.groupBy({
        by: ["taskId"],
        where: { projectId, taskId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const tasks: Record<string, number> = {};
    for (const row of grouped) {
      if (row.taskId) tasks[row.taskId] = row._count._all;
    }

    return NextResponse.json({ project, tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

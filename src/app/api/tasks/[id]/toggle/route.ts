import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { todayIso } from "@/lib/dates";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { applySetProgress, applyToggleComplete } from "@/lib/task-complete";
import { syncProjectStatusFromSchedule } from "@/lib/sync-project-status";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { progress?: number };
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Tarefa não encontrada.", 404);

    const rows = await prisma.task.findMany({ where: { projectId: existing.projectId } });
    const current = rows.map(mapTask);
    const next =
      typeof body.progress === "number"
        ? applySetProgress(current, id, body.progress, todayIso())
        : applyToggleComplete(current, id, todayIso());
    const changed = next.filter((task) => {
      const before = current.find((t) => t.id === task.id);
      return (
        !before ||
        before.completed !== task.completed ||
        before.completedAt !== task.completedAt ||
        before.progress !== task.progress
      );
    });

    if (changed.length) {
      await prisma.$transaction(
        changed.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: {
              progress: task.progress,
              completed: task.completed,
              completedAt: parseOptionalDate(task.completedAt),
            },
          }),
        ),
      );
    }

    const projectStatus = await syncProjectStatusFromSchedule(existing.projectId, toAuditActor(access));
    return NextResponse.json({ tasks: next, projectId: existing.projectId, projectStatus });
  } catch (error) {
    return handleApiError(error);
  }
}

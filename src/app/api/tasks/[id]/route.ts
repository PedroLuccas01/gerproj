import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { replaceTaskAssignees } from "@/lib/task-assignees";
import { replaceTaskDependencies } from "@/lib/task-deps";
import { TASK_INCLUDE } from "@/lib/task-query";
import { syncProjectStatusFromSchedule } from "@/lib/sync-project-status";
import type { Task } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Task>;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Tarefa não encontrada.", 404);

    await prisma.task.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.seq !== undefined ? { seq: patch.seq } : {}),
        ...(patch.startDate !== undefined ? { startDate: parseOptionalDate(patch.startDate) } : {}),
        ...(patch.endDate !== undefined ? { endDate: parseOptionalDate(patch.endDate) } : {}),
        ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress, completed: patch.progress === 100 } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
        ...(patch.completedAt !== undefined
          ? { completedAt: parseOptionalDate(patch.completedAt) }
          : {}),
        ...(patch.order !== undefined ? { order: patch.order } : {}),
        ...(patch.collapsed !== undefined ? { collapsed: patch.collapsed } : {}),
      },
    });
    if (patch.dependencies !== undefined) {
      await replaceTaskDependencies(id, existing.projectId, patch.dependencies);
    }
    if (patch.assigneeIds !== undefined) {
      await replaceTaskAssignees(id, patch.assigneeIds);
    }
    if (patch.completed !== undefined || patch.progress !== undefined) {
      await syncProjectStatusFromSchedule(existing.projectId, toAuditActor(access));
    }
    const mapped = await prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    return NextResponse.json(mapTask(mapped!));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const existing = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing) return jsonError("Tarefa não encontrada.", 404);
    await prisma.task.deleteMany({ where: { OR: [{ id }, { parentId: id }] } });
    await syncProjectStatusFromSchedule(existing.projectId, toAuditActor(access));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

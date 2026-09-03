import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { todayIso } from "@/lib/dates";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { replaceTaskAssignees } from "@/lib/task-assignees";
import { replaceTaskDependencies } from "@/lib/task-deps";
import { syncAllParentProgress } from "@/lib/task-complete";
import { TASK_INCLUDE } from "@/lib/task-query";
import { applyTaskSchedulePatch, parentScheduleChanged, syncAllTaskSchedules } from "@/lib/task-schedule";
import { syncProjectStatusFromSchedule } from "@/lib/sync-project-status";
import type { Task } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const { id } = await params;
    const patch = (await request.json()) as Partial<Task>;
    const existing = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!existing) return jsonError("Tarefa não encontrada.", 404);

    const current = mapTask(existing);
    const next = applyTaskSchedulePatch(current, patch);

    await prisma.task.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.seq !== undefined ? { seq: patch.seq } : {}),
        ...(patch.startDate !== undefined || patch.endDate !== undefined || patch.durationDays !== undefined
          ? {
              startDate: parseOptionalDate(next.startDate),
              endDate: parseOptionalDate(next.endDate),
              durationDays: next.durationDays,
            }
          : {}),
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

    const rows = await prisma.task.findMany({
      where: { projectId: existing.projectId },
      include: TASK_INCLUDE,
    });
    const mappedRows = rows.map(mapTask);
    const hasKids = mappedRows.some((task) => task.parentId === id);
    const scheduleTouched =
      patch.startDate !== undefined ||
      patch.endDate !== undefined ||
      patch.durationDays !== undefined;
    const synced = syncAllParentProgress(
      syncAllTaskSchedules(mappedRows, hasKids && scheduleTouched ? id : undefined),
      todayIso(),
    );
    const taskUpdates = synced.filter((task) => {
      const before = mappedRows.find((item) => item.id === task.id);
      if (!before) return false;
      return (
        before.progress !== task.progress ||
        before.completed !== task.completed ||
        before.completedAt !== task.completedAt ||
        parentScheduleChanged(before, task)
      );
    });
    if (taskUpdates.length) {
      await prisma.$transaction(
        taskUpdates.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: {
              progress: task.progress,
              completed: task.completed,
              completedAt: parseOptionalDate(task.completedAt),
              startDate: parseOptionalDate(task.startDate),
              endDate: parseOptionalDate(task.endDate),
              durationDays: task.durationDays,
            },
          }),
        ),
      );
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

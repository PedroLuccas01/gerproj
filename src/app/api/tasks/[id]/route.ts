import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
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

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phase !== undefined ? { phase: patch.phase } : {}),
        ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        ...(patch.seq !== undefined ? { seq: patch.seq } : {}),
        ...(patch.startDate !== undefined ? { startDate: parseOptionalDate(patch.startDate) } : {}),
        ...(patch.endDate !== undefined ? { endDate: parseOptionalDate(patch.endDate) } : {}),
        ...(patch.durationDays !== undefined ? { durationDays: patch.durationDays } : {}),
        ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
        ...(patch.completedAt !== undefined
          ? { completedAt: parseOptionalDate(patch.completedAt) }
          : {}),
        ...(patch.dependencies !== undefined ? { dependencies: patch.dependencies } : {}),
        ...(patch.order !== undefined ? { order: patch.order } : {}),
        ...(patch.collapsed !== undefined ? { collapsed: patch.collapsed } : {}),
      },
    });
    if (patch.completed !== undefined) {
      await syncProjectStatusFromSchedule(existing.projectId);
    }
    return NextResponse.json(mapTask(updated));
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
    await syncProjectStatusFromSchedule(existing.projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

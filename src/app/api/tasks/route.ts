import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { recordAudit, statusAudit, toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { todayIso } from "@/lib/dates";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { syncAllParentProgress } from "@/lib/task-complete";
import {
  inheritedSubtaskSchedule,
  parentScheduleChanged,
  syncAllParentSchedules,
} from "@/lib/task-schedule";
import { TASK_INCLUDE } from "@/lib/task-query";
import type { TaskPhase } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const body = (await request.json()) as {
      projectId?: string;
      phase?: TaskPhase;
      parentId?: string | null;
      name?: string;
    };
    if (!body.projectId || !body.phase) return jsonError("Projeto e fase são obrigatórios.");

    const parentId = body.parentId ?? null;
    const [project, orderAgg, seqAgg, parentTask] = await Promise.all([
      prisma.project.findUnique({
        where: { id: body.projectId },
        select: { id: true, status: true, name: true },
      }),
      prisma.task.aggregate({
        where: { projectId: body.projectId, phase: body.phase, parentId },
        _max: { order: true },
      }),
      prisma.task.aggregate({
        where: { projectId: body.projectId },
        _max: { seq: true },
      }),
      parentId
        ? prisma.task.findUnique({
            where: { id: parentId },
            select: { startDate: true, endDate: true, durationDays: true },
          })
        : Promise.resolve(null),
    ]);
    if (!project) return jsonError("Projeto não encontrado.", 404);

    const inheritedSchedule = inheritedSubtaskSchedule(
      parentTask?.startDate ? parentTask.startDate.toISOString().slice(0, 10) : null,
    );

    const created = await prisma.task.create({
      data: {
        projectId: body.projectId,
        parentId,
        phase: body.phase,
        name: body.name ?? "Nova tarefa",
        seq: (seqAgg._max.seq ?? 0) + 1,
        order: (orderAgg._max.order ?? -1) + 1,
        durationDays: inheritedSchedule.durationDays,
        startDate: parseOptionalDate(inheritedSchedule.startDate),
        endDate: parseOptionalDate(inheritedSchedule.endDate),
      },
    });

    if (project.status === "concluido") {
      await prisma.project.update({
        where: { id: body.projectId },
        data: { status: "em_andamento" },
      });
      const entry = statusAudit({
        actor: toAuditActor(access),
        projectId: body.projectId,
        projectName: project.name,
        from: "concluido",
        to: "em_andamento",
        action: "auto",
      });
      if (entry) await recordAudit(entry);
    }

    if (parentId) {
      const rows = await prisma.task.findMany({
        where: { projectId: body.projectId },
        include: TASK_INCLUDE,
      });
      const synced = syncAllParentProgress(syncAllParentSchedules(rows.map(mapTask)), todayIso());
      const parent = synced.find((task) => task.id === parentId);
      const before = rows.map(mapTask).find((task) => task.id === parentId);
      if (parent && before) {
        const scheduleChanged = parentScheduleChanged(before, parent);
        const progressChanged =
          before.progress !== parent.progress ||
          before.completed !== parent.completed ||
          before.completedAt !== parent.completedAt;
        if (scheduleChanged || progressChanged) {
          await prisma.task.update({
            where: { id: parentId },
            data: {
              progress: parent.progress,
              completed: parent.completed,
              completedAt: parseOptionalDate(parent.completedAt),
              startDate: parseOptionalDate(parent.startDate),
              endDate: parseOptionalDate(parent.endDate),
              durationDays: parent.durationDays,
            },
          });
        }
      }
    }

    return NextResponse.json(mapTask(created));
  } catch (error) {
    return handleApiError(error);
  }
}

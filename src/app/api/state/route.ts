import { NextResponse } from "next/server";
import { isAllocatedToProject, stripBudget } from "@/lib/access";
import { recordAudits, statusAudit, toAuditActor } from "@/lib/audit";
import { handleApiError } from "@/lib/api-utils";
import { todayIso } from "@/lib/dates";
import { mapState, mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { scheduleProgress } from "@/lib/schedule-progress";
import { requireAccess } from "@/lib/session";
import { syncAllParentProgress } from "@/lib/task-complete";
import { syncAllTaskSchedules, taskScheduleChanged } from "@/lib/task-schedule";
import { TASK_INCLUDE } from "@/lib/task-query";

export async function GET() {
  try {
    const access = await requireAccess();
    const [collaborators, clients, projects, tasks] = await Promise.all([
      prisma.collaborator.findMany({ orderBy: { name: "asc" } }),
      prisma.client.findMany({ orderBy: { name: "asc" } }),
      prisma.project.findMany({
        include: { team: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        include: TASK_INCLUDE,
        orderBy: [{ projectId: "asc" }, { seq: "asc" }],
      }),
    ]);

    const mappedTasks = tasks.map(mapTask);
    const syncedTasks = syncAllParentProgress(syncAllTaskSchedules(mappedTasks), todayIso());
    const taskUpdates = syncedTasks.filter((task) => {
      const before = mappedTasks.find((item) => item.id === task.id);
      if (!before) return false;
      return (
        before.progress !== task.progress ||
        before.completed !== task.completed ||
        before.completedAt !== task.completedAt ||
        taskScheduleChanged(before, task)
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

    const tasksByProject = new Map<string, typeof syncedTasks>();
    for (const task of syncedTasks) {
      const list = tasksByProject.get(task.projectId) ?? [];
      list.push(task);
      tasksByProject.set(task.projectId, list);
    }

    const completeIds = projects
      .filter((project) => project.status !== "cancelado" && project.status !== "concluido")
      .filter((project) => {
        const list = tasksByProject.get(project.id) ?? [];
        return list.length > 0 && scheduleProgress(list) === 100;
      })
      .map((project) => project.id);

    if (completeIds.length) {
      const actor = toAuditActor(access);
      await prisma.project.updateMany({
        where: { id: { in: completeIds } },
        data: { status: "concluido" },
      });
      const audits = completeIds
        .map((id) => {
          const project = projects.find((item) => item.id === id);
          if (!project) return null;
          return statusAudit({
            actor,
            projectId: project.id,
            projectName: project.name,
            from: project.status,
            to: "concluido",
            action: "auto",
          });
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      await recordAudits(audits);
      for (const project of projects) {
        if (completeIds.includes(project.id)) project.status = "concluido";
      }
    }

    const allocatedIds = new Set(
      projects
        .filter((project) => isAllocatedToProject(project, access.collaboratorId))
        .map((project) => project.id),
    );

    const state = mapState({
      collaborators,
      clients,
      projects,
      tasks,
    });
    state.tasks = access.isManagement
      ? syncedTasks
      : syncedTasks.filter((task) => allocatedIds.has(task.projectId));

    if (!access.isManagement) {
      state.projects = state.projects.map(stripBudget);
    }

    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}

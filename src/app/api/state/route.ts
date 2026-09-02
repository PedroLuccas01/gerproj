import { NextResponse } from "next/server";
import { isAllocatedToProject, stripBudget } from "@/lib/access";
import { handleApiError } from "@/lib/api-utils";
import { mapState, mapTask } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { scheduleProgress } from "@/lib/schedule-progress";
import { requireAccess } from "@/lib/session";

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
      prisma.task.findMany({ orderBy: [{ projectId: "asc" }, { seq: "asc" }] }),
    ]);

    const mappedTasks = tasks.map(mapTask);
    const tasksByProject = new Map<string, typeof mappedTasks>();
    for (const task of mappedTasks) {
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
      await prisma.project.updateMany({
        where: { id: { in: completeIds } },
        data: { status: "concluido" },
      });
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
      tasks: access.isManagement
        ? tasks
        : tasks.filter((task) => allocatedIds.has(task.projectId)),
    });

    if (!access.isManagement) {
      state.projects = state.projects.map(stripBudget);
    }

    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}

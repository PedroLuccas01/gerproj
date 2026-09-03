import { NextResponse } from "next/server";
import { stripBudget } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapProject, mapTask } from "@/lib/mappers";
import { findShareByToken, isShareActive } from "@/lib/project-share";
import { prisma } from "@/lib/prisma";
import { requireShareAccess } from "@/lib/share-session";
import { TASK_INCLUDE } from "@/lib/task-query";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const existing = await findShareByToken(token);
    if (!existing || existing.revokedAt) {
      return jsonError("Este link não está mais disponível.", 404);
    }
    if (!isShareActive(existing)) {
      return jsonError("Este acesso expirou.", 403);
    }
    const share = await requireShareAccess(token);
    const [project, tasks] = await Promise.all([
      prisma.project.findUnique({
        where: { id: share.projectId },
        include: { team: true },
      }),
      prisma.task.findMany({
        where: { projectId: share.projectId },
        include: TASK_INCLUDE,
        orderBy: [{ phase: "asc" }, { order: "asc" }],
      }),
    ]);
    if (!project) {
      const error = new Error("NOT_FOUND");
      throw error;
    }
    const assigneeIds = [
      ...new Set(tasks.flatMap((task) => task.assignees.map((item) => item.collaboratorId))),
    ];
    const people =
      assigneeIds.length === 0
        ? []
        : await prisma.collaborator.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, name: true },
          });

    const mapped = stripBudget(mapProject(project));
    return NextResponse.json({
      project: { ...mapped, notes: "" },
      tasks: tasks.map(mapTask),
      people,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

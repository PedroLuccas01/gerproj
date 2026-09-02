import { prisma } from "./prisma";
import { statusAfterScheduleChange } from "./schedule-progress";
import type { ProjectStatus } from "./types";

export async function syncProjectStatusFromSchedule(projectId: string): Promise<ProjectStatus | null> {
  const [project, rows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { id: true, parentId: true, completed: true, durationDays: true },
    }),
  ]);
  if (!project) return null;

  const next = statusAfterScheduleChange(project.status, rows);
  if (next === project.status) return next;

  await prisma.project.update({
    where: { id: projectId },
    data: { status: next },
  });
  return next;
}

import { prisma } from "@/lib/prisma";

export const TASK_DEP_INCLUDE = {
  dependsOn: { select: { dependsOnId: true } },
} as const;

export type TaskWithDeps = {
  dependsOn?: { dependsOnId: string }[];
};

export function dependencyIds(row: TaskWithDeps) {
  return (row.dependsOn ?? []).map((item) => item.dependsOnId);
}

export async function replaceTaskDependencies(taskId: string, projectId: string, rawIds: string[]) {
  const unique = [...new Set(rawIds.filter((id) => id && id !== taskId))];
  const valid = unique.length
    ? await prisma.task.findMany({
        where: { id: { in: unique }, projectId },
        select: { id: true },
      })
    : [];
  const nextIds = valid.map((row) => row.id);

  await prisma.$transaction([
    prisma.taskDependency.deleteMany({ where: { taskId } }),
    ...(nextIds.length
      ? [
          prisma.taskDependency.createMany({
            data: nextIds.map((dependsOnId) => ({ taskId, dependsOnId })),
          }),
        ]
      : []),
  ]);

  return nextIds;
}

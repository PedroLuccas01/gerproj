import { prisma } from "@/lib/prisma";

export const TASK_ASSIGNEE_INCLUDE = {
  assignees: { select: { collaboratorId: true } },
} as const;

export type TaskWithAssignees = {
  assignees?: { collaboratorId: string }[];
};

export function assigneeIds(row: TaskWithAssignees) {
  return (row.assignees ?? []).map((item) => item.collaboratorId);
}

export async function replaceTaskAssignees(taskId: string, rawIds: string[]) {
  const unique = [...new Set(rawIds.filter(Boolean))];
  const valid = unique.length
    ? await prisma.collaborator.findMany({
        where: { id: { in: unique } },
        select: { id: true },
      })
    : [];
  const nextIds = valid.map((row) => row.id);

  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { taskId } }),
    ...(nextIds.length
      ? [
          prisma.taskAssignee.createMany({
            data: nextIds.map((collaboratorId) => ({ taskId, collaboratorId })),
          }),
        ]
      : []),
  ]);

  return nextIds;
}

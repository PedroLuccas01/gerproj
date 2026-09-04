import type { HistoryNotificationReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assigneeIds, TASK_ASSIGNEE_INCLUDE } from "@/lib/task-assignees";

const REASON_RANK: Record<HistoryNotificationReason, number> = {
  mention: 0,
  assignee: 1,
  team: 2,
};

function pickReason(
  current: HistoryNotificationReason | undefined,
  next: HistoryNotificationReason,
): HistoryNotificationReason {
  if (!current) return next;
  return REASON_RANK[next] < REASON_RANK[current] ? next : current;
}

async function projectTeamIds(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      leaderId: true,
      team: { select: { collaboratorId: true } },
    },
  });
  if (!project) return [];
  const ids = new Set<string>();
  if (project.leaderId) ids.add(project.leaderId);
  for (const member of project.team) ids.add(member.collaboratorId);
  return [...ids];
}

async function buildRecipientReasons(input: {
  projectId: string;
  taskId: string | null;
  mentionIds: string[];
  authorCollaboratorId: string | null;
}) {
  const recipients = new Map<string, HistoryNotificationReason>();

  for (const collaboratorId of input.mentionIds) {
    if (collaboratorId === input.authorCollaboratorId) continue;
    recipients.set(
      collaboratorId,
      pickReason(recipients.get(collaboratorId), "mention"),
    );
  }

  if (input.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      include: TASK_ASSIGNEE_INCLUDE,
    });
    for (const collaboratorId of assigneeIds(task ?? {})) {
      if (collaboratorId === input.authorCollaboratorId) continue;
      recipients.set(
        collaboratorId,
        pickReason(recipients.get(collaboratorId), "assignee"),
      );
    }
  } else {
    for (const collaboratorId of await projectTeamIds(input.projectId)) {
      if (collaboratorId === input.authorCollaboratorId) continue;
      recipients.set(
        collaboratorId,
        pickReason(recipients.get(collaboratorId), "team"),
      );
    }
  }

  return recipients;
}

export async function collaboratorIdForEmail(email: string) {
  const row = await prisma.collaborator.findFirst({
    where: { email: email.trim().toLowerCase(), active: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function createHistoryNotifications(input: {
  entryId: string;
  projectId: string;
  taskId: string | null;
  mentionIds: string[];
  authorEmail: string;
}) {
  const authorCollaboratorId = await collaboratorIdForEmail(input.authorEmail);
  const recipients = await buildRecipientReasons({
    projectId: input.projectId,
    taskId: input.taskId,
    mentionIds: input.mentionIds,
    authorCollaboratorId,
  });
  if (!recipients.size) return;

  await prisma.projectHistoryNotification.createMany({
    data: [...recipients.entries()].map(([collaboratorId, reason]) => ({
      entryId: input.entryId,
      collaboratorId,
      reason,
    })),
    skipDuplicates: true,
  });
}

export async function notifyNewMentions(input: {
  entryId: string;
  projectId: string;
  taskId: string | null;
  previousMentionIds: string[];
  nextMentionIds: string[];
  authorEmail: string;
}) {
  const added = input.nextMentionIds.filter((id) => !input.previousMentionIds.includes(id));
  if (!added.length) return;

  const authorCollaboratorId = await collaboratorIdForEmail(input.authorEmail);
  for (const collaboratorId of added) {
    if (collaboratorId === authorCollaboratorId) continue;
    await prisma.projectHistoryNotification.upsert({
      where: {
        entryId_collaboratorId: {
          entryId: input.entryId,
          collaboratorId,
        },
      },
      update: { reason: "mention", readAt: null },
      create: {
        entryId: input.entryId,
        collaboratorId,
        reason: "mention",
      },
    });
  }
}

export function historyNotificationHref(projectId: string, taskId: string | null) {
  if (taskId) return `/projetos/${projectId}/cronograma?solicitacao=${taskId}`;
  return `/projetos/${projectId}/cronograma?comentarios=1`;
}

export function historyNotificationCopy(input: {
  reason: HistoryNotificationReason;
  taskId: string | null;
  taskSeq: number | null;
  taskName: string | null;
  projectName: string;
  authorName: string;
}) {
  const taskLabel =
    input.taskSeq != null && input.taskName
      ? `#${input.taskSeq} ${input.taskName}`
      : input.taskName;

  if (input.reason === "mention") {
    return {
      title: input.taskId ? "Menção em solicitação" : "Menção em comentário",
      description: `${input.authorName} mencionou você · ${taskLabel ? `${taskLabel} · ` : ""}${input.projectName}`,
      tone: "info" as const,
    };
  }

  if (input.taskId) {
    return {
      title: "Nova solicitação na atividade",
      description: `${input.authorName} · ${taskLabel ?? "Atividade"} · ${input.projectName}`,
      tone: "info" as const,
    };
  }

  return {
    title: "Novo comentário no projeto",
    description: `${input.authorName} · ${input.projectName}`,
    tone: "info" as const,
  };
}

import { addDaysIso, diffDays, formatBr, todayIso } from "./dates";
import type { Project, Task } from "./types";

export type NotificationTone = "info" | "warning" | "danger";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: NotificationTone;
  notificationId?: string;
};

export type PendingAccount = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "active" | "rejected";
};

const DUE_SOON_DAYS = 7;

function taskDueDate(task: Task) {
  if (task.endDate) return task.endDate;
  if (task.startDate) return addDaysIso(task.startDate, Math.max(1, task.durationDays));
  return null;
}

function relevantTasks(tasks: Task[], projects: Project[], collaboratorId: string | null, isManagement: boolean) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return tasks.filter((task) => {
    if (task.completed) return false;
    const project = projectById.get(task.projectId);
    if (!project || project.status === "cancelado") return false;
    if (isManagement) return true;
    return Boolean(collaboratorId) && task.assigneeIds.includes(collaboratorId!);
  });
}

export function buildNotifications(input: {
  isManagement: boolean;
  collaboratorId: string | null;
  projects: Project[];
  tasks: Task[];
  pendingUsers: PendingAccount[];
}): AppNotification[] {
  const today = todayIso();
  const soonLimit = addDaysIso(today, DUE_SOON_DAYS);
  const items: AppNotification[] = [];
  const projectById = new Map(input.projects.map((project) => [project.id, project]));

  if (input.isManagement) {
    for (const user of input.pendingUsers.filter((item) => item.status === "pending")) {
      items.push({
        id: `pending:${user.id}`,
        title: "Liberação de acesso",
        description: `${user.name} cadastrou e aguarda aprovação.`,
        href: "/colaboradores",
        tone: "danger",
      });
    }
  }

  const tasks = relevantTasks(input.tasks, input.projects, input.collaboratorId, input.isManagement);
  for (const task of tasks) {
    const due = taskDueDate(task);
    if (!due) continue;
    const project = projectById.get(task.projectId);
    const projectName = project?.name ?? "Projeto";
    const href = `/projetos/${task.projectId}/cronograma`;

    if (due < today) {
      const days = Math.max(1, diffDays(due, today));
      items.push({
        id: `overdue:${task.id}`,
        title: "Atividade atrasada",
        description: `${task.name} · ${projectName} · ${days === 1 ? "1 dia" : `${days} dias`} de atraso.`,
        href,
        tone: "danger",
      });
      continue;
    }

    if (due <= soonLimit && project?.status !== "concluido") {
      const days = diffDays(today, due);
      const when = days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias (${formatBr(due)})`;
      items.push({
        id: `soon:${task.id}`,
        title: "Prazo próximo",
        description: `${task.name} · ${projectName} · ${when}.`,
        href,
        tone: "warning",
      });
    }
  }

  const rank = { danger: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone] || a.title.localeCompare(b.title));
}

export function mergeNotifications(
  systemItems: AppNotification[],
  historyItems: AppNotification[],
): AppNotification[] {
  const rank = { danger: 0, warning: 1, info: 2 };
  return [...historyItems, ...systemItems].sort(
    (a, b) => rank[a.tone] - rank[b.tone] || a.title.localeCompare(b.title),
  );
}

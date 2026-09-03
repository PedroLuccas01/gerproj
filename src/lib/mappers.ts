import type { Client as DbClient, Collaborator as DbCollaborator, Project as DbProject, Task as DbTask } from "@prisma/client";
import { dependencyIds, type TaskWithDeps } from "./task-deps";
import type { AppState, Client, Collaborator, Project, Task } from "./types";

function isoDate(value: Date | null): string | null {
  if (!value) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function parseOptionalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return parseDate(iso);
}

export function mapCollaborator(row: DbCollaborator): Collaborator {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    area: row.area,
    phone: row.phone,
    active: row.active,
  };
}

export function mapClient(row: DbClient): Client {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    email: row.email,
  };
}

export function mapProject(
  row: DbProject & { team?: { collaboratorId: string }[] },
): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    clientId: row.clientId,
    leaderId: row.leaderId,
    durationDays: row.durationDays,
    status: row.status,
    startDate: isoDate(row.startDate)!,
    endDate: isoDate(row.endDate)!,
    budget: row.budget,
    budgetByArea: {
      automacao: row.budgetAutomacao,
      mecanica: row.budgetMecanica,
      hardware: row.budgetHardware,
      software: row.budgetSoftware,
    },
    teamIds: row.team?.map((t) => t.collaboratorId) ?? [],
    notes: row.notes,
    createdAt: isoDate(row.createdAt) ?? row.createdAt.toISOString().slice(0, 10),
  };
}

export function mapTask(row: DbTask & TaskWithDeps): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    parentId: row.parentId,
    phase: row.phase,
    seq: row.seq,
    name: row.name,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    durationDays: row.durationDays,
    assigneeId: row.assigneeId,
    progress: row.completed ? 100 : row.progress,
    completed: row.completed,
    completedAt: isoDate(row.completedAt),
    dependencies: dependencyIds(row),
    order: row.order,
    collapsed: row.collapsed,
  };
}

export function mapState(input: {
  collaborators: DbCollaborator[];
  clients: DbClient[];
  projects: Array<DbProject & { team: { collaboratorId: string }[] }>;
  tasks: Array<DbTask & TaskWithDeps>;
}): AppState {
  return {
    collaborators: input.collaborators.map(mapCollaborator),
    clients: input.clients.map(mapClient),
    projects: input.projects.map(mapProject),
    tasks: input.tasks.map(mapTask),
  };
}

import type { Project as DbProject } from "@prisma/client";
import { AREA_LABEL, BUDGET_AREAS, STATUS_LABEL } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditEntityType, AuditEvent, AuditField } from "@/lib/audit-shared";
import { isAuditField } from "@/lib/audit-shared";
import type { AuthUser } from "@/lib/auth-types";
import type { BudgetByArea, Project, ProjectStatus } from "@/lib/types";

export type AuditActor = {
  id: string;
  name: string;
  email: string;
};

export type AuditWrite = {
  actor: AuditActor;
  field: AuditField;
  action?: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  oldValue?: unknown;
  newValue?: unknown;
};

type ProjectWithTeam = DbProject & { team: { collaboratorId: string }[] };

export function toAuditActor(user: Pick<AuthUser, "id" | "name" | "email">): AuditActor {
  return { id: user.id, name: user.name, email: user.email };
}

function isoDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatIsoBr(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function money(value: number) {
  return Math.round(Number(value) * 100);
}

function sameMoney(a: number, b: number) {
  return money(a) === money(b);
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

function snapshotJson(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function toCreateData(entry: AuditWrite) {
  return {
    actorId: entry.actor.id,
    actorName: entry.actor.name,
    actorEmail: entry.actor.email,
    field: entry.field,
    action: entry.action ?? "update",
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    summary: entry.summary,
    oldValue: snapshotJson(entry.oldValue),
    newValue: snapshotJson(entry.newValue),
  };
}

export async function recordAudits(entries: AuditWrite[]) {
  if (!entries.length) return;
  await prisma.auditLog.createMany({ data: entries.map(toCreateData) });
}

export async function recordAudit(entry: AuditWrite) {
  await prisma.auditLog.create({ data: toCreateData(entry) });
}

export function mapAuditEvent(row: {
  id: string;
  createdAt: Date;
  actorName: string;
  actorEmail: string;
  field: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
}): AuditEvent | null {
  if (!isAuditField(row.field)) return null;
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    field: row.field,
    action: row.action === "auto" ? "auto" : "update",
    entityType: row.entityType === "user" ? "user" : "project",
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    summary: row.summary,
  };
}

function prazoText(start: string, end: string, days: number) {
  return `${formatIsoBr(start)} – ${formatIsoBr(end)} (${days} ${days === 1 ? "dia" : "dias"})`;
}

function budgetSnapshot(row: {
  budget: number;
  budgetAutomacao: number;
  budgetMecanica: number;
  budgetHardware: number;
  budgetSoftware: number;
}) {
  return {
    total: row.budget,
    automacao: row.budgetAutomacao,
    mecanica: row.budgetMecanica,
    hardware: row.budgetHardware,
    software: row.budgetSoftware,
  };
}

function nextBudget(row: ProjectWithTeam, patch: Partial<Project>) {
  const current = budgetSnapshot(row);
  return {
    total: patch.budget !== undefined ? patch.budget : current.total,
    automacao: patch.budgetByArea?.automacao ?? current.automacao,
    mecanica: patch.budgetByArea?.mecanica ?? current.mecanica,
    hardware: patch.budgetByArea?.hardware ?? current.hardware,
    software: patch.budgetByArea?.software ?? current.software,
  };
}

function budgetChanged(
  oldSnap: ReturnType<typeof budgetSnapshot>,
  nextSnap: ReturnType<typeof budgetSnapshot>,
) {
  return (
    !sameMoney(oldSnap.total, nextSnap.total) ||
    BUDGET_AREAS.some((area) => !sameMoney(oldSnap[area.key], nextSnap[area.key]))
  );
}

function budgetSummary(
  oldSnap: ReturnType<typeof budgetSnapshot>,
  nextSnap: ReturnType<typeof budgetSnapshot>,
) {
  const parts: string[] = [];
  if (!sameMoney(oldSnap.total, nextSnap.total)) {
    parts.push(`total R$ ${formatBRL(oldSnap.total)} → R$ ${formatBRL(nextSnap.total)}`);
  }
  for (const area of BUDGET_AREAS) {
    if (sameMoney(oldSnap[area.key], nextSnap[area.key])) continue;
    parts.push(`${area.label} R$ ${formatBRL(oldSnap[area.key])} → R$ ${formatBRL(nextSnap[area.key])}`);
  }
  return parts.join(" · ") || "Orçamento atualizado";
}

function listNames(ids: string[], names: Map<string, string>) {
  return ids
    .map((id) => names.get(id) ?? id)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function equipeText(leaderId: string | null, teamIds: string[], names: Map<string, string>) {
  const leader = leaderId ? (names.get(leaderId) ?? leaderId) : "nenhum";
  const team = listNames(teamIds, names);
  return `Líder: ${leader} · Equipe: ${team.length ? team.join(", ") : "nenhum"}`;
}

export function statusAudit(input: {
  actor: AuditActor;
  projectId: string;
  projectName: string;
  from: ProjectStatus;
  to: ProjectStatus;
  action?: AuditAction;
}): AuditWrite | null {
  if (input.from === input.to) return null;
  const fromLabel = STATUS_LABEL[input.from];
  const toLabel = STATUS_LABEL[input.to];
  const auto = input.action === "auto";
  return {
    actor: input.actor,
    field: "status",
    action: input.action ?? "update",
    entityType: "project",
    entityId: input.projectId,
    entityLabel: input.projectName,
    summary: auto
      ? `Status alterado automaticamente: ${fromLabel} → ${toLabel}`
      : `Status: ${fromLabel} → ${toLabel}`,
    oldValue: input.from,
    newValue: input.to,
  };
}

export function passwordAudit(input: {
  actor: AuditActor;
  targetId: string;
  targetName: string;
  byManagement?: boolean;
}): AuditWrite {
  return {
    actor: input.actor,
    field: "senha",
    entityType: "user",
    entityId: input.targetId,
    entityLabel: input.targetName,
    summary: input.byManagement
      ? "Senha redefinida por gestão"
      : "Senha alterada pela própria conta",
  };
}

export async function diffProjectAudits(input: {
  actor: AuditActor;
  existing: ProjectWithTeam;
  patch: Partial<Project>;
}): Promise<AuditWrite[]> {
  const { actor, existing, patch } = input;
  const entries: AuditWrite[] = [];
  const label = patch.name?.trim() || existing.name;

  if (patch.startDate !== undefined || patch.endDate !== undefined || patch.durationDays !== undefined) {
    const oldStart = isoDate(existing.startDate);
    const oldEnd = isoDate(existing.endDate);
    const nextStart = patch.startDate ?? oldStart;
    const nextEnd = patch.endDate ?? oldEnd;
    const nextDays = patch.durationDays ?? existing.durationDays;
    if (oldStart !== nextStart || oldEnd !== nextEnd || existing.durationDays !== nextDays) {
      entries.push({
        actor,
        field: "prazo",
        entityType: "project",
        entityId: existing.id,
        entityLabel: label,
        summary: `Prazo: ${prazoText(oldStart, oldEnd, existing.durationDays)} → ${prazoText(nextStart, nextEnd, nextDays)}`,
        oldValue: { startDate: oldStart, endDate: oldEnd, durationDays: existing.durationDays },
        newValue: { startDate: nextStart, endDate: nextEnd, durationDays: nextDays },
      });
    }
  }

  if (patch.status !== undefined) {
    const entry = statusAudit({
      actor,
      projectId: existing.id,
      projectName: label,
      from: existing.status,
      to: patch.status,
    });
    if (entry) entries.push(entry);
  }

  if (patch.budget !== undefined || patch.budgetByArea) {
    const oldSnap = budgetSnapshot(existing);
    const nextSnap = nextBudget(existing, patch);
    if (budgetChanged(oldSnap, nextSnap)) {
      entries.push({
        actor,
        field: "orcamento",
        entityType: "project",
        entityId: existing.id,
        entityLabel: label,
        summary: `Orçamento: ${budgetSummary(oldSnap, nextSnap)}`,
        oldValue: oldSnap,
        newValue: nextSnap,
      });
    }
  }

  if (patch.teamIds !== undefined || patch.leaderId !== undefined) {
    const oldTeam = existing.team.map((row) => row.collaboratorId);
    const nextTeam = patch.teamIds ?? oldTeam;
    const nextLeader = patch.leaderId !== undefined ? patch.leaderId : existing.leaderId;
    if (existing.leaderId !== nextLeader || !sameIds(oldTeam, nextTeam)) {
      const ids = [...new Set([...oldTeam, ...nextTeam, existing.leaderId, nextLeader].filter(Boolean))] as string[];
      const people = ids.length
        ? await prisma.collaborator.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, area: true },
          })
        : [];
      const names = new Map(people.map((person) => [person.id, person.name]));
      const areaById = new Map(people.map((person) => [person.id, person.area]));
      const withArea = (id: string) => {
        const name = names.get(id) ?? id;
        const area = areaById.get(id);
        return area ? `${name} (${AREA_LABEL[area]})` : name;
      };
      const named = new Map(ids.map((id) => [id, withArea(id)]));
      entries.push({
        actor,
        field: "equipe",
        entityType: "project",
        entityId: existing.id,
        entityLabel: label,
        summary: `Equipe: ${equipeText(existing.leaderId, oldTeam, named)} → ${equipeText(nextLeader, nextTeam, named)}`,
        oldValue: { leaderId: existing.leaderId, teamIds: oldTeam },
        newValue: { leaderId: nextLeader, teamIds: nextTeam },
      });
    }
  }

  return entries;
}

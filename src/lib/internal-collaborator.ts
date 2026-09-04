import { prisma } from "@/lib/prisma";
import { isSupportLogin, SUPPORT_LOGIN } from "@/lib/support-admin";

export function isInternalCollaborator(input: { email?: string | null }) {
  return isSupportLogin(input.email ?? "");
}

export function filterPublicCollaborators<T extends { email: string }>(list: T[]): T[] {
  return list.filter((person) => !isInternalCollaborator(person));
}

export async function getInternalCollaboratorId() {
  const row = await prisma.collaborator.findFirst({
    where: { email: SUPPORT_LOGIN },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function stripInternalCollaboratorIds(ids: string[]) {
  const internalId = await getInternalCollaboratorId();
  if (!internalId) return ids;
  return ids.filter((id) => id !== internalId);
}

export async function sanitizeLeaderId(leaderId: string | null | undefined) {
  if (!leaderId) return leaderId ?? null;
  const internalId = await getInternalCollaboratorId();
  return internalId && leaderId === internalId ? null : leaderId;
}

export async function detachInternalCollaboratorFromProjects() {
  const internalId = await getInternalCollaboratorId();
  if (!internalId) return;
  await prisma.$transaction([
    prisma.projectTeam.deleteMany({ where: { collaboratorId: internalId } }),
    prisma.project.updateMany({ where: { leaderId: internalId }, data: { leaderId: null } }),
    prisma.taskAssignee.deleteMany({ where: { collaboratorId: internalId } }),
  ]);
}

export function publicCollaboratorWhere() {
  return { email: { not: SUPPORT_LOGIN } };
}

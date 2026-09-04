import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth-types";
import type { Area, Project } from "@/lib/types";
import { isAllocatedToProject } from "@/lib/access-shared";

export { isAllocatedToProject };

const EMPTY_BUDGET = {
  automacao: 0,
  mecanica: 0,
  hardware: 0,
  software: 0,
};

const ACCESS_TTL_MS = 20_000;
const accessCache = new Map<string, { at: number; value: AuthUser }>();

export async function toAuthUser(user: { id: string; name: string; email: string }): Promise<AuthUser> {
  const cached = accessCache.get(user.id);
  if (cached && Date.now() - cached.at < ACCESS_TTL_MS) return cached.value;

  const [row, collab] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, status: true, name: true, email: true },
    }),
    prisma.collaborator.findFirst({
      where: { email: user.email.trim().toLowerCase() },
      select: { id: true, area: true },
    }),
  ]);
  const isAdmin = row?.isAdmin ?? false;
  const status = row?.status ?? "pending";
  const value: AuthUser = {
    id: user.id,
    name: row?.name ?? user.name,
    email: row?.email ?? user.email,
    status,
    isAdmin,
    isManagement: isAdmin || collab?.area === "gestao",
    collaboratorId: collab?.id ?? null,
  };
  accessCache.set(user.id, { at: Date.now(), value });
  return value;
}

export function stripBudget(project: Project): Project {
  return {
    ...project,
    budget: 0,
    budgetByArea: { ...EMPTY_BUDGET },
  };
}

export function forbid(message = "Sem permissão.") {
  throw new Error("FORBIDDEN");
}

export function requireActive(user: AuthUser) {
  if (user.status !== "active") forbid("Conta aguardando aprovação.");
}

export function requireManagement(user: AuthUser) {
  if (!user.isManagement) forbid("Apenas gestão pode realizar esta ação.");
}

export function requireAdmin(user: AuthUser) {
  if (!user.isAdmin) forbid("Apenas o administrador pode realizar esta ação.");
}

export function isPrivilegedStaff(target: { isAdmin?: boolean; area?: Area | null }) {
  return Boolean(target.isAdmin) || target.area === "gestao";
}

export function assertCanEditStaff(
  actor: AuthUser,
  target: { isAdmin?: boolean; area?: Area | null },
) {
  if (actor.isAdmin) return;
  if (isPrivilegedStaff(target)) {
    forbid("Somente o administrador pode alterar cadastros de gestão ou admin.");
  }
}

export function assertCanAssignArea(user: AuthUser, area: Area, previous?: Area) {
  const touchesGestao = area === "gestao" || previous === "gestao";
  if (touchesGestao && area !== previous && !user.isAdmin) {
    forbid("Somente o administrador pode definir a área Gestão.");
  }
}

export async function loadProjectForAccess(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: true },
  });
  if (!project) {
    throw new Error("NOT_FOUND");
  }
  return project;
}

export async function assertCanViewProject(user: AuthUser, projectId: string) {
  const project = await loadProjectForAccess(projectId);
  if (user.isManagement || isAllocatedToProject(project, user.collaboratorId)) {
    return project;
  }
  forbid("Você não está alocado neste projeto.");
  return project;
}

export async function assertCanWriteProjectHistory(user: AuthUser, projectId: string) {
  return assertCanViewProject(user, projectId);
}

export async function assertCanEditProjectHistoryEntry(
  user: AuthUser,
  entry: { authorId: string; projectId: string },
) {
  if (user.isManagement || entry.authorId === user.id) return;
  forbid("Você só pode editar seus próprios registros.");
}

export async function assertCanDeleteProjectHistoryEntry(user: AuthUser) {
  requireManagement(user);
}

export function isAllocatedToProject(
  project: { leaderId: string | null; team?: { collaboratorId: string }[]; teamIds?: string[] },
  collaboratorId: string | null,
) {
  if (!collaboratorId) return false;
  if (project.leaderId === collaboratorId) return true;
  if (project.teamIds?.includes(collaboratorId)) return true;
  return project.team?.some((row) => row.collaboratorId === collaboratorId) ?? false;
}

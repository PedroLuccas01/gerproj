import type { Collaborator, Project, ProjectHistoryEntry } from "./types";

export type HistoryEntryWithMentions = ProjectHistoryEntry;

export function projectTeamMembers(
  project: Pick<Project, "leaderId" | "teamIds">,
  collaborators: Collaborator[],
): Collaborator[] {
  const ids = new Set<string>();
  if (project.leaderId) ids.add(project.leaderId);
  for (const id of project.teamIds) ids.add(id);
  return collaborators
    .filter((member) => ids.has(member.id) && member.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseMentionIds(content: string, members: Collaborator[]): string[] {
  const mentioned = new Set<string>();
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);

  for (const member of sorted) {
    const pattern = new RegExp(`@${escapeRegex(member.name)}(?![\\p{L}\\p{N}_])`, "iu");
    if (pattern.test(content)) mentioned.add(member.id);
  }

  return [...mentioned];
}

export function filterMentionCandidates(query: string, members: Collaborator[]): Collaborator[] {
  const term = query.trim().toLowerCase();
  if (!term) return members;
  return members.filter((member) => member.name.toLowerCase().includes(term));
}

export function insertMention(value: string, cursor: number, memberName: string): { next: string; cursor: number } {
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) {
    const token = `@${memberName} `;
    return { next: `${before}${token}${after}`, cursor: before.length + token.length };
  }
  const prefix = before.slice(0, atIndex);
  const token = `@${memberName} `;
  return { next: `${prefix}${token}${after}`, cursor: prefix.length + token.length };
}

export function activeMentionQuery(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  const fragment = before.slice(atIndex + 1);
  if (/[\s\n]/.test(fragment)) return null;
  return fragment;
}

export function formatHistoryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function formatHistoryDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "Hoje";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export function groupHistoryByDate(entries: HistoryEntryWithMentions[]) {
  const groups: { label: string; items: HistoryEntryWithMentions[] }[] = [];
  for (const entry of entries) {
    const label = formatHistoryDateLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}

export function mentionHighlightPattern(members: Collaborator[]) {
  const names = [...members]
    .sort((a, b) => b.name.length - a.name.length)
    .map((member) => escapeRegex(member.name));
  if (!names.length) return null;
  return new RegExp(`@(${names.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
}

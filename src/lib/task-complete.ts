import type { Task } from "./types";

function childrenOf(tasks: Task[], id: string) {
  return tasks.filter((t) => t.parentId === id);
}

function descendantIds(tasks: Task[], id: string): string[] {
  const ids: string[] = [];
  for (const child of childrenOf(tasks, id)) {
    ids.push(child.id, ...descendantIds(tasks, child.id));
  }
  return ids;
}

function ancestorIds(tasks: Task[], id: string): string[] {
  const ids: string[] = [];
  let current = tasks.find((t) => t.id === id);
  while (current?.parentId) {
    ids.push(current.parentId);
    current = tasks.find((t) => t.id === current?.parentId);
  }
  return ids;
}

function mark(
  tasks: Task[],
  ids: Set<string>,
  completed: boolean,
  completedAt: string | null,
): Task[] {
  if (!ids.size) return tasks;
  return tasks.map((t) => (ids.has(t.id) ? { ...t, completed, completedAt } : t));
}

function allDirectChildrenComplete(tasks: Task[], parentId: string) {
  const kids = childrenOf(tasks, parentId);
  return kids.length > 0 && kids.every((k) => k.completed);
}

export function applyToggleComplete(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;

  const nextCompleted = !target.completed;

  if (nextCompleted) {
    const toComplete = new Set([id, ...descendantIds(tasks, id)]);
    let next = mark(tasks, toComplete, true, today);
    let cursor = next.find((t) => t.id === id);
    while (cursor?.parentId) {
      if (!allDirectChildrenComplete(next, cursor.parentId)) break;
      next = mark(next, new Set([cursor.parentId]), true, today);
      cursor = next.find((t) => t.id === cursor?.parentId);
    }
    return next;
  }

  const toOpen = new Set([id, ...descendantIds(tasks, id), ...ancestorIds(tasks, id)]);
  return mark(tasks, toOpen, false, null);
}

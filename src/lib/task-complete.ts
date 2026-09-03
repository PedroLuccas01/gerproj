import { TASK_PROGRESS, type TaskProgressStep } from "./constants";
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

export function normalizeTaskProgress(value: number): TaskProgressStep {
  return TASK_PROGRESS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );
}

export function taskProgressOf(task: Pick<Task, "progress" | "completed">) {
  if (task.completed) return 100 as TaskProgressStep;
  return normalizeTaskProgress(task.progress ?? 0);
}

function withProgress(task: Task, progress: number, today: string): Task {
  const next = normalizeTaskProgress(progress);
  return {
    ...task,
    progress: next,
    completed: next === 100,
    completedAt: next === 100 ? task.completedAt ?? today : null,
  };
}

function taskDepth(tasks: Task[], id: string): number {
  const task = tasks.find((t) => t.id === id);
  if (!task?.parentId) return 0;
  return 1 + taskDepth(tasks, task.parentId);
}

export function rawProgressWithChildren(task: Task, tasks: Task[]): number {
  const kids = childrenOf(tasks, task.id);
  if (!kids.length) return taskProgressOf(task);
  const total = kids.reduce((sum, child) => sum + Math.max(1, child.durationDays), 0);
  const earned = kids.reduce(
    (sum, child) => sum + Math.max(1, child.durationDays) * (taskProgressOf(child) / 100),
    0,
  );
  return Math.round((earned / total) * 100);
}

export function progressWithChildren(task: Task, tasks: Task[]): TaskProgressStep {
  const kids = childrenOf(tasks, task.id);
  if (!kids.length) return taskProgressOf(task);
  if (kids.every((child) => taskProgressOf(child) === 100)) return 100;
  const raw = rawProgressWithChildren(task, tasks);
  return TASK_PROGRESS.filter((step) => step < 100).reduce((best, step) =>
    Math.abs(step - raw) < Math.abs(best - raw) ? step : best,
  );
}

export function isParentComplete(task: Task, tasks: Task[]): boolean {
  const kids = childrenOf(tasks, task.id);
  return kids.length > 0 && kids.every((child) => taskProgressOf(child) === 100);
}

export function syncAllParentProgress(tasks: Task[], today: string): Task[] {
  const parentIds = tasks
    .filter((task) => childrenOf(tasks, task.id).length > 0)
    .map((task) => task.id)
    .sort((a, b) => taskDepth(tasks, b) - taskDepth(tasks, a));

  let next = tasks;
  for (const parentId of parentIds) {
    next = rollupParent(next, parentId, today);
  }
  return next;
}

function rollupParent(tasks: Task[], parentId: string, today: string): Task[] {
  const kids = childrenOf(tasks, parentId);
  if (!kids.length) return tasks;
  const total = kids.reduce((sum, task) => sum + Math.max(1, task.durationDays), 0);
  const earned = kids.reduce(
    (sum, task) => sum + Math.max(1, task.durationDays) * (taskProgressOf(task) / 100),
    0,
  );
  const completed = kids.every((task) => taskProgressOf(task) === 100);
  const progress = completed ? 100 : Math.min(99, Math.round((earned / total) * 100));
  return tasks.map((task) => {
    if (task.id !== parentId) return task;
    return {
      ...task,
      progress,
      completed,
      completedAt: completed ? task.completedAt ?? today : null,
    };
  });
}

export function applySetProgress(tasks: Task[], id: string, progress: number, today: string): Task[] {
  const target = tasks.find((task) => task.id === id);
  if (!target) return tasks;

  const nextProgress = normalizeTaskProgress(progress);
  const subtree = new Set([id, ...descendantIds(tasks, id)]);
  let next = tasks.map((task) => (subtree.has(task.id) ? withProgress(task, nextProgress, today) : task));

  let cursor = next.find((task) => task.id === id);
  while (cursor?.parentId) {
    next = rollupParent(next, cursor.parentId, today);
    cursor = next.find((task) => task.id === cursor?.parentId);
  }
  return next;
}

export function applyToggleComplete(tasks: Task[], id: string, today: string): Task[] {
  const target = tasks.find((task) => task.id === id);
  if (!target) return tasks;
  return applySetProgress(tasks, id, taskProgressOf(target) === 100 ? 0 : 100, today);
}

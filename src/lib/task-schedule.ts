import { durationFromRange, endFromDuration, maxIso, minIso } from "./dates";
import type { Task } from "./types";

function childrenOf(tasks: Task[], id: string) {
  return tasks.filter((task) => task.parentId === id);
}

function taskDepth(tasks: Task[], id: string): number {
  const task = tasks.find((item) => item.id === id);
  if (!task?.parentId) return 0;
  return 1 + taskDepth(tasks, task.parentId);
}

export function applyTaskSchedulePatch(task: Task, patch: Partial<Task>): Task {
  const next = { ...task, ...patch };
  const scheduleTouched =
    patch.startDate !== undefined || patch.endDate !== undefined || patch.durationDays !== undefined;

  if (!scheduleTouched) return next;

  const endChanged = patch.endDate !== undefined;
  const durationChanged = patch.durationDays !== undefined;
  const startChanged = patch.startDate !== undefined;

  if (durationChanged && next.startDate) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  } else if (startChanged && next.startDate && next.durationDays && !endChanged) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  } else if (next.startDate && next.endDate) {
    next.durationDays = durationFromRange(next.startDate, next.endDate);
  } else if (next.startDate && next.durationDays) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  }

  return next;
}

export function normalizeTaskSchedule(task: Task): Task {
  if (!task.startDate || task.durationDays < 1) return task;
  const endDate = endFromDuration(task.startDate, task.durationDays);
  if (task.endDate === endDate) return task;
  return { ...task, endDate };
}

export function syncAllTaskSchedules(tasks: Task[], freezeParentId?: string): Task[] {
  const normalized = tasks.map(normalizeTaskSchedule);
  const parentIds = normalized
    .filter((task) => childrenOf(normalized, task.id).length > 0)
    .map((task) => task.id)
    .sort((a, b) => taskDepth(normalized, b) - taskDepth(normalized, a));

  let next = normalized;
  for (const parentId of parentIds) {
    if (parentId === freezeParentId) continue;
    next = expandParentSchedule(next, parentId);
  }
  return next;
}

export function taskScheduleChanged(before: Task, after: Task): boolean {
  return (
    before.startDate !== after.startDate ||
    before.endDate !== after.endDate ||
    before.durationDays !== after.durationDays
  );
}

function expandParentSchedule(tasks: Task[], parentId: string): Task[] {
  const parent = tasks.find((task) => task.id === parentId);
  if (!parent) return tasks;

  const dated = childrenOf(tasks, parentId)
    .map(normalizeTaskSchedule)
    .filter((child) => child.startDate && child.endDate);
  if (!dated.length) return tasks;

  const childStart = minIso(dated.map((child) => child.startDate!));
  const childEnd = maxIso(dated.map((child) => child.endDate!));

  let startDate = parent.startDate;
  let endDate = parent.endDate;

  if (!startDate || !endDate) {
    startDate = childStart;
    endDate = childEnd;
  } else {
    startDate = childStart < startDate ? childStart : startDate;
    endDate = childEnd > endDate ? childEnd : endDate;
  }

  const durationDays = durationFromRange(startDate, endDate);
  if (
    parent.startDate === startDate &&
    parent.endDate === endDate &&
    parent.durationDays === durationDays
  ) {
    return tasks;
  }

  return tasks.map((task) =>
    task.id === parentId ? { ...task, startDate, endDate, durationDays } : task,
  );
}

export function syncAllParentSchedules(tasks: Task[]): Task[] {
  const parentIds = tasks
    .filter((task) => childrenOf(tasks, task.id).length > 0)
    .map((task) => task.id)
    .sort((a, b) => taskDepth(tasks, b) - taskDepth(tasks, a));

  let next = tasks;
  for (const parentId of parentIds) {
    next = expandParentSchedule(next, parentId);
  }
  return next;
}

export function inheritedSubtaskSchedule(parentStartDate: string | null | undefined) {
  if (!parentStartDate) {
    return { startDate: null, endDate: null, durationDays: 1 };
  }
  return {
    startDate: parentStartDate,
    endDate: endFromDuration(parentStartDate, 1),
    durationDays: 1,
  };
}

export function initialSubtaskSchedule(parent: Task | undefined): Pick<Task, "startDate" | "endDate" | "durationDays"> {
  return inheritedSubtaskSchedule(parent?.startDate ?? null);
}

export function parentScheduleChanged(before: Task, after: Task): boolean {
  return taskScheduleChanged(before, after);
}

export function parentSchedulePatch(task: Task): Partial<Task> {
  return {
    startDate: task.startDate,
    endDate: task.endDate,
    durationDays: task.durationDays,
  };
}

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

  if (next.startDate && next.endDate) {
    next.durationDays = durationFromRange(next.startDate, next.endDate);
  } else if (next.startDate && next.durationDays) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  }

  return next;
}

export function parentScheduleOf(
  task: Task,
  tasks: Task[],
): Pick<Task, "startDate" | "endDate" | "durationDays"> {
  const kids = childrenOf(tasks, task.id);
  const dated = kids.filter((child) => child.startDate && child.endDate);
  if (!dated.length) {
    return {
      startDate: task.startDate,
      endDate: task.endDate,
      durationDays: task.durationDays,
    };
  }

  const startDate = minIso(dated.map((child) => child.startDate!));
  const endDate = maxIso(dated.map((child) => child.endDate!));
  return {
    startDate,
    endDate,
    durationDays: durationFromRange(startDate, endDate),
  };
}

function rollupParentSchedule(tasks: Task[], parentId: string): Task[] {
  const kids = childrenOf(tasks, parentId);
  if (!kids.length) return tasks;

  const dated = kids.filter((child) => child.startDate && child.endDate);
  if (!dated.length) return tasks;

  const startDate = minIso(dated.map((child) => child.startDate!));
  const endDate = maxIso(dated.map((child) => child.endDate!));
  const durationDays = durationFromRange(startDate, endDate);

  return tasks.map((task) => {
    if (task.id !== parentId) return task;
    return { ...task, startDate, endDate, durationDays };
  });
}

export function syncAllParentSchedules(tasks: Task[]): Task[] {
  const parentIds = tasks
    .filter((task) => childrenOf(tasks, task.id).length > 0)
    .map((task) => task.id)
    .sort((a, b) => taskDepth(tasks, b) - taskDepth(tasks, a));

  let next = tasks;
  for (const parentId of parentIds) {
    next = rollupParentSchedule(next, parentId);
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
  return (
    before.startDate !== after.startDate ||
    before.endDate !== after.endDate ||
    before.durationDays !== after.durationDays
  );
}

export function parentSchedulePatch(task: Task): Partial<Task> {
  return {
    startDate: task.startDate,
    endDate: task.endDate,
    durationDays: task.durationDays,
  };
}

import type { ProjectStatus, Task } from "./types";
import { taskProgressOf } from "./task-complete";

export type ScheduleTask = Pick<Task, "id" | "parentId" | "completed" | "durationDays" | "progress">;

function leafTasks(tasks: ScheduleTask[]) {
  const parentsWithChildren = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const leaves = tasks.filter((t) => !parentsWithChildren.has(t.id));
  return leaves.length ? leaves : tasks;
}

export function scheduleProgress(tasks: ScheduleTask[]) {
  const pool = leafTasks(tasks);
  if (!pool.length) return 0;
  const weight = (task: ScheduleTask) => Math.max(1, task.durationDays);
  const total = pool.reduce((sum, task) => sum + weight(task), 0);
  const earned = pool.reduce((sum, task) => sum + weight(task) * (taskProgressOf(task) / 100), 0);
  return Math.round((earned / total) * 100);
}

export function statusAfterScheduleChange(current: ProjectStatus, tasks: ScheduleTask[]): ProjectStatus {
  if (current === "cancelado") return current;
  if (tasks.length > 0 && scheduleProgress(tasks) === 100) return "concluido";
  if (current === "concluido") return "em_andamento";
  return current;
}

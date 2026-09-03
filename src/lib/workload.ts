import { addDaysIso, eachWeek, startOfWeek, todayIso, weekEnd } from "./dates";
import type { Collaborator, Project, ProjectStatus, Task } from "./types";

export const WORKLOAD_PAST_WEEKS = 1;
export const WORKLOAD_WEEK_COUNT = 12;
export const WATCH_FRENTES = 2;
export const CONFLICT_FRENTES = 3;

const ACTIVE_STATUS: ProjectStatus[] = ["planejamento", "em_andamento"];

export type TaskWindow = { start: string; end: string };

export type FrenteInWeek = {
  projectId: string;
  taskCount: number;
};

export type WeekLoad = {
  weekStart: string;
  frentes: FrenteInWeek[];
};

export type PersonLoad = {
  collaborator: Collaborator;
  weeks: WeekLoad[];
  undatedOpen: number;
  maxFrentes: number;
  thisWeekFrentes: number;
};

export function taskWindow(task: Task): TaskWindow | null {
  if (task.startDate && task.endDate) {
    return task.startDate <= task.endDate
      ? { start: task.startDate, end: task.endDate }
      : { start: task.endDate, end: task.startDate };
  }
  if (task.startDate) {
    return {
      start: task.startDate,
      end: addDaysIso(task.startDate, Math.max(1, task.durationDays) - 1),
    };
  }
  if (task.endDate) {
    return {
      start: addDaysIso(task.endDate, -(Math.max(1, task.durationDays) - 1)),
      end: task.endDate,
    };
  }
  return null;
}

export function rangesOverlap(a: TaskWindow, b: TaskWindow) {
  return a.start <= b.end && b.start <= a.end;
}

export function workloadWeeks(today = todayIso()) {
  const current = startOfWeek(today);
  const first = addDaysIso(current, -WORKLOAD_PAST_WEEKS * 7);
  return eachWeek(first, WORKLOAD_WEEK_COUNT);
}

function isActiveProject(project: Project | undefined) {
  return Boolean(project && ACTIVE_STATUS.includes(project.status));
}

export function buildWorkload(input: {
  collaborators: Collaborator[];
  projects: Project[];
  tasks: Task[];
  today?: string;
}): PersonLoad[] {
  const today = input.today ?? todayIso();
  const weeks = workloadWeeks(today);
  const thisWeek = startOfWeek(today);
  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const people = input.collaborators.filter((person) => person.active);

  return people
    .map((collaborator) => {
      const assigned = input.tasks.filter(
        (task) => task.assigneeId === collaborator.id && !task.completed && isActiveProject(projectById.get(task.projectId)),
      );
      const dated = assigned
        .map((task) => {
          const window = taskWindow(task);
          return window ? { task, window } : null;
        })
        .filter((item): item is { task: Task; window: TaskWindow } => item !== null);

      const weekLoads: WeekLoad[] = weeks.map((weekStart) => {
        const span = { start: weekStart, end: weekEnd(weekStart) };
        const counts = new Map<string, number>();
        for (const item of dated) {
          if (!rangesOverlap(item.window, span)) continue;
          counts.set(item.task.projectId, (counts.get(item.task.projectId) ?? 0) + 1);
        }
        const frentes = [...counts.entries()]
          .map(([projectId, taskCount]) => ({ projectId, taskCount }))
          .sort((a, b) => b.taskCount - a.taskCount);
        return { weekStart, frentes };
      });

      const maxFrentes = weekLoads.reduce((max, week) => Math.max(max, week.frentes.length), 0);
      const thisWeekFrentes = weekLoads.find((week) => week.weekStart === thisWeek)?.frentes.length ?? 0;

      return {
        collaborator,
        weeks: weekLoads,
        undatedOpen: assigned.length - dated.length,
        maxFrentes,
        thisWeekFrentes,
      };
    })
    .filter((person) => person.maxFrentes > 0 || person.undatedOpen > 0)
    .sort((a, b) => {
      if (a.thisWeekFrentes !== b.thisWeekFrentes) return b.thisWeekFrentes - a.thisWeekFrentes;
      if (a.maxFrentes !== b.maxFrentes) return b.maxFrentes - a.maxFrentes;
      return a.collaborator.name.localeCompare(b.collaborator.name, "pt-BR");
    });
}

export function loadTone(frentes: number) {
  if (frentes >= CONFLICT_FRENTES) return "danger" as const;
  if (frentes >= WATCH_FRENTES) return "watch" as const;
  if (frentes === 1) return "ok" as const;
  return "empty" as const;
}

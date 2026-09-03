import type { Task } from "@/lib/types";

export type TaskTreeNode = {
  sourceId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  assigneeIds: string[];
  progress: number;
  completed: boolean;
  completedAt: string | null;
  collapsed: boolean;
  dependencies: string[];
  children: TaskTreeNode[];
};

export function snapshotTaskTree(tasks: Task[], root: Task): TaskTreeNode {
  const children = tasks
    .filter((task) => task.parentId === root.id)
    .sort((a, b) => a.order - b.order)
    .map((child) => snapshotTaskTree(tasks, child));

  return {
    sourceId: root.id,
    name: root.name,
    startDate: root.startDate,
    endDate: root.endDate,
    durationDays: root.durationDays,
    assigneeIds: [...root.assigneeIds],
    progress: root.progress,
    completed: root.completed,
    completedAt: root.completedAt,
    collapsed: root.collapsed,
    dependencies: [...root.dependencies],
    children,
  };
}

export function countTreeNodes(node: TaskTreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0);
}

export function collectAssigneeIds(node: TaskTreeNode, into = new Set<string>()) {
  for (const id of node.assigneeIds) into.add(id);
  for (const child of node.children) collectAssigneeIds(child, into);
  return into;
}

export function parseTaskTree(raw: unknown, depth = 0): TaskTreeNode | null {
  if (!raw || typeof raw !== "object" || depth > 8) return null;
  const node = raw as Record<string, unknown>;
  if (typeof node.sourceId !== "string" || typeof node.name !== "string") return null;
  const childrenRaw = Array.isArray(node.children) ? node.children : [];
  if (childrenRaw.length > 80) return null;
  const children: TaskTreeNode[] = [];
  for (const child of childrenRaw) {
    const parsed = parseTaskTree(child, depth + 1);
    if (parsed) children.push(parsed);
  }

  let assigneeIds: string[] = [];
  if (Array.isArray(node.assigneeIds)) {
    assigneeIds = node.assigneeIds.filter((id): id is string => typeof id === "string" && Boolean(id));
  } else if (typeof node.assigneeId === "string" && node.assigneeId) {
    assigneeIds = [node.assigneeId];
  }

  return {
    sourceId: node.sourceId,
    name: node.name.trim() || "Nova tarefa",
    startDate: typeof node.startDate === "string" ? node.startDate : null,
    endDate: typeof node.endDate === "string" ? node.endDate : null,
    durationDays: Number(node.durationDays) > 0 ? Math.floor(Number(node.durationDays)) : 1,
    assigneeIds,
    progress: clampProgress(Number(node.progress)),
    completed: Boolean(node.completed) || Number(node.progress) === 100,
    completedAt: typeof node.completedAt === "string" ? node.completedAt : null,
    collapsed: Boolean(node.collapsed),
    dependencies: Array.isArray(node.dependencies)
      ? node.dependencies.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [],
    children,
  };
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

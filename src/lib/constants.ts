import type { Area, ProjectStatus, TaskPhase } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planejamento: "#3b82f6",
  em_andamento: "#22c55e",
  concluido: "#64748b",
  cancelado: "#ef4444",
};

export const STATUS_BADGE: Record<ProjectStatus, string> = {
  planejamento: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900",
  em_andamento: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  concluido: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  cancelado: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900",
};

export const PHASE_LABEL: Record<TaskPhase, string> = {
  planejamento: "Planejamento",
  desenvolvimento: "Desenvolvimento",
  testes: "Testes",
  entrega: "Entrega",
  finalizado: "Finalizado",
};

export const PHASE_COLOR: Record<TaskPhase, string> = {
  planejamento: "#3b82f6",
  desenvolvimento: "#8b5cf6",
  testes: "#f97316",
  entrega: "#22c55e",
  finalizado: "#94a3b8",
};

export const PHASE_HEADER: Record<TaskPhase, string> = {
  planejamento: "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  desenvolvimento: "bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  testes: "bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  entrega: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  finalizado: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const PHASES: TaskPhase[] = [
  "planejamento",
  "desenvolvimento",
  "testes",
  "entrega",
  "finalizado",
];

export const AREA_LABEL: Record<Area, string> = {
  automacao: "Automação",
  mecanica: "Mecânica",
  hardware: "Hardware",
  software: "Software",
  gestao: "Gestão",
  compras: "Compras",
  financeiro: "Financeiro",
  pcp: "PCP",
};

export const BUDGET_AREAS = [
  { key: "automacao", label: "Automação" },
  { key: "mecanica", label: "Mecânica" },
  { key: "hardware", label: "Hardware" },
  { key: "software", label: "Software" },
] as const;

export const TASK_PROGRESS = [0, 25, 50, 75, 100] as const;
export type TaskProgressStep = (typeof TASK_PROGRESS)[number];

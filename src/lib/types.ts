export type ProjectStatus =
  | "planejamento"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export type Area =
  | "automacao"
  | "mecanica"
  | "hardware"
  | "software"
  | "gestao"
  | "compras"
  | "financeiro"
  | "pcp";

export type TaskPhase =
  | "planejamento"
  | "desenvolvimento"
  | "testes"
  | "entrega"
  | "finalizado";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: string;
  area: Area;
  phone: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
}

export interface BudgetByArea {
  automacao: number;
  mecanica: number;
  hardware: number;
  software: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  clientId: string | null;
  leaderId: string | null;
  durationDays: number;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  budget: number;
  budgetByArea: BudgetByArea;
  teamIds: string[];
  notes: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  phase: TaskPhase;
  seq: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  assigneeId: string | null;
  completed: boolean;
  completedAt: string | null;
  dependencies: string[];
  order: number;
  collapsed: boolean;
}

export interface AppState {
  collaborators: Collaborator[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
}

export type ProjectDraft = Omit<Project, "id" | "createdAt">;
export type CollaboratorDraft = Omit<Collaborator, "id">;
export type ClientDraft = Omit<Client, "id">;

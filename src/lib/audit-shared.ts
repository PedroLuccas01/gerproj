export const AUDIT_FIELDS = ["prazo", "status", "orcamento", "equipe", "senha"] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];
export type AuditAction = "update" | "auto";
export type AuditEntityType = "project" | "user";

export const AUDIT_FIELD_LABEL: Record<AuditField, string> = {
  prazo: "Prazo",
  status: "Status",
  orcamento: "Orçamento",
  equipe: "Equipe",
  senha: "Senha",
};

export const AUDIT_FIELD_BADGE: Record<AuditField, string> = {
  prazo: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
  status: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
  orcamento: "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  equipe: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  senha: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

export type AuditEvent = {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  field: AuditField;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
};

export function isAuditField(value: string | null | undefined): value is AuditField {
  return Boolean(value && (AUDIT_FIELDS as readonly string[]).includes(value));
}

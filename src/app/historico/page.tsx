"use client";

import { useState } from "react";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { AUDIT_FIELD_LABEL, AUDIT_FIELDS, type AuditField } from "@/lib/audit-shared";
import { cn } from "@/components/ui";

type Filter = "all" | AuditField;

const FILTERS: Filter[] = ["all", ...AUDIT_FIELDS];

export default function HistoricoPage() {
  const [field, setField] = useState<Filter>("all");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Histórico</h1>
        <p className="mt-1 text-sm text-muted">
          Quem alterou prazo, status, orçamento, equipe ou senha.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setField(item)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
              field === item
                ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900"
                : "bg-surface text-muted ring-line hover:bg-hover hover:text-ink",
            )}
          >
            {item === "all" ? "Tudo" : AUDIT_FIELD_LABEL[item]}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface px-5 py-2">
        <AuditLogPanel field={field} />
      </section>
    </div>
  );
}

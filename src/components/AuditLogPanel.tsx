"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AUDIT_FIELD_BADGE, AUDIT_FIELD_LABEL, type AuditEvent, type AuditField } from "@/lib/audit-shared";
import { cn } from "./ui";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function AuditLogPanel({
  projectId,
  field,
  refreshKey = 0,
  emptyText = "Nenhuma alteração registrada ainda.",
}: {
  projectId?: string;
  field?: AuditField | "all";
  refreshKey?: number;
  emptyText?: string;
}) {
  const [items, setItems] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "120" });
    if (projectId) {
      params.set("entityType", "project");
      params.set("entityId", projectId);
    }
    if (field && field !== "all") params.set("field", field);
    const response = await fetch(`/api/audit?${params.toString()}`);
    const data = (await response.json()) as { items?: AuditEvent[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Não foi possível carregar o histórico.");
    }
    setItems(data.items ?? []);
  }, [projectId, field, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setItems(null);
    load().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
      setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (items === null) {
    return <p className="text-sm text-muted">Carregando histórico...</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (!items.length) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }

  return (
    <ol className="divide-y divide-line-subtle">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-3">
          <span
            className={cn(
              "mt-0.5 inline-flex w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              AUDIT_FIELD_BADGE[item.field],
            )}
          >
            {AUDIT_FIELD_LABEL[item.field]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">{item.summary}</p>
            <p className="mt-0.5 text-xs text-muted">
              {item.actorName}
              {item.action === "auto" ? " · automático" : ""}
              {" · "}
              {formatWhen(item.createdAt)}
              {!projectId && item.entityType === "project" ? (
                <>
                  {" · "}
                  <Link href={`/projetos/${item.entityId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {item.entityLabel}
                  </Link>
                </>
              ) : null}
              {!projectId && item.entityType === "user" ? ` · ${item.entityLabel}` : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

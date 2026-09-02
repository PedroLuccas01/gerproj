"use client";

import { ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProjectFormModal } from "@/components/ProjectFormModal";
import { ShareLinkMenu } from "@/components/ShareLinkButton";
import { Button, StatusBadge, cn } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isAllocatedToProject } from "@/lib/access-shared";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { formatBr } from "@/lib/dates";
import { useFeedback } from "@/lib/feedback";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ProjectStatus } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function ProjetosPage() {
  const { state, updateProject } = useStore();
  const { user } = useAuth();
  const { notify } = useFeedback();
  const isManagement = Boolean(user?.isManagement);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const list = useMemo(() => {
    return state.projects.filter((p) => {
      if (!isManagement && !isAllocatedToProject(p, user?.collaboratorId ?? null)) {
        return false;
      }
      const q = query.trim().toLowerCase();
      return (
        (!q || p.name.toLowerCase().includes(q)) &&
        (status === "all" || p.status === status)
      );
    });
  }, [state.projects, query, status, isManagement, user?.collaboratorId]);

  async function changeStatus(id: string, next: ProjectStatus) {
    const current = state.projects.find((p) => p.id === id);
    if (!current || current.status === next) return;
    setSavingId(id);
    try {
      await updateProject(id, { status: next });
    } catch (error) {
      notify({
        type: "error",
        title: "Não foi possível atualizar o status",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Projetos</h1>
          <p className="text-sm text-muted">
            {isManagement
              ? "Cadastre prazo, orçamento, equipe e acompanhe cada obra do planejamento à entrega."
              : "Acompanhe os projetos em que você está alocado."}
          </p>
        </div>
        {isManagement ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar projeto..."
            className="w-full rounded-lg border border-line bg-control py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-focus"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "all")}
          className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink"
        >
          <option value="all">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((project) => {
          const client = state.clients.find((c) => c.id === project.clientId);
          const leader = state.collaborators.find((c) => c.id === project.leaderId);
          const taskCount = state.tasks.filter((t) => t.projectId === project.id);
          const done = taskCount.filter((t) => t.completed).length;
          return (
            <article key={project.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={isManagement ? `/projetos/${project.id}` : `/projetos/${project.id}/cronograma`}
                    className="text-base font-semibold text-navy hover:underline"
                  >
                    {project.name}
                  </Link>
                  <div className="mt-1 text-xs text-muted">
                    {client?.name ?? "Sem cliente"} · {leader?.name ?? "Sem líder"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isManagement ? (
                    <ProjectStatusSelect
                      value={project.status}
                      disabled={savingId === project.id}
                      onChange={(next) => changeStatus(project.id, next)}
                    />
                  ) : (
                    <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
                  )}
                  {isManagement ? <ShareLinkMenu projectId={project.id} /> : null}
                </div>
              </div>
              <div className={`mt-4 grid gap-3 text-xs text-muted ${isManagement ? "grid-cols-3" : "grid-cols-2"}`}>
                <div>
                  <div className="font-medium text-faint">Prazo</div>
                  <div className="mt-0.5 text-ink">
                    {formatBr(project.startDate)} – {formatBr(project.endDate)}
                  </div>
                </div>
                {isManagement ? (
                  <div>
                    <div className="font-medium text-faint">Orçamento</div>
                    <div className="mt-0.5 text-ink">R$ {formatBRL(project.budget)}</div>
                  </div>
                ) : null}
                <div>
                  <div className="font-medium text-faint">Tarefas</div>
                  <div className="mt-0.5 text-ink">
                    {done}/{taskCount.length}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/projetos/${project.id}/cronograma`}
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/60"
                >
                  Cronograma
                </Link>
                {isManagement ? (
                  <Link
                    href={`/projetos/${project.id}`}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-hover"
                  >
                    Detalhes
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {isManagement ? (
        <ProjectFormModal
          open={open}
          onClose={() => setOpen(false)}
          onCreated={(id) => router.push(`/projetos/${id}/cronograma`)}
        />
      ) : null}
    </div>
  );
}

function ProjectStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        disabled={disabled}
        aria-label="Status do projeto"
        title="Alterar status"
        onChange={(e) => onChange(e.target.value as ProjectStatus)}
        className={cn(
          "cursor-pointer appearance-none rounded-full py-0.5 pl-2.5 pr-6 text-[11px] font-semibold outline-none ring-1 ring-inset disabled:cursor-wait disabled:opacity-70",
          STATUS_BADGE[value],
        )}
      >
        {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
    </div>
  );
}

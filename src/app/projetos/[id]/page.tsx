"use client";

import { CalendarRange, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectFormModal } from "@/components/ProjectFormModal";
import { Button, StatusBadge } from "@/components/ui";
import { AREA_LABEL, BUDGET_AREAS, STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { formatBr } from "@/lib/dates";
import { useFeedback } from "@/lib/feedback";
import { formatBRL } from "@/lib/format";
import { useStore } from "@/lib/store";

export default function ProjetoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, deleteProject } = useStore();
  const { confirm, notify } = useFeedback();
  const [edit, setEdit] = useState(false);
  const project = state.projects.find((p) => p.id === params.id);

  if (!project) {
    return (
      <div className="p-6 text-sm text-muted">
        Projeto não encontrado.{" "}
        <Link href="/projetos" className="text-blue-600 dark:text-blue-400">
          Voltar
        </Link>
      </div>
    );
  }

  const client = state.clients.find((c) => c.id === project.clientId);
  const leader = state.collaborators.find((c) => c.id === project.leaderId);
  const team = state.collaborators.filter((c) => project.teamIds.includes(c.id));
  const tasks = state.tasks.filter((t) => t.projectId === project.id);
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/projetos" className="text-xs font-medium text-blue-600 dark:text-blue-400">
            ← Projetos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-navy">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
            <span className="text-sm text-muted">
              {formatBr(project.startDate)} – {formatBr(project.endDate)} · {project.durationDays} dias
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projetos/${project.id}/cronograma`}>
            <Button>
              <CalendarRange className="h-4 w-4" />
              Cronograma
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 dark:text-red-400"
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir projeto",
                description:
                  "Excluir este projeto e o cronograma? Esta ação não pode ser desfeita.",
                confirmLabel: "Excluir",
                tone: "danger",
              });
              if (!ok) return;
              try {
                await deleteProject(project.id);
                notify({ type: "success", title: "Projeto excluído" });
                router.push("/projetos");
              } catch (error) {
                notify({
                  type: "error",
                  title: "Não foi possível excluir",
                  description: error instanceof Error ? error.message : undefined,
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {project.description ? (
        <p className="max-w-3xl text-sm leading-6 text-muted">{project.description}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Info title="Cliente" value={client?.name ?? "Nenhum cliente"} />
        <Info title="Líder" value={leader?.name ?? "Nenhum líder"} />
        <Info title="Tarefas" value={`${done} de ${tasks.length} concluídas`} />
        <Info title="Orçamento previsto" value={`R$ ${formatBRL(project.budget)}`} />
        <Info
          title="Equipe"
          value={`${team.length} colaborador(es)`}
        />
        <Info title="Observações" value={project.notes || "—"} />
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-navy">Valores por área</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {BUDGET_AREAS.map((area) => (
            <div key={area.key} className="rounded-lg bg-surface-2 p-3">
              <div className="text-xs text-muted">{area.label}</div>
              <div className="mt-1 text-sm font-semibold text-navy">
                R$ {formatBRL(project.budgetByArea[area.key])}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-navy">Equipe do projeto</h2>
        {team.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum colaborador selecionado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-subtle">
            {team.map((person) => (
              <li key={person.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-ink">{person.name}</span>
                <span className="text-muted">
                  {person.role} · {AREA_LABEL[person.area]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProjectFormModal open={edit} onClose={() => setEdit(false)} project={project} />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-faint">{title}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

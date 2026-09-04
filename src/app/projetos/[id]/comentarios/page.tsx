"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ProjectHistoryPanel } from "@/components/ProjectHistoryPanel";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { StatusBadge } from "@/components/ui";
import { isAllocatedToProject } from "@/lib/access-shared";
import { useAuth } from "@/lib/auth";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { formatBr } from "@/lib/dates";
import { useStore } from "@/lib/store";

export default function ProjetoComentariosPage() {
  const params = useParams<{ id: string }>();
  const { state } = useStore();
  const { user } = useAuth();
  const isManagement = Boolean(user?.isManagement);
  const project = state.projects.find((item) => item.id === params.id);
  const allocated = isAllocatedToProject(project ?? { leaderId: null, teamIds: [] }, user?.collaboratorId ?? null);

  if (!project || (!isManagement && !allocated)) {
    return (
      <div className="p-6 text-sm text-muted">
        Projeto não encontrado.{" "}
        <Link href="/projetos" className="text-blue-600 dark:text-blue-400">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <Link
          href={isManagement ? `/projetos/${project.id}` : "/projetos"}
          className="text-xs font-medium text-blue-600 dark:text-blue-400"
        >
          ← {isManagement ? project.name : "Projetos"}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-navy">Comentários</h1>
          <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
        </div>
        <p className="mt-1 text-sm text-muted">
          Registro de observações, decisões e ocorrências do projeto, com anexos e menções à equipe.
        </p>
        <p className="mt-1 text-xs text-faint">
          {formatBr(project.startDate)} – {formatBr(project.endDate)} · {project.durationDays} dias
        </p>
      </div>

      <ProjectSubnav projectId={project.id} isManagement={isManagement} />

      <ProjectHistoryPanel
        project={project}
        collaborators={state.collaborators}
        canWrite={isManagement || allocated}
        isManagement={isManagement}
      />
    </div>
  );
}

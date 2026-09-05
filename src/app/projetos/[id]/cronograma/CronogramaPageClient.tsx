"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectCommentsDrawer, type CommentsDrawerMode } from "@/components/ProjectCommentsDrawer";
import { ProjectGantt } from "@/components/ProjectGantt";
import { ExportScheduleButtons } from "@/components/ExportScheduleButtons";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { Button, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isAllocatedToProject } from "@/lib/access-shared";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { formatBr } from "@/lib/dates";
import { useStore } from "@/lib/store";

type HistoryCounts = { project: number; tasks: Record<string, number> };

export function CronogramaPageClient() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state } = useStore();
  const { user } = useAuth();
  const isManagement = Boolean(user?.isManagement);
  const project = state.projects.find((p) => p.id === params.id);
  const allocated = isAllocatedToProject(project ?? { leaderId: null, teamIds: [] }, user?.collaboratorId ?? null);
  const tasks = useMemo(
    () => state.tasks.filter((task) => task.projectId === params.id),
    [state.tasks, params.id],
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CommentsDrawerMode>("comments");
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [counts, setCounts] = useState<HistoryCounts>({ project: 0, tasks: {} });

  const drawerTask = useMemo(
    () => (drawerTaskId ? tasks.find((task) => task.id === drawerTaskId) ?? null : null),
    [drawerTaskId, tasks],
  );

  const refreshCounts = useCallback(async () => {
    if (!project) return;
    try {
      const response = await fetch(`/api/projects/${project.id}/history/counts`);
      const data = (await response.json()) as HistoryCounts & { error?: string };
      if (response.ok) setCounts({ project: data.project ?? 0, tasks: data.tasks ?? {} });
    } catch {
      // ignore count refresh errors
    }
  }, [project]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (!project) return;
    const openComments = searchParams.get("comentarios") === "1";
    const solicitacaoTaskId = searchParams.get("solicitacao");
    if (openComments) {
      setDrawerMode("comments");
      setDrawerTaskId(null);
      setDrawerOpen(true);
      void markPanelNotificationsRead("comments", null);
    } else if (solicitacaoTaskId) {
      setDrawerMode("requests");
      setDrawerTaskId(solicitacaoTaskId);
      setDrawerOpen(true);
      void markPanelNotificationsRead("requests", solicitacaoTaskId);
    }
  }, [project, searchParams]);

  async function markPanelNotificationsRead(mode: CommentsDrawerMode, taskId: string | null) {
    if (!project) return;
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        taskId: mode === "requests" ? taskId : null,
      }),
    });
  }

  function openDrawer(mode: CommentsDrawerMode, taskId?: string | null) {
    setDrawerMode(mode);
    setDrawerTaskId(taskId ?? null);
    setDrawerOpen(true);
    void markPanelNotificationsRead(mode, taskId ?? null);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("comentarios");
    next.delete("solicitacao");
    if (mode === "comments") next.set("comentarios", "1");
    else if (taskId) next.set("solicitacao", taskId);
    router.replace(`/projetos/${params.id}/cronograma?${next.toString()}`, { scroll: false });
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerTaskId(null);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("comentarios");
    next.delete("solicitacao");
    const query = next.toString();
    router.replace(
      query ? `/projetos/${params.id}/cronograma?${query}` : `/projetos/${params.id}/cronograma`,
      { scroll: false },
    );
  }

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

  const canWrite = isManagement || allocated;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={isManagement ? `/projetos/${project.id}` : "/projetos"}
            className="text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            ← {isManagement ? project.name : "Projetos"}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-navy">Cronograma</h1>
            <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
          </div>
          <p className="mt-1 text-xs text-faint">
            {formatBr(project.startDate)} – {formatBr(project.endDate)} · {project.durationDays} dias
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => openDrawer("comments")}
            className="relative"
            title="Comentários do projeto"
          >
            <MessageCircle className="h-4 w-4" />
            Comentários
            {counts.project > 0 ? (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {counts.project}
              </span>
            ) : null}
          </Button>
          <ExportScheduleButtons
            input={{
              project,
              tasks,
              people: state.collaborators,
              clientName: state.clients.find((client) => client.id === project.clientId)?.name,
            }}
          />
        </div>
      </div>

      <ProjectSubnav projectId={project.id} isManagement={isManagement} />

      <ProjectGantt
        project={project}
        readOnly={!isManagement}
        requestCounts={counts.tasks}
        onOpenTaskRequests={(task) => openDrawer("requests", task.id)}
      />

      <ProjectCommentsDrawer
        open={drawerOpen}
        mode={drawerMode}
        project={project}
        collaborators={state.collaborators}
        canWrite={canWrite}
        isManagement={isManagement}
        task={drawerTask}
        onClose={closeDrawer}
        onEntriesChange={() => void refreshCounts()}
      />
    </div>
  );
}

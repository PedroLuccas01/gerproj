"use client";

import { MessageCircle, X } from "lucide-react";
import { ProjectHistoryPanel } from "@/components/ProjectHistoryPanel";
import type { Collaborator, Project, Task } from "@/lib/types";

export type CommentsDrawerMode = "comments" | "requests";

export function ProjectCommentsDrawer({
  open,
  mode,
  project,
  collaborators,
  canWrite,
  isManagement,
  task,
  onClose,
  onEntriesChange,
}: {
  open: boolean;
  mode: CommentsDrawerMode;
  project: Project;
  collaborators: Collaborator[];
  canWrite: boolean;
  isManagement: boolean;
  task?: Task | null;
  onClose: () => void;
  onEntriesChange?: () => void;
}) {
  if (!open) return null;

  const isComments = mode === "comments";
  const title = isComments ? "Comentários do projeto" : "Solicitações da atividade";
  const subtitle = isComments
    ? "Observações, decisões e ocorrências gerais do projeto."
    : task
      ? `#${task.seq} ${task.name}`
      : "Selecione uma atividade.";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/45 dark:bg-black/55"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-3xl flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-navy">{title}</h2>
            </div>
            <p className="mt-1 truncate text-sm text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-faint hover:bg-hover hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isComments || task ? (
            <ProjectHistoryPanel
              project={project}
              collaborators={collaborators}
              canWrite={canWrite}
              isManagement={isManagement}
              scope={isComments ? "project" : "task"}
              taskId={isComments ? undefined : task?.id}
              taskLabel={isComments ? undefined : task ? `#${task.seq} ${task.name}` : undefined}
              embedded
              onEntriesChange={onEntriesChange}
            />
          ) : (
            <p className="text-sm text-muted">Atividade não encontrada.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

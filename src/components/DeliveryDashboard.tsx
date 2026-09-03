"use client";

import { AlertCircle, CalendarDays, CheckCircle2, Clock, Eye, EyeOff, MoreHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { isAllocatedToProject } from "@/lib/access-shared";
import { STATUS_BADGE, STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { addDaysIso, diffDays, formatBr, todayIso } from "@/lib/dates";
import { plural } from "@/lib/format";
import { scheduleProgress } from "@/lib/schedule-progress";
import { useStore } from "@/lib/store";
import type { Project, ProjectStatus, Task } from "@/lib/types";
import { cn, StatusBadge } from "./ui";

const PERCENT_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
const HIDDEN_KEY = "pdef-hidden-projects";

function hiddenStorageKey(userId: string) {
  return `${HIDDEN_KEY}:${userId}`;
}

function readHiddenIds(userId: string) {
  try {
    const raw = localStorage.getItem(hiddenStorageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeHiddenIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(hiddenStorageKey(userId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function expectedProgress(project: Project, today: string) {
  if (!project.startDate || !project.endDate) return 0;
  if (today <= project.startDate) return 0;
  if (today >= project.endDate) return 100;
  const total = Math.max(1, diffDays(project.startDate, project.endDate));
  const elapsed = diffDays(project.startDate, today);
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function overdueActivities(tasks: Task[], today: string) {
  return tasks.filter((task) => {
    if (task.completed) return false;
    const end =
      task.endDate ??
      (task.startDate ? addDaysIso(task.startDate, Math.max(1, task.durationDays)) : null);
    return Boolean(end && end < today);
  });
}

function inWindow(project: Project, days: number, today: string) {
  if (!project.endDate || project.status === "cancelado") return false;
  const limit = addDaysIso(today, days);
  return project.endDate >= today && project.endDate <= limit;
}

export function DeliveryDashboard() {
  const { state } = useStore();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const today = todayIso();

  useEffect(() => {
    if (!user?.id) return;
    setHiddenIds(readHiddenIds(user.id));
  }, [user?.id]);

  function persistHidden(next: Set<string>) {
    setHiddenIds(next);
    if (user?.id) writeHiddenIds(user.id, next);
  }

  function hideProject(id: string) {
    persistHidden(new Set([...hiddenIds, id]));
  }

  function unhideProject(id: string) {
    const next = new Set(hiddenIds);
    next.delete(id);
    persistHidden(next);
  }

  const overdueByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const project of state.projects) {
      if (project.status === "cancelado") continue;
      const late = overdueActivities(
        state.tasks.filter((task) => task.projectId === project.id),
        today,
      );
      if (late.length) map.set(project.id, late);
    }
    return map;
  }, [state.projects, state.tasks, today]);

  const filtered = useMemo(() => {
    return state.projects
      .filter((p) => {
        if (!showHidden && hiddenIds.has(p.id)) return false;
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || p.name.toLowerCase().includes(q);
        const matchesStatus = status === "all" || p.status === status;
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        const aLate = overdueByProject.has(a.id);
        const bLate = overdueByProject.has(b.id);
        if (aLate !== bLate) return aLate ? -1 : 1;
        return a.startDate.localeCompare(b.startDate);
      });
  }, [state.projects, query, status, overdueByProject, hiddenIds, showHidden]);

  const cards = useMemo(() => {
    const withDeadline = state.projects.filter((p) => p.endDate && p.status !== "cancelado");
    const overdue = state.projects.filter(
      (p) => p.status !== "cancelado" && overdueByProject.has(p.id),
    );
    return [
      {
        label: "Projetos com prazo",
        value: withDeadline.length,
        icon: CalendarDays,
        tone: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50",
      },
      {
        label: "Próximos 30 dias",
        value: withDeadline.filter((p) => inWindow(p, 30, today)).length,
        icon: Clock,
        tone: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50",
        href: "#timeline",
      },
      {
        label: "Próximos 60 dias",
        value: withDeadline.filter((p) => inWindow(p, 60, today)).length,
        icon: Clock,
        tone: "text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50",
        href: "#timeline",
      },
      {
        label: "Próximos 90 dias",
        value: withDeadline.filter((p) => inWindow(p, 90, today)).length,
        icon: Clock,
        tone: "text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/50",
        href: "#timeline",
      },
      {
        label: "Em atraso",
        value: overdue.length,
        icon: AlertCircle,
        tone: "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50",
        href: "#timeline",
      },
      {
        label: "Concluídos",
        value: state.projects.filter((p) => p.status === "concluido").length,
        icon: CheckCircle2,
        tone: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50",
      },
    ];
  }, [state.projects, today, overdueByProject]);

  const progressByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const project of filtered) {
      map.set(
        project.id,
        scheduleProgress(state.tasks.filter((task) => task.projectId === project.id)),
      );
    }
    return map;
  }, [filtered, state.tasks]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Linha do tempo de entregas</h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhe as próximas entregas e o progresso de cada projeto.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={cn(
                "rounded-xl border border-line bg-surface p-4",
                card.label === "Em atraso" && card.value > 0 && "row-alert",
              )}
            >
              <div className="flex items-start justify-between">
                <div className="text-xs font-medium text-muted">{card.label}</div>
                <span className={`rounded-lg p-1.5 ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold text-navy">{card.value}</div>
              {card.href ? (
                <a href={card.href} className="mt-2 inline-block text-xs font-medium text-blue-600 dark:text-blue-400">
                  Ver no Gantt
                </a>
              ) : null}
            </div>
          );
        })}
      </div>

      <section id="timeline" className="rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line-subtle px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-navy">Linha do tempo de entregas</h2>
            <p className="text-xs text-muted">
              {plural(filtered.length, "projeto exibido", "projetos exibidos")}
              {hiddenIds.size > 0 ? ` · ${plural(hiddenIds.size, "oculto", "ocultos")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-3 w-px bg-orange-500" />
              Hoje (esperado)
            </span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Atividade atrasada
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar projeto por nome..."
              className="w-full rounded-lg border border-line bg-control py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-focus"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus | "all")}
            className="rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {hiddenIds.size > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm outline-none",
                showHidden
                  ? "border-brand bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-line bg-control text-ink hover:bg-hover",
              )}
            >
              {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {showHidden ? "Ocultos visíveis" : "Mostrar ocultos"}
            </button>
          ) : null}
        </div>

        <div className="min-w-0 overflow-x-hidden">
          <div className="flex border-t border-b border-line bg-hover">
            <div className="flex w-[320px] shrink-0 items-center gap-3.5 border-r border-line px-5 py-2 text-xs font-medium text-muted">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">#</span>
              Projeto
            </div>
            <div className="relative min-w-0 flex-1 overflow-hidden px-3 py-1.5">
              <div className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Progresso
              </div>
              <div className="relative h-4">
                {PERCENT_TICKS.map((n) => (
                  <span
                    key={n}
                    className="absolute top-0 text-[11px] tabular-nums text-faint"
                    style={{
                      left: `${n}%`,
                      transform: n === 0 ? undefined : n === 100 ? "translateX(-100%)" : "translateX(-50%)",
                    }}
                  >
                    {n}%
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="scrollbar-minimal max-h-[460px] overflow-x-hidden overflow-y-auto overscroll-contain">
            {filtered.map((project, index) => (
              <TimelineRow
                key={project.id}
                index={index}
                project={project}
                progress={progressByProject.get(project.id) ?? 0}
                expected={expectedProgress(project, today)}
                overdue={overdueByProject.get(project.id) ?? []}
                hidden={hiddenIds.has(project.id)}
                onHide={() => hideProject(project.id)}
                onUnhide={() => unhideProject(project.id)}
              />
            ))}
          </div>
        </div>
        <p className="px-5 py-3 text-[11px] text-faint">
          A barra soma o avanço das atividades (0, 25, 50, 75 ou 100%), ponderado pela duração. A linha
          laranja indica o progresso esperado para hoje.
        </p>
      </section>
    </div>
  );
}

function TimelineRow({
  index,
  project,
  progress,
  expected,
  overdue,
  hidden,
  onHide,
  onUnhide,
}: {
  index: number;
  project: Project;
  progress: number;
  expected: number;
  overdue: Task[];
  hidden: boolean;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const { user } = useAuth();
  const isManagement = Boolean(user?.isManagement);
  const color = STATUS_COLOR[project.status];
  const allocated =
    isManagement || isAllocatedToProject(project, user?.collaboratorId ?? null);
  const projectHref = isManagement
    ? `/projetos/${project.id}`
    : allocated
      ? `/projetos/${project.id}/cronograma`
      : null;
  const showName = progress >= 22;
  const isLate = overdue.length > 0;
  const lateHint = isLate
    ? `${plural(overdue.length, "atividade atrasada", "atividades atrasadas")}: ${overdue
        .slice(0, 3)
        .map((task) => task.name)
        .join(", ")}${overdue.length > 3 ? "…" : ""}`
    : null;
  const barClass =
    "absolute top-6 flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm";
  const barStyle = {
    width: `${Math.max(progress, progress > 0 ? 1.4 : 0)}%`,
    background: color,
  };
  const barInner = (
    <>
      {showName ? <span className="min-w-0 truncate">{project.name}</span> : null}
      {progress > 0 ? <span className="ml-auto shrink-0 tabular-nums">{progress}%</span> : null}
    </>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 border-t border-line-subtle",
        hidden && "opacity-55",
        isLate ? "row-alert hover:bg-red-500/15" : "hover:bg-hover",
        !isLate && index % 2 === 1 && "bg-surface-2",
      )}
      title={lateHint ?? undefined}
    >
      <div className="relative flex w-[320px] shrink-0 items-center gap-3.5 border-r border-line-subtle px-5 py-3 pr-10">
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold leading-none tabular-nums",
            isLate
              ? "border-red-500 text-red-600 dark:text-red-400"
              : "border-line text-muted",
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {isLate ? (
              <AlertCircle className="alert-beat h-3.5 w-3.5 shrink-0 text-red-500" />
            ) : null}
            {projectHref ? (
              <Link href={projectHref} className="truncate text-sm font-semibold text-navy hover:underline">
                {project.name}
              </Link>
            ) : (
              <div className="truncate text-sm font-semibold text-navy">{project.name}</div>
            )}
          </div>
          <div className="mt-1 text-xs text-muted">
            {formatBr(project.startDate)} - {formatBr(project.endDate)} · {project.durationDays} dias
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
            {isLate ? (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-100 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900">
                {plural(overdue.length, "atrasada", "atrasadas")}
              </span>
            ) : null}
          </div>
        </div>
        <RowMenu hidden={hidden} onHide={onHide} onUnhide={onUnhide} />
      </div>
      <div className="h-[76px] min-w-0 flex-1 overflow-hidden px-3">
        <div className="relative h-full">
          {PERCENT_TICKS.map((n) => (
            <div
              key={n}
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-line-subtle"
              style={{ left: `${n}%` }}
            />
          ))}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-orange-500"
            style={{ left: `${expected}%` }}
          />
          {progress === 0 ? (
            <span className="absolute top-8 left-1 text-[11px] font-medium tabular-nums text-faint">0%</span>
          ) : allocated || isManagement ? (
            <Link
              href={`/projetos/${project.id}/cronograma`}
              title={`${project.name} · ${progress}% concluído · esperado hoje ${expected}%`}
              className={barClass}
              style={barStyle}
            >
              {barInner}
            </Link>
          ) : (
            <div
              title={`${project.name} · ${progress}% concluído · esperado hoje ${expected}%`}
              className={barClass}
              style={barStyle}
            >
              {barInner}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowMenu({
  hidden,
  onHide,
  onUnhide,
}: {
  hidden: boolean;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={wrapRef} className="absolute right-1.5 top-1.5 z-20">
      <button
        type="button"
        aria-label="Mais opções"
        title="Mais opções"
        onClick={(event) => {
          event.stopPropagation();
          const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
          setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          setOpen((prev) => !prev);
        }}
        className="rounded-md p-1 text-faint hover:bg-hover hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-line bg-surface py-1 shadow-lg"
          style={{ top: pos.top, right: pos.right }}
        >
          <button
            type="button"
            onClick={() => {
              if (hidden) onUnhide();
              else onHide();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-hover"
          >
            {hidden ? <Eye className="h-3.5 w-3.5 text-muted" /> : <EyeOff className="h-3.5 w-3.5 text-muted" />}
            {hidden ? "Mostrar na lista" : "Ocultar projeto"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

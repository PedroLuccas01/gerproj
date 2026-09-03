"use client";

import { ChevronDown, ChevronRight, Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PHASE_COLOR,
  PHASE_HEADER,
  PHASE_LABEL,
  PHASES,
} from "@/lib/constants";
import {
  addDaysIso,
  diffDays,
  formatBr,
  monthKey,
  monthLabel,
  positionPct,
  rangeForProjects,
  startOfMonth,
  todayIso,
  widthPct,
} from "@/lib/dates";
import { useStore } from "@/lib/store";
import { useFeedback } from "@/lib/feedback";
import type { Project, Task, TaskPhase } from "@/lib/types";
import { ProgressSelect } from "./ui";

const TABLE_W = 800;
const ROW = 48;
const PHASE_H = 40;

export function ProjectGantt({
  project,
  readOnly = false,
  tasks: tasksOverride,
  people: peopleOverride,
}: {
  project: Project;
  readOnly?: boolean;
  tasks?: Task[];
  people?: { id: string; name: string }[];
}) {
  const { state, addTask, updateTask, setTaskProgress, deleteTask } = useStore();
  const { confirm, notify } = useFeedback();
  const [depFor, setDepFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const tasks = useMemo(
    () => tasksOverride ?? state.tasks.filter((t) => t.projectId === project.id),
    [tasksOverride, state.tasks, project.id],
  );
  const people = peopleOverride ?? state.collaborators;

  async function createTask(input: { phase: TaskPhase; parentId?: string | null }) {
    try {
      await addTask({ projectId: project.id, ...input });
    } catch (error) {
      notify({
        type: "error",
        title: "Não foi possível adicionar",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function removeTask(task: Task) {
    const ok = await confirm({
      title: "Excluir tarefa",
      description: task.parentId
        ? `Excluir a subtarefa "${task.name}"?`
        : `Excluir "${task.name}" e as subtarefas vinculadas?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTask(task.id);
      notify({ type: "success", title: "Tarefa excluída" });
    } catch (error) {
      notify({
        type: "error",
        title: "Não foi possível excluir",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const range = useMemo(() => {
    const dated = tasks.filter((t) => t.startDate && t.endDate);
    return rangeForProjects(
      [project.startDate, ...dated.map((t) => t.startDate!)],
      [project.endDate, ...dated.map((t) => t.endDate!)],
      8,
    );
  }, [tasks, project.startDate, project.endDate]);

  const months = useMemo(() => {
    const result: { key: string; label: string; left: number; width: number }[] = [];
    let cursor = startOfMonth(range.start);
    while (cursor <= range.end) {
      const key = monthKey(cursor);
      const next = startOfMonth(addDaysIso(cursor, 32));
      const end = next < range.end ? next : addDaysIso(range.end, 1);
      const startClamped = cursor < range.start ? range.start : cursor;
      result.push({
        key,
        label: monthLabel(startClamped),
        left: positionPct(range.start, range.totalDays, startClamped),
        width: widthPct(range.totalDays, Math.max(1, diffDays(startClamped, end))),
      });
      cursor = next;
    }
    return result;
  }, [range]);

  const todayLeft = positionPct(range.start, range.totalDays, todayIso());

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          <div className="flex border-b border-line bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <div className="flex shrink-0" style={{ width: TABLE_W }}>
              <Col className="w-12">#</Col>
              <Col className="flex-1">Nome da Tarefa</Col>
              <Col className="w-16">Duração</Col>
              <Col className="w-[108px]">Início</Col>
              <Col className="w-[108px]">Término</Col>
              <Col className="w-10">Dep.</Col>
              <Col className="w-[150px]">Responsável</Col>
              {readOnly ? null : <Col className="w-10" />}
            </div>
            <div className="relative h-10 flex-1">
              {months.map((m) => (
                <div
                  key={m.key}
                  className="absolute inset-y-0 flex items-center border-l border-line px-2 text-[11px] font-medium normal-case text-muted"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </div>
              ))}
              <TodayLine left={todayLeft} label />
            </div>
          </div>

          {PHASES.map((phase) => {
            const roots = tasks
              .filter((t) => t.phase === phase && !t.parentId)
              .sort((a, b) => a.order - b.order);
            return (
              <div key={phase}>
                <div className="flex">
                  <div
                    className={`flex shrink-0 items-center justify-between px-3 text-sm font-semibold ${PHASE_HEADER[phase]}`}
                    style={{ width: TABLE_W, height: PHASE_H }}
                  >
                    <span>{PHASE_LABEL[phase]}</span>
                    {readOnly ? null : (
                      <button
                        type="button"
                        onClick={() => void createTask({ phase })}
                        className="inline-flex items-center gap-1 rounded-md bg-surface/80 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-surface dark:text-blue-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova Tarefa
                      </button>
                    )}
                  </div>
                  <div className="relative flex-1 border-b border-line-subtle" style={{ height: PHASE_H }}>
                    <TodayLine left={todayLeft} />
                  </div>
                </div>
                {roots.map((root) => {
                  const kids = childrenOf(tasks, root.id);
                  const rootCollapsed = collapsed[root.id] ?? root.collapsed;
                  const showKids = !rootCollapsed && kids.length > 0;
                  return (
                    <div key={root.id}>
                      <TaskRowView
                        task={{ ...root, collapsed: rootCollapsed }}
                        depth={0}
                        hasChildren={kids.length > 0}
                        people={people}
                        allTasks={tasks}
                        range={range}
                        todayLeft={todayLeft}
                        depFor={depFor}
                        setDepFor={setDepFor}
                        readOnly={readOnly}
                        onProgress={(progress) => void setTaskProgress(root.id, progress)}
                        onUpdate={(patch) => updateTask(root.id, patch)}
                        onDelete={() => removeTask(root)}
                        onAddChild={() => void createTask({ phase, parentId: root.id })}
                        onToggleCollapse={() => {
                          if (readOnly) {
                            setCollapsed((prev) => ({
                              ...prev,
                              [root.id]: !(prev[root.id] ?? root.collapsed),
                            }));
                            return;
                          }
                          updateTask(root.id, { collapsed: !root.collapsed });
                        }}
                      />
                      {showKids
                        ? kids.map((child) => (
                            <TaskRowView
                              key={child.id}
                              task={child}
                              depth={1}
                              hasChildren={false}
                              people={people}
                              allTasks={tasks}
                              range={range}
                              todayLeft={todayLeft}
                              depFor={depFor}
                              setDepFor={setDepFor}
                              readOnly={readOnly}
                              onProgress={(progress) => void setTaskProgress(child.id, progress)}
                              onUpdate={(patch) => updateTask(child.id, patch)}
                              onDelete={() => removeTask(child)}
                              onAddChild={() => undefined}
                              onToggleCollapse={() => undefined}
                            />
                          ))
                        : null}
                    </div>
                  );
                })}
                {roots.length === 0 ? (
                  <div className="flex text-xs text-faint">
                    <div className="border-b border-line-subtle px-4 py-2" style={{ width: TABLE_W }}>
                      Nenhuma tarefa nesta fase.
                    </div>
                    <div className="relative flex-1 border-b border-line-subtle" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Col({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={`flex items-center px-2 ${className ?? ""}`}>{children}</div>;
}

function childrenOf(tasks: Task[], id: string) {
  return tasks.filter((t) => t.parentId === id).sort((a, b) => a.order - b.order);
}

function TodayLine({ left, label }: { left: number; label?: boolean }) {
  return (
    <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500" style={{ left: `${left}%` }}>
      {label ? (
        <span className="absolute left-1 top-1 whitespace-nowrap text-[10px] font-semibold text-red-600 dark:text-red-400">
          Hoje
        </span>
      ) : null}
    </div>
  );
}

function TaskRowView({
  task,
  depth,
  hasChildren,
  people,
  allTasks,
  range,
  todayLeft,
  depFor,
  setDepFor,
  onProgress,
  onUpdate,
  onDelete,
  onAddChild,
  onToggleCollapse,
  readOnly = false,
}: {
  task: Task;
  depth: number;
  hasChildren: boolean;
  people: { id: string; name: string }[];
  allTasks: Task[];
  range: { start: string; totalDays: number };
  todayLeft: number;
  depFor: string | null;
  setDepFor: (id: string | null) => void;
  onProgress: (progress: number) => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onAddChild: () => void;
  onToggleCollapse: () => void;
  readOnly?: boolean;
}) {
  const left =
    task.startDate != null ? positionPct(range.start, range.totalDays, task.startDate) : 0;
  const width =
    task.startDate && task.endDate
      ? widthPct(range.totalDays, Math.max(1, diffDays(task.startDate, task.endDate)))
      : 0;
  const color = PHASE_COLOR[task.phase as TaskPhase];

  return (
    <div className="flex border-b border-line-subtle hover:bg-hover">
      <div className="flex shrink-0 items-center text-sm" style={{ width: TABLE_W, height: ROW }}>
        <div className="w-12 px-2 text-center text-xs text-muted">{task.seq}</div>
        <div className="flex min-w-0 flex-1 items-center gap-1 pr-2" style={{ paddingLeft: 8 + depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={onToggleCollapse} className="text-muted">
              {task.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          {depth === 0 && !readOnly ? (
            <button
              type="button"
              onClick={onAddChild}
              className="rounded p-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="Adicionar subtarefa"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="w-4" />
          )}
          <ProgressSelect
            value={task.progress}
            onChange={onProgress}
            disabled={readOnly}
          />
          {readOnly ? (
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                task.completed ? "text-faint line-through" : "text-ink"
              }`}
            >
              {task.name}
            </span>
          ) : (
            <input
              value={task.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                task.completed ? "text-faint line-through" : "text-ink"
              }`}
            />
          )}
        </div>
        <div className="flex w-16 items-center gap-0.5 px-1">
          {readOnly ? (
            <>
              <span className="px-1 text-xs text-muted">{task.durationDays}</span>
              <span className="text-[11px] text-faint">d</span>
            </>
          ) : (
            <>
              <input
                type="number"
                min={1}
                value={task.durationDays}
                onChange={(e) => onUpdate({ durationDays: Number(e.target.value) || 1 })}
                className="w-10 rounded border border-transparent bg-transparent px-1 py-1 text-xs text-muted outline-none hover:border-line focus:border-brand"
              />
              <span className="text-[11px] text-faint">d</span>
            </>
          )}
        </div>
        <div className="w-[108px] px-1">
          <DateCell value={task.startDate} onChange={(startDate) => onUpdate({ startDate })} readOnly={readOnly} />
        </div>
        <div className="w-[108px] px-1">
          <DateCell value={task.endDate} onChange={(endDate) => onUpdate({ endDate })} readOnly={readOnly} />
        </div>
        <div className="relative w-10 px-1">
          <button
            type="button"
            onClick={() => {
              if (readOnly) return;
              setDepFor(depFor === task.id ? null : task.id);
            }}
            className={`rounded p-1 ${
              task.dependencies.length ? "text-blue-600 dark:text-blue-400" : "text-faint hover:text-muted"
            } ${readOnly ? "cursor-default" : ""}`}
            title="Dependências"
          >
            <Link2 className="h-4 w-4" />
          </button>
          {!readOnly && depFor === task.id ? (
            <div className="absolute right-0 top-8 z-20 w-56 rounded-lg border border-line bg-surface p-2 shadow-lg">
              <div className="mb-1 text-[11px] font-semibold text-muted">Predecessores</div>
              <div className="max-h-40 overflow-y-auto">
                {allTasks
                  .filter((t) => t.id !== task.id)
                  .map((t) => (
                    <label key={t.id} className="flex items-center gap-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={task.dependencies.includes(t.id)}
                        onChange={() => {
                          const next = task.dependencies.includes(t.id)
                            ? task.dependencies.filter((d) => d !== t.id)
                            : [...task.dependencies, t.id];
                          onUpdate({ dependencies: next });
                        }}
                      />
                      <span className="truncate">
                        #{t.seq} {t.name}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="w-[150px] px-1">
          {readOnly ? (
            <span className="block truncate px-1 text-xs text-ink">
              {people.find((p) => p.id === task.assigneeId)?.name ?? "Sem responsável"}
            </span>
          ) : (
            <select
              value={task.assigneeId ?? ""}
              onChange={(e) => onUpdate({ assigneeId: e.target.value || null })}
              className="w-full rounded-md border border-line bg-surface px-1 py-1 text-xs text-ink outline-none"
            >
              <option value="">Sem responsável</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {readOnly ? null : (
          <div className="w-10 px-1">
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="relative flex-1" style={{ height: ROW }}>
        <TodayLine left={todayLeft} />
        {task.startDate && task.endDate ? (
          <div
            className="absolute top-3 h-6 overflow-hidden rounded-md"
            style={{
              left: `${left}%`,
              width: `${Math.max(width, 0.8)}%`,
              background: color,
              opacity: 0.28,
            }}
            title={`${task.name} · ${formatBr(task.startDate)} – ${formatBr(task.endDate)} · ${task.progress}%`}
          />
        ) : null}
        {task.startDate && task.endDate && task.progress > 0 ? (
          <div
            className="absolute top-3 h-6 rounded-md"
            style={{
              left: `${left}%`,
              width: `${Math.max(width * (task.progress / 100), 0.4)}%`,
              background: color,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function DateCell({
  value,
  onChange,
  readOnly = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return <div className="px-1 py-1 text-[11px] text-ink">{value ? formatBr(value) : "—"}</div>;
  }
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-line bg-control px-1 py-1 text-[11px] text-ink outline-none"
    />
  );
}

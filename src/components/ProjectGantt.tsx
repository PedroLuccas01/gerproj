"use client";

import { ChevronDown, ChevronRight, ClipboardPaste, Copy, Link2, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { isParentComplete, progressWithChildren, rawProgressWithChildren } from "@/lib/task-complete";
import { useStore } from "@/lib/store";
import { useFeedback } from "@/lib/feedback";
import { snapshotTaskTree, type TaskTreeNode } from "@/lib/task-clipboard";
import type { Project, Task, TaskPhase } from "@/lib/types";
import { ProgressSelect } from "./ui";

const TABLE_W = 1060;
const ROW = 48;
const PHASE_H = 40;

function timelineWidthForRange(totalDays: number) {
  return Math.max(720, totalDays * 14);
}

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
  const { state, addTask, pasteTasks, updateTask, setTaskProgress, deleteTask } = useStore();
  const { confirm, notify } = useFeedback();
  const [depFor, setDepFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<TaskTreeNode | null>(null);
  const [pasting, setPasting] = useState(false);
  const pendingNameFocus = useRef(false);
  const knownTaskIds = useRef<Set<string> | null>(null);

  const tasks = useMemo(
    () => tasksOverride ?? state.tasks.filter((t) => t.projectId === project.id),
    [tasksOverride, state.tasks, project.id],
  );
  const people = peopleOverride ?? state.collaborators;

  useLayoutEffect(() => {
    const currentIds = new Set(tasks.map((task) => task.id));
    if (knownTaskIds.current === null) {
      knownTaskIds.current = currentIds;
      return;
    }
    if (pendingNameFocus.current) {
      const addedId = [...currentIds].find((id) => !knownTaskIds.current!.has(id));
      if (addedId) setFocusTaskId(addedId);
    }
    knownTaskIds.current = currentIds;
  }, [tasks]);

  async function createTask(input: { phase: TaskPhase; parentId?: string | null; focusName?: boolean }) {
    if (input.focusName) pendingNameFocus.current = true;
    if (input.focusName && input.parentId) {
      const parent = tasks.find((task) => task.id === input.parentId);
      const parentCollapsed = collapsed[input.parentId] ?? parent?.collapsed ?? false;
      if (parentCollapsed) {
        setCollapsed((prev) => ({ ...prev, [input.parentId!]: false }));
        if (!readOnly && parent) updateTask(parent.id, { collapsed: false });
      }
    }
    try {
      const created = await addTask({
        projectId: project.id,
        phase: input.phase,
        parentId: input.parentId,
      });
      if (input.focusName) {
        setFocusTaskId(created.id);
        pendingNameFocus.current = false;
      }
    } catch (error) {
      pendingNameFocus.current = false;
      notify({
        type: "error",
        title: "Não foi possível adicionar",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  function copyTask(task: Task) {
    if (task.id.startsWith("tmp_")) {
      notify({ type: "warning", title: "Aguarde a atividade ser salva para copiar." });
      return;
    }
    setClipboard(snapshotTaskTree(tasks, task));
    const kids = childrenOf(tasks, task.id).length;
    notify({
      type: "success",
      title: kids ? "Atividade e subtarefas copiadas" : "Atividade copiada",
      description: "Use Colar para criar uma cópia independente.",
    });
  }

  async function pasteIntoPhase(phase: TaskPhase) {
    if (!clipboard || pasting) return;
    setPasting(true);
    pendingNameFocus.current = true;
    try {
      const created = await pasteTasks({
        projectId: project.id,
        phase,
        tree: clipboard,
      });
      setFocusTaskId(created.rootId);
      pendingNameFocus.current = false;
      notify({ type: "success", title: "Atividade colada" });
    } catch (error) {
      pendingNameFocus.current = false;
      notify({
        type: "error",
        title: "Não foi possível colar",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPasting(false);
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
  const timelineWidth = useMemo(() => timelineWidthForRange(range.totalDays), [range.totalDays]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto overscroll-x-contain">
        <div style={{ minWidth: TABLE_W + timelineWidth }}>
          <div className="flex border-b border-line bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <div className="flex shrink-0" style={{ width: TABLE_W }}>
              <Col className="w-12">#</Col>
              <Col className="min-w-[280px] flex-1">Nome da Tarefa</Col>
              <Col className="w-16">Duração</Col>
              <Col className="w-[108px]">Início</Col>
              <Col className="w-[108px]">Término</Col>
              <Col className="w-10">Dep.</Col>
              <Col className="w-[170px]">Responsável</Col>
              {readOnly ? null : <Col className="w-10" />}
            </div>
            <div className="relative h-10 shrink-0 overflow-hidden border-l border-line" style={{ width: timelineWidth }}>
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
                      <div className="flex items-center gap-1">
                        {clipboard ? (
                          <button
                            type="button"
                            disabled={pasting}
                            onClick={() => void pasteIntoPhase(phase)}
                            className="inline-flex items-center gap-1 rounded-md bg-surface/80 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-surface disabled:opacity-50 dark:text-blue-300"
                          >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Colar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void createTask({ phase, focusName: true })}
                          className="inline-flex items-center gap-1 rounded-md bg-surface/80 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-surface dark:text-blue-300"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Nova Tarefa
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    className="relative shrink-0 overflow-hidden border-b border-l border-line-subtle"
                    style={{ width: timelineWidth, height: PHASE_H }}
                  >
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
                        timelineWidth={timelineWidth}
                        depFor={depFor}
                        setDepFor={setDepFor}
                        readOnly={readOnly}
                        shouldFocusName={focusTaskId === root.id}
                        onNameFocused={() =>
                          setFocusTaskId((current) => (current === root.id ? null : current))
                        }
                        onProgress={(progress) => void setTaskProgress(root.id, progress)}
                        onUpdate={(patch) => updateTask(root.id, patch)}
                        onDelete={() => removeTask(root)}
                        onCopy={() => copyTask(root)}
                        onPaste={() => void pasteIntoPhase(phase)}
                        canPaste={Boolean(clipboard) && !pasting}
                        onAddChild={() => void createTask({ phase, parentId: root.id, focusName: true })}
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
                              timelineWidth={timelineWidth}
                              depFor={depFor}
                              setDepFor={setDepFor}
                              readOnly={readOnly}
                              shouldFocusName={focusTaskId === child.id}
                              onNameFocused={() =>
                                setFocusTaskId((current) => (current === child.id ? null : current))
                              }
                              onProgress={(progress) => void setTaskProgress(child.id, progress)}
                              onUpdate={(patch) => updateTask(child.id, patch)}
                              onDelete={() => removeTask(child)}
                              onCopy={() => copyTask(child)}
                              onPaste={() => void pasteIntoPhase(phase)}
                              canPaste={Boolean(clipboard) && !pasting}
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
                    <div
                      className="relative shrink-0 overflow-hidden border-b border-l border-line-subtle"
                      style={{ width: timelineWidth }}
                    />
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
  timelineWidth,
  depFor,
  setDepFor,
  onProgress,
  onUpdate,
  onDelete,
  onCopy,
  onPaste,
  canPaste = false,
  onAddChild,
  onToggleCollapse,
  shouldFocusName = false,
  onNameFocused,
  readOnly = false,
}: {
  task: Task;
  depth: number;
  hasChildren: boolean;
  people: { id: string; name: string }[];
  allTasks: Task[];
  range: { start: string; totalDays: number };
  todayLeft: number;
  timelineWidth: number;
  depFor: string | null;
  setDepFor: (id: string | null) => void;
  onProgress: (progress: number) => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste?: boolean;
  onAddChild: () => void;
  onToggleCollapse: () => void;
  shouldFocusName?: boolean;
  onNameFocused?: () => void;
  readOnly?: boolean;
}) {
  const nameInputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!shouldFocusName || readOnly) return;
    const input = nameInputRef.current;
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    input.focus({ preventScroll: true });
    if (input.value === "Nova tarefa") input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    onNameFocused?.();
  }, [shouldFocusName, readOnly, onNameFocused]);

  useLayoutEffect(() => {
    const input = nameInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(22, input.scrollHeight)}px`;
  }, [task.name, readOnly]);

  const left =
    task.startDate != null ? positionPct(range.start, range.totalDays, task.startDate) : 0;
  const width =
    task.startDate && task.endDate
      ? widthPct(range.totalDays, Math.max(1, diffDays(task.startDate, task.endDate)))
      : 0;
  const color = PHASE_COLOR[task.phase as TaskPhase];
  const displayProgress = hasChildren ? progressWithChildren(task, allTasks) : task.progress;
  const exactParentProgress = hasChildren ? rawProgressWithChildren(task, allTasks) : null;
  const isDone = hasChildren ? isParentComplete(task, allTasks) : task.completed;

  return (
    <div className="flex border-b border-line-subtle hover:bg-hover">
      <div className="flex shrink-0 items-start py-1.5 text-sm" style={{ width: TABLE_W, minHeight: ROW }}>
        <div className="flex h-[34px] w-12 items-center justify-center px-2 text-xs text-muted">{task.seq}</div>
        <div className="flex min-w-[280px] flex-1 items-start gap-1 pr-2" style={{ paddingLeft: 8 + depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={onToggleCollapse} className="mt-1.5 text-muted">
              {task.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <span className="mt-1.5 w-4 shrink-0" />
          )}
          {depth === 0 && !readOnly ? (
            <button
              type="button"
              onClick={onAddChild}
              className="mt-1.5 shrink-0 rounded p-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="Adicionar subtarefa"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="mt-1.5 w-4 shrink-0" />
          )}
          <div className="mt-0.5 shrink-0">
            {hasChildren ? (
              <span
                className="inline-flex h-7 w-[58px] shrink-0 items-center justify-center rounded-md border border-line bg-surface px-1 text-[11px] font-medium tabular-nums text-muted"
                title="Calculado pelas subtarefas"
              >
                {exactParentProgress}%
              </span>
            ) : (
              <ProgressSelect value={displayProgress} onChange={onProgress} disabled={readOnly} />
            )}
          </div>
          {readOnly ? (
            <span
              title={task.name}
              className={`min-w-0 flex-1 whitespace-pre-wrap break-words pt-1.5 text-sm leading-5 ${
                isDone ? "text-faint line-through" : "text-ink"
              }`}
            >
              {task.name}
            </span>
          ) : (
            <textarea
              ref={nameInputRef}
              rows={1}
              title={task.name}
              value={task.name}
              spellCheck={false}
              onChange={(e) => onUpdate({ name: e.target.value.replace(/\n/g, " ") })}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className={`min-w-0 flex-1 resize-none overflow-hidden bg-transparent pt-1.5 text-sm leading-5 outline-none ${
                isDone ? "text-faint line-through" : "text-ink"
              }`}
            />
          )}
        </div>
        <div className="flex h-[34px] w-16 items-center gap-0.5 px-1">
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
        <div className="w-[108px] px-1 pt-0.5">
          <DateCell value={task.startDate} onChange={(startDate) => onUpdate({ startDate })} readOnly={readOnly} />
        </div>
        <div className="w-[108px] px-1 pt-0.5">
          <DateCell value={task.endDate} onChange={(endDate) => onUpdate({ endDate })} readOnly={readOnly} />
        </div>
        <div className="relative flex h-[34px] w-10 items-center px-1">
          <button
            type="button"
            onClick={() => {
              if (readOnly) return;
              setDepFor(depFor === task.id ? null : task.id);
            }}
            className={`rounded p-1 ${
              task.dependencies.some((id) => allTasks.some((item) => item.id === id))
                ? "text-blue-600 dark:text-blue-400"
                : "text-faint hover:text-muted"
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
        <div className="flex min-h-[34px] w-[170px] items-start px-1 pt-0.5">
          <AssigneePicker
            people={people}
            value={task.assigneeIds}
            onChange={(assigneeIds) => onUpdate({ assigneeIds })}
            readOnly={readOnly}
          />
        </div>
        {readOnly ? null : (
          <div className="flex h-[34px] w-10 items-center px-1">
            <TaskActions
              canPaste={canPaste}
              onCopy={onCopy}
              onPaste={onPaste}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
      <div
        className="relative min-h-[48px] shrink-0 overflow-hidden self-stretch border-l border-line-subtle"
        style={{ width: timelineWidth }}
      >
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

function AssigneePicker({
  people,
  value,
  onChange,
  readOnly = false,
}: {
  people: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  readOnly?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const names = value
    .map((id) => people.find((person) => person.id === id)?.name)
    .filter(Boolean) as string[];
  const label =
    names.length === 0 ? "Sem responsável" : names.length === 1 ? names[0] : `${names.length} pessoas`;

  if (readOnly) {
    return (
      <span className="block px-1 text-xs leading-5 text-ink" title={names.join(", ") || undefined}>
        {names.length ? names.join(", ") : "Sem responsável"}
      </span>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        title={names.length ? names.join(", ") : "Selecionar responsáveis"}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-1 rounded-md border border-line bg-surface px-1.5 py-1 text-left text-xs outline-none hover:border-brand ${
          value.length ? "text-ink" : "text-faint"
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-30 w-56 rounded-lg border border-line bg-surface p-2 shadow-lg">
          <div className="mb-1 text-[11px] font-semibold text-muted">Responsáveis</div>
          <div className="max-h-40 overflow-y-auto">
            {people.map((person) => (
              <label key={person.id} className="flex items-center gap-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={value.includes(person.id)}
                  onChange={() => {
                    const next = value.includes(person.id)
                      ? value.filter((id) => id !== person.id)
                      : [...value, person.id];
                    onChange(next);
                  }}
                />
                <span className="truncate">{person.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskActions({
  canPaste,
  onCopy,
  onPaste,
  onDelete,
}: {
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Ações da atividade"
        title="Ações"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded p-1 text-faint hover:bg-hover hover:text-ink"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-line bg-surface py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCopy();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-hover"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
          <button
            type="button"
            disabled={!canPaste}
            onClick={() => {
              if (!canPaste) return;
              setOpen(false);
              onPaste();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink hover:bg-hover disabled:cursor-not-allowed disabled:text-faint"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Colar
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        </div>
      ) : null}
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

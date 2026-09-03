"use client";

import { useMemo, useState } from "react";
import { PHASE_COLOR } from "@/lib/constants";
import { addDaysIso, diffDays, eachDay, formatBr, todayIso } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { ProgressSelect, Select, StatusBadge } from "./ui";

export function BurndownView() {
  const { state, setTaskProgress } = useStore();
  const defaultProjectId =
    state.projects.find((p) => p.status === "em_andamento")?.id ?? state.projects[0]?.id ?? "";
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [assigneeId, setAssigneeId] = useState("all");

  const project = state.projects.find((p) => p.id === projectId);
  const tasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === projectId),
    [state.tasks, projectId],
  );

  const filteredTasks = useMemo(() => {
    if (assigneeId === "all") return tasks;
    if (assigneeId === "none") return tasks.filter((t) => t.assigneeIds.length === 0);
    return tasks.filter((t) => t.assigneeIds.includes(assigneeId));
  }, [tasks, assigneeId]);

  const chart = useMemo(() => (project ? buildBurndown(project.startDate, project.endDate, tasks) : null), [
    project,
    tasks,
  ]);

  const byPerson = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filteredTasks) {
      const keys = task.assigneeIds.length ? task.assigneeIds : ["none"];
      for (const key of keys) {
        const list = map.get(key) ?? [];
        list.push(task);
        map.set(key, list);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredTasks]);

  const done = filteredTasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Burndown</h1>
        <p className="mt-1 text-sm text-muted">
          Consumo do trabalho ao longo do prazo deste projeto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="all">Todos os colaboradores</option>
          <option value="none">Sem responsável</option>
          {state.collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {!project ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
          Cadastre um projeto para ver o burndown.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Tarefas" value={filteredTasks.length} />
            <Stat label="Concluídas" value={done} />
            <Stat label="Restantes" value={filteredTasks.length - done} />
            <Stat
              label="Conclusão"
              value={
                filteredTasks.length
                  ? `${Math.round((done / filteredTasks.length) * 100)}%`
                  : "0%"
              }
            />
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-navy">Burndown do projeto</h2>
            <p className="mb-4 text-xs text-muted">
              Ideal vs. trabalho restante · {formatBr(project.startDate)} a {formatBr(project.endDate)}
            </p>
            {chart && tasks.length > 0 && chart.points.length > 0 ? (
              <BurndownSvg chart={chart} />
            ) : (
              <p className="text-sm text-muted">Inclua tarefas no cronograma para gerar o gráfico.</p>
            )}
          </div>

          <div className="space-y-4">
            {byPerson.map(([key, list]) => {
              const person =
                key === "none" ? null : state.collaborators.find((c) => c.id === key);
              const remaining = list.filter((t) => !t.completed).length;
              return (
                <div key={key} className="rounded-xl border border-line bg-surface">
                  <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-navy">
                        {person ? person.name : "Sem responsável"}
                      </div>
                      <div className="text-xs text-muted">
                        {person ? person.role : "Tarefas ainda não atribuídas"}
                      </div>
                    </div>
                    <StatusBadge
                      label={`${remaining} em aberto`}
                      className="bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900"
                    />
                  </div>
                  <ul className="divide-y divide-line-subtle">
                    {list.map((task) => (
                      <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                        <ProgressSelect
                          value={task.progress}
                          onChange={(progress) => void setTaskProgress(task.id, progress)}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-sm ${
                              task.completed ? "text-faint line-through" : "text-ink"
                            }`}
                          >
                            {task.name}
                          </div>
                          <div className="text-[11px] text-faint">
                            {task.startDate && task.endDate
                              ? `${formatBr(task.startDate)} – ${formatBr(task.endDate)}`
                              : "Sem datas"}
                          </div>
                        </div>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: PHASE_COLOR[task.phase] }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-navy">{value}</div>
    </div>
  );
}

function buildBurndown(start: string, end: string, tasks: Task[]) {
  if (!tasks.length) return { total: 0, points: [], start, end };

  const total = tasks.length;
  const span = Math.max(1, diffDays(start, end));
  const today = todayIso();
  const plotEnd = today < end ? today : end;

  let days = eachDay(start, plotEnd);
  if (days.length < 2) {
    days = start < end ? [start, end] : [start, addDaysIso(start, 1)];
  }

  const points = days.map((day) => {
    const dayIndex = Math.max(0, diffDays(start, day));
    const remaining = tasks.filter((t) => {
      if (!t.completed) return true;
      if (!t.completedAt) return false;
      return t.completedAt > day;
    }).length;
    const ideal = Math.max(0, total * (1 - dayIndex / span));
    return { day, remaining, ideal };
  });
  return { total, points, start, end };
}

function BurndownSvg({
  chart,
}: {
  chart: { total: number; points: { day: string; remaining: number; ideal: number }[] };
}) {
  const w = 760;
  const h = 280;
  const pad = { l: 40, r: 16, t: 16, b: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(chart.total, 1);
  const n = chart.points.length - 1 || 1;

  const x = (i: number) => pad.l + (i / n) * innerW;
  const y = (v: number) => pad.t + (1 - v / maxY) * innerH;

  const ideal = chart.points.map((p, i) => `${x(i)},${y(p.ideal)}`).join(" ");
  const actual = chart.points.map((p, i) => `${x(i)},${y(p.remaining)}`).join(" ");

  const yTicks = [...new Set([0, Math.round(maxY / 2), maxY])];
  const xTicks = [...new Set([0, Math.floor(n / 2), n])];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-72 w-full">
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--line)"
          />
          <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" className="fill-faint" fontSize="11">
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={h - 10}
          textAnchor="middle"
          className="fill-faint"
          fontSize="11"
        >
          {formatBr(chart.points[i]?.day)}
        </text>
      ))}
      <polyline fill="none" stroke="var(--faint)" strokeDasharray="6 4" strokeWidth="2" points={ideal} />
      <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" points={actual} />
      <g transform={`translate(${pad.l + 8}, ${pad.t + 8})`}>
        <rect width="10" height="2" y="6" fill="var(--faint)" />
        <text x="16" y="10" fontSize="11" className="fill-muted">
          Ideal
        </text>
        <rect width="10" height="2" y="22" fill="var(--brand)" />
        <text x="16" y="26" fontSize="11" className="fill-muted">
          Restante
        </text>
      </g>
    </svg>
  );
}

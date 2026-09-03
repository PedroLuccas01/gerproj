"use client";

import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AREA_LABEL } from "@/lib/constants";
import { formatBr, startOfWeek, todayIso, weekEnd, weekLabel } from "@/lib/dates";
import { plural } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Area } from "@/lib/types";
import {
  CONFLICT_FRENTES,
  buildWorkload,
  loadTone,
  type PersonLoad,
  type WeekLoad,
} from "@/lib/workload";
import { cn, Select, StatusBadge } from "./ui";

const CELL_TONE = {
  empty: "text-faint",
  ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  watch: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function WorkloadView() {
  const { state } = useStore();
  const today = todayIso();
  const thisWeek = startOfWeek(today);
  const [area, setArea] = useState<Area | "all">("all");
  const [onlyBusy, setOnlyBusy] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const people = useMemo(
    () => buildWorkload({ collaborators: state.collaborators, projects: state.projects, tasks: state.tasks, today }),
    [state.collaborators, state.projects, state.tasks, today],
  );

  const weeks = people[0]?.weeks.map((week) => week.weekStart) ?? [];
  const projectName = useMemo(() => new Map(state.projects.map((project) => [project.id, project.name])), [state.projects]);

  const visible = useMemo(() => {
    return people.filter((person) => {
      if (area !== "all" && person.collaborator.area !== area) return false;
      if (onlyBusy && person.maxFrentes < 2 && person.thisWeekFrentes < 2) return false;
      return true;
    });
  }, [people, area, onlyBusy]);

  const conflictNow = people.filter((person) => person.thisWeekFrentes >= CONFLICT_FRENTES);
  const watchNow = people.filter((person) => person.thisWeekFrentes === 2);

  const areas = useMemo(() => {
    const set = new Set(people.map((person) => person.collaborator.area));
    return [...set].sort((a, b) => AREA_LABEL[a].localeCompare(AREA_LABEL[b], "pt-BR"));
  }, [people]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Carga da equipe</h1>
        <p className="mt-1 text-sm text-muted">
          Quantos projetos cada pessoa tem na mesma semana. Três frentes ao mesmo tempo é o sinal de atraso em
          oficina e campo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="3+ frentes nesta semana" value={conflictNow.length} tone={conflictNow.length ? "danger" : "ok"} />
        <Stat label="2 frentes nesta semana" value={watchNow.length} tone={watchNow.length ? "watch" : "ok"} />
        <Stat
          label="Pessoas com carga no período"
          value={people.length}
          tone="ok"
        />
      </div>

      {conflictNow.length ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {conflictNow.map((person) => person.collaborator.name).join(", ")}{" "}
            {conflictNow.length === 1 ? "está" : "estão"} em {CONFLICT_FRENTES} ou mais projetos nesta semana (
            {formatBr(thisWeek)} a {formatBr(weekEnd(thisWeek))}).
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={area} onChange={(event) => setArea(event.target.value as Area | "all")}>
          <option value="all">Todas as áreas</option>
          {areas.map((item) => (
            <option key={item} value={item}>
              {AREA_LABEL[item]}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setOnlyBusy((prev) => !prev)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition",
            onlyBusy
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-line bg-surface text-muted hover:bg-hover hover:text-ink",
          )}
        >
          {onlyBusy ? "Mostrando 2+ frentes" : "Mostrar todo mundo com carga"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <Legend className={CELL_TONE.ok} label="1 frente" />
        <Legend className={CELL_TONE.watch} label="2 frentes" />
        <Legend className={CELL_TONE.danger} label="3+ frentes" />
      </div>

      {!people.length ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
          Atribua atividades com data no cronograma para ver a carga por semana.
        </div>
      ) : !visible.length ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
          Ninguém com duas ou mais frentes no período. Desmarque o filtro para ver a carga de 1 projeto.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs font-semibold text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-2 px-4 py-3">Pessoa</th>
                {weeks.map((week) => (
                  <th
                    key={week}
                    className={cn(
                      "px-1 py-3 text-center font-medium",
                      week === thisWeek ? "text-blue-700 dark:text-blue-300" : "",
                    )}
                  >
                    <div>{weekLabel(week)}</div>
                    {week === thisWeek ? <div className="text-[10px] font-normal">semana atual</div> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => {
                const open = openId === person.collaborator.id;
                return (
                  <PersonRows
                    key={person.collaborator.id}
                    person={person}
                    thisWeek={thisWeek}
                    open={open}
                    projectName={projectName}
                    onToggle={() => setOpenId(open ? null : person.collaborator.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PersonRows({
  person,
  thisWeek,
  open,
  projectName,
  onToggle,
}: {
  person: PersonLoad;
  thisWeek: string;
  open: boolean;
  projectName: Map<string, string>;
  onToggle: () => void;
}) {
  const colSpan = person.weeks.length + 1;
  return (
    <>
      <tr className="border-t border-line-subtle">
        <td className="sticky left-0 z-10 bg-surface px-4 py-2">
          <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 text-left">
            {open ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            )}
            <span>
              <span className="block font-medium text-ink">{person.collaborator.name}</span>
              <span className="block text-[11px] text-muted">
                {AREA_LABEL[person.collaborator.area]}
                {person.thisWeekFrentes
                  ? ` · ${plural(person.thisWeekFrentes, "frente", "frentes")} nesta semana`
                  : ""}
              </span>
            </span>
          </button>
        </td>
        {person.weeks.map((week) => (
          <td key={week.weekStart} className="px-1 py-2 text-center">
            <WeekCell
              week={week}
              current={week.weekStart === thisWeek}
              projectName={projectName}
            />
          </td>
        ))}
      </tr>
      {open ? (
        <tr className="border-t border-line-subtle bg-surface-2">
          <td colSpan={colSpan} className="px-4 py-4">
            <WeekDetails person={person} projectName={projectName} thisWeek={thisWeek} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function WeekCell({
  week,
  current,
  projectName,
}: {
  week: WeekLoad;
  current: boolean;
  projectName: Map<string, string>;
}) {
  const count = week.frentes.length;
  const tone = loadTone(count);
  if (!count) {
    return <span className="text-faint">·</span>;
  }
  const title = week.frentes
    .map((frente) => projectName.get(frente.projectId) ?? "Projeto")
    .join(" · ");
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold",
        CELL_TONE[tone],
        current ? "ring-1 ring-blue-300 dark:ring-blue-800" : "",
      )}
    >
      {count}
    </span>
  );
}

function WeekDetails({
  person,
  projectName,
  thisWeek,
}: {
  person: PersonLoad;
  projectName: Map<string, string>;
  thisWeek: string;
}) {
  const busyWeeks = person.weeks.filter((week) => week.frentes.length > 0);
  return (
    <div className="space-y-4">
      {busyWeeks.map((week) => (
        <div key={week.weekStart}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-navy">
            {weekLabel(week.weekStart)}
            {week.weekStart === thisWeek ? (
              <StatusBadge
                label="semana atual"
                className="bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900"
              />
            ) : null}
            <span className="font-normal text-muted">
              {plural(week.frentes.length, "projeto", "projetos")}
            </span>
          </div>
          <ul className="space-y-1">
            {week.frentes.map((frente) => (
              <li key={frente.projectId} className="text-sm text-ink">
                <Link
                  href={`/projetos/${frente.projectId}/cronograma`}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {projectName.get(frente.projectId) ?? "Projeto"}
                </Link>
                <span className="text-muted">
                  {" "}
                  · {plural(frente.taskCount, "atividade aberta", "atividades abertas")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {person.undatedOpen ? (
        <p className="text-xs text-muted">
          {plural(person.undatedOpen, "atividade aberta sem data", "atividades abertas sem data")} — não entra na grade
          semanal até ter prazo no cronograma.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "watch" | "danger";
}) {
  const color = {
    ok: "text-navy",
    watch: "text-amber-700 dark:text-amber-300",
    danger: "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", color)}>{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold", className)}>
        n
      </span>
      {label}
    </span>
  );
}

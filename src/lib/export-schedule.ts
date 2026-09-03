"use client";

import { PHASE_LABEL, PHASES, STATUS_LABEL } from "./constants";
import { formatBr, todayIso } from "./dates";
import { fileSlug } from "./format";
import { scheduleProgress } from "./schedule-progress";
import { taskProgressOf } from "./task-complete";
import type { Project, Task } from "./types";

export type ScheduleExportPerson = { id: string; name: string };

export type ScheduleExportInput = {
  project: Project;
  tasks: Task[];
  people: ScheduleExportPerson[];
  clientName?: string;
};

type ScheduleRow = {
  fase: string;
  seq: number;
  atividade: string;
  inicio: string;
  fim: string;
  duracao: number;
  avanco: string;
  responsavel: string;
  situacao: string;
};

function situation(task: Task) {
  const progress = taskProgressOf(task);
  if (progress === 100) return "Concluída";
  if (progress > 0) return "Em andamento";
  return "Não iniciada";
}

function orderedTasks(tasks: Task[]) {
  const rows: { task: Task; indent: boolean }[] = [];
  for (const phase of PHASES) {
    const roots = tasks
      .filter((task) => task.phase === phase && !task.parentId)
      .sort((a, b) => a.order - b.order);
    for (const root of roots) {
      rows.push({ task: root, indent: false });
      const children = tasks
        .filter((task) => task.parentId === root.id)
        .sort((a, b) => a.order - b.order);
      for (const child of children) {
        rows.push({ task: child, indent: true });
      }
    }
  }
  return rows;
}

function buildRows(input: ScheduleExportInput): ScheduleRow[] {
  const names = new Map(input.people.map((person) => [person.id, person.name]));
  return orderedTasks(input.tasks).map(({ task, indent }) => ({
    fase: PHASE_LABEL[task.phase],
    seq: task.seq,
    atividade: indent ? `- ${task.name}` : task.name,
    inicio: formatBr(task.startDate) || "-",
    fim: formatBr(task.endDate) || "-",
    duracao: task.durationDays,
    avanco: `${taskProgressOf(task)}%`,
    responsavel:
      task.assigneeIds.length > 0
        ? task.assigneeIds.map((id) => names.get(id)).filter(Boolean).join(", ") || "-"
        : "-",
    situacao: situation(task),
  }));
}

function fileBase(projectName: string) {
  return `cronograma-${fileSlug(projectName)}-${todayIso()}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadScheduleExcel(input: ScheduleExportInput) {
  const XLSX = await import("xlsx");
  const rows = buildRows(input);
  const progress = scheduleProgress(input.tasks);
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Cronograma"],
    ["Projeto", input.project.name],
    ["Cliente", input.clientName || "-"],
    ["Prazo", `${formatBr(input.project.startDate)} a ${formatBr(input.project.endDate)}`],
    ["Status", STATUS_LABEL[input.project.status]],
    ["Avanço geral", `${progress}%`],
    ["Gerado em", formatBr(todayIso())],
    [],
    ["Fase", "#", "Atividade", "Início", "Fim", "Dias", "Avanço", "Responsável", "Situação"],
    ...rows.map((row) => [
      row.fase,
      row.seq,
      row.atividade,
      row.inicio,
      row.fim,
      row.duracao,
      row.avanco,
      row.responsavel,
      row.situacao,
    ]),
  ]);
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 6 },
    { wch: 42 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 22 },
    { wch: 14 },
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Cronograma");
  XLSX.writeFile(book, `${fileBase(input.project.name)}.xlsx`);
}

export async function downloadSchedulePdf(input: ScheduleExportInput) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const rows = buildRows(input);
  const progress = scheduleProgress(input.tasks);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Cronograma", 14, 14);
  doc.setFontSize(11);
  doc.text(input.project.name, 14, 21);
  doc.setFontSize(9);
  const meta = [
    `Cliente: ${input.clientName || "-"}`,
    `Prazo: ${formatBr(input.project.startDate)} a ${formatBr(input.project.endDate)} (${input.project.durationDays} dias)`,
    `Status: ${STATUS_LABEL[input.project.status]}  |  Avanço geral: ${progress}%  |  Gerado em: ${formatBr(todayIso())}`,
  ];
  meta.forEach((line, index) => doc.text(line, 14, 28 + index * 5));

  autoTable(doc, {
    startY: 44,
    head: [["Fase", "#", "Atividade", "Início", "Fim", "Dias", "Avanço", "Responsável", "Situação"]],
    body: rows.map((row) => [
      row.fase,
      String(row.seq),
      row.atividade,
      row.inicio,
      row.fim,
      String(row.duracao),
      row.avanco,
      row.responsavel,
      row.situacao,
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [22, 58, 95], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 10 },
      2: { cellWidth: 78 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 14 },
      6: { cellWidth: 18 },
      7: { cellWidth: 40 },
      8: { cellWidth: 28 },
    },
  });

  const blob = doc.output("blob");
  triggerDownload(blob, `${fileBase(input.project.name)}.pdf`);
}

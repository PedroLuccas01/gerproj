"use client";

import { useEffect, useMemo, useState } from "react";
import { BUDGET_AREAS, STATUS_LABEL } from "@/lib/constants";
import { durationFromRange, endFromDuration, todayIso } from "@/lib/dates";
import { useFeedback } from "@/lib/feedback";
import { formatBRL, parseBRL } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BudgetByArea, Project, ProjectDraft, ProjectStatus } from "@/lib/types";
import { Modal } from "./Modal";
import { Button, Field, Select, TextArea, TextInput } from "./ui";

const emptyBudget = (): BudgetByArea => ({
  automacao: 0,
  mecanica: 0,
  hardware: 0,
  software: 0,
});

function toDraft(project?: Project): ProjectDraft {
  if (!project) {
    return {
      name: "",
      description: "",
      clientId: null,
      leaderId: null,
      durationDays: 30,
      status: "planejamento",
      startDate: todayIso(),
      endDate: endFromDuration(todayIso(), 30),
      budget: 0,
      budgetByArea: emptyBudget(),
      teamIds: [],
      notes: "",
    };
  }
  return {
    name: project.name,
    description: project.description,
    clientId: project.clientId,
    leaderId: project.leaderId,
    durationDays: project.durationDays,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget,
    budgetByArea: { ...project.budgetByArea },
    teamIds: [...project.teamIds],
    notes: project.notes,
  };
}

export function ProjectFormModal({
  open,
  onClose,
  project,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onCreated?: (id: string) => void;
}) {
  const { state, addProject, updateProject } = useStore();
  const { notify } = useFeedback();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft>(toDraft(project ?? undefined));
  const [budgetText, setBudgetText] = useState(formatBRL(0));
  const [areaText, setAreaText] = useState<Record<keyof BudgetByArea, string>>({
    automacao: formatBRL(0),
    mecanica: formatBRL(0),
    hardware: formatBRL(0),
    software: formatBRL(0),
  });

  useEffect(() => {
    if (!open) return;
    const next = toDraft(project ?? undefined);
    setDraft(next);
    setBudgetText(formatBRL(next.budget));
    setAreaText({
      automacao: formatBRL(next.budgetByArea.automacao),
      mecanica: formatBRL(next.budgetByArea.mecanica),
      hardware: formatBRL(next.budgetByArea.hardware),
      software: formatBRL(next.budgetByArea.software),
    });
  }, [open, project]);

  const activePeople = useMemo(
    () => state.collaborators.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [state.collaborators],
  );

  function patch(partial: Partial<ProjectDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function onStartChange(startDate: string) {
    const endDate = draft.durationDays ? endFromDuration(startDate, draft.durationDays) : draft.endDate;
    patch({ startDate, endDate });
  }

  function onEndChange(endDate: string) {
    const durationDays = draft.startDate ? durationFromRange(draft.startDate, endDate) : draft.durationDays;
    patch({ endDate, durationDays });
  }

  function onDurationChange(durationDays: number) {
    const endDate = draft.startDate ? endFromDuration(draft.startDate, durationDays) : draft.endDate;
    patch({ durationDays, endDate });
  }

  function toggleMember(id: string) {
    patch({
      teamIds: draft.teamIds.includes(id)
        ? draft.teamIds.filter((x) => x !== id)
        : [...draft.teamIds, id],
    });
  }

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      if (project) {
        await updateProject(project.id, draft);
        notify({ type: "success", title: "Projeto atualizado" });
        onClose();
        return;
      }
      const created = await addProject({ ...draft, name: draft.name.trim() });
      notify({ type: "success", title: "Projeto criado" });
      onClose();
      onCreated?.(created.id);
    } catch (error) {
      notify({
        type: "error",
        title: "Não foi possível salvar o projeto",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Editar Projeto" : "Novo Projeto"}
      subtitle={
        project ? "Atualize os dados do projeto" : "Preencha os dados do novo projeto"
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!draft.name.trim() || saving}>
            {saving ? "Salvando..." : project ? "Salvar alterações" : "Criar Projeto"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do Projeto" required>
          <TextInput
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Ex: Projeto de Usinagem - Peças Especiais"
          />
        </Field>
        <Field label="Descrição">
          <TextArea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Descreva o projeto..."
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <Select
              value={draft.clientId ?? ""}
              onChange={(e) => patch({ clientId: e.target.value || null })}
            >
              <option value="">Nenhum cliente</option>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Líder do Projeto">
            <Select
              value={draft.leaderId ?? ""}
              onChange={(e) => patch({ leaderId: e.target.value || null })}
            >
              <option value="">Nenhum líder</option>
              {activePeople.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duração (dias)">
            <TextInput
              type="number"
              min={1}
              value={draft.durationDays}
              onChange={(e) => onDurationChange(Number(e.target.value) || 1)}
              placeholder="Ex: 30"
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as ProjectStatus })}
            >
              {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data de Início">
            <TextInput
              type="date"
              value={draft.startDate}
              onChange={(e) => onStartChange(e.target.value)}
            />
          </Field>
          <Field label="Data de Fim">
            <TextInput
              type="date"
              value={draft.endDate}
              onChange={(e) => onEndChange(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Orçamento Previsto (R$)">
          <TextInput
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            onBlur={() => {
              const n = parseBRL(budgetText);
              patch({ budget: n });
              setBudgetText(formatBRL(n));
            }}
            placeholder="0,00"
          />
        </Field>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-navy">
            Valores Disponíveis por Área (R$)
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BUDGET_AREAS.map((area) => (
              <Field key={area.key} label={area.label}>
                <TextInput
                  value={areaText[area.key]}
                  onChange={(e) => setAreaText((prev) => ({ ...prev, [area.key]: e.target.value }))}
                  onBlur={() => {
                    const n = parseBRL(areaText[area.key]);
                    patch({
                      budgetByArea: { ...draft.budgetByArea, [area.key]: n },
                    });
                    setAreaText((prev) => ({ ...prev, [area.key]: formatBRL(n) }));
                  }}
                  placeholder="0,00"
                />
              </Field>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-navy">Equipe do Projeto</div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-line">
            {activePeople.map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center gap-3 border-b border-line-subtle px-3 py-2 last:border-b-0 hover:bg-hover"
              >
                <input
                  type="checkbox"
                  checked={draft.teamIds.includes(person.id)}
                  onChange={() => toggleMember(person.id)}
                  className="h-4 w-4 rounded border-line text-blue-600 dark:text-blue-400"
                />
                <span className="text-sm text-ink">
                  {person.name} - {person.role}
                  {person.area === "pcp" ? " (PLANEJAMENTO ESTRATÉGICO)" : ""}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {draft.teamIds.length} colaborador(es) selecionado(s)
          </p>
        </div>
        <Field label="Observações">
          <TextArea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Anotações adicionais sobre o projeto..."
          />
        </Field>
      </div>
    </Modal>
  );
}

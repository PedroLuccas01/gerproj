"use client";

import { Pencil, Shield, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { AREA_LABEL } from "@/lib/constants";
import { useFeedback } from "@/lib/feedback";
import { useStore } from "@/lib/store";
import type { Area, Collaborator, CollaboratorDraft } from "@/lib/types";

type AccountUser = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "active" | "rejected";
  isAdmin: boolean;
  createdAt: string;
};

const emptyDraft = (): CollaboratorDraft => ({
  name: "",
  email: "",
  role: "",
  area: "automacao",
  phone: "",
  active: true,
});

export default function ColaboradoresPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const { state, updateCollaborator, deleteCollaborator } = useStore();
  const { confirm, notify } = useFeedback();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [draft, setDraft] = useState<CollaboratorDraft>(emptyDraft());
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [approveRole, setApproveRole] = useState<Record<string, string>>({});
  const [approveArea, setApproveArea] = useState<Record<string, Area>>({});

  const areaOptions = (Object.keys(AREA_LABEL) as Area[]).filter(
    (area) => isAdmin || area !== "gestao",
  );

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (!res.ok) return;
    const data = (await res.json()) as { users: AccountUser[] };
    setAccounts(data.users);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function startEdit(person: Collaborator) {
    setEditing(person);
    setDraft({
      name: person.name,
      email: person.email,
      role: person.role,
      area: person.area,
      phone: person.phone,
      active: person.active,
    });
    setPassword("");
    setPasswordConfirm("");
    setOpen(true);
  }

  async function save() {
    if (!editing || !draft.name.trim() || !draft.role.trim() || saving) return;
    const nextPassword = password.trim();
    if (nextPassword && nextPassword.length < 6) {
      notify({ type: "warning", title: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (nextPassword && nextPassword !== passwordConfirm.trim()) {
      notify({ type: "warning", title: "As senhas não coincidem." });
      return;
    }
    setSaving(true);
    try {
      await updateCollaborator(editing.id, {
        ...draft,
        ...(nextPassword ? { password: nextPassword } : {}),
      });
      setOpen(false);
      notify({ type: "success", title: "Colaborador atualizado" });
    } catch (error) {
      notify({
        type: "error",
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function approve(account: AccountUser) {
    const role = (approveRole[account.id] ?? "").trim();
    const area = approveArea[account.id] ?? "automacao";
    if (!role) {
      notify({ type: "warning", title: "Informe o cargo para aprovar." });
      return;
    }
    const res = await fetch(`/api/users/${account.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, area }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      notify({ type: "error", title: body.error || "Não foi possível aprovar." });
      return;
    }
    notify({ type: "success", title: `${account.name} aprovado` });
    await loadUsers();
    window.location.reload();
  }

  async function reject(account: AccountUser) {
    const ok = await confirm({
      title: "Recusar cadastro",
      description: `Recusar o acesso de ${account.name}?`,
      confirmLabel: "Recusar",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/users/${account.id}/reject`, { method: "POST" });
    if (!res.ok) {
      notify({ type: "error", title: "Não foi possível recusar." });
      return;
    }
    notify({ type: "success", title: "Cadastro recusado" });
    await loadUsers();
  }

  async function toggleAdmin(account: AccountUser) {
    const res = await fetch(`/api/users/${account.id}/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !account.isAdmin }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      notify({ type: "error", title: body.error || "Não foi possível alterar o admin." });
      return;
    }
    notify({
      type: "success",
      title: account.isAdmin ? "Admin removido" : "Usuário tornado admin",
    });
    await loadUsers();
  }

  const pending = accounts.filter((account) => account.status === "pending");
  const accountByEmail = new Map(accounts.map((account) => [account.email.toLowerCase(), account]));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Colaboradores</h1>
        <p className="text-sm text-muted">
          Aprove novos cadastros, defina o cargo e mantenha a equipe.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-navy">Cadastros aguardando aprovação</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum cadastro pendente.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((account) => (
              <li
                key={account.id}
                className="flex flex-col gap-3 rounded-lg border border-line-subtle p-3 lg:flex-row lg:items-end"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{account.name}</div>
                  <div className="text-xs text-muted">{account.email}</div>
                </div>
                <label className="block text-xs font-medium text-muted">
                  Cargo
                  <TextInput
                    className="mt-1"
                    value={approveRole[account.id] ?? ""}
                    onChange={(e) =>
                      setApproveRole((prev) => ({ ...prev, [account.id]: e.target.value }))
                    }
                    placeholder="Ex: Projetista"
                  />
                </label>
                <label className="block text-xs font-medium text-muted">
                  Área
                  <Select
                    className="mt-1"
                    value={approveArea[account.id] ?? "automacao"}
                    onChange={(e) =>
                      setApproveArea((prev) => ({ ...prev, [account.id]: e.target.value as Area }))
                    }
                  >
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {AREA_LABEL[area]}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex gap-2">
                  <Button onClick={() => void approve(account)}>Aprovar</Button>
                  <Button variant="ghost" className="text-red-600" onClick={() => void reject(account)}>
                    Recusar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Área</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {state.collaborators.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  Nenhum colaborador cadastrado ainda.
                </td>
              </tr>
            ) : null}
            {state.collaborators.map((person) => {
              const account = accountByEmail.get(person.email.toLowerCase());
              return (
                <tr key={person.id} className="border-t border-line-subtle">
                  <td className="px-4 py-3 font-medium text-ink">
                    {person.name}
                    {account?.isAdmin ? (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                        Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{person.role}</td>
                  <td className="px-4 py-3 text-muted">{AREA_LABEL[person.area]}</td>
                  <td className="px-4 py-3 text-muted">{person.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        person.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-surface-2 text-muted"
                      }`}
                    >
                      {person.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && account && account.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => void toggleAdmin(account)}
                        className="mr-1 rounded p-1 text-muted hover:bg-hover"
                        title={account.isAdmin ? "Remover admin" : "Tornar admin"}
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(person)}
                      className="mr-1 rounded p-1 text-muted hover:bg-hover"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Remover colaborador",
                          description: `Remover ${person.name} da equipe? Projetos e tarefas associados ficarão sem este responsável.`,
                          confirmLabel: "Remover",
                          tone: "danger",
                        });
                        if (!ok) return;
                        try {
                          await deleteCollaborator(person.id);
                          notify({ type: "success", title: "Colaborador removido" });
                        } catch (error) {
                          notify({
                            type: "error",
                            title: "Não foi possível remover",
                            description: error instanceof Error ? error.message : undefined,
                          });
                        }
                      }}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar colaborador"
        subtitle="Atualize cargo, área, contato e, se precisar, a senha de acesso."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!draft.name.trim() || !draft.role.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Cargo" required>
            <TextInput
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              placeholder="Ex: Projetista mecânico"
            />
          </Field>
          <Field label="Área">
            <Select
              value={draft.area}
              onChange={(e) => setDraft({ ...draft, area: e.target.value as Area })}
            >
              {(draft.area === "gestao" && !isAdmin ? (["gestao", ...areaOptions] as Area[]) : areaOptions).map(
                (a) => (
                  <option key={a} value={a} disabled={a === "gestao" && !isAdmin}>
                    {AREA_LABEL[a]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <TextInput value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select
              value={draft.active ? "1" : "0"}
              onChange={(e) => setDraft({ ...draft, active: e.target.value === "1" })}
            >
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </Select>
          </Field>
          <Field label="Nova senha">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Deixe em branco para manter"
            />
          </Field>
          <Field label="Confirmar senha">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

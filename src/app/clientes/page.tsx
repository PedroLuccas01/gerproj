"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Field, TextInput } from "@/components/ui";
import { useFeedback } from "@/lib/feedback";
import { useStore } from "@/lib/store";
import type { Client, ClientDraft } from "@/lib/types";

const emptyDraft = (): ClientDraft => ({ name: "", contact: "", email: "" });

export default function ClientesPage() {
  const { state, addClient, updateClient, deleteClient } = useStore();
  const { confirm, notify } = useFeedback();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  }

  function startEdit(client: Client) {
    setEditing(client);
    setDraft({ name: client.name, contact: client.contact, email: client.email });
    setOpen(true);
  }

  async function save() {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      if (editing) await updateClient(editing.id, draft);
      else await addClient(draft);
      setOpen(false);
      notify({
        type: "success",
        title: editing ? "Cliente atualizado" : "Cliente cadastrado",
      });
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Clientes</h1>
          <p className="text-sm text-muted">Cadastro de cliente.</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Projetos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {state.clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            ) : null}
            {state.clients.map((client) => {
              const count = state.projects.filter((p) => p.clientId === client.id).length;
              return (
                <tr key={client.id} className="border-t border-line-subtle">
                  <td className="px-4 py-3 font-medium text-ink">{client.name}</td>
                  <td className="px-4 py-3 text-muted">{client.contact || "—"}</td>
                  <td className="px-4 py-3 text-muted">{client.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">{count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(client)}
                      className="mr-1 rounded p-1 text-muted hover:bg-hover"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Remover cliente",
                          description: `Remover ${client.name}? Projetos vinculados ficarão sem cliente.`,
                          confirmLabel: "Remover",
                          tone: "danger",
                        });
                        if (!ok) return;
                        try {
                          await deleteClient(client.id);
                          notify({ type: "success", title: "Cliente removido" });
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
        title={editing ? "Editar cliente" : "Novo cliente"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!draft.name.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome da empresa" required>
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Contato">
            <TextInput value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

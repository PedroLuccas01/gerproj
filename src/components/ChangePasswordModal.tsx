"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Field, TextInput } from "@/components/ui";
import { useFeedback } from "@/lib/feedback";

export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { notify } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (newPassword.length < 6) {
      notify({ type: "warning", title: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirm) {
      notify({ type: "warning", title: "As senhas novas não coincidem." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify({ type: "error", title: body.error || "Não foi possível alterar a senha." });
        return;
      }
      notify({ type: "success", title: "Senha atualizada" });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Alterar senha"
      subtitle="Informe a senha atual e escolha uma nova."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving || !currentPassword || !newPassword || !confirm}>
            {saving ? "Salvando..." : "Salvar senha"}
          </Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
        <Field label="Senha atual" required>
          <TextInput
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field label="Nova senha" required>
          <TextInput
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirmar nova senha" required>
          <TextInput
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

"use client";

import { Check, Copy, FileSpreadsheet, FileText, KeyRound, Link2, MoreVertical, RefreshCw, TimerOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { downloadScheduleExcel, downloadSchedulePdf } from "@/lib/export-schedule";
import { formatBr } from "@/lib/dates";
import { useFeedback } from "@/lib/feedback";
import { useStore } from "@/lib/store";

type ShareAccess = {
  id: string;
  at: string;
  ip: string;
  from: string;
};

type ShareInfo = {
  token: string;
  login: string;
  validUntil: string;
  expired: boolean;
  accesses?: ShareAccess[];
};

type ShareResponse = {
  share: ShareInfo | null;
  password?: string;
  error?: string;
};

function shareUrl(token: string) {
  return `${window.location.origin}/c/${token}`;
}

export function ShareLinkMenu({ projectId }: { projectId: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { state } = useStore();
  const { notify } = useFeedback();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const project = state.projects.find((item) => item.id === projectId);
  const exportInput = project
    ? {
        project,
        tasks: state.tasks.filter((task) => task.projectId === projectId),
        people: state.collaborators,
        clientName: state.clients.find((client) => client.id === project.clientId)?.name,
      }
    : null;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Mais opções"
        title="Mais opções"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
          setMenuOpen((prev) => !prev);
        }}
        className="rounded-md p-1 text-faint hover:bg-hover hover:text-ink"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menuOpen ? (
        <div
          className="fixed z-50 min-w-[188px] rounded-lg border border-line bg-surface py-1 shadow-lg"
          style={{ top: pos.top, right: pos.right }}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setDialogOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-hover"
          >
            <Link2 className="h-3.5 w-3.5 text-muted" />
            Gerar link
          </button>
          <button
            type="button"
            disabled={!exportInput || Boolean(exporting)}
            onClick={async () => {
              if (!exportInput) return;
              setExporting("xlsx");
              try {
                await downloadScheduleExcel(exportInput);
                setMenuOpen(false);
              } catch (error) {
                notify({
                  type: "error",
                  title: "Não foi possível gerar o Excel",
                  description: error instanceof Error ? error.message : undefined,
                });
              } finally {
                setExporting(null);
              }
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-hover disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-muted" />
            {exporting === "xlsx" ? "Gerando Excel..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={!exportInput || Boolean(exporting)}
            onClick={async () => {
              if (!exportInput) return;
              setExporting("pdf");
              try {
                await downloadSchedulePdf(exportInput);
                setMenuOpen(false);
              } catch (error) {
                notify({
                  type: "error",
                  title: "Não foi possível gerar o PDF",
                  description: error instanceof Error ? error.message : undefined,
                });
              } finally {
                setExporting(null);
              }
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-hover disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5 text-muted" />
            {exporting === "pdf" ? "Gerando PDF..." : "Exportar PDF"}
          </button>
        </div>
      ) : null}
      <ShareLinkDialog projectId={projectId} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

export function ShareLinkDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { confirm, notify } = useFeedback();
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/share`);
    const data = (await res.json()) as ShareResponse;
    setShare(data.share);
    if (!data.share) setPassword(null);
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    setPassword(null);
    setCopied(null);
    void load();
  }, [open, load]);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1600);
  }

  async function generate() {
    if (share && !share.expired) {
      const ok = await confirm({
        title: "Gerar novo link",
        description:
          "O link atual e a senha deixam de funcionar. O cliente precisará do novo acesso.",
        confirmLabel: "Gerar novo",
        tone: "warning",
      });
      if (!ok) return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
      const data = (await res.json()) as ShareResponse;
      if (!res.ok) {
        notify({ type: "error", title: data.error || "Não foi possível gerar o link." });
        return;
      }
      setShare(data.share);
      setPassword(data.password ?? null);
      notify({ type: "success", title: "Link do cronograma gerado" });
    } finally {
      setLoading(false);
    }
  }

  async function patchShare(action: "password" | "expire" | "reactivate") {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as ShareResponse;
      if (!res.ok) {
        notify({ type: "error", title: data.error || "Não foi possível atualizar o acesso." });
        return;
      }
      setShare(data.share);
      if (action === "password") {
        setPassword(data.password ?? null);
        notify({ type: "success", title: "Nova senha gerada. O link e o login continuam os mesmos." });
      } else if (action === "expire") {
        setPassword(null);
        notify({ type: "success", title: "Acesso encerrado. O link não muda." });
      } else {
        notify({ type: "success", title: "Acesso reativado até o fim do projeto." });
      }
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    const ok = await confirm({
      title: "Revogar acesso",
      description: "O cliente não poderá mais abrir o cronograma com este link.",
      confirmLabel: "Revogar",
      tone: "danger",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
      if (!res.ok) {
        notify({ type: "error", title: "Não foi possível revogar o link." });
        return;
      }
      setShare(null);
      setPassword(null);
      notify({ type: "success", title: "Acesso revogado" });
    } finally {
      setLoading(false);
    }
  }

  const url = share ? shareUrl(share.token) : "";
  const message =
    share && password
      ? `Acesso ao cronograma\nLink: ${url}\nLogin: ${share.login}\nSenha: ${password}\nVálido até: ${formatBr(share.validUntil)}`
      : share
        ? `Acesso ao cronograma\nLink: ${url}\nLogin: ${share.login}\nVálido até: ${formatBr(share.validUntil)}`
        : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link do cronograma"
      subtitle="O cliente acessa só o Gantt deste projeto. Você pode encerrar o acesso ou trocar a senha sem gerar um link novo."
      footer={
        share ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" className="text-red-600 dark:text-red-400" disabled={loading} onClick={() => void revoke()}>
              <Trash2 className="h-4 w-4" />
              Revogar
            </Button>
            <Button variant="secondary" disabled={loading} onClick={() => void generate()}>
              <RefreshCw className="h-4 w-4" />
              Gerar novo
            </Button>
          </div>
        ) : (
          <Button disabled={loading} onClick={() => void generate()}>
            Gerar link
          </Button>
        )
      }
    >
      {!share ? (
        <p className="text-sm text-muted">
          Ainda não há um link ativo. Ao gerar, você recebe um endereço, um login e uma senha para enviar ao
          cliente.
        </p>
      ) : (
        <div className="space-y-4">
          {share.expired ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              Este acesso está encerrado. Reative até o fim do projeto ou gere um link novo.
            </p>
          ) : null}
          <CopyField
            label="Link"
            value={url}
            copied={copied === "link"}
            onCopy={() => void copy("link", url)}
          />
          <CopyField
            label="Login"
            value={share.login}
            copied={copied === "login"}
            onCopy={() => void copy("login", share.login)}
          />
          {password ? (
            <CopyField
              label="Senha"
              value={password}
              copied={copied === "password"}
              onCopy={() => void copy("password", password)}
            />
          ) : (
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-navy">Senha</div>
              <p className="text-sm text-muted">
                A senha só aparece ao gerar o link ou ao renovar. O endereço e o login não mudam.
              </p>
            </div>
          )}
          <p className="text-sm text-muted">
            Válido até <span className="font-medium text-ink">{formatBr(share.validUntil)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={async () => {
                const ok = await confirm({
                  title: "Renovar senha",
                  description: "A senha atual deixa de valer. O link e o login continuam os mesmos.",
                  confirmLabel: "Gerar nova senha",
                  tone: "warning",
                });
                if (ok) await patchShare("password");
              }}
            >
              <KeyRound className="h-4 w-4" />
              Renovar senha
            </Button>
            {share.expired ? (
              <Button variant="secondary" disabled={loading} onClick={() => void patchShare("reactivate")}>
                Reativar acesso
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={loading}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Encerrar acesso agora",
                    description:
                      "O cliente não entra mais neste link. O endereço e o login permanecem; você pode reativar depois.",
                    confirmLabel: "Encerrar",
                    tone: "warning",
                  });
                  if (ok) await patchShare("expire");
                }}
              >
                <TimerOff className="h-4 w-4" />
                Encerrar agora
              </Button>
            )}
          </div>
          {message ? (
            <Button variant="secondary" className="w-full" onClick={() => void copy("message", message)}>
              {copied === "message" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar dados para enviar
            </Button>
          ) : null}
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-navy">Acessos do cliente</div>
            {share.accesses?.length ? (
              <ul className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-line-subtle p-3">
                {share.accesses.map((item) => (
                  <li key={item.id} className="text-xs text-ink">
                    <div className="font-medium">
                      {new Date(item.at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </div>
                    <div className="text-muted">
                      {item.from} · {item.ip}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum acesso registrado ainda.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-semibold text-navy">{label}</div>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className="w-full rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink"
        />
        <Button variant="secondary" onClick={onCopy} title="Copiar">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

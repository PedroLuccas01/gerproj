"use client";

import { Check, Copy, Link2, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { formatBr } from "@/lib/dates";
import { useFeedback } from "@/lib/feedback";

type ShareInfo = {
  token: string;
  login: string;
  validUntil: string;
  expired: boolean;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

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
          className="fixed z-50 min-w-[168px] rounded-lg border border-line bg-surface py-1 shadow-lg"
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
      subtitle="O cliente acessa só o Gantt deste projeto, com login e senha. O acesso vale até o fim do projeto e pode ser revogado a qualquer momento."
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
              Este acesso expirou no fim do projeto. Gere um novo link ou ajuste a data de término.
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
                A senha só aparece na hora de gerar o link. Se o cliente perdeu, gere um novo acesso.
              </p>
            </div>
          )}
          <p className="text-sm text-muted">
            Válido até <span className="font-medium text-ink">{formatBr(share.validUntil)}</span>
          </p>
          {message ? (
            <Button variant="secondary" className="w-full" onClick={() => void copy("message", message)}>
              {copied === "message" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar dados para enviar
            </Button>
          ) : null}
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

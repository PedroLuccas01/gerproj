"use client";

import { Eye, EyeOff, Lock, LogOut, User } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ProjectGantt } from "@/components/ProjectGantt";
import { Button, StatusBadge } from "@/components/ui";
import { STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { formatBr } from "@/lib/dates";
import type { Project, Task } from "@/lib/types";

type SharePayload = {
  project: Project;
  tasks: Task[];
  people: { id: string; name: string }[];
};

export function ShareCronogramaView({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "login" | "ready" | "missing" | "expired">("loading");
  const [data, setData] = useState<SharePayload | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/share/cronograma/${token}`);
    if (res.status === 404) {
      setStatus("missing");
      return;
    }
    if (res.status === 403) {
      setStatus("expired");
      return;
    }
    if (res.status === 401) {
      setStatus("login");
      return;
    }
    if (!res.ok) {
      setStatus("missing");
      return;
    }
    const body = (await res.json()) as SharePayload;
    setData(body);
    setStatus("ready");
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/share/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, login, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Não foi possível entrar.");
        if (res.status === 404) setStatus("missing");
        if (res.status === 403) setStatus("expired");
        return;
      }
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/share/logout", { method: "POST" });
    setData(null);
    setPassword("");
    setStatus("login");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-muted">
        Carregando...
      </div>
    );
  }

  if (status === "missing" || status === "expired") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page p-6 text-center">
        <BrandMark />
        <p className="max-w-sm text-sm text-muted">
          {status === "expired"
            ? "Este acesso ao cronograma expirou."
            : "Este link não está mais disponível. Solicite um novo acesso."}
        </p>
      </div>
    );
  }

  if (status === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-4">
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
        >
          <BrandMark />
          <h1 className="mt-6 text-xl font-semibold text-navy">Cronograma do projeto</h1>
          <p className="mt-1 text-sm text-muted">Entre com o login e a senha que você recebeu.</p>
          {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <label className="mt-5 mb-1.5 block text-[13px] font-semibold text-navy">Login</label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-line bg-control py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-focus"
            />
          </div>
          <label className="mt-4 mb-1.5 block text-[13px] font-semibold text-navy">Senha</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-control py-2 pl-9 pr-10 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-focus"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    );
  }

  if (!data) return null;
  const { project, tasks, people } = data;

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-page px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{project.name}</p>
            <p className="text-xs text-muted">
              {formatBr(project.startDate)} – {formatBr(project.endDate)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-hover hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-navy">Cronograma</h1>
          <StatusBadge label={STATUS_LABEL[project.status]} className={STATUS_BADGE[project.status]} />
        </div>
        <ProjectGantt project={project} tasks={tasks} people={people} readOnly />
      </div>
    </div>
  );
}

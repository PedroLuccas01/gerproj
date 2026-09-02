"use client";

import { Clock3 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "./BrandMark";

export function PendingApprovalScreen() {
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  async function checkAgain() {
    setChecking(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { user: { status?: string } | null };
      if (data.user?.status === "active") {
        window.location.assign("/");
        return;
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="w-full max-w-md rounded-[20px] border border-line bg-surface p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
          <Clock3 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-navy">Cadastro em análise</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Olá, {user?.name}. Sua conta foi criada e está aguardando aprovação da gestão. Você
          receberá acesso depois que o cargo for definido.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={checkAgain}
            disabled={checking}
            className="rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {checking ? "Verificando..." : "Já fui aprovado? Verificar"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.assign("/login");
            }}
            className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

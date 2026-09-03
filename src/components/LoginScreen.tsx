"use client";

import { Eye, EyeOff, Lock, Mail, Quote, ShieldCheck, User } from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "./BrandMark";

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup") {
      if (name.trim().length < 3) {
        setError("Informe o nome completo.");
        return;
      }
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (password !== confirm) {
        setError("As senhas não coincidem.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const err =
        mode === "signup"
          ? await signup(name, email, password)
          : await login(email, password);
      if (err) {
        setError(err);
        return;
      }
      window.location.assign("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4 sm:p-6">
      <div className="flex h-[785px] w-[1198px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <aside className="relative hidden h-full w-[599px] shrink-0 overflow-hidden lg:block">
          <Image
            src="/login-hero.png"
            alt=""
            fill
            sizes="599px"
            preload
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/80" />

          <div className="relative z-10 flex h-full flex-col px-10 py-9">
            <BrandMark inverted size="lg" />

            <div className="mt-8 max-w-[420px]">
              <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-white">
                Transformamos projetos em{" "}
                <span className="text-blue-500">resultados.</span>
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Plataforma completa para planejar, acompanhar e entregar projetos com
                eficiência.
              </p>
            </div>

            <div className="mt-auto flex max-w-[420px] gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 backdrop-blur-sm">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p className="text-[13px] leading-6 text-white/85">
                Organização e visibilidade que impulsionam equipes e entregas.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex h-full min-w-0 flex-1 flex-col bg-white px-8 py-8 sm:px-12">
          <div className="mb-6 lg:hidden">
            <BrandMark onLight />
          </div>

          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center">
            {mode === "signin" ? (
              <>
                <h2 className="text-center text-[28px] font-semibold tracking-tight text-slate-900">
                  Bem-vindo de volta!
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Faça login para continuar na sua conta.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-center text-[28px] font-semibold tracking-tight text-slate-900">
                  Crie sua conta
                </h2>
                <p className="mt-2 text-center text-sm text-slate-500">
                  Comece sua experiência cadastrando um acesso.
                </p>
              </>
            )}

            <form onSubmit={onSubmit} className="mt-7 space-y-3.5">
              {mode === "signup" ? (
                <Field label="Nome completo">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Pedro Luccas"
                    className={fieldClass}
                  />
                </Field>
              ) : null}

              <Field label={mode === "signin" ? "E-mail ou usuário" : "E-mail"}>
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={mode === "signin" ? "text" : "email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "signin" ? "seu@email.com ou usuário" : "seu@email.com"}
                  className={fieldClass}
                />
              </Field>

              <Field label="Senha">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signin" ? "Sua senha" : "Informe sua senha"}
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              {mode === "signup" ? (
                <Field label="Confirmar senha">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className={fieldClass}
                  />
                </Field>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                {mode === "signin" ? <Lock className="h-4 w-4" /> : null}
                {submitting
                  ? "Aguarde..."
                  : mode === "signin"
                    ? "Entrar"
                    : "Criar conta"}
              </button>
            </form>

            {mode === "signin" ? (
              <p className="mt-5 text-center text-sm text-slate-500">
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-[#2563eb] hover:underline"
                >
                  Crie sua conta
                </button>
              </p>
            ) : (
              <p className="mt-5 text-center text-sm text-slate-500">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-semibold text-[#2563eb] hover:underline"
                >
                  Entrar
                </button>
              </p>
            )}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus dados estão protegidos com criptografia de ponta a ponta
          </p>
        </section>
      </div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      <span className="relative block">{children}</span>
    </label>
  );
}

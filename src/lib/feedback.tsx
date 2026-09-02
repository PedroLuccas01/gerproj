"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, cn } from "@/components/ui";

export type ToastType = "success" | "error" | "warning" | "info";
export type ConfirmTone = "danger" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type FeedbackContextValue = {
  notify: (input: { type: ToastType; title: string; description?: string }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_META: Record<
  ToastType,
  { icon: typeof CheckCircle2; wrap: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    wrap: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/70",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: XCircle,
    wrap: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/70",
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/70",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    wrap: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/70",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
};

const CONFIRM_META: Record<
  ConfirmTone,
  { icon: typeof AlertTriangle; iconWrap: string; iconClass: string }
> = {
  danger: {
    icon: AlertTriangle,
    iconWrap: "bg-red-50 dark:bg-red-950/60",
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: "bg-amber-50 dark:bg-amber-950/60",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    iconWrap: "bg-blue-50 dark:bg-blue-950/60",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (input: { type: ToastType; title: string; description?: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, ...input }].slice(-4));
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setConfirmState({
        confirmLabel: "Confirmar",
        cancelLabel: "Cancelar",
        tone: "danger",
        ...options,
      });
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setConfirmState(null);
  }, []);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);
  const tone = confirmState?.tone ?? "danger";
  const ConfirmIcon = CONFIRM_META[tone].icon;

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {confirmState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cancelar"
            onClick={() => closeConfirm(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  CONFIRM_META[tone].iconWrap,
                )}
              >
                <ConfirmIcon className={cn("h-5 w-5", CONFIRM_META[tone].iconClass)} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-base font-semibold text-navy">
                  {confirmState.title}
                </h2>
                <p id="confirm-desc" className="mt-1 text-sm leading-5 text-muted">
                  {confirmState.description}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </Button>
              <Button
                variant={tone === "danger" ? "danger" : "primary"}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(100%-2rem,380px)] flex-col gap-2">
        {toasts.map((toast) => {
          const meta = TOAST_META[toast.type];
          const Icon = meta.icon;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-3 shadow-lg",
                meta.wrap,
              )}
              role="status"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", meta.iconClass)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{toast.title}</div>
                {toast.description ? (
                  <div className="mt-0.5 text-xs leading-4 text-muted">{toast.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-faint hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback deve ser usado dentro de FeedbackProvider");
  return ctx;
}

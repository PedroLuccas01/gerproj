"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8 dark:bg-black/60">
      <button className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <div
        className={`relative z-10 my-4 flex max-h-[min(920px,calc(100vh-4rem))] w-full flex-col rounded-2xl bg-surface shadow-xl ${
          wide ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between border-b border-line-subtle px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-navy">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-faint hover:bg-hover hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-line-subtle px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

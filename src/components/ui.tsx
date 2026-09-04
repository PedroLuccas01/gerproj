"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { TASK_PROGRESS } from "@/lib/constants";
import { normalizeTaskProgress } from "@/lib/task-complete";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-navy">
      {children}
    </label>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

const control =
  "w-full rounded-lg border border-line bg-control px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-focus";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea(props, ref) {
    return <textarea ref={ref} {...props} className={cn(control, "min-h-[84px] resize-y", props.className)} />;
  },
);

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function Button({
  variant = "primary",
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-brand text-white hover:bg-[#1d4ed8] dark:hover:bg-blue-500",
    secondary: "border border-line bg-surface text-ink hover:bg-hover",
    ghost: "text-muted hover:bg-hover",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ProgressSelect({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
}) {
  const current = normalizeTaskProgress(value);
  if (disabled) {
    return <span className="w-[52px] shrink-0 text-center text-[11px] tabular-nums text-muted">{current}%</span>;
  }
  return (
    <select
      value={current}
      onChange={(event) => onChange?.(Number(event.target.value))}
      className="h-7 w-[58px] shrink-0 rounded-md border border-line bg-surface px-1 text-[11px] font-medium tabular-nums text-ink outline-none focus:border-brand"
      title="Avanço da atividade"
    >
      {TASK_PROGRESS.map((step) => (
        <option key={step} value={step}>
          {step}%
        </option>
      ))}
    </select>
  );
}

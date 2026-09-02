"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "./ui";

export function ThemeToggle({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { setTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => {
          const dark = document.documentElement.classList.contains("dark");
          setTheme(dark ? "light" : "dark");
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-lg p-2 text-muted transition hover:bg-hover hover:text-ink",
          className,
        )}
        title="Alternar tema"
        aria-label="Alternar tema claro ou escuro"
      >
        <Sun className="hidden h-4 w-4 dark:block" />
        <Moon className="h-4 w-4 dark:hidden" />
      </button>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-2 rounded-lg bg-surface-2 p-0.5 text-xs font-medium", className)}
      role="group"
      aria-label="Tema"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-surface px-2 py-1.5 text-navy shadow-sm transition dark:bg-transparent dark:text-muted dark:shadow-none dark:hover:text-ink"
      >
        <Sun className="h-3.5 w-3.5" />
        Claro
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-muted transition hover:text-ink dark:bg-surface dark:text-navy dark:shadow-sm"
      >
        <Moon className="h-3.5 w-3.5" />
        Escuro
      </button>
    </div>
  );
}

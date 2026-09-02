"use client";

import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { BrandMark } from "./BrandMark";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Entregas", icon: LayoutDashboard },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/burndown", label: "Burndown", icon: TrendingDown, managementOnly: true },
  { href: "/colaboradores", label: "Colaboradores", icon: Users, managementOnly: true },
  { href: "/clientes", label: "Clientes", icon: Building2, managementOnly: true },
];

const SIDEBAR_KEY = "pdef-sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-full bg-page">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex border-b border-line-subtle",
            collapsed ? "justify-center px-2 py-3" : "items-center gap-1 px-3 py-3",
          )}
        >
          {!collapsed ? (
            <Link href="/" className="min-w-0 flex-1 px-3 py-0.5" title="CAPSULA">
              <BrandMark />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={toggle}
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-hover hover:text-ink"
            title={collapsed ? "Expandir menu" : "Retrair menu"}
            aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
        <nav className={cn("flex-1 space-y-1 py-3", collapsed ? "px-2" : "px-3")}>
          {NAV.filter((item) => user?.isManagement || !item.managementOnly).map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? item.label : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line-subtle bg-surface px-4">
          <p className="min-w-0 truncate text-sm font-light tracking-wide text-muted">
            Gestão de Projetos - PDef | {process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact className="sm:hidden" />
          <ThemeToggle className="hidden w-[168px] sm:grid" />
          <NotificationBell />
          {user ? (
            <div className="flex min-w-0 items-center gap-2 pl-1">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                {initials(user.name)}
              </span>
              <span className="hidden max-w-[180px] truncate text-sm font-medium text-ink sm:inline">
                {user.name}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            title="Sair"
            onClick={async () => {
              await logout();
              window.location.assign("/login");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-hover hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Sair</span>
          </button>
          </div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

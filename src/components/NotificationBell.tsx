"use client";

import { AlertTriangle, Bell, Clock, MessageCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  buildNotifications,
  mergeNotifications,
  type AppNotification,
  type PendingAccount,
} from "@/lib/notifications";
import { useStore } from "@/lib/store";
import { cn } from "./ui";

async function markHistoryNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export function NotificationBell() {
  const { user } = useAuth();
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingAccount[]>([]);
  const [historyItems, setHistoryItems] = useState<AppNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadHistoryNotifications = useCallback(async () => {
    if (!user?.collaboratorId) {
      setHistoryItems([]);
      return;
    }
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: AppNotification[] };
      setHistoryItems(data.items ?? []);
    } catch {
      // ignore fetch errors
    }
  }, [user?.collaboratorId]);

  useEffect(() => {
    if (!user?.isManagement) {
      setPendingUsers([]);
      return;
    }
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/users");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { users: PendingAccount[] };
      if (!cancelled) setPendingUsers(data.users.filter((item) => item.status === "pending"));
    }
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.isManagement, open]);

  useEffect(() => {
    void loadHistoryNotifications();
    const timer = window.setInterval(() => void loadHistoryNotifications(), 45_000);
    return () => window.clearInterval(timer);
  }, [loadHistoryNotifications, open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const items = useMemo(
    () =>
      mergeNotifications(
        buildNotifications({
          isManagement: Boolean(user?.isManagement),
          collaboratorId: user?.collaboratorId ?? null,
          projects: state.projects,
          tasks: state.tasks,
          pendingUsers,
        }),
        historyItems,
      ),
    [user?.isManagement, user?.collaboratorId, state.projects, state.tasks, pendingUsers, historyItems],
  );

  const count = items.length;
  const label = count > 99 ? "99+" : String(count);

  async function handleOpen(item: AppNotification) {
    if (item.notificationId) {
      await markHistoryNotificationsRead([item.notificationId]);
      setHistoryItems((prev) => prev.filter((entry) => entry.notificationId !== item.notificationId));
    }
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={count ? `${count} notificações` : "Notificações"}
        title="Notificações"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-muted hover:bg-hover hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {label}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-[min(calc(100vw-2rem),360px)] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line-subtle px-3 py-2">
            <div className="text-sm font-semibold text-navy">Notificações</div>
            <div className="text-[11px] text-faint">
              {count === 0 ? "Nada pendente no momento." : `${count} item${count === 1 ? "" : "s"} para acompanhar.`}
            </div>
          </div>
          <div className="scrollbar-minimal max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">Você está em dia.</p>
            ) : (
              items.map((item) => {
                const Icon = item.notificationId
                  ? MessageCircle
                  : item.id.startsWith("pending:")
                    ? UserPlus
                    : item.tone === "danger"
                      ? AlertTriangle
                      : Clock;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => void handleOpen(item)}
                    className="flex gap-2.5 border-b border-line-subtle px-3 py-2.5 last:border-b-0 hover:bg-hover"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        item.notificationId
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"
                          : item.tone === "danger"
                            ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-ink">{item.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted">{item.description}</span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

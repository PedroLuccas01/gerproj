"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isManagementOnlyPath } from "@/lib/access-paths";
import { AppShell } from "./AppShell";
import { PendingApprovalScreen } from "./PendingApprovalScreen";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, hydrated, logout } = useAuth();
  const isLogin = pathname === "/login";
  const isShare = pathname.startsWith("/c/");

  useEffect(() => {
    if (!hydrated || isLogin || isShare) return;
    if (!user) {
      window.location.replace("/login?session=end");
      return;
    }
    if (user.isManagement || user.status !== "active") return;
    if (isManagementOnlyPath(pathname)) {
      window.location.replace("/");
    }
  }, [hydrated, user, pathname, isLogin, isShare]);

  if (isLogin || isShare) return <>{children}</>;

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-muted">
        Carregando...
      </div>
    );
  }

  if (user.status === "pending") {
    return <PendingApprovalScreen />;
  }

  if (user.status === "rejected") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page p-6 text-center">
        <p className="text-sm text-muted">Seu cadastro não foi aprovado.</p>
        <button
          type="button"
          className="text-sm font-medium text-blue-600 dark:text-blue-400"
          onClick={async () => {
            await logout();
            window.location.assign("/login");
          }}
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  if (!user.isManagement && isManagementOnlyPath(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-sm text-muted">
        Redirecionando...
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

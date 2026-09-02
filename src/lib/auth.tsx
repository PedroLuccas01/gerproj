"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser } from "./auth-types";
import {
  clearBrowserSession,
  isBrowserSessionLive,
  markBrowserSessionLive,
  startBrowserSessionHeartbeat,
} from "./browser-session";

type AuthContextValue = {
  hydrated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || "Não foi possível autenticar.";
  } catch {
    return "Não foi possível autenticar.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const path = window.location.pathname;
      if (path === "/login" || path.startsWith("/c/")) {
        setUser(null);
        setHydrated(true);
        return;
      }

      const live = await isBrowserSessionLive();
      if (!live) {
        clearBrowserSession();
        if (cancelled) return;
        setUser(null);
        setHydrated(true);
        window.location.replace("/login?session=end");
        return;
      }

      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { user: AuthUser | null };
        if (cancelled) return;
        if (data.user) markBrowserSessionLive();
        else clearBrowserSession();
        setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    markBrowserSessionLive();
    return startBrowserSessionHeartbeat();
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return readError(res);
    const data = (await res.json()) as { user: AuthUser };
    markBrowserSessionLive();
    setUser(data.user);
    return null;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) return readError(res);
    const data = (await res.json()) as { user: AuthUser };
    markBrowserSessionLive();
    setUser(data.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    clearBrowserSession();
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ hydrated, user, login, signup, logout }),
    [hydrated, user, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

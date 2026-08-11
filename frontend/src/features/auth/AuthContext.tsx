import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, loginRequest, logoutRequest, refreshSession } from "../../services/api/client";
import type { AuthUser } from "../../types/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshSession().then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const color = user?.business.primaryColor ?? "#2563EB";
    document.documentElement.style.setProperty("--brand-primary", color);
    document.documentElement.style.setProperty("--brand-soft", `${color}18`);
  }, [user?.business.primaryColor]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await loginRequest(identifier, password);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => { setUser(await apiRequest<AuthUser>("/auth/me")); }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiRequest, loginRequest, logoutRequest, refreshSession, setAccessToken, subscribeSessionExpired } from "../../services/api/client";
import type { AuthUser } from "../../types/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    refreshSession().then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => subscribeSessionExpired(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
    toast.error("Tu sesión venció. Iniciá sesión nuevamente.");
  }), [queryClient]);

  useEffect(() => {
    const color = user?.business.primaryColor ?? "#2563EB";
    const normalized = color.replace("#", "");
    const channels = normalized.length === 6 ? [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) : [37, 99, 235];
    const [red = 37, green = 99, blue = 235] = channels;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    document.documentElement.style.setProperty("--brand-primary", color);
    document.documentElement.style.setProperty("--brand-soft", `${color}18`);
    document.documentElement.style.setProperty("--brand-contrast", luminance > 0.6 ? "#0f172a" : "#ffffff");
  }, [user?.business.primaryColor]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await loginRequest(identifier, password);
    queryClient.clear();
    setUser(data.user);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try { await logoutRequest(); }
    finally {
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => { setUser(await apiRequest<AuthUser>("/auth/me")); }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

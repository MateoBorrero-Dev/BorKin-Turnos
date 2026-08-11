import { CalendarDays, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../utils/permissions";

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  if (!user) return null;

  const nav = [
    { to: "/", label: "Inicio", icon: LayoutDashboard, visible: hasPermission(user.permissions, "dashboard.view") },
    { to: "/users", label: "Usuarios", icon: Users, visible: hasPermission(user.permissions, "users.manage") },
  ].filter((item) => item.visible);

  async function handleLogout() {
    try { await logout(); }
    catch { toast.error("No pudimos cerrar la sesión correctamente."); }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {open && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><CalendarDays size={21} /></span>
            <div><p className="font-semibold tracking-tight">BorKin Turnos</p><p className="text-xs text-slate-500">{user.business.name}</p></div>
          </div>
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Navegación principal">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
              <Icon size={19} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 px-3"><p className="truncate text-sm font-medium">{user.firstName} {user.lastName}</p><p className="truncate text-xs text-slate-500">{user.role.name}</p></div>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600" onClick={() => void handleLogout()}><LogOut size={18} />Cerrar sesión</button>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
          <p className="ml-3 font-semibold">BorKin Turnos</p>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

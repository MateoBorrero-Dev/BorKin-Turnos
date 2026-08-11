import { ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <header><p className="text-sm font-medium text-blue-700">{user?.business.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Hola, {user?.firstName}</h1><p className="mt-2 text-slate-500">Las fundaciones de acceso y seguridad están operativas.</p></header>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
        <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={22} /></span><div><h2 className="font-semibold">Sesión protegida</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Autenticación, renovación segura, roles y permisos backend están activos. Los indicadores operativos se incorporarán en la fase correspondiente con datos reales.</p></div></div>
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Clock3, DollarSign, UserCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../services/api/client";
import type { AppointmentStatus, DashboardData } from "../types/api";

const statusLabel: Record<AppointmentStatus, string> = { PENDIENTE: "Pendiente", CONFIRMADO: "Confirmado", EN_CURSO: "En curso", COMPLETADO: "Completado", CANCELADO: "Cancelado", AUSENTE: "Ausente" };

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useQuery({ queryKey: ["analytics", "dashboard"], queryFn: () => apiRequest<DashboardData>("/analytics/dashboard"), staleTime: 15_000 });
  if (!user) return null;
  const money = new Intl.NumberFormat(user.business.locale, { style: "currency", currency: user.business.currency });
  const time = new Intl.DateTimeFormat(user.business.locale, { timeZone: user.business.timezone, hour: "2-digit", minute: "2-digit" });
  const data = dashboard.data;
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium brand-text">{user.business.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Hola, {user.firstName}</h1><p className="mt-2 text-slate-500">Así está funcionando el negocio hoy.</p></div><Link to="/agenda" className="primary-button">Ver agenda</Link></header>
    {dashboard.isLoading ? <DashboardSkeleton /> : dashboard.isError ? <ErrorState retry={() => void dashboard.refetch()} /> : data && <>
      <section className={`grid gap-3 sm:grid-cols-2 ${data.financial ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <Kpi icon={CalendarCheck} label="Turnos de hoy" value={String(data.kpis.total)} detail={`${data.kpis.confirmed} confirmados · ${data.kpis.pending} pendientes`} />
        <Kpi icon={CheckCircle2} label="Completados" value={String(data.kpis.completed)} detail={`${data.kpis.inProgress} en curso`} />
        <Kpi icon={UserCheck} label="Clientes atendidos" value={String(data.kpis.clientsAttended)} detail={`${data.kpis.cancelled} cancelados · ${data.kpis.absent} ausentes`} />
        {data.financial && <Kpi icon={DollarSign} label="Ventas cobradas" value={money.format(Number(data.financial.sales))} detail={`${data.financial.paymentCount} cobros · ticket ${money.format(Number(data.financial.averageTicket))}`} />}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold">Agenda de hoy</h2><p className="mt-1 text-sm text-slate-500">Horarios en {data.timezone}</p></div><UsersRound className="text-slate-400" size={20} /></div>
          {data.appointments.length ? <div className="divide-y divide-slate-100">{data.appointments.map((item) => <Link key={item.id} to="/agenda" className="grid gap-2 p-4 transition hover:bg-slate-50 sm:grid-cols-[5rem_1fr_1fr_auto] sm:items-center"><strong className="text-sm">{time.format(new Date(item.startAt))}</strong><div><p className="font-medium">{item.client.firstName} {item.client.lastName}</p><p className="text-xs text-slate-500">{item.serviceName}</p></div><p className="text-sm text-slate-600"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.employee.color }} />{item.employee.firstName} {item.employee.lastName}</p><StatusBadge status={item.status} /></Link>)}</div> : <Empty text="No hay turnos programados para hoy." />}
        </div>
        <div className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Clock3 size={20} /></span><div><h2 className="font-semibold">Próximo turno</h2><p className="text-sm text-slate-500">Siguiente cita activa</p></div></div>{data.nextAppointment ? <div className="mt-5"><p className="text-2xl font-semibold">{time.format(new Date(data.nextAppointment.startAt))}</p><p className="mt-2 font-medium">{data.nextAppointment.client.firstName} {data.nextAppointment.client.lastName}</p><p className="text-sm text-slate-500">{data.nextAppointment.serviceName} · {data.nextAppointment.employee.firstName} {data.nextAppointment.employee.lastName}</p><div className="mt-4"><StatusBadge status={data.nextAppointment.status} /></div></div> : <p className="mt-5 text-sm text-slate-500">No hay próximos turnos pendientes o confirmados.</p>}</div>
          {data.financial && <Link to="/statistics" className="block rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm"><p className="text-sm text-slate-300">Ticket promedio de hoy</p><p className="mt-2 text-2xl font-semibold">{money.format(Number(data.financial.averageTicket))}</p><p className="mt-3 text-sm text-slate-300">Abrir estadísticas →</p></Link>}
        </div>
      </section>
    </>}
  </div>;
}

function Kpi({ icon: Icon, label, value, detail }: { icon: typeof CalendarCheck; label: string; value: string; detail: string }) { return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon size={20} /></span></div><p className="mt-3 text-xs text-slate-500">{detail}</p></article>; }
function StatusBadge({ status }: { status: AppointmentStatus }) { const styles: Record<AppointmentStatus, string> = { PENDIENTE: "bg-amber-50 text-amber-700", CONFIRMADO: "bg-blue-50 text-blue-700", EN_CURSO: "bg-violet-50 text-violet-700", COMPLETADO: "bg-emerald-50 text-emerald-700", CANCELADO: "bg-red-50 text-red-700", AUSENTE: "bg-slate-100 text-slate-600" }; return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>{statusLabel[status]}</span>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-500">{text}</div>; }
function DashboardSkeleton() { return <div className="space-y-6" aria-label="Cargando panel"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div><div className="h-80 animate-pulse rounded-2xl bg-slate-100" /></div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-2xl border border-red-200 bg-white p-10 text-center"><p className="font-medium">No pudimos cargar el panel.</p><button className="secondary-button mt-4" onClick={retry}>Reintentar</button></div>; }

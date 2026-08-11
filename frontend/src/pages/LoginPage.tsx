import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../hooks/useAuth";
import { LoadingScreen } from "../components/LoadingScreen";

const schema = z.object({ identifier: z.string().trim().min(3, "Ingresá tu usuario o email."), password: z.string().min(8, "Ingresá tu contraseña.") });
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  if (loading) return <LoadingScreen />;
  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(values: Values) {
    setServerError(null);
    try {
      await login(values.identifier, values.password);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.08fr_.92fr]">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600"><CalendarDays size={23} /></span><span className="text-xl font-semibold">BorKin Turnos</span></div>
        <div className="max-w-xl"><p className="mb-5 text-sm font-medium uppercase tracking-[.18em] text-blue-300">Gestión profesional</p><h1 className="text-5xl font-semibold leading-tight tracking-tight">Tu negocio organizado, de principio a fin.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Turnos, equipo, clientes y operación diaria en un solo lugar confiable.</p></div>
        <p className="text-sm text-slate-500">Software BorKin</p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><CalendarDays size={21} /></span><span className="font-semibold">BorKin Turnos</span></div>
          <p className="text-sm font-medium text-blue-700">Bienvenido</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Ingresá a tu cuenta</h2><p className="mt-3 text-slate-500">Usá las credenciales asignadas por el administrador.</p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
            <label className="block"><span className="mb-2 block text-sm font-medium">Usuario o email</span><input className="field" autoComplete="username" autoFocus {...register("identifier")} />{errors.identifier && <span className="field-error">{errors.identifier.message}</span>}</label>
            <label className="block"><span className="mb-2 block text-sm font-medium">Contraseña</span><span className="relative block"><input className="field pr-12" type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} /><button type="button" className="absolute inset-y-0 right-0 px-4 text-slate-500" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span>{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
            {serverError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{serverError}</div>}
            <button className="primary-button w-full" disabled={isSubmitting}>{isSubmitting ? "Ingresando…" : "Iniciar sesión"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

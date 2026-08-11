import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { apiRequest } from "../services/api/client";
import type { RoleWithPermissions, UserRow } from "../types/api";

const createSchema = z.object({
  username: z.string().trim().min(3, "Mínimo 3 caracteres."),
  email: z.email("Email inválido."),
  firstName: z.string().trim().min(1, "Ingresá el nombre."),
  lastName: z.string().trim().min(1, "Ingresá el apellido."),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres."),
  roleId: z.string().min(1, "Seleccioná un rol."),
});
type CreateValues = z.infer<typeof createSchema>;

function message(error: unknown) { return error instanceof Error ? error.message : "No se pudo completar la operación."; }

export function UsersPage() {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const users = useQuery({ queryKey: ["users"], queryFn: () => apiRequest<UserRow[]>("/users") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiRequest<RoleWithPermissions[]>("/access/roles") });
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema) });

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => apiRequest<UserRow>("/users", { method: "POST", body: JSON.stringify({ ...values, permissionOverrides: [] }) }),
    onSuccess: () => { toast.success("Usuario creado."); setCreateOpen(false); form.reset(); void client.invalidateQueries({ queryKey: ["users"] }); },
    onError: (error) => toast.error(message(error)),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiRequest<UserRow>(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: (_data, variables) => { toast.success(variables.active ? "Usuario activado." : "Usuario desactivado."); void client.invalidateQueries({ queryKey: ["users"] }); },
    onError: (error) => toast.error(message(error)),
  });
  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => apiRequest<void>(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => { toast.success("Contraseña restablecida y sesiones revocadas."); setResetTarget(null); setNewPassword(""); },
    onError: (error) => toast.error(message(error)),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-blue-700">Seguridad</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Usuarios</h1><p className="mt-2 text-slate-500">Administrá accesos, roles y estado de las cuentas.</p></div>
        <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={18} />Nuevo usuario</button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        {users.isLoading ? <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
          : users.isError ? <div className="p-8 text-center"><p className="font-medium">No pudimos cargar los usuarios.</p><p className="mt-1 text-sm text-slate-500">{message(users.error)}</p><button className="secondary-button mt-4" onClick={() => void users.refetch()}>Reintentar</button></div>
          : !users.data?.length ? <div className="p-10 text-center text-slate-500"><UserRound className="mx-auto mb-3" />No hay usuarios registrados.</div>
          : <div className="divide-y divide-slate-100">{users.data.map((user) => (
            <article key={user.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{user.firstName[0]}{user.lastName[0]}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium">{user.firstName} {user.lastName}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{user.active ? "Activo" : "Inactivo"}</span></div><p className="truncate text-sm text-slate-500">@{user.username} · {user.email}</p><p className="mt-1 text-xs text-slate-400">{user.role.name}</p></div></div>
              <div className="flex flex-wrap gap-2 sm:justify-end"><button className="secondary-button" onClick={() => setResetTarget(user)}><KeyRound size={16} />Contraseña</button><button className="secondary-button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: user.id, active: !user.active })}>{user.active ? "Desactivar" : "Activar"}</button></div>
            </article>
          ))}</div>}
      </section>

      {createOpen && (
        <Modal title="Nuevo usuario" onClose={() => setCreateOpen(false)}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <Field label="Nombre" error={form.formState.errors.firstName?.message}><input className="field" {...form.register("firstName")} /></Field>
            <Field label="Apellido" error={form.formState.errors.lastName?.message}><input className="field" {...form.register("lastName")} /></Field>
            <Field label="Usuario" error={form.formState.errors.username?.message}><input className="field" autoComplete="off" {...form.register("username")} /></Field>
            <Field label="Email" error={form.formState.errors.email?.message}><input className="field" type="email" {...form.register("email")} /></Field>
            <Field label="Contraseña inicial" error={form.formState.errors.password?.message}><input className="field" type="password" autoComplete="new-password" {...form.register("password")} /></Field>
            <Field label="Rol" error={form.formState.errors.roleId?.message}><select className="field" defaultValue="" {...form.register("roleId")}><option value="" disabled>Seleccionar</option>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" disabled={createMutation.isPending}>{createMutation.isPending ? "Creando…" : "Crear usuario"}</button></div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title="Restablecer contraseña" onClose={() => { setResetTarget(null); setNewPassword(""); }}>
          <p className="mb-5 text-sm leading-6 text-slate-500">Se cerrarán todas las sesiones de {resetTarget.firstName} {resetTarget.lastName}.</p>
          <label className="block"><span className="mb-2 block text-sm font-medium">Nueva contraseña</span><input className="field" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="mt-2 block text-xs text-slate-500">Mínimo 12 caracteres.</span></label>
          <div className="mt-6 flex justify-end gap-3"><button className="secondary-button" onClick={() => setResetTarget(null)}>Cancelar</button><button className="primary-button" disabled={newPassword.length < 12 || resetMutation.isPending} onClick={() => resetMutation.mutate({ id: resetTarget.id, password: newPassword })}>{resetMutation.isPending ? "Guardando…" : "Restablecer"}</button></div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-label={title}><header className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>{children}</section></div>;
}

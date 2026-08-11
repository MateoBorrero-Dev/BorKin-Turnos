import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiRequest } from "../services/api/client";
import type { Client, DuplicateClient } from "../types/api";
import { clientFormSchema, clientPayload, duplicateClients, type ClientFormValues } from "../utils/client-form";
import { Field, Modal } from "./Modal";

const emptyValues: ClientFormValues = { firstName: "", lastName: "", phone: "", email: "", birthDate: "", notes: "" };
const message = (error: unknown) => error instanceof Error ? error.message : "No se pudo guardar el cliente.";

export function ClientFormModal({ client, onClose, onSaved, onViewDuplicate }: { client?: Client; onClose: () => void; onSaved: (client: Client) => Promise<void> | void; onViewDuplicate: (id: string) => void }) {
  const [duplicates, setDuplicates] = useState<DuplicateClient[] | null>(null);
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? { firstName: client.firstName, lastName: client.lastName ?? "", phone: client.phone ?? "", email: client.email ?? "", birthDate: client.birthDate ?? "", notes: client.notes ?? "" } : emptyValues,
  });
  const mutation = useMutation({
    mutationFn: ({ values, force }: { values: ClientFormValues; force: boolean }) => apiRequest<Client>(client ? `/clients/${client.id}` : "/clients", { method: client ? "PATCH" : "POST", body: JSON.stringify(clientPayload(values, force)) }),
    onSuccess: async (saved) => { setDuplicates(null); toast.success(client ? "Cliente actualizado." : "Cliente creado."); await onSaved(saved); onClose(); },
    onError: (error) => { const matches = duplicateClients(error); if (matches?.length) setDuplicates(matches); else toast.error(message(error)); },
  });
  const submit = (force = false) => form.handleSubmit((values) => mutation.mutate({ values, force }))();

  return <><Modal title={client ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate({ values, force: false }))}>
      <Field label="Nombre *" error={form.formState.errors.firstName?.message}><input className="field" autoFocus {...form.register("firstName")} /></Field>
      <Field label="Apellido" error={form.formState.errors.lastName?.message}><input className="field" {...form.register("lastName")} /></Field>
      <Field label="Teléfono" error={form.formState.errors.phone?.message}><input className="field" inputMode="tel" placeholder="+54 9 345 1234567" {...form.register("phone")} /></Field>
      <Field label="Email" error={form.formState.errors.email?.message}><input className="field" type="email" {...form.register("email")} /></Field>
      <Field label="Fecha de nacimiento" error={form.formState.errors.birthDate?.message}><input className="field" type="date" max={new Date().toISOString().slice(0, 10)} {...form.register("birthDate")} /></Field>
      <div className="sm:col-span-2"><Field label="Notas" error={form.formState.errors.notes?.message}><textarea className="field min-h-28 resize-y" maxLength={2_000} placeholder="Preferencias generales del cliente…" {...form.register("notes")} /></Field><p className="mt-1 text-right text-xs text-slate-400">Máximo 2000 caracteres</p></div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? "Guardando…" : "Guardar cliente"}</button></div>
    </form>
  </Modal>
  {duplicates && <DuplicateClientModal matches={duplicates} saving={mutation.isPending} onCancel={() => setDuplicates(null)} onView={(id) => { setDuplicates(null); onClose(); onViewDuplicate(id); }} onForce={() => void submit(true)} />}
  </>;
}

export function DuplicateClientModal({ matches, saving, onCancel, onView, onForce }: { matches: DuplicateClient[]; saving: boolean; onCancel: () => void; onView: (id: string) => void; onForce: () => void }) {
  return <Modal title="Posible cliente duplicado" onClose={onCancel} width="max-w-xl"><div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={20} /><p className="text-sm leading-6">Encontramos un cliente activo con el mismo teléfono o email. Revisalo antes de crear otro registro.</p></div><div className="mt-4 space-y-3">{matches.map((match) => <article key={match.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{match.fullName}</p>{match.phone && <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Phone size={15} />{match.phone}</p>}{match.email && <p className="mt-1 flex items-center gap-2 break-all text-sm text-slate-600"><Mail size={15} />{match.email}</p>}</div><button className="secondary-button shrink-0" onClick={() => onView(match.id)}>Ver cliente</button></div></article>)}</div><div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={saving} onClick={onForce}>{saving ? "Creando…" : "Crear de todas formas"}</button></div></Modal>;
}

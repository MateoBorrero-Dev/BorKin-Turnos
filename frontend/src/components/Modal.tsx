import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ title, onClose, children, width = "max-w-2xl" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-3 sm:p-4"><section className={`max-h-[94vh] w-full ${width} overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6`} role="dialog" aria-modal="true" aria-label={title}><header className="mb-6 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{title}</h2><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>{children}</section></div>;
}

export function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>;
}

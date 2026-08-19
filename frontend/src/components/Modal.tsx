import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export function Modal({ title, onClose, children, width = "max-w-2xl" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]");
    (firstFocusable ?? dialogRef.current)?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]") ?? [])];
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-3 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${width} flex-col rounded-2xl bg-white p-5 shadow-xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:p-6`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}>
        <header className="mb-5 flex shrink-0 items-center justify-between gap-4"><h2 id={titleId} className="text-xl font-semibold">{title}</h2><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">{children}</div>
      </section>
    </div>
  );
}

export function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>;
}

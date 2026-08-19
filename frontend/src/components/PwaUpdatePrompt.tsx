import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError(error) { console.error("No se pudo registrar el service worker", error); },
  });

  if (!needRefresh) return null;
  return (
    <section className="fixed bottom-4 left-4 right-4 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="status" aria-live="polite">
      <RefreshCw className="shrink-0 text-blue-600" size={21} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-slate-700"><strong className="block text-slate-950">Nueva versión disponible</strong>Actualizá para usar las últimas mejoras.</p>
      <button className="primary-button" onClick={() => void updateServiceWorker(true)}>Actualizar</button>
      <button className="rounded-lg px-2 text-slate-500 hover:bg-slate-100" onClick={() => setNeedRefresh(false)} aria-label="Cerrar aviso"><X size={18} /></button>
    </section>
  );
}

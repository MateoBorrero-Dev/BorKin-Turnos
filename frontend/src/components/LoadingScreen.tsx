export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50" role="status" aria-label="Cargando aplicación">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
        Cargando BorKin Turnos…
      </div>
    </div>
  );
}

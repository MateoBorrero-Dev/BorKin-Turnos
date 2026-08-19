import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { failed: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="alert">
          <p className="text-sm font-semibold text-red-700">Error inesperado</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">No pudimos mostrar esta pantalla</h1>
          <p className="mt-3 text-sm text-slate-600">Recargá la aplicación. Si el problema continúa, contactá al administrador.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="primary-button" onClick={() => window.location.reload()}>Recargar</button>
            <a className="secondary-button" href="/">Volver al inicio</a>
          </div>
        </section>
      </main>
    );
  }
}

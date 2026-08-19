import { ArrowLeft, Home, ShieldX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

function Feedback({ code, title, detail, forbidden = false }: { code: string; title: string; detail: string; forbidden?: boolean }) {
  const navigate = useNavigate();
  return (
    <section className="mx-auto grid min-h-[65dvh] max-w-xl place-items-center text-center" aria-labelledby="route-feedback-title">
      <div>
        {forbidden && <ShieldX className="mx-auto mb-4 text-amber-600" size={44} aria-hidden="true" />}
        <p className="text-sm font-semibold text-slate-500">{code}</p>
        <h1 id="route-feedback-title" className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-slate-600">{detail}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button className="secondary-button" onClick={() => navigate(-1)}><ArrowLeft size={18} />Volver</button>
          <Link className="primary-button" to="/"><Home size={18} />Ir al inicio</Link>
        </div>
      </div>
    </section>
  );
}

export function ForbiddenPage() {
  return <Feedback code="403" title="Acceso restringido" detail="Tu usuario no tiene permiso para ver esta sección." forbidden />;
}

export function NotFoundPage() {
  return <Feedback code="404" title="Página no encontrada" detail="La dirección solicitada no existe o fue movida." />;
}

import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-cream-200 text-plum-500 flex items-center justify-center mb-4">
        <Cookie className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-serif font-bold text-ink mb-2">Página no encontrada</h2>
      <p className="text-sm text-ink-muted max-w-md mb-6">
        La ruta solicitada no existe en el sistema de K_Sweet o fue reubicada.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-plum-500 text-white font-medium text-sm hover:bg-plum-600 transition-colors shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver al Panel Principal</span>
      </Link>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error capturado en frontera K_Sweet:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-serif font-bold text-ink mb-2">Ocurrió un error inesperado</h2>
      <p className="text-sm text-ink-muted max-w-md mb-6">
        {error.message || "No fue posible procesar la solicitud en el módulo de K_Sweet."}
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-plum-500 text-white font-medium text-sm hover:bg-plum-600 transition-colors shadow-sm"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Reintentar operación</span>
      </button>
    </div>
  );
}

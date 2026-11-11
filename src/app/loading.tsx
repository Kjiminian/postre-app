export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-4 border-plum-200 border-t-plum-500 rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-ink-muted">Cargando datos de K_Sweet...</p>
    </div>
  );
}

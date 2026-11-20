// Constantes del Negocio — K_Sweet (República Dominicana)
// GEM PROYECTOS SOFTWARE V3.0 (RN-001 a RN-008)

export const BUSINESS = {
  name: "K_Sweet",
  tagline: "Repostería artesanal con sabor auténtico",
  timezone: "America/Santo_Domingo",
  currency: { code: "DOP", symbol: "RD$", locale: "es-DO" },
  weekStartsOn: 1 as const, // 1 = Lunes (RF-006)
};

export const PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "PENDIENTE"] as const;

export const RECIPE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Activa", color: "bg-sage-500/10 text-sage-600" },
  ARCHIVED: { label: "Archivada", color: "bg-cream-200 text-ink-muted" },
};

export const BASE_UNITS = ["g", "ml", "unidad"] as const;
export const ALL_UNITS = ["g", "kg", "lb", "oz", "ml", "l", "taza", "cda", "cdita", "unidad"] as const;

export const EXPENSE_CATEGORIES_DEFAULT = [
  "Transporte",
  "Publicidad",
  "Alquiler",
  "Servicios (Agua/Luz/Gas)",
  "Empaque y Embalaje",
  "Limpieza",
  "Otros",
] as const;

/** Semana ISO: Lunes 00:00 → Domingo 23:59:59 en AST (UTC-4, República Dominicana) */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const AST_OFFSET_MS = 4 * 60 * 60 * 1000;
  const astDate = new Date(date.getTime() - AST_OFFSET_MS);
  const day = astDate.getUTCDay(); // 0=Dom, 1=Lun...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayYear = astDate.getUTCFullYear();
  const mondayMonth = astDate.getUTCMonth();
  const mondayDay = astDate.getUTCDate() + diffToMonday;

  // Lunes 00:00:00.000 AST = 04:00:00.000 UTC
  const start = new Date(Date.UTC(mondayYear, mondayMonth, mondayDay, 4, 0, 0, 0));
  // Domingo 23:59:59.999 AST = Lunes siguiente 03:59:59.999 UTC
  const end = new Date(Date.UTC(mondayYear, mondayMonth, mondayDay + 6, 27, 59, 59, 999));
  return { start, end };
}

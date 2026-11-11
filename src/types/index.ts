// Tipos de Dominio — K_Sweet
// GEM PROYECTOS SOFTWARE V3.0 (RN-007, RN-008, RF-016, RF-017, RF-018)

// ─── Enums de Estado ─────────────────────────────────────────────────────────

export enum SaleStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
}

export enum RecipeStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum ImportStatus {
  PENDING = "PENDING",
  PREVIEWING = "PREVIEWING",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}

export enum ImportRowStatus {
  DRAFT = "DRAFT",
  IMPORTED = "IMPORTED",
  SKIPPED = "SKIPPED",
  ERROR = "ERROR",
}

// ─── Tipos de Pago y Entrega ──────────────────────────────────────────────────

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "PENDIENTE";
export type UserRole = "ADMIN" | "STAFF";

// ─── Unidades soportadas ──────────────────────────────────────────────────────

export type MassUnit = "g" | "kg" | "lb" | "oz";
export type VolumeUnit = "ml" | "l" | "taza" | "cda" | "cdita";
export type Unit = MassUnit | VolumeUnit | "unidad";

// ─── DTOs de Negocio ──────────────────────────────────────────────────────────

export interface IngredientDto {
  id: string;
  name: string;
  supplierName: string | null;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  costPerBaseUnit: number;
  density: number | null;
  reviewFlag: boolean;
  isActive: boolean;
  notes: string | null;
}

export interface RecipeIngredientLine {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costCents: number;
}

export interface RecipeDto {
  id: string;
  name: string;
  slug: string;
  yield: number;
  yieldUnit: string;
  batchCostCents: number;
  unitCostCents: number;
  suggestedPriceCents: number;
  currentPriceCents: number;
  targetMargin: number;
  status: RecipeStatus;
  reviewFlag: boolean;
  ingredients: RecipeIngredientLine[];
}

export interface SaleItemInput {
  recipeId?: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  notes?: string;
}

export interface SaleCreateInput {
  saleDate: string; // ISO
  customerName?: string;
  customerId?: string;
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  collectedCents: number;
  notes?: string;
}

export interface WeeklyCloseDto {
  id: string;
  weekStart: string;
  weekEnd: string;
  invoicedCents: number;
  collectedCents: number;
  pendingCents: number;
  costOfGoodsCents: number;
  operationalExpCents: number;
  netResultCents: number;
  cashFundCents: number;
  expectedCashCents: number;
  countedCashCents: number;
  cashDifferenceCents: number;
  isClosed: boolean;
  modifiedAfterClose: boolean;
}

// ─── Conversiones de Unidades (Módulo 7) ─────────────────────────────────────

/** Factores de conversión a gramos (masa) — RFC-021 */
export const MASS_TO_GRAMS: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,     // Exacto
  oz: 28.349523125,  // Exacto
};

/** Factores de conversión a mililitros (volumen) — RF-021 */
export const VOL_TO_ML: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  taza: 236.5882365,    // 1 taza US estándar
  cda: 14.7867648,      // 1 cucharada US
  cdita: 4.92892159,    // 1 cucharadita US
};

/** Equivalencias históricas del Excel — RF-023 (aproximadas, editables) */
export const EXCEL_APPROX_REFS = [
  { name: "taza (referencia Excel)", from: "taza", to: "g", factor: 150, ingredient: null, source: "EXCEL" },
  { name: "media taza (referencia Excel)", from: "media_taza", to: "g", factor: 75, ingredient: null, source: "EXCEL" },
  { name: "cucharada (referencia Excel)", from: "cda", to: "g", factor: 15, ingredient: null, source: "EXCEL" },
];

// ─── Helpers de Moneda ────────────────────────────────────────────────────────

/** Convierte centavos a RD$ mostrando 2 decimales */
export function formatDOP(cents: number): string {
  return `RD$ ${(cents / 100).toFixed(2)}`;
}

/** Convierte valor decimal RD$ a centavos enteros */
export function toCents(dop: number): number {
  return Math.round(dop * 100);
}

/** Convierte centavos enteros a valor decimal RD$ */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Calcula precio sugerido dado costo y margen sobre venta (RF-017)
 * P = C / (1 - M)  donde M es entre 0 y 1
 */
export function calcSuggestedPrice(unitCostCents: number, marginFraction: number): number {
  if (marginFraction >= 1 || marginFraction < 0) throw new Error("Margen debe ser >= 0% y < 100%");
  return Math.ceil(unitCostCents / (1 - marginFraction));
}

/** Calcula margen sobre venta (RF-018) */
export function calcMarginOnSale(priceCents: number, costCents: number): number {
  if (priceCents <= 0) return 0;
  return ((priceCents - costCents) / priceCents) * 100;
}

/** Calcula markup sobre costo (RF-018) */
export function calcMarkupOnCost(priceCents: number, costCents: number): number {
  if (costCents <= 0) return 0;
  return ((priceCents - costCents) / costCents) * 100;
}

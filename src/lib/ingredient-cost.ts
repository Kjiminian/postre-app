import { normalizeToBase } from "@/lib/conversions";

export interface IngredientCostInput {
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  conversionFactor?: number | null;
  hasExplicitFactor?: boolean;
  density?: number | null;
}

export type IngredientCostResult =
  | {
      ok: true;
      effectiveBaseQty: number;
      costPerBaseUnit: number;
      appliedFactor: number;
      usedStandardConversion: boolean;
    }
  | { ok: false; error: string };

/**
 * Calcula la cantidad efectiva en unidad base y el costo por unidad base.
 * Precedencia (PRE-001):
 * 1. Si hay un factor explícito distinto de 1 (o factorId seleccionado), usa packageQty * conversionFactor.
 * 2. Si conversionFactor === 1 y packageUnit !== baseUnit, aplica normalizeToBase estándar.
 * 3. Si packageUnit === baseUnit, usa packageQty * 1.
 */
export function calculateIngredientBaseCost(input: IngredientCostInput): IngredientCostResult {
  const {
    packagePriceCents,
    packageQty,
    packageUnit,
    baseUnit,
    conversionFactor = 1,
    hasExplicitFactor = false,
    density,
  } = input;

  if (!Number.isFinite(packagePriceCents) || packagePriceCents <= 0) {
    return { ok: false, error: "El precio del empaque debe ser mayor a 0." };
  }
  if (!Number.isFinite(packageQty) || packageQty <= 0) {
    return { ok: false, error: "La cantidad del empaque debe ser mayor a 0." };
  }
  const factorNum = conversionFactor === null || conversionFactor === undefined ? 1 : Number(conversionFactor);
  if (!Number.isFinite(factorNum) || factorNum <= 0) {
    return { ok: false, error: "El factor de conversión debe ser mayor a 0." };
  }

  let effectiveBaseQty = packageQty * factorNum;
  let usedStandardConversion = false;

  if (!hasExplicitFactor && factorNum === 1 && packageUnit !== baseUnit) {
    const conv = normalizeToBase(packageQty, packageUnit, baseUnit, density ?? undefined);
    if (!conv.ok) {
      return { ok: false, error: conv.error };
    }
    effectiveBaseQty = conv.value;
    usedStandardConversion = true;
  }

  if (!Number.isFinite(effectiveBaseQty) || effectiveBaseQty <= 0) {
    return { ok: false, error: "La cantidad efectiva en unidad base debe ser mayor a 0." };
  }

  const costPerBaseUnit = packagePriceCents / 100 / effectiveBaseQty;
  return {
    ok: true,
    effectiveBaseQty,
    costPerBaseUnit,
    appliedFactor: usedStandardConversion ? effectiveBaseQty / packageQty : factorNum,
    usedStandardConversion,
  };
}

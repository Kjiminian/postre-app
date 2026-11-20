import { MassUnit, VolumeUnit, MASS_TO_GRAMS, VOL_TO_ML } from "@/types";

export type ConversionResult =
  | { ok: true; value: number; fromUnit: string; toUnit: string }
  | { ok: false; error: string };

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  grs: "g",
  gramo: "g",
  gramos: "g",
  gracmos: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  lb: "lb",
  lbs: "lb",
  libra: "lb",
  libras: "lb",
  oz: "oz",
  onza: "oz",
  onzas: "oz",
  "fl oz": "fl_oz",
  "fl. oz": "fl_oz",
  "fl.oz": "fl_oz",
  fl_oz: "fl_oz",
  floz: "fl_oz",
  "onza liquida": "fl_oz",
  "onzas liquidas": "fl_oz",
  ml: "ml",
  mililitro: "ml",
  mililitros: "ml",
  l: "l",
  lt: "l",
  litro: "l",
  litros: "l",
  taza: "taza",
  tazas: "taza",
  cda: "cda",
  cdas: "cda",
  cucharada: "cda",
  cucharadas: "cda",
  cdita: "cdita",
  cditas: "cdita",
  cucharadita: "cdita",
  cucharaditas: "cdita",
  unidad: "unidad",
  unidades: "unidad",
  ud: "unidad",
  uds: "unidad",
  und: "unidad",
  unds: "unidad",
  pieza: "unidad",
  piezas: "unidad",
  paquete: "paquete",
  paquetes: "paquete",
  pack: "paquete",
  yarda: "yarda",
  yardas: "yarda",
};

/**
 * Normaliza alias comunes de unidades en español sin inventar densidades.
 */
export function normalizeUnitAlias(raw: string | null | undefined): string {
  const cleaned = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "unidad";
  return UNIT_ALIASES[cleaned] || cleaned;
}

/**
 * Convierte entre unidades de masa (RF-021)
 * 1 lb = 453.59237 g exacto
 * 1 oz = 28.349523125 g exacto
 */
export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  const inGrams = value * MASS_TO_GRAMS[from];
  return inGrams / MASS_TO_GRAMS[to];
}

/**
 * Convierte entre unidades de volumen (RF-021)
 */
export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  const inMl = value * VOL_TO_ML[from];
  return inMl / VOL_TO_ML[to];
}

/**
 * Convierte de volumen a masa usando densidad (RF-022)
 * @param density g/ml del ingrediente específico
 */
export function convertVolumeToMass(
  value: number,
  from: VolumeUnit,
  to: MassUnit,
  density: number
): ConversionResult {
  if (!density || density <= 0) {
    return { ok: false, error: "Se requiere densidad (g/ml) para convertir de volumen a masa." };
  }
  const ml = value * VOL_TO_ML[from];
  const grams = ml * density;
  const result = grams / MASS_TO_GRAMS[to];
  return { ok: true, value: result, fromUnit: from, toUnit: to };
}

/**
 * Convierte de masa a volumen usando densidad (RF-022)
 */
export function convertMassToVolume(
  value: number,
  from: MassUnit,
  to: VolumeUnit,
  density: number
): ConversionResult {
  if (!density || density <= 0) {
    return { ok: false, error: "Se requiere densidad (g/ml) para convertir de masa a volumen." };
  }
  const grams = value * MASS_TO_GRAMS[from];
  const ml = grams / density;
  const result = ml / VOL_TO_ML[to];
  return { ok: true, value: result, fromUnit: from, toUnit: to };
}

export const MASS_UNITS: MassUnit[] = ["g", "kg", "lb", "oz"];
export const VOL_UNITS: VolumeUnit[] = ["ml", "l", "fl_oz", "taza", "cda", "cdita"];

/**
 * Convierte entre cualquier par de unidades, requiriendo densidad si hay
 * cruce entre masa y volumen (RF-021 y RF-022)
 */
export function convertUnit(
  value: number,
  from: string,
  to: string,
  density?: number
): ConversionResult {
  const normFrom = normalizeUnitAlias(from);
  const normTo = normalizeUnitAlias(to);

  if (normFrom === normTo) return { ok: true, value, fromUnit: normFrom, toUnit: normTo };

  const fromIsMass = MASS_UNITS.includes(normFrom as MassUnit);
  const toIsMass = MASS_UNITS.includes(normTo as MassUnit);
  const fromIsVol = VOL_UNITS.includes(normFrom as VolumeUnit);
  const toIsVol = VOL_UNITS.includes(normTo as VolumeUnit);

  if (fromIsMass && toIsMass) {
    return { ok: true, value: convertMass(value, normFrom as MassUnit, normTo as MassUnit), fromUnit: normFrom, toUnit: normTo };
  }
  if (fromIsVol && toIsVol) {
    return { ok: true, value: convertVolume(value, normFrom as VolumeUnit, normTo as VolumeUnit), fromUnit: normFrom, toUnit: normTo };
  }
  if (fromIsVol && toIsMass) {
    return convertVolumeToMass(value, normFrom as VolumeUnit, normTo as MassUnit, density ?? 0);
  }
  if (fromIsMass && toIsVol) {
    return convertMassToVolume(value, normFrom as MassUnit, normTo as VolumeUnit, density ?? 0);
  }

  return { ok: false, error: `No se puede convertir de "${from}" a "${to}".` };
}

/** Normaliza la cantidad de un ingrediente a su unidad base (g, ml, o unidad) */
export function normalizeToBase(
  qty: number,
  unit: string,
  baseUnit: string,
  density?: number
): ConversionResult {
  return convertUnit(qty, unit, baseUnit, density);
}

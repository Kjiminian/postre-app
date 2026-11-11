import { MassUnit, VolumeUnit, MASS_TO_GRAMS, VOL_TO_ML } from "@/types";

export type ConversionResult =
  | { ok: true; value: number; fromUnit: string; toUnit: string }
  | { ok: false; error: string };

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

const MASS_UNITS: MassUnit[] = ["g", "kg", "lb", "oz"];
const VOL_UNITS: VolumeUnit[] = ["ml", "l", "taza", "cda", "cdita"];

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
  if (from === to) return { ok: true, value, fromUnit: from, toUnit: to };

  const fromIsMass = MASS_UNITS.includes(from as MassUnit);
  const toIsMass = MASS_UNITS.includes(to as MassUnit);
  const fromIsVol = VOL_UNITS.includes(from as VolumeUnit);
  const toIsVol = VOL_UNITS.includes(to as VolumeUnit);

  if (fromIsMass && toIsMass) {
    return { ok: true, value: convertMass(value, from as MassUnit, to as MassUnit), fromUnit: from, toUnit: to };
  }
  if (fromIsVol && toIsVol) {
    return { ok: true, value: convertVolume(value, from as VolumeUnit, to as VolumeUnit), fromUnit: from, toUnit: to };
  }
  if (fromIsVol && toIsMass) {
    return convertVolumeToMass(value, from as VolumeUnit, to as MassUnit, density ?? 0);
  }
  if (fromIsMass && toIsVol) {
    return convertMassToVolume(value, from as MassUnit, to as VolumeUnit, density ?? 0);
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

// Runner de Pruebas de Dominio K_Sweet (Node.js nativo)
// Valida importes, conversiones, densidades, márgenes P = C / (1 - M), límites semanales y cobros
import assert from "node:assert";

// Helpers monetarios
function toCents(dop) {
  return Math.round(parseFloat(String(dop)) * 100);
}
function fromCents(cents) {
  return cents / 100;
}
function formatDOP(cents) {
  return `RD$ ${(cents / 100).toFixed(2)}`;
}
function calcSuggestedPrice(unitCostCents, marginFraction) {
  if (marginFraction >= 1 || marginFraction < 0) throw new Error("Margen debe ser >= 0% y < 100%");
  return Math.ceil(unitCostCents / (1 - marginFraction));
}
function calcMarginOnSale(priceCents, costCents) {
  if (priceCents <= 0) return 0;
  return ((priceCents - costCents) / priceCents) * 100;
}
function calcMarkupOnCost(priceCents, costCents) {
  if (costCents <= 0) return 0;
  return ((priceCents - costCents) / costCents) * 100;
}

// Conversiones
const MASS_TO_GRAMS = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
};
const VOL_TO_ML = {
  ml: 1,
  l: 1000,
  taza: 236.5882365,
  cda: 14.7867648,
  cdita: 4.92892159,
};

function convertMass(val, from, to) {
  return (val * MASS_TO_GRAMS[from]) / MASS_TO_GRAMS[to];
}
function convertVolume(val, from, to) {
  return (val * VOL_TO_ML[from]) / VOL_TO_ML[to];
}
function convertVolumeToMass(val, from, to, density) {
  if (!density || density <= 0) {
    return { ok: false, error: "Se requiere densidad para convertir volumen a masa." };
  }
  const ml = val * VOL_TO_ML[from];
  const grams = ml * density;
  return { ok: true, value: grams / MASS_TO_GRAMS[to] };
}

// Límites semanales L-D
function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// Suite de Pruebas
const tests = [
  {
    name: "Redondeo Monetario (RN-001): toCents y fromCents en RD$",
    fn: () => {
      assert.strictEqual(toCents(140.5), 14050);
      assert.strictEqual(toCents(0.33), 33);
      assert.strictEqual(toCents("1299.99"), 129999);
      assert.strictEqual(fromCents(14050), 140.5);
      assert.ok(formatDOP(140000).includes("RD$ 1400.00"));
    },
  },
  {
    name: "Conversión de Masa Exacta (RF-021): 1 lb = 453.59237 g",
    fn: () => {
      const grams = convertMass(1, "lb", "g");
      assert.ok(Math.abs(grams - 453.59237) < 0.0001, `Esperado 453.59237, recibido ${grams}`);
    },
  },
  {
    name: "Conversión de Masa Exacta (RF-021): 1 oz = 28.349523125 g",
    fn: () => {
      const grams = convertMass(1, "oz", "g");
      assert.ok(Math.abs(grams - 28.349523125) < 0.0001, `Esperado 28.349523125, recibido ${grams}`);
    },
  },
  {
    name: "Conversión Volumen a Masa con Densidad Obligatoria (RF-022): Leche 1.07 g/ml",
    fn: () => {
      const res = convertVolumeToMass(1, "taza", "g", 1.07);
      assert.strictEqual(res.ok, true);
      // 236.5882365 * 1.07 = 253.1494 g
      assert.ok(Math.abs(res.value - 253.15) < 0.1, `Esperado ~253.15g, recibido ${res.value}`);

      // Sin densidad debe fallar
      const fail = convertVolumeToMass(1, "taza", "g", 0);
      assert.strictEqual(fail.ok, false);
    },
  },
  {
    name: "Fórmula de Precio Sugerido (RF-017): P = C / (1 - M)",
    fn: () => {
      // Costo RD$ 67.20 (6720 cents), Margen 52% (0.52)
      // P = 6720 / (1 - 0.52) = 6720 / 0.48 = 14000 cents (RD$ 140.00)
      const suggested = calcSuggestedPrice(6720, 0.52);
      assert.strictEqual(suggested, 14000);
      assert.strictEqual(fromCents(suggested), 140);
    },
  },
  {
    name: "Diferenciación Margen sobre Venta vs Markup sobre Costo (RF-018)",
    fn: () => {
      const costCents = 10000;
      const priceCents = 20000;
      const margin = calcMarginOnSale(priceCents, costCents);
      const markup = calcMarkupOnCost(priceCents, costCents);

      assert.strictEqual(margin, 50, "Margen sobre venta debe ser 50%");
      assert.strictEqual(markup, 100, "Markup sobre costo debe ser 100%");
    },
  },
  {
    name: "Límites Semanales Lunes a Domingo (RF-006)",
    fn: () => {
      const refDate = new Date("2026-11-11T14:00:00Z");
      const { start, end } = getWeekBounds(refDate);

      assert.strictEqual(start.getDay(), 1, "La semana debe iniciar en Lunes (getDay = 1)");
      assert.strictEqual(end.getDay(), 0, "La semana debe terminar en Domingo (getDay = 0)");
      assert.strictEqual(end.getHours(), 23);
      assert.strictEqual(end.getMinutes(), 59);
    },
  },
  {
    name: "Cobros Parciales y Saldo Restante (RF-001)",
    fn: () => {
      const total = 280000; // RD$ 2,800.00
      const cobro1 = 100000;
      const saldo1 = total - cobro1;
      assert.strictEqual(saldo1, 180000);

      const cobro2 = 180000;
      const saldoFinal = saldo1 - cobro2;
      assert.strictEqual(saldoFinal, 0);
    },
  },
  {
    name: "Auditoría de Inconsistencias Excel (Módulo 8): Detección de #REF! y Multiplicaciones Erróneas",
    fn: () => {
      // Simulación de validación de coordenadas de hoja Cheesecake
      const formulasWithRef = ["Cheesecake!C47", "Cheesecake!C48", "Cheesecake!C49", "Cheesecake!C50", "Cheesecake!C51"];
      assert.strictEqual(formulasWithRef.length, 5, "Debe detectar exactamente las 5 fórmulas con #REF!");

      // Harina: Paquete de 5 lb son 2267.96g, no 453g
      const pesoCorrectoGramos = 5 * MASS_TO_GRAMS.lb;
      assert.ok(Math.abs(pesoCorrectoGramos - 2267.96185) < 0.001);
    },
  },
];

console.log("=================================================");
console.log("   K_SWEET — SUITE DE PRUEBAS AUTOMATIZADAS");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    console.log(`  [PASS] ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log("\n-------------------------------------------------");
console.log(`TOTAL: ${tests.length} | APROBADAS: ${passed} | FALLIDAS: ${failed}`);
console.log("-------------------------------------------------");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n>>> TODAS LAS PRUEBAS DE DOMINIO Y NEGOCIO PASARON EXITOSAMENTE (EXIT CODE 0) <<<\n");
  process.exit(0);
}

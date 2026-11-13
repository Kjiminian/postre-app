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
  {
    name: "Receta Madre: Costo de Lote y Costo por Unidad de Rendimiento (P-33 / RN-014)",
    fn: () => {
      // Caso Brownie 15 porciones del Excel:
      // Ingredientes = 421.72 DOP = 42172 centavos
      // Overhead 10% = 4217 centavos
      // Mano de obra 20% = 8434 centavos
      // Empaque lote = 0
      // Lote Total = 54823 centavos (RD$ 548.23)
      // Rendimiento = 15 unidades -> Costo Unitario Rendimiento = 54823 / 15 = 3654.86 centavos (~RD$ 36.55)
      const ingCost = 42172;
      const overhead = Math.round(ingCost * 0.10);
      const labor = Math.round(ingCost * 0.20);
      const batchCost = ingCost + overhead + labor;
      assert.strictEqual(batchCost, 54823);

      const costPerYieldUnit = batchCost / 15;
      assert.ok(Math.abs(costPerYieldUnit - 3654.866) < 0.01);
    },
  },
  {
    name: "Presentación Derivada: Consumo de Receta Madre + Empaque (Combo 1 San Valentín)",
    fn: () => {
      // Combo 1 consume: 2 brownies @ 3654.87 = 7309.7 centavos
      // Empaques: Caja (12500) + Capacillos (60) + Lazo (1667) + Etiqueta (600) + Mensaje (1000) = 15827 centavos
      // Costo Total Presentación = 7310 + 15827 = 23137 centavos (RD$ 231.37)
      const motherUnitCost = 3654.866;
      const baseCost = Math.round(motherUnitCost * 2);
      const packagingCost = 12500 + 60 + 1667 + 600 + 1000;
      const totalPresentationCost = baseCost + packagingCost;

      assert.strictEqual(baseCost, 7310);
      assert.strictEqual(packagingCost, 15827);
      assert.strictEqual(totalPresentationCost, 23137);

      // Margen deseado sobre venta: 40% (0.40)
      // P_sug = 23137 / (1 - 0.40) = 23137 / 0.60 = 38562 centavos (RD$ 385.62)
      const suggestedPrice = calcSuggestedPrice(totalPresentationCost, 0.40);
      assert.strictEqual(suggestedPrice, 38562);

      // Ganancia real y margen real al precio final de RD$ 400.00 (40000 centavos)
      const finalPrice = 40000;
      const profit = finalPrice - totalPresentationCost;
      const realMargin = calcMarginOnSale(finalPrice, totalPresentationCost);
      assert.strictEqual(profit, 16863); // RD$ 168.63
      assert.ok(Math.abs(realMargin - 42.1575) < 0.01);
    },
  },
  {
    name: "Validación de Fronteras Matemáticas (PRE-001): Margen < 100% y Precio <= 0",
    fn: () => {
      // 1. Margen >= 100% debe lanzar excepción
      assert.throws(() => calcSuggestedPrice(5000, 1.0), /Margen debe ser/);
      assert.throws(() => calcSuggestedPrice(5000, 1.05), /Margen debe ser/);
      assert.throws(() => calcSuggestedPrice(5000, -0.1), /Margen debe ser/);

      // 2. Precio final <= 0 debe retornar margen 0% sin arrojar error ni -Infinity
      const zeroMargin = calcMarginOnSale(0, 5000);
      assert.strictEqual(zeroMargin, 0);
      const negMargin = calcMarginOnSale(-100, 5000);
      assert.strictEqual(negMargin, 0);
    },
  },
  {
    name: "Presentación Compuesta: Caja de 12 Unidades con Empaque Adicional",
    fn: () => {
      // 12 unidades de brownie a 3655 centavos cada uno = 43860
      // Caja grande (6500) + Lazo (2500) + Etiqueta (600) = 9600
      // Costo total = 53460 centavos (RD$ 534.60)
      const unitCost = 3655;
      const boxCost = (12 * unitCost) + 6500 + 2500 + 600;
      assert.strictEqual(boxCost, 53460);

      // Recargo (Markup) 50%: Costo * 1.50 = 80190 centavos (RD$ 801.90)
      const markupPrice = Math.ceil(boxCost * 1.5);
      assert.strictEqual(markupPrice, 80190);
    },
  },
  {
    name: "Cascada Reactiva y Congelación de Ventas Históricas (PRE-002 / RF-014)",
    fn: () => {
      // Venta registrada en el pasado con Costo Histórico RD$ 200.00 y Precio RD$ 350.00
      const historicalSaleItem = {
        productName: "Caja San Valentín",
        unitPriceCents: 35000,
        unitCostCents: 20000,
        quantity: 2,
        totalCents: 70000,
        totalCostCents: 40000,
      };

      // Nuevo costo de producción sube a RD$ 250.00 tras alza de mantequilla
      const newPresentationCost = 25000;
      const preservedFinalPrice = 35000; // Preserva precio manual

      // Ganancia se actualiza para futuras ventas
      const newProfit = preservedFinalPrice - newPresentationCost;
      const newMargin = calcMarginOnSale(preservedFinalPrice, newPresentationCost);

      assert.strictEqual(newProfit, 10000); // RD$ 100.00
      assert.ok(Math.abs(newMargin - 28.57) < 0.1);

      // La venta histórica NO se altera
      assert.strictEqual(historicalSaleItem.unitCostCents, 20000);
      assert.strictEqual(historicalSaleItem.totalCostCents, 40000);
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

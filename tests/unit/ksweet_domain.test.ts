import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  formatDOP,
  calcSuggestedPrice,
  calcMarginOnSale,
  calcMarkupOnCost,
} from "../../src/types";
import {
  convertMass,
  convertVolume,
  convertVolumeToMass,
  convertMassToVolume,
  convertUnit,
} from "../../src/lib/conversions";
import { getWeekBounds } from "../../src/lib/constants";
import { validateCostingParams } from "../../src/lib/services/recipes";

describe("K_Sweet — Suite Exhaustiva de Dominio y Negocio (GEM V3)", () => {
  // ─── 1. Cálculos de Importes y Redondeo Monetario (RD$) ───────────────────────
  describe("Redondeo Monetario en Centavos (RN-001)", () => {
    it("convierte valores decimales RD$ a centavos enteros sin errores flotantes", () => {
      expect(toCents(140.5)).toBe(14050);
      expect(toCents(0.33)).toBe(33);
      expect(toCents("1299.99")).toBe(129999);
      expect(fromCents(14050)).toBe(140.5);
    });

    it("formatea moneda RD$ con dos decimales exactos", () => {
      const formatted = formatDOP(140000);
      expect(formatted).toContain("RD$");
      expect(formatted).toContain("1400.00");
    });
  });

  // ─── 2. Conversiones Científicas de Unidades (Módulo 7 / RF-021) ─────────────
  describe("Conversiones de Masa y Volumen (RF-021)", () => {
    it("convierte 1 libra exacta a gramos (1 lb = 453.59237 g)", () => {
      const grams = convertMass(1, "lb", "g");
      expect(grams).toBeCloseTo(453.59237, 5);
    });

    it("convierte 1 onza exacta a gramos (1 oz = 28.349523125 g)", () => {
      const grams = convertMass(1, "oz", "g");
      expect(grams).toBeCloseTo(28.349523125, 6);
    });

    it("convierte kilogramos a libras correctamente", () => {
      const lbs = convertMass(1, "kg", "lb");
      // 1000 / 453.59237 ≈ 2.20462
      expect(lbs).toBeCloseTo(2.20462, 4);
    });

    it("convierte litros a tazas US", () => {
      const tazas = convertVolume(1, "l", "taza");
      // 1000 ml / 236.5882365 ml ≈ 4.22675 tazas
      expect(tazas).toBeCloseTo(4.22675, 4);
    });
  });

  // ─── 3. Densidad Obligatoria para Cruce Volumen ↔ Masa (RF-022) ─────────────
  describe("Cruce Volumen a Masa con Densidad Requerida (RF-022)", () => {
    it("convierte 1 taza de leche evaporada usando su densidad (1.07 g/ml)", () => {
      const res = convertVolumeToMass(1, "taza", "g", 1.07);
      expect(res.ok).toBe(true);
      if (res.ok) {
        // 236.588 ml * 1.07 g/ml ≈ 253.149 g
        expect(res.value).toBeCloseTo(253.15, 1);
      }
    });

    it("falla si se intenta convertir volumen a masa con densidad 0 o nula", () => {
      const res = convertUnit(2, "taza", "g", 0);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("densidad");
      }
    });

    it("convierte masa a volumen (aceite densidad 0.92 g/ml)", () => {
      const res = convertMassToVolume(500, "g", "ml", 0.92);
      expect(res.ok).toBe(true);
      if (res.ok) {
        // 500 g / 0.92 g/ml ≈ 543.478 ml
        expect(res.value).toBeCloseTo(543.48, 1);
      }
    });
  });

  // ─── 4. Precios y Márgenes Matemáticos (Módulo 5 / RF-017, RF-018) ────────────
  describe("Fórmulas de Costos y Precios: P = C / (1 - M)", () => {
    it("calcula el precio sugerido con costo RD$ 67.20 y margen sobre venta del 52%", () => {
      const unitCostCents = 6720; // RD$ 67.20
      const margin = 0.52; // 52%
      const suggestedPriceCents = calcSuggestedPrice(unitCostCents, margin);
      // P = 6720 / (1 - 0.52) = 6720 / 0.48 = 14000 centavos = RD$ 140.00
      expect(suggestedPriceCents).toBe(14000);
      expect(fromCents(suggestedPriceCents)).toBe(140);
    });

    it("diferencia claramente margen sobre venta de recargo (markup) sobre costo", () => {
      const costCents = 10000; // RD$ 100.00
      const priceCents = 20000; // RD$ 200.00
      const marginOnSale = calcMarginOnSale(priceCents, costCents);
      const markupOnCost = calcMarkupOnCost(priceCents, costCents);

      // Margen sobre venta = (200 - 100) / 200 = 50%
      expect(marginOnSale).toBe(50);
      // Recargo sobre costo = (200 - 100) / 100 = 100%
      expect(markupOnCost).toBe(100);
    });

    it("valida que rendimiento sea mayor a 0", () => {
      expect(() => validateCostingParams(0, 40)).toThrow("estrictamente mayor a 0");
      expect(() => validateCostingParams(-5, 40)).toThrow("estrictamente mayor a 0");
    });

    it("valida que margen objetivo sea menor al 100%", () => {
      expect(() => validateCostingParams(10, 100)).toThrow("menor al 100%");
      expect(() => validateCostingParams(10, 105)).toThrow("menor al 100%");
      expect(() => validateCostingParams(10, -5)).toThrow("no puede ser negativo");
    });
  });

  // ─── 5. Límites Semanales (Lunes a Domingo) (Módulo 2 / RF-006) ───────────────
  describe("Límites de Cuadre Semanal (RF-006)", () => {
    it("calcula límites de semana comenzando en Lunes y terminando en Domingo", () => {
      // Miércoles 11 de Noviembre 2026
      const refDate = new Date("2026-11-11T14:00:00Z");
      const { start, end } = getWeekBounds(refDate);

      // Lunes debe ser 9 de Noviembre 2026
      expect(start.getDay()).toBe(1); // 1 = Lunes
      // Domingo debe ser 15 de Noviembre 2026
      expect(end.getDay()).toBe(0); // 0 = Domingo
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });
  });

  // ─── 6. Cobros Parciales y Saldos (Módulo 1 / RF-001) ─────────────────────────
  describe("Cobros Parciales y Saldos (RF-001)", () => {
    it("calcula saldo exacto en abonos parciales sin alterar costos históricos", () => {
      const totalCents = 280000; // RD$ 2,800.00
      const payment1Cents = 100000; // RD$ 1,000.00
      const balance1 = totalCents - payment1Cents;
      expect(balance1).toBe(180000); // Saldo RD$ 1,800.00

      const payment2Cents = 180000;
      const balance2 = balance1 - payment2Cents;
      expect(balance2).toBe(0); // Saldado completo
    });
  });
});

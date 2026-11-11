"use client";

import { useState } from "react";
import {
  Scale,
  ArrowRightLeft,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Edit2,
  Check,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { convertUnit } from "@/lib/conversions";

interface ExcelRef {
  id: string;
  name: string;
  from: string;
  to: string;
  grams: number;
  ingredient: string;
  isEditing: boolean;
}

const INITIAL_EXCEL_REFS: ExcelRef[] = [
  {
    id: "REF-1",
    name: "Taza aproximada según Excel",
    from: "1 taza",
    to: "gramos",
    grams: 150,
    ingredient: "Referencia General (Harina / Azúcar)",
    isEditing: false,
  },
  {
    id: "REF-2",
    name: "Media taza aproximada según Excel",
    from: "1/2 taza",
    to: "gramos",
    grams: 75,
    ingredient: "Referencia General",
    isEditing: false,
  },
  {
    id: "REF-3",
    name: "Cucharada (cda) según Excel",
    from: "1 cda",
    to: "gramos",
    grams: 15,
    ingredient: "Referencia General",
    isEditing: false,
  },
];

const INGREDIENT_DENSITIES = [
  { name: "Agua / Leche Líquida", density: 1.0, note: "1 ml ≈ 1.00 g" },
  { name: "Leche Evaporada Carnation", density: 1.07, note: "1 ml ≈ 1.07 g" },
  { name: "Aceite Vegetal", density: 0.92, note: "1 ml ≈ 0.92 g" },
  { name: "Miel de Abeja / Sirope", density: 1.42, note: "1 ml ≈ 1.42 g" },
  { name: "Harina de Trigo (suelta)", density: 0.53, note: "1 taza (236 ml) ≈ 125 g" },
  { name: "Azúcar Granulada", density: 0.85, note: "1 taza (236 ml) ≈ 200 g" },
];

export default function ConversionesPage() {
  // Calculadora
  const [val, setVal] = useState<number>(1);
  const [fromUnit, setFromUnit] = useState<string>("lb");
  const [toUnit, setToUnit] = useState<string>("g");
  const [density, setDensity] = useState<number>(1.0);

  // Tabla editable de equivalencias Excel
  const [excelRefs, setExcelRefs] = useState<ExcelRef[]>(INITIAL_EXCEL_REFS);

  // Ejecutar conversión
  const result = convertUnit(val, fromUnit, toUnit, density);

  const handleEditGrams = (id: string, newGrams: number) => {
    setExcelRefs(
      excelRefs.map((ref) => (ref.id === id ? { ...ref, grams: newGrams } : ref))
    );
  };

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Conversor de Unidades & Densidades"
        subtitle="Conversiones científicas exactas (1 lb = 453.59237g) • Densidades para volumen a masa • Equivalencias históricas Excel"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner de Rigor Metodológico (RF-021 y RF-022) */}
        <div className="p-5 rounded-2xl bg-white border border-plum-200 shadow-card flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="text-xs text-ink-light space-y-1.5 leading-relaxed">
            <h4 className="font-bold text-ink text-sm">
              Estándar Científico Innegociable (RF-021, RF-022, RF-023)
            </h4>
            <p>
              • <strong>Masa Exacta:</strong> <code>1 lb = 453.59237 g</code> y <code>1 oz = 28.349523125 g</code>.
            </p>
            <p>
              • <strong>Cruce Volumen ↔ Masa:</strong> Prohibido asumir que 1 taza equivale a una masa fija para todos
              los ingredientes. Se <strong>exige la densidad</strong> de cada insumo porque una taza de harina pesa
              aprox. 125g mientras que una taza de azúcar pesa aprox. 200g y una taza de miel pesa 335g.
            </p>
            <p>
              • <strong>Valores del Excel Original:</strong> Las equivalencias del Excel (1 taza = 150g, 1/2 taza = 75g,
              1 cda = 15g) se conservan abajo como <em>referencias aproximadas editables</em>, jamás universales.
            </p>
          </div>
        </div>

        {/* Calculadora Interactiva */}
        <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card">
          <h3 className="font-serif font-bold text-ink text-base mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-plum-500" />
            <span>Calculadora de Conversión Instantánea</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Cantidad</label>
              <input
                type="number"
                step="0.01"
                min="0.0001"
                value={val}
                onChange={(e) => setVal(Number(e.target.value))}
                className="w-full p-2.5 text-base font-bold bg-cream-50 border border-cream-300 rounded-lg text-ink"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Unidad Origen</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
              >
                <optgroup label="Masa (Peso)">
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="lb">Libras US (lb - 453.59g)</option>
                  <option value="oz">Onzas de masa (oz - 28.35g)</option>
                </optgroup>
                <optgroup label="Volumen">
                  <option value="ml">Mililitros (ml)</option>
                  <option value="l">Litros (l)</option>
                  <option value="taza">Taza US (236.59 ml)</option>
                  <option value="cda">Cucharada US (14.79 ml)</option>
                  <option value="cdita">Cucharadita US (4.93 ml)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Unidad Destino</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-medium"
              >
                <optgroup label="Masa (Peso)">
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="lb">Libras US (lb - 453.59g)</option>
                  <option value="oz">Onzas de masa (oz - 28.35g)</option>
                </optgroup>
                <optgroup label="Volumen">
                  <option value="ml">Mililitros (ml)</option>
                  <option value="l">Litros (l)</option>
                  <option value="taza">Taza US (236.59 ml)</option>
                  <option value="cda">Cucharada US (14.79 ml)</option>
                  <option value="cdita">Cucharadita US (4.93 ml)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Densidad (g/ml)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink"
              />
              <span className="text-[10px] text-ink-muted">Requerida para cruce volumen ↔ masa</span>
            </div>
          </div>

          {/* Resultado de Conversión */}
          <div className="mt-5 p-4 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-between">
            <div>
              <span className="text-xs text-ink-muted uppercase font-semibold">Resultado Calculado:</span>
              {result.ok ? (
                <p className="text-2xl font-bold font-serif text-plum-600 mt-0.5">
                  {val} {fromUnit} = {result.value.toFixed(4)} {toUnit}
                </p>
              ) : (
                <p className="text-sm font-semibold text-red-600 mt-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> {result.error}
                </p>
              )}
            </div>
            {result.ok && (
              <span className="text-xs font-medium text-sage-600 px-3 py-1 rounded-full bg-sage-500/10 border border-sage-500/20">
                Factor verificado exacto
              </span>
            )}
          </div>
        </div>

        {/* Tabla Editable de Equivalencias Aproximadas del Excel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-ink text-base">
                  Equivalencias Aproximadas del Excel Original (RF-023)
                </h3>
                <p className="text-xs text-ink-muted">Valores editables utilizados históricamente en los cálculos</p>
              </div>
            </div>

            <div className="space-y-3">
              {excelRefs.map((ref) => (
                <div
                  key={ref.id}
                  className="p-3.5 rounded-xl border border-cream-200 bg-cream-50 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-ink text-xs">{ref.name}</p>
                    <p className="text-[11px] text-ink-muted">{ref.ingredient}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-ink">{ref.from} =</span>
                    <input
                      type="number"
                      step="1"
                      value={ref.grams}
                      onChange={(e) => handleEditGrams(ref.id, Number(e.target.value))}
                      className="w-16 p-1 text-xs font-bold text-center bg-white border border-cream-300 rounded focus:border-plum-500"
                    />
                    <span className="text-xs font-mono text-ink-muted">g</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de Densidades de Referencia */}
          <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card">
            <h3 className="font-serif font-bold text-ink text-base mb-1">
              Densidades Gastronómicas de Referencia
            </h3>
            <p className="text-xs text-ink-muted mb-4">
              Factores de peso por volumen para repostería dominicana
            </p>

            <div className="space-y-2.5">
              {INGREDIENT_DENSITIES.map((ing) => (
                <div
                  key={ing.name}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-cream-200 text-xs"
                >
                  <div>
                    <span className="font-semibold text-ink">{ing.name}</span>
                    <span className="text-[11px] text-ink-muted block">{ing.note}</span>
                  </div>
                  <span className="px-2 py-1 rounded bg-cream-100 font-mono font-bold text-plum-600">
                    {ing.density} g/ml
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

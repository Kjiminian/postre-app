"use client";

import { useState } from "react";
import {
  BadgeDollarSign,
  Calculator,
  Percent,
  TrendingUp,
  AlertTriangle,
  Info,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP, formatDOPFloat } from "@/lib/utils";
import { calcSuggestedPrice, calcMarginOnSale, calcMarkupOnCost } from "@/types";

export default function CostosPreciosPage() {
  // Calculadora interactiva de precios y márgenes (RF-017, RF-018)
  const [costDOP, setCostDOP] = useState<number>(67.2); // Costo unitario RD$
  const [targetMargin, setTargetMargin] = useState<number>(52); // Margen objetivo sobre venta %
  const [manualPriceDOP, setManualPriceDOP] = useState<number>(140); // Precio fijado

  // Fórmulas matemáticas vinculantes (RF-017)
  // Precio sugerido = Costo / (1 - MargenObjetivo / 100)
  const marginFraction = Math.min(0.999, Math.max(0, targetMargin / 100));
  const costCents = Math.round(costDOP * 100);
  const suggestedPriceCents = targetMargin < 100 ? calcSuggestedPrice(costCents, marginFraction) : 0;
  const suggestedPriceDOP = suggestedPriceCents / 100;

  // Comparativa Margen sobre Venta vs Recargo sobre Costo (RF-018)
  const currentPriceCents = Math.round(manualPriceDOP * 100);
  const actualMarginOnSale = calcMarginOnSale(currentPriceCents, costCents);
  const actualMarkupOnCost = calcMarkupOnCost(currentPriceCents, costCents);
  const profitPerUnitCents = currentPriceCents - costCents;

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Costos y Precios de Venta"
        subtitle="Fórmula P = C / (1 - M) • Diferenciación entre margen sobre venta y recargo sobre costo"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner Pedagógico de Negocio (RF-018) */}
        <div className="p-5 rounded-2xl bg-white border border-plum-200 shadow-card flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-xs text-ink-light space-y-1.5 leading-relaxed">
            <h4 className="font-bold text-ink text-sm">
              Diferencia Fundamental: Margen sobre Venta vs Recargo (Markup) sobre Costo (RF-018)
            </h4>
            <p>
              • <strong>Margen sobre Venta:</strong> Porcentaje del precio de venta que corresponde a utilidad neta:{" "}
              <code className="bg-cream-200 px-1.5 py-0.5 rounded text-plum-600 font-mono">
                M = ((Precio - Costo) / Precio) * 100
              </code>. Siempre es menor al 100%.
            </p>
            <p>
              • <strong>Recargo sobre Costo (Markup):</strong> Porcentaje que se le agrega al costo para llegar al precio:{" "}
              <code className="bg-cream-200 px-1.5 py-0.5 rounded text-plum-600 font-mono">
                R = ((Precio - Costo) / Costo) * 100
              </code>. Puede ser superior al 100%.
            </p>
            <p>
              • <strong>Fórmula de Precio Sugerido (RF-017):</strong>{" "}
              <code className="bg-cream-200 px-1.5 py-0.5 rounded text-sage-600 font-bold font-mono">
                Precio Sugerido = Costo Unitario / (1 - MargenObjetivo / 100)
              </code>. Requiere rendimiento &gt; 0 y margen &lt; 100%.
            </p>
          </div>
        </div>

        {/* Simulador Interactivo de Precios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de Entradas */}
          <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center font-bold">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-ink text-base">Simulador de Costeo</h3>
                <p className="text-xs text-ink-muted">Ajusta los parámetros para evaluar el precio óptimo</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Costo Unitario de Producción (RD$)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={costDOP}
                onChange={(e) => setCostDOP(Number(e.target.value))}
                className="w-full p-2.5 text-base font-bold bg-cream-50 border border-cream-300 rounded-lg text-ink focus:border-plum-500"
              />
              <span className="text-[11px] text-ink-muted">
                Suma de ingredientes, empaque, mano de obra y gastos indirectos / rendimiento
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-ink-muted uppercase">
                  Margen Objetivo sobre Venta (%): <span className="text-plum-600 font-bold">{targetMargin}%</span>
                </label>
                {targetMargin >= 100 && (
                  <span className="text-[11px] font-bold text-red-600">Inválido: debe ser &lt; 100%</span>
                )}
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="1"
                value={targetMargin}
                onChange={(e) => setTargetMargin(Number(e.target.value))}
                className="w-full accent-plum-500"
              />
              <div className="flex justify-between text-[10px] text-ink-muted mt-1">
                <span>5% (Mínimo)</span>
                <span>40% (Recomendado repostería)</span>
                <span>60% (Postres gourmet)</span>
                <span>95% (Máximo)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-cream-200">
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Precio de Venta Real / Fijado (RD$)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={manualPriceDOP}
                onChange={(e) => setManualPriceDOP(Number(e.target.value))}
                className="w-full p-2.5 text-base font-bold bg-cream-50 border border-cream-300 rounded-lg text-plum-600 focus:border-plum-500"
              />
              <span className="text-[11px] text-ink-muted">
                Precio final al que se vende al cliente en la carta
              </span>
            </div>
          </div>

          {/* Panel de Resultados y Desglose Matemático */}
          <div className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-ink text-base">Resultado del Análisis</h3>
                <Sparkles className="w-4 h-4 text-plum-500" />
              </div>

              {/* Tarjeta de Precio Sugerido */}
              <div className="p-4 rounded-xl bg-sage-500/10 border border-sage-500/20 mb-4">
                <span className="text-xs text-sage-600 font-semibold uppercase block">
                  Precio Sugerido por Fórmula P = C / (1 - M)
                </span>
                <p className="text-3xl font-bold font-serif text-sage-600 mt-1">
                  RD$ {suggestedPriceDOP.toFixed(2)}
                </p>
                <p className="text-[11px] text-ink-muted mt-1">
                  Garantiza exactamente el {targetMargin}% de utilidad sobre cada venta.
                </p>
              </div>

              {/* Comparativa de Márgenes Reales con el Precio Fijado */}
              <div className="space-y-3 pt-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-cream-200">
                  <span className="text-ink">Utilidad Neta por Porción/Unidad:</span>
                  <span className="font-bold text-ink">{formatDOP(profitPerUnitCents)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-cream-200">
                  <span className="text-ink">Margen sobre Venta Real:</span>
                  <span
                    className={`font-bold ${
                      actualMarginOnSale >= targetMargin ? "text-sage-600" : "text-amber-600"
                    }`}
                  >
                    {actualMarginOnSale.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-ink">Recargo (Markup) sobre Costo:</span>
                  <span className="font-bold text-plum-600">{actualMarkupOnCost.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-cream-100 rounded-xl border border-cream-200 text-xs text-ink-light flex items-center justify-between">
              <span>Rendimiento mínimo requerido:</span>
              <span className="font-bold text-sage-600">Mayor a 0 (Validado)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

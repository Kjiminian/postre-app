"use client";

import { useState, useEffect } from "react";
import {
  BadgeDollarSign,
  Calculator,
  AlertTriangle,
  Info,
  Search,
  RefreshCw,
  Edit2,
  Check,
  X,
  Package,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";
import { calcPriceByMethod, PricingMethod } from "@/types";

interface PresentationItem {
  id: string;
  recipeId: string;
  recipeName: string;
  name: string;
  sizeDescription?: string;
  motherRecipeQty: number;
  motherRecipeUnit: string;
  presentationYield: number;
  packagingCostCents: number;
  additionalCostCents: number;
  totalCostCents: number;
  pricingMethod: PricingMethod;
  desiredMarginPercent: number;
  suggestedPriceCents: number;
  finalPriceCents: number;
  realProfitCents: number;
  realMarginPercent: number;
  isActive: boolean;
}

export default function CostosPreciosPage() {
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Estado para edición en línea de precio
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPriceDOP, setEditPriceDOP] = useState<number>(0);
  const [editMargin, setEditMargin] = useState<number>(40);
  const [editMethod, setEditMethod] = useState<PricingMethod>("MARGIN");

  // Simulador rápido
  const [simCostDOP, setSimCostDOP] = useState<number>(231.37);
  const [simMargin, setSimMargin] = useState<number>(42);
  const [simMethod, setSimMethod] = useState<PricingMethod>("MARGIN");

  const loadPresentations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/presentaciones");
      const json = await res.json();
      if (json.success) setPresentations(json.data);
      else throw new Error(json.error);
    } catch (err: any) {
      setError(err.message || "Error cargando presentaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresentations();
  }, []);

  const handleStartEdit = (p: PresentationItem) => {
    setEditingId(p.id);
    setEditPriceDOP(p.finalPriceCents / 100);
    setEditMargin(p.desiredMarginPercent);
    setEditMethod(p.pricingMethod);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch("/api/presentaciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          finalPriceCents: Math.round(editPriceDOP * 100),
          desiredMarginPercent: editMargin,
          pricingMethod: editMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        loadPresentations();
      } else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    }
  };

  // Cálculo simulador
  const simCostCents = Math.round(simCostDOP * 100);
  const simSuggestedCents = calcPriceByMethod(simCostCents, simMargin, simMethod);
  const simSuggestedDOP = simSuggestedCents / 100;
  const simProfitDOP = (simSuggestedCents - simCostCents) / 100;
  const simRealMargin = simSuggestedCents > 0 ? ((simSuggestedCents - simCostCents) / simSuggestedCents) * 100 : 0;

  const filtered = presentations.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.recipeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
            <BadgeDollarSign className="w-4 h-4" />
            <span>Gestión Financiera de Carta</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
            Costos, Precios y Márgenes por Presentación
          </h1>
          <p className="text-sm text-[#7D6E65] mt-1">
            Fórmulas exactas: Margen sobre Venta P = C / (1 - M) vs Recargo sobre Costo P = C × (1 + R). Edita precios de carta y evalúa la ganancia neta.
          </p>
        </div>

        {/* Guía Pedagógica GEM V3 */}
        <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FAF5F7] text-[#9C4266] flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-xs text-[#7D6E65] space-y-1">
            <h4 className="font-bold text-[#4A3B32] text-sm">
              Regla Financiera Innegociable (RN-017 / RN-018)
            </h4>
            <p>
              • <strong>Margen sobre Ventas:</strong> Porcentaje del precio cobrado al cliente que es ganancia neta:{" "}
              <code className="bg-[#FAF8F6] px-1 py-0.5 rounded text-[#9C4266] font-mono font-semibold">
                P = Costo ÷ (1 − M)
              </code>
              . Nunca puede ser ≥ 100%.
            </p>
            <p>
              • <strong>Recargo sobre Costo (Markup):</strong> Multiplicador agregado al costo de producción:{" "}
              <code className="bg-[#FAF8F6] px-1 py-0.5 rounded text-[#4A3B32] font-mono font-semibold">
                P = Costo × (1 + R)
              </code>
              . Puede superar el 100%.
            </p>
          </div>
        </div>

        {/* TABLA MAESTRA DE TODAS LAS PRESENTACIONES */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E8E2D9] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <h3 className="font-serif font-bold text-base text-[#4A3B32]">
              Presentaciones Registradas ({filtered.length})
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
              <input
                type="text"
                placeholder="Filtrar presentación o receta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9] bg-[#FAF8F6]"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-7 h-7 text-[#9C4266] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#7D6E65]">Cargando presentaciones...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center bg-[#FFF5F5]">
              <AlertTriangle className="w-7 h-7 text-[#E53E3E] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[#9B2C2C]">{error}</p>
              <button
                onClick={loadPresentations}
                className="mt-3 px-3 py-1.5 text-xs font-semibold bg-[#E53E3E] text-white rounded-lg hover:bg-[#C53030]"
              >
                Reintentar
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-8 h-8 text-[#C4B5A5] mx-auto mb-2" />
              <p className="text-xs text-[#7D6E65]">No hay presentaciones que coincidan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-[11px] font-semibold text-[#7D6E65] uppercase tracking-wider">
                    <th className="py-3 px-4">Receta Madre</th>
                    <th className="py-3 px-4">Presentación</th>
                    <th className="py-3 px-4">Consumo Base</th>
                    <th className="py-3 px-4">Costo Unit. Total</th>
                    <th className="py-3 px-4">Método / % Obj.</th>
                    <th className="py-3 px-4">Precio Sugerido</th>
                    <th className="py-3 px-4">Precio Final Carta</th>
                    <th className="py-3 px-4">Ganancia Real</th>
                    <th className="py-3 px-4">Margen Real</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-xs">
                  {filtered.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-[#FAF8F6]/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#4A3B32]">
                          {p.recipeName}
                        </td>
                        <td className="py-3 px-4 text-[#4A3B32]">
                          <span className="font-medium">{p.name}</span>
                          {p.sizeDescription && (
                            <span className="text-[10px] text-[#7D6E65] block">{p.sizeDescription}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#7D6E65] tabular-nums">
                          {p.motherRecipeQty} {p.motherRecipeUnit}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#9C4266] tabular-nums">
                          {formatDOP(p.totalCostCents)}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={editMethod}
                                onChange={(e) => setEditMethod(e.target.value as PricingMethod)}
                                className="px-1 py-0.5 rounded text-[11px] border border-[#E8E2D9] bg-white"
                              >
                                <option value="MARGIN">Margen</option>
                                <option value="MARKUP">Markup</option>
                              </select>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={editMargin}
                                onChange={(e) => setEditMargin(parseFloat(e.target.value) || 0)}
                                className="w-12 px-1 py-0.5 rounded text-[11px] border border-[#E8E2D9] tabular-nums"
                              />
                              %
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-[#7D6E65] tabular-nums">
                              {p.pricingMethod === "MARGIN" ? "Margen" : "Markup"} {p.desiredMarginPercent}%
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#7D6E65] tabular-nums">
                          {formatDOP(p.suggestedPriceCents)}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editPriceDOP}
                              onChange={(e) => setEditPriceDOP(parseFloat(e.target.value) || 0)}
                              className="w-20 px-1.5 py-0.5 text-xs font-bold rounded border border-[#9C4266] bg-white tabular-nums"
                            />
                          ) : (
                            <span className="font-bold text-sm text-[#4A3B32] tabular-nums">
                              {formatDOP(p.finalPriceCents)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#22543D] tabular-nums">
                          {formatDOP(p.realProfitCents)}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#9C4266] tabular-nums">
                          {p.realMarginPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSaveEdit(p.id)}
                                className="p-1 bg-[#22543D] text-white rounded hover:bg-[#1A4331]"
                                title="Guardar cambios"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 bg-[#E8E2D9] text-[#7D6E65] rounded hover:bg-[#D8D2C9]"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(p)}
                              className="p-1 text-[#7D6E65] hover:text-[#9C4266] rounded hover:bg-[#FAF8F6]"
                              title="Editar precio y margen"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SIMULADOR RÁPIDO DE PRECIOS */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E2D9] shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-[#9C4266]" />
            <h3 className="font-serif font-bold text-base text-[#4A3B32]">
              Simulador Rápido de Costeo y Márgenes
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">
                Costo Unitario Total (RD$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={simCostDOP}
                onChange={(e) => setSimCostDOP(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">
                Método de Cálculo
              </label>
              <select
                value={simMethod}
                onChange={(e) => setSimMethod(e.target.value as PricingMethod)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
              >
                <option value="MARGIN">Margen sobre Venta P = C / (1 - M)</option>
                <option value="MARKUP">Recargo sobre Costo P = C × (1 + R)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">
                Porcentaje Objetivo (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max={simMethod === "MARGIN" ? 99.9 : 500}
                value={simMargin}
                onChange={(e) => setSimMargin(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F6] p-4 rounded-xl border border-[#E8E2D9]">
            <div>
              <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Precio Sugerido</span>
              <span className="text-base font-bold text-[#4A3B32]">RD$ {simSuggestedDOP.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Ganancia Unitaria</span>
              <span className="text-base font-bold text-[#22543D]">RD$ {simProfitDOP.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Margen Real s/ Venta</span>
              <span className="text-base font-bold text-[#9C4266]">{simRealMargin.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Markup s/ Costo</span>
              <span className="text-base font-bold text-[#4A3B32]">
                {simCostDOP > 0 ? (((simSuggestedDOP - simCostDOP) / simCostDOP) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ChefHat,
  Plus,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  X,
  Search,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";
import { calcSuggestedPrice } from "@/types";

interface RecipeItem {
  id: string;
  name: string;
  yield: number;
  yieldUnit: string;
  batchCostCents: number;
  unitCostCents: number;
  targetMargin: number;
  suggestedPriceCents: number;
  currentPriceCents: number;
  reviewFlag: boolean;
  notes?: string;
}

const INITIAL_RECIPES: RecipeItem[] = [
  {
    id: "REC-001",
    name: "Cheesecake Clásico 8\"",
    yield: 8,
    yieldUnit: "porciones",
    batchCostCents: 53760, // RD$ 537.60 lote
    unitCostCents: 6720, // RD$ 67.20 / porción
    targetMargin: 52, // 52% margen sobre venta
    suggestedPriceCents: 14000, // RD$ 140.00 / porción (o 1,120 el molde)
    currentPriceCents: 14000,
    reviewFlag: true, // Alerta: Fórmulas #REF! en filas 47-51 del Excel de origen
    notes: "Ingresada como borrador por fórmulas rotas en Excel de origen. Costo no auditado.",
  },
  {
    id: "REC-002",
    name: "Bizcocho Dominicano Suspiro (1 lb)",
    yield: 12,
    yieldUnit: "porciones",
    batchCostCents: 81120, // RD$ 811.20
    unitCostCents: 6760, // RD$ 67.60 / porción
    targetMargin: 48,
    suggestedPriceCents: 13000,
    currentPriceCents: 13000,
    reviewFlag: false,
    notes: "Incluye mano de obra 15% y gastos indirectos 10%",
  },
  {
    id: "REC-003",
    name: "Caja Brownies Artesanales (6 uds)",
    yield: 1,
    yieldUnit: "caja",
    batchCostCents: 18900,
    unitCostCents: 18900,
    targetMargin: 58,
    suggestedPriceCents: 45000,
    currentPriceCents: 45000,
    reviewFlag: false,
    notes: "Incluye caja kraft + lazo ciruela (RD$ 35 empaque)",
  },
  {
    id: "REC-004",
    name: "Subreceta: Mermelada Casera de Fresas",
    yield: 500,
    yieldUnit: "gramos",
    batchCostCents: 14500,
    unitCostCents: 29, // RD$ 0.29 por gramo
    targetMargin: 0, // Insumo intermedio
    suggestedPriceCents: 29,
    currentPriceCents: 29,
    reviewFlag: false,
    notes: "Subreceta reutilizable en Cheesecake y Tartas",
  },
];

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<RecipeItem[]>(INITIAL_RECIPES);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario nueva receta
  const [newRecipe, setNewRecipe] = useState({
    name: "",
    yield: 8,
    yieldUnit: "porciones",
    batchCostDOP: 500,
    laborPercent: 15,
    overheadPercent: 10,
    targetMargin: 50,
    currentPriceDOP: 120,
    notes: "",
  });

  const handleDuplicate = (recipe: RecipeItem) => {
    const copy: RecipeItem = {
      ...recipe,
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      name: `${recipe.name} (Copia)`,
      reviewFlag: false,
      notes: `Duplicada a partir de ${recipe.name}`,
    };
    setRecipes([...recipes, copy]);
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipe.name.trim()) return;
    if (newRecipe.yield <= 0) return;
    if (newRecipe.targetMargin >= 100 || newRecipe.targetMargin < 0) return;

    const batchCostCents = Math.round(Number(newRecipe.batchCostDOP) * 100);
    const unitCostCents = Math.ceil(batchCostCents / newRecipe.yield);
    const marginFraction = newRecipe.targetMargin / 100;
    const suggestedPriceCents = calcSuggestedPrice(unitCostCents, marginFraction);
    const currentPriceCents = newRecipe.currentPriceDOP > 0
      ? Math.round(newRecipe.currentPriceDOP * 100)
      : suggestedPriceCents;

    const created: RecipeItem = {
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      name: newRecipe.name.trim(),
      yield: Number(newRecipe.yield),
      yieldUnit: newRecipe.yieldUnit,
      batchCostCents,
      unitCostCents,
      targetMargin: Number(newRecipe.targetMargin),
      suggestedPriceCents,
      currentPriceCents,
      reviewFlag: false,
      notes: newRecipe.notes.trim() || undefined,
    };

    setRecipes([created, ...recipes]);
    setIsModalOpen(false);
    setNewRecipe({
      name: "",
      yield: 8,
      yieldUnit: "porciones",
      batchCostDOP: 500,
      laborPercent: 15,
      overheadPercent: 10,
      targetMargin: 50,
      currentPriceDOP: 120,
      notes: "",
    });
  };

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Recetas & Subrecetas"
        subtitle="Rendimientos, empaques, mano de obra, gastos indirectos y duplicación sin duplicar costos"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner de Alerta de Borradores de Importación */}
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">Aviso de Auditoría de Recetas:</span> Las recetas importadas con fórmulas
            incompletas o errores del Excel se mantienen como <strong>Borrador en Revisión</strong>. No se
            utilizan como costos definitivos hasta que el repostero confirme los ingredientes y el rendimiento exacto.
          </div>
        </div>

        {/* Barra de Búsqueda y Acción */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-cream-300 shadow-card">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar receta o subreceta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:border-plum-500"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Receta</span>
          </button>
        </div>

        {/* Tarjetas de Recetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-2 p-8 text-center text-ink-muted text-xs bg-white rounded-2xl border border-cream-300">
              No se encontraron recetas para la búsqueda ingresada.
            </div>
          ) : (
            filtered.map((recipe) => (
              <div
                key={recipe.id}
                className="p-6 bg-white rounded-2xl border border-cream-300 shadow-card flex flex-col justify-between relative overflow-hidden"
              >
                {recipe.reviewFlag && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 shadow-sm">
                    <AlertTriangle className="w-3 h-3" /> Borrador por revisar
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center font-bold">
                      <ChefHat className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-ink text-base">{recipe.name}</h3>
                      <p className="text-xs text-ink-muted">
                        Rendimiento: <span className="font-semibold text-ink">{recipe.yield} {recipe.yieldUnit}</span>
                      </p>
                    </div>
                  </div>

                  {recipe.notes && (
                    <p className="text-xs text-ink-light bg-cream-100 p-2.5 rounded-lg border border-cream-200 mt-2 mb-4">
                      {recipe.notes}
                    </p>
                  )}

                  {/* Métricas de Costeo de la Receta */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-cream-200 text-xs">
                    <div>
                      <span className="text-ink-muted text-[11px] block">Costo Lote</span>
                      <span className="font-bold text-ink">{formatDOP(recipe.batchCostCents)}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted text-[11px] block">Costo Unit.</span>
                      <span className="font-bold text-ink">{formatDOP(recipe.unitCostCents)}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted text-[11px] block">Margen Obj.</span>
                      <span className="font-bold text-plum-600">{recipe.targetMargin}%</span>
                    </div>
                    <div>
                      <span className="text-ink-muted text-[11px] block">Precio Sugerido</span>
                      <span className="font-bold text-sage-600">{formatDOP(recipe.suggestedPriceCents)}</span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="mt-6 pt-4 border-t border-cream-200 flex items-center justify-between">
                  <button
                    onClick={() => handleDuplicate(recipe)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream-100 hover:bg-cream-200 text-ink text-xs font-medium border border-cream-300 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-plum-500" />
                    <span>Duplicar receta</span>
                  </button>

                  <div className="text-xs font-semibold text-ink">
                    Precio Venta: <span className="text-plum-600 font-bold">{formatDOP(recipe.currentPriceCents)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Registrar Nueva Receta */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-cream-300 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-cream-200 flex items-center justify-between bg-cream-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-plum-100 text-plum-600 flex items-center justify-center">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif font-bold text-lg text-ink">Crear Receta o Subreceta</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-cream-200 flex items-center justify-center text-ink-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRecipe} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                    Nombre del Postre / Receta *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Tres Leches de Caramelo Salado"
                    value={newRecipe.name}
                    onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                    className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink focus:border-plum-500 focus:outline-none font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                      Rendimiento * (&gt; 0)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={newRecipe.yield}
                      onChange={(e) => setNewRecipe({ ...newRecipe, yield: Math.max(1, Number(e.target.value)) })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-semibold focus:border-plum-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                      Unidad de Rendimiento
                    </label>
                    <select
                      value={newRecipe.yieldUnit}
                      onChange={(e) => setNewRecipe({ ...newRecipe, yieldUnit: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink focus:border-plum-500 focus:outline-none"
                    >
                      <option value="porciones">Porciones</option>
                      <option value="unidades">Unidades / Piezas</option>
                      <option value="caja">Caja</option>
                      <option value="gramos">Gramos (Subreceta)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                      Costo Total del Lote (RD$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={newRecipe.batchCostDOP}
                      onChange={(e) => setNewRecipe({ ...newRecipe, batchCostDOP: Number(e.target.value) })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-bold focus:border-plum-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                      Margen Objetivo sobre Venta (% &lt; 100) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="99"
                      value={newRecipe.targetMargin}
                      onChange={(e) => setNewRecipe({ ...newRecipe, targetMargin: Math.min(99, Math.max(0, Number(e.target.value))) })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-plum-600 font-bold focus:border-plum-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Previsualización de fórmula P = C / (1 - M) */}
                <div className="p-3 bg-cream-100 rounded-xl border border-cream-300 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-ink-muted block text-[11px] uppercase font-semibold">Costo Unitario:</span>
                    <span className="font-bold text-ink">
                      RD$ {(newRecipe.batchCostDOP / newRecipe.yield).toFixed(2)} /{newRecipe.yieldUnit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-muted block text-[11px] uppercase font-semibold">Precio Sugerido P = C / (1-M):</span>
                    <span className="font-bold text-sage-600 text-sm">
                      RD$ {((newRecipe.batchCostDOP / newRecipe.yield) / (1 - newRecipe.targetMargin / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                    Precio de Venta Fijado (RD$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newRecipe.currentPriceDOP}
                    onChange={(e) => setNewRecipe({ ...newRecipe, currentPriceDOP: Number(e.target.value) })}
                    className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-bold focus:border-plum-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-ink-muted mt-0.5 block">
                    Precio con el que se publica en la carta al cliente.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                    Notas / Insumos
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Incluye empaque de domo transparente y lazo ciruela"
                    value={newRecipe.notes}
                    onChange={(e) => setNewRecipe({ ...newRecipe, notes: e.target.value })}
                    className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink focus:border-plum-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-cream-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-cream-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-plum-500 hover:bg-plum-600 text-white font-medium shadow-sm transition-colors"
                  >
                    Guardar Receta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

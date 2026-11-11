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
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

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

        {/* Tarjetas de Recetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map((recipe) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}

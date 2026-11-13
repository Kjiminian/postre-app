"use client";

import { useState, useEffect } from "react";
import {
  ChefHat,
  Plus,
  Search,
  AlertTriangle,
  Package,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Gift,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";
import { RecipeType, PricingMethod } from "@/types";

interface IngredientOption {
  id: string;
  name: string;
  costPerBaseUnit: number;
  baseUnit: string;
  category: string;
}

interface RecipeItem {
  id: string;
  name: string;
  slug: string;
  recipeType: RecipeType;
  description?: string;
  yield: number;
  yieldUnit: string;
  laborPercent: number;
  overheadPercent: number;
  batchCostCents: number;
  unitCostCents: number;
  costPerYieldUnit: number;
  suggestedPriceCents: number;
  currentPriceCents: number;
  targetMargin: number;
  status: string;
  reviewFlag: boolean;
  notes?: string;
  importedFrom?: string;
  ingredients: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    costCents: number;
    ingredient: {
      name: string;
      baseUnit: string;
      costPerBaseUnit: number;
    };
  }>;
  presentations: Array<{
    id: string;
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
    materials?: Array<{ name: string; quantity: number; unit: string; totalCostCents: number }>;
  }>;
}

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});

  // Modales
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isPresModalOpen, setIsPresModalOpen] = useState(false);
  const [selectedMotherRecipe, setSelectedMotherRecipe] = useState<RecipeItem | null>(null);

  // Formulario Receta Madre
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    recipeType: "MOTHER" as RecipeType,
    description: "",
    yieldQty: 15,
    yieldUnit: "porciones",
    laborPercent: 20,
    overheadPercent: 10,
    packageCostDOP: 0,
    targetMargin: 40,
    notes: "",
    ingredients: [] as Array<{ ingredientId: string; quantity: number; unit: string; costCents: number }>,
  });

  // Formulario Presentación
  const [presForm, setPresForm] = useState({
    name: "",
    sizeDescription: "",
    motherRecipeQty: 1,
    motherRecipeUnit: "porciones",
    pricingMethod: "MARGIN" as PricingMethod,
    desiredMarginPercent: 40,
    finalPriceDOP: 0,
    notes: "",
    materials: [] as Array<{ ingredientId?: string; name: string; quantity: number; unit: string; unitCostCents: number; totalCostCents: number }>,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resRec, resIng] = await Promise.all([
        fetch("/api/recetas"),
        fetch("/api/ingredientes"),
      ]);
      const dataRec = await resRec.json();
      const dataIng = await resIng.json();

      if (dataRec.success) {
        setRecipes(dataRec.data);
        const initialExpanded: Record<string, boolean> = {};
        dataRec.data.forEach((r: RecipeItem) => {
          initialExpanded[r.id] = true;
        });
        setExpandedRecipes(initialExpanded);
      } else throw new Error(dataRec.error);

      if (dataIng.success) {
        setAvailableIngredients(dataIng.data);
      }
    } catch (err: any) {
      setError(err.message || "Error cargando recetas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedRecipes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenNewPresentation = (mother: RecipeItem) => {
    setSelectedMotherRecipe(mother);
    setPresForm({
      name: "",
      sizeDescription: "",
      motherRecipeQty: 1,
      motherRecipeUnit: mother.yieldUnit,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 40,
      finalPriceDOP: 0,
      notes: "",
      materials: [],
    });
    setIsPresModalOpen(true);
  };

  const calcPresPreview = () => {
    if (!selectedMotherRecipe) return { totalCostDOP: 0, suggestedPriceDOP: 0, profitDOP: 0, realMargin: 0 };

    const baseCostCents = Math.round(selectedMotherRecipe.costPerYieldUnit * presForm.motherRecipeQty);
    const packagingCostCents = presForm.materials.reduce((sum, m) => sum + (m.totalCostCents || 0), 0);
    const totalCostCents = baseCostCents + packagingCostCents;

    let suggestedCents = totalCostCents;
    if (presForm.pricingMethod === "MARKUP") {
      suggestedCents = Math.ceil(totalCostCents * (1 + presForm.desiredMarginPercent / 100));
    } else {
      const frac = presForm.desiredMarginPercent / 100;
      suggestedCents = frac < 1 ? Math.ceil(totalCostCents / (1 - frac)) : totalCostCents;
    }

    const finalCents = presForm.finalPriceDOP > 0 ? Math.round(presForm.finalPriceDOP * 100) : suggestedCents;
    const profitCents = finalCents - totalCostCents;
    const realMargin = finalCents > 0 ? ((finalCents - totalCostCents) / finalCents) * 100 : 0;

    return {
      totalCostDOP: totalCostCents / 100,
      suggestedPriceDOP: suggestedCents / 100,
      profitDOP: profitCents / 100,
      realMargin,
    };
  };

  const presPreview = calcPresPreview();

  const handleSavePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMotherRecipe || !presForm.name) return;

    try {
      const payload = {
        recipeId: selectedMotherRecipe.id,
        name: presForm.name,
        sizeDescription: presForm.sizeDescription,
        motherRecipeQty: presForm.motherRecipeQty,
        motherRecipeUnit: presForm.motherRecipeUnit,
        pricingMethod: presForm.pricingMethod,
        desiredMarginPercent: presForm.desiredMarginPercent,
        finalPriceCents: presForm.finalPriceDOP > 0 ? Math.round(presForm.finalPriceDOP * 100) : undefined,
        notes: presForm.notes,
        materials: presForm.materials,
      };

      const res = await fetch("/api/presentaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsPresModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error al guardar presentación: " + err.message);
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.name) return;

    try {
      const payload = {
        ...recipeForm,
        packageCostCents: Math.round(recipeForm.packageCostDOP * 100),
      };

      const res = await fetch("/api/recetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsRecipeModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error al guardar receta: " + err.message);
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "ALL" || r.recipeType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <ChefHat className="w-4 h-4" />
              <span>Arquitectura Bipolar de Producción</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Recetas Madre y Presentaciones
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Costeo base de lote por rendimiento y gestión modular de presentaciones derivadas sin duplicación de ingredientes.
            </p>
          </div>

          <button
            onClick={() => {
              setRecipeForm({
                name: "",
                recipeType: "MOTHER",
                description: "",
                yieldQty: 15,
                yieldUnit: "porciones",
                laborPercent: 20,
                overheadPercent: 10,
                packageCostDOP: 0,
                targetMargin: 40,
                notes: "",
                ingredients: [],
              });
              setIsRecipeModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Receta Madre</span>
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E8E2D9] shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
            <input
              type="text"
              placeholder="Buscar receta madre o presentación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#FAF8F6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: "ALL", label: "Todas" },
              { id: "MOTHER", label: "Recetas Madre" },
              { id: "SUBRECIPE", label: "Subrecetas" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === t.id ? "bg-[#9C4266] text-white" : "bg-[#FAF8F6] text-[#7D6E65] hover:bg-[#F3EFEA]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#4A3B32]">Cargando recetas y presentaciones...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center">
            <AlertTriangle className="w-8 h-8 text-[#E53E3E] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg hover:bg-[#C53030]"
            >
              Reintentar
            </button>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <ChefHat className="w-10 h-10 text-[#C4B5A5] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#4A3B32]">No hay recetas registradas</h3>
            <p className="text-xs text-[#7D6E65] max-w-sm mx-auto mt-1">
              Comienza registrando tu primera receta madre de bizcocho, mousse o brownie.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRecipes.map((recipe) => {
              const isExpanded = expandedRecipes[recipe.id] !== false;
              return (
                <div key={recipe.id} className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
                  <div className="p-6 bg-[#FAF8F6]/60 border-b border-[#E8E2D9]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              recipe.recipeType === "MOTHER"
                                ? "bg-[#FAF5F7] text-[#9C4266] border border-[#F3D5E2]"
                                : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                            }`}
                          >
                            {recipe.recipeType === "MOTHER" ? "Receta Madre" : "Subreceta Base"}
                          </span>
                          {recipe.importedFrom && (
                            <span className="text-[11px] text-[#A89F91]">
                              Origen: {recipe.importedFrom}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-serif font-bold text-[#4A3B32]">{recipe.name}</h2>
                        {recipe.description && (
                          <p className="text-xs text-[#7D6E65] mt-0.5">{recipe.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-[#E8E2D9]">
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Rendimiento</span>
                          <span className="text-sm font-bold text-[#4A3B32] tabular-nums">
                            {recipe.yield} {recipe.yieldUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Costo Total Lote</span>
                          <span className="text-sm font-bold text-[#4A3B32] tabular-nums">
                            {formatDOP(recipe.batchCostCents)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Costo x Unidad Rend.</span>
                          <span className="text-sm font-bold text-[#9C4266] tabular-nums">
                            RD$ {(recipe.costPerYieldUnit / 100).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Overhead / MO</span>
                          <span className="text-xs font-medium text-[#7D6E65] tabular-nums">
                            {recipe.overheadPercent}% / {recipe.laborPercent}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E8E2D9]/70 text-xs text-[#7D6E65]">
                      <button
                        onClick={() => toggleExpand(recipe.id)}
                        className="inline-flex items-center gap-1 font-semibold text-[#9C4266] hover:underline"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>
                          {isExpanded ? "Ocultar Presentaciones y Detalles" : `Ver ${recipe.presentations.length} Presentaciones`}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenNewPresentation(recipe)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#9C4266] text-white rounded-lg font-medium hover:bg-[#833554] shadow-sm transition-all"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Agregar Presentación</span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-6 space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-serif font-bold text-[#4A3B32] flex items-center gap-2">
                            <Package className="w-4 h-4 text-[#9C4266]" />
                            <span>Presentaciones de Venta Derivadas ({recipe.presentations.length})</span>
                          </h3>
                        </div>

                        {recipe.presentations.length === 0 ? (
                          <div className="p-6 rounded-xl border border-dashed border-[#E8E2D9] text-center bg-[#FAF8F6]">
                            <p className="text-xs text-[#7D6E65]">
                              Esta receta madre aún no tiene presentaciones registradas (porciones, vasos, cajas o shots).
                            </p>
                            <button
                              onClick={() => handleOpenNewPresentation(recipe)}
                              className="mt-2 text-xs font-semibold text-[#9C4266] hover:underline"
                            >
                              + Crear la primera presentación
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recipe.presentations.map((pres) => (
                              <div
                                key={pres.id}
                                className="p-4 rounded-xl border border-[#E8E2D9] bg-white hover:border-[#9C4266]/40 transition-all shadow-sm flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="text-base font-semibold text-[#4A3B32]">{pres.name}</h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF5F7] text-[#9C4266]">
                                      {pres.pricingMethod === "MARGIN" ? "Margen Venta" : "Markup Costo"}
                                    </span>
                                  </div>
                                  {pres.sizeDescription && (
                                    <p className="text-xs text-[#7D6E65] mb-3">{pres.sizeDescription}</p>
                                  )}

                                  <div className="space-y-1.5 text-xs text-[#7D6E65] border-t border-b border-[#FAF8F6] py-2 mb-3">
                                    <div className="flex justify-between">
                                      <span>Consumo Receta Madre:</span>
                                      <span className="font-semibold text-[#4A3B32] tabular-nums">
                                        {pres.motherRecipeQty} {pres.motherRecipeUnit}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Rendimiento x Lote:</span>
                                      <span className="font-semibold text-[#4A3B32] tabular-nums">
                                        {pres.presentationYield.toFixed(1)} unidades
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Costo Empaques / Extras:</span>
                                      <span className="font-medium text-[#4A3B32] tabular-nums">
                                        {formatDOP(pres.packagingCostCents + pres.additionalCostCents)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-[#FAF8F6]">
                                      <span className="font-semibold text-[#4A3B32]">Costo Total Unitario:</span>
                                      <span className="font-bold text-[#9C4266] tabular-nums">
                                        {formatDOP(pres.totalCostCents)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 bg-[#FAF8F6] p-2.5 rounded-lg">
                                  <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-[11px] text-[#7D6E65]">Precio Final Venta:</span>
                                    <span className="text-base font-bold text-[#4A3B32] tabular-nums">
                                      {formatDOP(pres.finalPriceCents)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-[#22543D] font-semibold tabular-nums">
                                      Ganancia: {formatDOP(pres.realProfitCents)}
                                    </span>
                                    <span className="text-[#9C4266] font-bold tabular-nums">
                                      {pres.realMarginPercent.toFixed(1)}% Margen
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-[#E8E2D9]">
                        <h4 className="text-xs font-semibold text-[#7D6E65] uppercase tracking-wider mb-2">
                          Ingredientes que componen el lote ({recipe.ingredients.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {recipe.ingredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#FAF8F6] border border-[#E8E2D9] text-[#4A3B32]"
                            >
                              <span className="font-medium">{ing.ingredient.name}:</span>
                              <span>
                                {ing.quantity} {ing.unit}
                              </span>
                              <span className="text-[#9C4266] font-semibold">
                                ({formatDOP(ing.costCents)})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isPresModalOpen && selectedMotherRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsPresModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
                <Gift className="w-4 h-4" />
                <span>Nueva Presentación Derivada</span>
              </div>
              <h2 className="text-xl font-serif font-bold text-[#4A3B32]">
                {selectedMotherRecipe.name}
              </h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                Define el tamaño, consumo de preparación base, empaques y margen deseado.
              </p>

              <form onSubmit={handleSavePresentation} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre de la Presentación</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Shot 2 oz, Caja x 12, Completo 8 pulg"
                      value={presForm.name}
                      onChange={(e) => setPresForm({ ...presForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Descripción / Tamaño</label>
                    <input
                      type="text"
                      placeholder="Ej. Vaso shot con cuchara mini"
                      value={presForm.sizeDescription}
                      onChange={(e) => setPresForm({ ...presForm, sizeDescription: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                      Consume de Receta Madre
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={presForm.motherRecipeQty}
                      onChange={(e) => setPresForm({ ...presForm, motherRecipeQty: parseFloat(e.target.value) || 0.1 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Unidad Consumida</label>
                    <input
                      type="text"
                      disabled
                      value={presForm.motherRecipeUnit}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#F3EFEA] text-[#7D6E65]"
                    />
                  </div>
                </div>

                <div className="border border-[#E8E2D9] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#4A3B32]">
                      Empaques y Materiales Específicos ({presForm.materials.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPresForm({
                          ...presForm,
                          materials: [
                            ...presForm.materials,
                            { name: "Caja / Vaso", quantity: 1, unit: "unidad", unitCostCents: 1500, totalCostCents: 1500 },
                          ],
                        });
                      }}
                      className="text-xs font-semibold text-[#9C4266] hover:underline"
                    >
                      + Añadir material
                    </button>
                  </div>

                  {presForm.materials.map((mat, idx) => (
                    <div key={idx} className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Material (Vaso, Tapa, Lazo)"
                        value={mat.name}
                        onChange={(e) => {
                          const updated = [...presForm.materials];
                          updated[idx].name = e.target.value;
                          setPresForm({ ...presForm, materials: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                      />
                      <input
                        type="number"
                        placeholder="RD$ Costo"
                        value={mat.totalCostCents / 100}
                        onChange={(e) => {
                          const updated = [...presForm.materials];
                          const val = parseFloat(e.target.value) || 0;
                          updated[idx].totalCostCents = Math.round(val * 100);
                          setPresForm({ ...presForm, materials: updated });
                        }}
                        className="w-24 px-2.5 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = presForm.materials.filter((_, i) => i !== idx);
                          setPresForm({ ...presForm, materials: updated });
                        }}
                        className="p-1 text-[#E53E3E]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Método de Precios</label>
                    <select
                      value={presForm.pricingMethod}
                      onChange={(e) => setPresForm({ ...presForm, pricingMethod: e.target.value as PricingMethod })}
                      className="w-full px-2 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    >
                      <option value="MARGIN">Margen s/ Venta</option>
                      <option value="MARKUP">Recargo s/ Costo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">% Deseado</label>
                    <input
                      type="number"
                      min="0"
                      max="99.9"
                      step="0.5"
                      value={presForm.desiredMarginPercent}
                      onChange={(e) => setPresForm({ ...presForm, desiredMarginPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Precio Final (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Sugerido: ${presPreview.suggestedPriceDOP.toFixed(2)}`}
                      value={presForm.finalPriceDOP || ""}
                      onChange={(e) => setPresForm({ ...presForm, finalPriceDOP: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] font-bold text-[#4A3B32]"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF5F7] border border-[#F3D5E2] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#7D6E65] block font-medium">Costo Total Unitario:</span>
                    <span className="text-sm font-bold text-[#9C4266]">
                      RD$ {presPreview.totalCostDOP.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#7D6E65] block font-medium">Precio Sugerido:</span>
                    <span className="text-sm font-bold text-[#4A3B32]">
                      RD$ {presPreview.suggestedPriceDOP.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#7D6E65] block font-medium">Ganancia Real:</span>
                    <span className="text-sm font-bold text-[#22543D]">
                      RD$ {presPreview.profitDOP.toFixed(2)} ({presPreview.realMargin.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsPresModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-[#7D6E65]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-[#9C4266] text-white rounded-lg hover:bg-[#833554] shadow-sm"
                  >
                    Guardar Presentación
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isRecipeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif font-bold text-[#4A3B32] mb-1">Nueva Receta Madre</h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                Define el rendimiento del lote y porcentajes de mano de obra y gastos de producción.
              </p>

              <form onSubmit={handleSaveRecipe} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre de la Receta</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Receta Base de Mousse de Chocolate"
                    value={recipeForm.name}
                    onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Rendimiento Real del Lote</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={recipeForm.yieldQty}
                      onChange={(e) => setRecipeForm({ ...recipeForm, yieldQty: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Unidad de Rendimiento</label>
                    <select
                      value={recipeForm.yieldUnit}
                      onChange={(e) => setRecipeForm({ ...recipeForm, yieldUnit: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="porciones">porciones</option>
                      <option value="unidades">unidades</option>
                      <option value="gramos">gramos</option>
                      <option value="ml">mililitros</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Mano de Obra (% sobre insumos)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={recipeForm.laborPercent}
                      onChange={(e) => setRecipeForm({ ...recipeForm, laborPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Gastos Producción / Gas / Luz (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={recipeForm.overheadPercent}
                      onChange={(e) => setRecipeForm({ ...recipeForm, overheadPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Notas del Obrador</label>
                  <textarea
                    rows={2}
                    value={recipeForm.notes}
                    onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                    placeholder="Instrucciones clave de horneado o temperatura..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsRecipeModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-[#7D6E65]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-[#9C4266] text-white rounded-lg hover:bg-[#833554] shadow-sm"
                  >
                    Guardar Receta Madre
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

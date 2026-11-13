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
  Edit2,
  Trash2,
  Check,
  Calculator,
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
  packageCostCents: number;
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
    isComposite?: boolean;
    materials?: Array<{
      id: string;
      name: string;
      quantity: number;
      unit: string;
      unitCostCents: number;
      totalCostCents: number;
    }>;
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
  const [simPortions, setSimPortions] = useState<Record<string, number>>({});
  const [comboQtyOverride, setComboQtyOverride] = useState<Record<string, number>>({});

  // Edición en línea de precio de presentación
  const [editingPresId, setEditingPresId] = useState<string | null>(null);
  const [editingPresPriceDOP, setEditingPresPriceDOP] = useState<number>(0);

  // Modales
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [isPresModalOpen, setIsPresModalOpen] = useState(false);
  const [editingPresRecordId, setEditingPresRecordId] = useState<string | null>(null);
  const [selectedMotherRecipe, setSelectedMotherRecipe] = useState<RecipeItem | null>(null);

  // Formulario Receta Madre (Crear / Editar)
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    recipeType: "MOTHER" as RecipeType,
    description: "",
    yieldQty: 15,
    yieldUnit: "porciones",
    laborPercent: 40,
    overheadPercent: 30,
    packageCostDOP: 0,
    targetMargin: 60,
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
    desiredMarginPercent: 35,
    finalPriceDOP: 0,
    notes: "",
    materials: [] as Array<{ ingredientId?: string; name: string; quantity: number; unit: string; unitCostDOP: number; totalCostCents: number }>,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, ingRes] = await Promise.all([
        fetch("/api/recetas"),
        fetch("/api/ingredientes"),
      ]);
      const recJson = await recRes.json();
      const ingJson = await ingRes.json();

      if (recJson.success) {
        setRecipes(recJson.data);
        // Expandir la primera receta automáticamente para vista inmediata
        if (recJson.data.length > 0 && Object.keys(expandedRecipes).length === 0) {
          const brownieRec = recJson.data.find((r: RecipeItem) => r.name.includes("Modelo Receta 2")) || recJson.data[0];
          setExpandedRecipes({ [brownieRec.id]: true });
        }
      } else {
        throw new Error(recJson.error);
      }

      if (ingJson.success) {
        setAvailableIngredients(ingJson.data);
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar recetas");
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

  const handleOpenNewRecipe = () => {
    setEditingRecipeId(null);
    setRecipeForm({
      name: "",
      recipeType: "MOTHER",
      description: "",
      yieldQty: 15,
      yieldUnit: "porciones",
      laborPercent: 30,
      overheadPercent: 20,
      packageCostDOP: 0,
      targetMargin: 40,
      notes: "",
      ingredients: [],
    });
    setIsRecipeModalOpen(true);
  };

  const handleOpenEditRecipe = (recipe: RecipeItem) => {
    setEditingRecipeId(recipe.id);
    setRecipeForm({
      name: recipe.name,
      recipeType: recipe.recipeType,
      description: recipe.description || "",
      yieldQty: recipe.yield,
      yieldUnit: recipe.yieldUnit,
      laborPercent: recipe.laborPercent,
      overheadPercent: recipe.overheadPercent,
      packageCostDOP: (recipe.packageCostCents || 0) / 100,
      targetMargin: recipe.targetMargin,
      notes: recipe.notes || "",
      ingredients: recipe.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
        costCents: i.costCents,
      })),
    });
    setIsRecipeModalOpen(true);
  };

  const handleOpenNewPresentation = (mother: RecipeItem) => {
    setEditingPresRecordId(null);
    setSelectedMotherRecipe(mother);
    setPresForm({
      name: "",
      sizeDescription: "",
      motherRecipeQty: 1,
      motherRecipeUnit: mother.yieldUnit,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 35,
      finalPriceDOP: 0,
      notes: "",
      materials: [],
    });
    setIsPresModalOpen(true);
  };

  const handleOpenEditPresentation = (mother: RecipeItem, pres: RecipeItem["presentations"][number]) => {
    setEditingPresRecordId(pres.id);
    setSelectedMotherRecipe(mother);
    setPresForm({
      name: pres.name,
      sizeDescription: pres.sizeDescription || "",
      motherRecipeQty: pres.motherRecipeQty,
      motherRecipeUnit: pres.motherRecipeUnit,
      pricingMethod: pres.pricingMethod,
      desiredMarginPercent: pres.desiredMarginPercent,
      finalPriceDOP: pres.finalPriceCents / 100,
      notes: "",
      materials: (pres.materials || []).map((m) => ({
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        unitCostDOP: m.unitCostCents / 100,
        totalCostCents: m.totalCostCents,
      })),
    });
    setIsPresModalOpen(true);
  };

  const calcPresPreview = () => {
    if (!selectedMotherRecipe) {
      return { baseCostDOP: 0, packagingCostDOP: 0, totalCostDOP: 0, suggestedPriceDOP: 0, profitDOP: 0, realMargin: 0 };
    }

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
      baseCostDOP: baseCostCents / 100,
      packagingCostDOP: packagingCostCents / 100,
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
        ...(editingPresRecordId ? { id: editingPresRecordId } : { recipeId: selectedMotherRecipe.id }),
        name: presForm.name,
        sizeDescription: presForm.sizeDescription,
        motherRecipeQty: presForm.motherRecipeQty,
        motherRecipeUnit: presForm.motherRecipeUnit,
        pricingMethod: presForm.pricingMethod,
        desiredMarginPercent: presForm.desiredMarginPercent,
        finalPriceCents: presForm.finalPriceDOP > 0 ? Math.round(presForm.finalPriceDOP * 100) : undefined,
        notes: presForm.notes,
        materials: presForm.materials.map((m) => ({
          ingredientId: m.ingredientId || null,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          unitCostCents: Math.round(m.unitCostDOP * 100),
          totalCostCents: m.totalCostCents,
        })),
      };

      const res = await fetch("/api/presentaciones", {
        method: editingPresRecordId ? "PUT" : "POST",
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
        ...(editingRecipeId ? { id: editingRecipeId } : {}),
        ...recipeForm,
        packageCostCents: Math.round(recipeForm.packageCostDOP * 100),
      };

      const res = await fetch("/api/recetas", {
        method: editingRecipeId ? "PUT" : "POST",
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

  const handleSaveInlinePresPrice = async (presId: string) => {
    try {
      const res = await fetch("/api/presentaciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: presId,
          finalPriceCents: Math.round(editingPresPriceDOP * 100),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setEditingPresId(null);
      loadData();
    } catch (err: any) {
      alert("Error al actualizar precio: " + err.message);
    }
  };

  const handleDeletePresentation = async (presId: string, name: string) => {
    if (!confirm(`¿Desactivar la presentación "${name}"? Conservará su historial en ventas pasadas.`)) return;
    try {
      const res = await fetch(`/api/presentaciones?id=${presId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      loadData();
    } catch (err: any) {
      alert("Error al desactivar: " + err.message);
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.presentations.some((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "ALL" || r.recipeType === typeFilter;
    return matchesSearch && matchesType;
  });

  // Cálculo en vivo para modal de Receta Madre
  const modalIngTotalCents = recipeForm.ingredients.reduce((s, i) => s + (i.costCents || 0), 0);
  const modalOverheadCents = Math.round((modalIngTotalCents * recipeForm.overheadPercent) / 100);
  const modalLaborCents = Math.round((modalIngTotalCents * recipeForm.laborPercent) / 100);
  const modalBatchRealCents = modalIngTotalCents + modalOverheadCents + modalLaborCents + Math.round(recipeForm.packageCostDOP * 100);
  const modalGainBaseCents = Math.round((modalBatchRealCents * recipeForm.targetMargin) / 100);
  const modalTotalWithGainCents = modalBatchRealCents + modalGainBaseCents;

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <ChefHat className="w-4 h-4" />
              <span>Hoja de Costeo Maestra (Modelo Bronie Receta 2)</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Recetas Madre y Presentaciones Derivadas
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Cada receta base calcula su costo real y ganancia por lote, y deriva sus presentaciones (porciones, mini, vasos y cajas) sin duplicar ingredientes.
            </p>
          </div>

          <button
            onClick={handleOpenNewRecipe}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Receta Madre</span>
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="bg-white p-4 rounded-xl border border-[#E8E2D9] shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
            <input
              type="text"
              placeholder="Buscar receta madre o presentación derivada (ej. Brownie, Chinola, Quesillo)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#FAF8F6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: "ALL", label: `Todas (${recipes.length})` },
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
            <p className="text-sm font-medium text-[#4A3B32]">Cargando hojas de costeo y presentaciones...</p>
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
            <h3 className="text-base font-semibold text-[#4A3B32]">No se encontraron recetas</h3>
            <p className="text-xs text-[#7D6E65] max-w-sm mx-auto mt-1">
              Ajusta tu búsqueda o registra una nueva receta madre para empezar.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRecipes.map((recipe) => {
              const isExpanded = Boolean(expandedRecipes[recipe.id]);

              // Cálculo detallado estilo Excel Bronie Receta 2
              const ingTotalCents = recipe.ingredients.reduce((acc, i) => acc + i.costCents, 0);
              const overheadCents = Math.round((ingTotalCents * recipe.overheadPercent) / 100);
              const laborCents = Math.round((ingTotalCents * recipe.laborPercent) / 100);
              const subTotalRealCents = recipe.batchCostCents;
              const baseGainCents = Math.round((subTotalRealCents * recipe.targetMargin) / 100);
              const totalWithBaseGainCents = subTotalRealCents + baseGainCents;

              const currentSimPortions = simPortions[recipe.id] || recipe.yield;
              const simCostPerPortion = currentSimPortions > 0 ? subTotalRealCents / currentSimPortions : subTotalRealCents;
              const simValWithGainPerPortion = currentSimPortions > 0 ? totalWithBaseGainCents / currentSimPortions : totalWithBaseGainCents;

              return (
                <div key={recipe.id} className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
                  {/* CABECERA DE RECETA MADRE */}
                  <div className="p-5 sm:p-6 bg-[#FAF8F6]/70 border-b border-[#E8E2D9]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              recipe.recipeType === "MOTHER"
                                ? "bg-[#FAF5F7] text-[#9C4266] border border-[#F3D5E2]"
                                : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                            }`}
                          >
                            {recipe.recipeType === "MOTHER" ? "Receta Madre" : "Subreceta Base"}
                          </span>
                          {recipe.importedFrom && (
                            <span className="text-[11px] text-[#7D6E65] bg-white px-2 py-0.5 rounded border border-[#E8E2D9]">
                              Hoja: {recipe.importedFrom}
                            </span>
                          )}
                          <span className="text-[11px] text-[#7D6E65]">
                            {recipe.ingredients.length} ingredientes · {recipe.presentations.length} presentaciones
                          </span>
                        </div>
                        <h2 className="text-xl font-serif font-bold text-[#4A3B32]">{recipe.name}</h2>
                        {recipe.description && (
                          <p className="text-xs text-[#7D6E65] mt-0.5">{recipe.description}</p>
                        )}
                      </div>

                      {/* KPIs de Lote */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-[#E8E2D9]">
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Rendimiento Base</span>
                          <span className="text-sm font-bold text-[#4A3B32] tabular-nums">
                            {recipe.yield} {recipe.yieldUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Costo Real Lote</span>
                          <span className="text-sm font-bold text-[#4A3B32] tabular-nums">
                            {formatDOP(subTotalRealCents)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Costo x Porción</span>
                          <span className="text-sm font-bold text-[#9C4266] tabular-nums">
                            RD$ {(recipe.costPerYieldUnit / 100).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Gas / MO / Gan.</span>
                          <span className="text-xs font-semibold text-[#4A3B32] tabular-nums">
                            {recipe.overheadPercent}% / {recipe.laborPercent}% / {recipe.targetMargin}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[#E8E2D9]/70 text-xs">
                      <button
                        onClick={() => toggleExpand(recipe.id)}
                        className="inline-flex items-center gap-1.5 font-semibold text-[#9C4266] hover:underline"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>
                          {isExpanded
                            ? "Ocultar Hoja de Costeo y Presentaciones"
                            : `Abrir Hoja de Costeo (${recipe.ingredients.length} ing. → ${recipe.presentations.length} presentaciones)`}
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditRecipe(recipe)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D9] text-[#4A3B32] rounded-lg font-medium hover:bg-[#FAF8F6] transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#7D6E65]" />
                          <span>Editar Receta Madre</span>
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
                  </div>

                  {/* CUERPO EXPANDIDO: DISEÑO EXCEL BRONIE RECETA 2 (RECETA MADRE + DERIVACIONES) */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 bg-white">
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                        {/* COLUMNA IZQUIERDA (5 cols): RECETA MADRE / COSTEO DEL LOTE */}
                        <div className="xl:col-span-5 rounded-xl border border-[#E8E2D9] bg-[#FAF8F6]/40 overflow-hidden">
                          <div className="px-4 py-3 bg-[#4A3B32] text-white flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-[#F3D5E2] font-semibold block">
                                Paso 1 · Receta Base
                              </span>
                              <h3 className="text-sm font-serif font-bold">
                                Liquidación del Lote ({recipe.yield} {recipe.yieldUnit})
                              </h3>
                            </div>
                            <button
                              onClick={() => handleOpenEditRecipe(recipe)}
                              className="text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded text-white font-medium transition-colors"
                            >
                              Editar Insumos
                            </button>
                          </div>

                          {/* Tabla de Ingredientes */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#F3EFEA] text-[#7D6E65] border-b border-[#E8E2D9] font-semibold">
                                  <th className="py-2 px-3">Ingrediente</th>
                                  <th className="py-2 px-2 text-right">Precio Unit.</th>
                                  <th className="py-2 px-2 text-right">Cant.</th>
                                  <th className="py-2 px-3 text-right">Importe</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E8E2D9]/60 bg-white">
                                {recipe.ingredients.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="py-4 px-3 text-center text-[#7D6E65]">
                                      Sin ingredientes registrados. Haz clic en &ldquo;Editar Insumos&rdquo;.
                                    </td>
                                  </tr>
                                ) : (
                                  recipe.ingredients.map((item) => (
                                    <tr key={item.id} className="hover:bg-[#FAF8F6]/60">
                                      <td className="py-2 px-3 font-medium text-[#4A3B32]">
                                        {item.ingredient?.name || "Ingrediente"}
                                      </td>
                                      <td className="py-2 px-2 text-right text-[#7D6E65] tabular-nums">
                                        {item.ingredient ? `RD$ ${item.ingredient.costPerBaseUnit.toFixed(2)}` : "-"}
                                      </td>
                                      <td className="py-2 px-2 text-right text-[#4A3B32] tabular-nums">
                                        {item.quantity} <span className="text-[10px] text-[#7D6E65]">{item.unit}</span>
                                      </td>
                                      <td className="py-2 px-3 text-right font-semibold text-[#4A3B32] tabular-nums">
                                        {formatDOP(item.costCents)}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Bloque de Costos, Mano de Obra y Ganancia Base (Tal cual Bronie receta 2) */}
                          <div className="p-4 bg-[#FAF8F6] border-t border-[#E8E2D9] space-y-2 text-xs">
                            <div className="flex justify-between text-[#4A3B32]">
                              <span>Costo de Producción (Ingredientes)</span>
                              <span className="font-semibold tabular-nums">{formatDOP(ingTotalCents)}</span>
                            </div>
                            <div className="flex justify-between text-[#7D6E65]">
                              <span>Gas, Agua, Luz, Mat. gastables ({recipe.overheadPercent}%)</span>
                              <span className="tabular-nums">{formatDOP(overheadCents)}</span>
                            </div>
                            <div className="flex justify-between text-[#7D6E65]">
                              <span>Mano de Obra ({recipe.laborPercent}%)</span>
                              <span className="tabular-nums">{formatDOP(laborCents)}</span>
                            </div>

                            <div className="pt-2 border-t border-[#E8E2D9] flex justify-between items-center font-bold text-[#4A3B32]">
                              <span>SubTotal (Costo Real del Lote)</span>
                              <span className="text-sm tabular-nums">{formatDOP(subTotalRealCents)}</span>
                            </div>

                            <div className="flex justify-between text-[#22543D] font-medium">
                              <span>Ganancia Receta Base ({recipe.targetMargin}%)</span>
                              <span className="tabular-nums">{formatDOP(baseGainCents)}</span>
                            </div>

                            <div className="pt-2 border-t border-[#E8E2D9] flex justify-between items-center font-bold text-[#9C4266]">
                              <span>Total Lote (con Ganancia Base)</span>
                              <span className="text-sm tabular-nums">{formatDOP(totalWithBaseGainCents)}</span>
                            </div>

                            {/* Simulador de Porciones del Lote */}
                            <div className="mt-3 p-3 rounded-lg bg-white border border-[#E8E2D9] space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-[#4A3B32] flex items-center gap-1">
                                  <Calculator className="w-3.5 h-3.5 text-[#9C4266]" />
                                  Porciones a extraer del lote:
                                </span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={currentSimPortions}
                                  onChange={(e) =>
                                    setSimPortions((prev) => ({
                                      ...prev,
                                      [recipe.id]: Math.max(1, parseFloat(e.target.value) || 1),
                                    }))
                                  }
                                  className="w-16 px-2 py-0.5 text-right text-xs font-bold rounded border border-[#9C4266] text-[#9C4266] tabular-nums"
                                />
                              </div>
                              <div className="flex justify-between text-[11px] text-[#7D6E65]">
                                <span>Costo real por unidad ({currentSimPortions} uds):</span>
                                <span className="font-bold text-[#4A3B32] tabular-nums">
                                  RD$ {(simCostPerPortion / 100).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] text-[#7D6E65]">
                                <span>Valor c/ ganancia base por unidad:</span>
                                <span className="font-semibold text-[#9C4266] tabular-nums">
                                  RD$ {(simValWithGainPerPortion / 100).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] text-[#7D6E65] leading-relaxed pt-1">
                              * Las presentaciones derivadas toman el <strong>Costo Real</strong> (SubTotal) para no duplicar ganancias al aplicar su propio margen.
                            </p>
                          </div>
                        </div>

                        {/* COLUMNA DERECHA (7 cols): PRESENTACIONES DERIVADAS */}
                        <div className="xl:col-span-7 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-serif font-bold text-[#4A3B32] flex items-center gap-2">
                              <Package className="w-4 h-4 text-[#9C4266]" />
                              <span>Paso 2 · Presentaciones Derivadas de esta Receta ({recipe.presentations.length})</span>
                            </h3>
                          </div>

                          {recipe.presentations.length === 0 ? (
                            <div className="p-8 rounded-xl border border-dashed border-[#E8E2D9] text-center bg-[#FAF8F6]">
                              <p className="text-xs text-[#7D6E65]">
                                Esta receta madre aún no tiene presentaciones derivadas (porciones, mini, cajas o shots).
                              </p>
                              <button
                                onClick={() => handleOpenNewPresentation(recipe)}
                                className="mt-2 text-xs font-semibold text-[#9C4266] hover:underline"
                              >
                                + Crear primera presentación derivada
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {recipe.presentations.map((pres) => {
                                const activeQty = comboQtyOverride[pres.id] ?? pres.motherRecipeQty;
                                const isScaled = Math.abs(activeQty - pres.motherRecipeQty) > 0.001;
                                const scaleFactor = pres.motherRecipeQty > 0 ? activeQty / pres.motherRecipeQty : 1;

                                const baseConsumedCents = Math.round(recipe.costPerYieldUnit * activeQty);
                                const scaledPackagingCents = Math.round(pres.packagingCostCents * scaleFactor);
                                const scaledTotalCostCents = baseConsumedCents + scaledPackagingCents;

                                const scaledSuggestedCents =
                                  pres.pricingMethod === "MARKUP"
                                    ? Math.ceil(scaledTotalCostCents * (1 + pres.desiredMarginPercent / 100))
                                    : pres.desiredMarginPercent < 100
                                      ? Math.ceil(scaledTotalCostCents / (1 - pres.desiredMarginPercent / 100))
                                      : scaledTotalCostCents;

                                const activeFinalCents = isScaled ? scaledSuggestedCents : pres.finalPriceCents;
                                const activeProfitCents = activeFinalCents - scaledTotalCostCents;
                                const activeMarginPercent =
                                  activeFinalCents > 0 ? ((activeFinalCents - scaledTotalCostCents) / activeFinalCents) * 100 : 0;

                                const isEditingThisPrice = editingPresId === pres.id;

                                return (
                                  <div
                                    key={pres.id}
                                    className="rounded-xl border border-[#E8E2D9] bg-white shadow-sm overflow-hidden flex flex-col justify-between"
                                  >
                                    <div>
                                      {/* Cabecera de la presentación */}
                                      <div className="px-4 py-3 bg-[#FAF5F7] border-b border-[#F3D5E2] flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <h4 className="text-sm font-bold text-[#4A3B32]">{pres.name}</h4>
                                          {pres.sizeDescription && (
                                            <p className="text-[11px] text-[#7D6E65] mt-0.5">{pres.sizeDescription}</p>
                                          )}

                                          {/* Escalador / Cantidad dinámica de Combo */}
                                          <div className="flex flex-wrap items-center gap-2 mt-2 bg-white/90 px-2.5 py-1.5 rounded-lg border border-[#F3D5E2]">
                                            <span className="text-[10px] font-semibold text-[#4A3B32]">
                                              Cant. Combo:
                                            </span>
                                            <input
                                              type="number"
                                              step="1"
                                              min="0.1"
                                              value={activeQty}
                                              onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                setComboQtyOverride((prev) => ({
                                                  ...prev,
                                                  [pres.id]: isNaN(v) || v <= 0 ? 0.1 : v,
                                                }));
                                              }}
                                              className="w-16 px-1.5 py-0.5 text-center text-xs font-bold rounded border border-[#9C4266] text-[#9C4266] bg-white tabular-nums"
                                            />
                                            <span className="text-[10px] text-[#7D6E65]">{pres.motherRecipeUnit}</span>
                                            {isScaled ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setComboQtyOverride((prev) => {
                                                    const copy = { ...prev };
                                                    delete copy[pres.id];
                                                    return copy;
                                                  })
                                                }
                                                className="text-[10px] font-semibold text-[#9C4266] hover:underline ml-auto"
                                                title="Restablecer a cantidad base"
                                              >
                                                ↺ Base ({pres.motherRecipeQty})
                                              </button>
                                            ) : (
                                              <span className="text-[10px] text-[#7D6E65] tabular-nums ml-auto">
                                                ({pres.presentationYield.toFixed(1)} pres/lote)
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleOpenEditPresentation(recipe, pres)}
                                            title="Editar presentación, materiales, cantidades y costos"
                                            className="p-1 text-[#7D6E65] hover:text-[#9C4266] hover:bg-white rounded transition-colors"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeletePresentation(pres.id, pres.name)}
                                            title="Desactivar presentación"
                                            className="p-1 text-[#A89F91] hover:text-[#C53030] hover:bg-white rounded transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Tabla estilo Excel de la Presentación */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[11px]">
                                          <thead>
                                            <tr className="bg-[#FAF8F6] text-[#7D6E65] border-b border-[#E8E2D9] font-semibold">
                                              <th className="py-1.5 px-3">Concepto</th>
                                              <th className="py-1.5 px-2 text-right">C. Unit</th>
                                              <th className="py-1.5 px-2 text-right">Cant.</th>
                                              <th className="py-1.5 px-3 text-right">Importe</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#E8E2D9]/60">
                                            {/* Fila base derivada de la receta madre */}
                                            <tr className="bg-[#FAF5F7]/30 font-medium">
                                              <td className="py-1.5 px-3 text-[#9C4266]">Base: {recipe.name.split(" ")[0]}</td>
                                              <td className="py-1.5 px-2 text-right text-[#7D6E65] tabular-nums">
                                                RD$ {(recipe.costPerYieldUnit / 100).toFixed(2)}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-[#4A3B32] tabular-nums">
                                                {Number(activeQty.toFixed(2))}
                                              </td>
                                              <td className="py-1.5 px-3 text-right font-semibold text-[#4A3B32] tabular-nums">
                                                {formatDOP(baseConsumedCents)}
                                              </td>
                                            </tr>

                                            {/* Materiales / Empaques específicos escalados automáticamente */}
                                            {pres.materials && pres.materials.length > 0 ? (
                                              pres.materials.map((mat) => {
                                                const scaledQty = Number((mat.quantity * scaleFactor).toFixed(2));
                                                const scaledMatCents = Math.round(mat.totalCostCents * scaleFactor);
                                                return (
                                                  <tr key={mat.id}>
                                                    <td className="py-1.5 px-3 text-[#4A3B32]">{mat.name}</td>
                                                    <td className="py-1.5 px-2 text-right text-[#7D6E65] tabular-nums">
                                                      RD$ {(mat.unitCostCents / 100).toFixed(2)}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right text-[#4A3B32] tabular-nums">
                                                      {scaledQty}
                                                    </td>
                                                    <td className="py-1.5 px-3 text-right text-[#4A3B32] tabular-nums">
                                                      {formatDOP(scaledMatCents)}
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            ) : scaledPackagingCents > 0 ? (
                                              <tr>
                                                <td className="py-1.5 px-3 text-[#4A3B32]">Empaques / Materiales</td>
                                                <td className="py-1.5 px-2 text-right text-[#7D6E65]">-</td>
                                                <td className="py-1.5 px-2 text-right text-[#4A3B32] tabular-nums">
                                                  {Number(scaleFactor.toFixed(2))}
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-[#4A3B32] tabular-nums">
                                                  {formatDOP(scaledPackagingCents)}
                                                </td>
                                              </tr>
                                            ) : null}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Pie Financiero de la Presentación */}
                                    <div className="p-3 bg-[#FAF8F6] border-t border-[#E8E2D9] space-y-1.5 text-xs">
                                      <div className="flex justify-between text-[11px] text-[#7D6E65]">
                                        <span>Base ({formatDOP(baseConsumedCents)}) + Adic. ({formatDOP(scaledPackagingCents)})</span>
                                        {isScaled && (
                                          <span className="font-semibold text-[#9C4266] tabular-nums">
                                            Escala {scaleFactor.toFixed(2)}×
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex justify-between text-[#4A3B32]">
                                        <span className="font-semibold">Costo Total Presentación:</span>
                                        <span className="font-bold tabular-nums">{formatDOP(scaledTotalCostCents)}</span>
                                      </div>

                                      <div className="flex justify-between text-[11px] text-[#7D6E65]">
                                        <span>
                                          Sugerido ({pres.desiredMarginPercent}% {pres.pricingMethod === "MARKUP" ? "Recargo" : "Margen"}):
                                        </span>
                                        <span className="tabular-nums">{formatDOP(scaledSuggestedCents)}</span>
                                      </div>

                                      <div className="pt-1.5 border-t border-[#E8E2D9] flex items-center justify-between gap-2">
                                        <span className="font-semibold text-[#4A3B32]">
                                          {isScaled ? "Precio Combo Escalado:" : "Precio Venta:"}
                                        </span>
                                        {!isScaled && isEditingThisPrice ? (
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="5"
                                              min="1"
                                              value={editingPresPriceDOP}
                                              onChange={(e) => setEditingPresPriceDOP(parseFloat(e.target.value) || 0)}
                                              className="w-20 px-1.5 py-0.5 text-right text-xs font-bold rounded border border-[#9C4266] bg-white tabular-nums"
                                            />
                                            <button
                                              onClick={() => handleSaveInlinePresPrice(pres.id)}
                                              className="p-1 bg-[#22543D] text-white rounded hover:bg-[#1A4331]"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => setEditingPresId(null)}
                                              className="p-1 bg-[#E8E2D9] text-[#7D6E65] rounded"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : isScaled ? (
                                          <span className="text-sm font-bold text-[#9C4266] tabular-nums">
                                            {formatDOP(activeFinalCents)}
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setEditingPresId(pres.id);
                                              setEditingPresPriceDOP(pres.finalPriceCents / 100);
                                            }}
                                            className="inline-flex items-center gap-1 text-sm font-bold text-[#9C4266] hover:underline tabular-nums"
                                            title="Clic para ajustar precio final de venta"
                                          >
                                            <span>{formatDOP(activeFinalCents)}</span>
                                            <Edit2 className="w-3 h-3 opacity-60" />
                                          </button>
                                        )}
                                      </div>

                                      <div className="flex justify-between items-center text-[11px] pt-0.5">
                                        <span className="text-[#22543D] font-semibold tabular-nums">
                                          Ganancia: {formatDOP(activeProfitCents)}
                                        </span>
                                        <span
                                          className={`font-bold px-1.5 py-0.5 rounded tabular-nums ${
                                            activeMarginPercent < 25
                                              ? "bg-[#FED7D7] text-[#9B2C2C]"
                                              : "bg-[#C6F6D5]/60 text-[#22543D]"
                                          }`}
                                        >
                                          {activeMarginPercent.toFixed(1)}% Margen Real
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL CREAR / EDITAR RECETA MADRE */}
        {isRecipeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif font-bold text-[#4A3B32] mb-1">
                {editingRecipeId ? "Editar Receta Madre" : "Nueva Receta Madre / Base"}
              </h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                Define ingredientes, gastos de producción, mano de obra, ganancia base y rendimiento. Al guardar se recalcularán todas las presentaciones derivadas.
              </p>

              <form onSubmit={handleSaveRecipe} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre de la Receta *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Producción de Brownie"
                      value={recipeForm.name}
                      onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Tipo</label>
                    <select
                      value={recipeForm.recipeType}
                      onChange={(e) => setRecipeForm({ ...recipeForm, recipeType: e.target.value as RecipeType })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="MOTHER">Receta Madre</option>
                      <option value="SUBRECIPE">Subreceta (Crema/Tope)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Descripción</label>
                  <input
                    type="text"
                    placeholder="Notas sobre el rendimiento o preparación..."
                    value={recipeForm.description}
                    onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Rendimiento *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      required
                      value={recipeForm.yieldQty}
                      onChange={(e) => setRecipeForm({ ...recipeForm, yieldQty: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Unidad</label>
                    <select
                      value={recipeForm.yieldUnit}
                      onChange={(e) => setRecipeForm({ ...recipeForm, yieldUnit: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="porciones">Porciones</option>
                      <option value="unidades">Unidades</option>
                      <option value="g">Gramos (g)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Gas/Mat. (%)</label>
                    <input
                      type="number"
                      min="0"
                      value={recipeForm.overheadPercent}
                      onChange={(e) => setRecipeForm({ ...recipeForm, overheadPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Mano Obra (%)</label>
                    <input
                      type="number"
                      min="0"
                      value={recipeForm.laborPercent}
                      onChange={(e) => setRecipeForm({ ...recipeForm, laborPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Gan. Base (%)</label>
                    <input
                      type="number"
                      min="0"
                      value={recipeForm.targetMargin}
                      onChange={(e) => setRecipeForm({ ...recipeForm, targetMargin: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                </div>

                {/* Lista de Ingredientes */}
                <div className="p-4 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A3B32]">Ingredientes de la Receta Madre</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableIngredients.length === 0) return;
                        const first = availableIngredients[0];
                        setRecipeForm({
                          ...recipeForm,
                          ingredients: [
                            ...recipeForm.ingredients,
                            {
                              ingredientId: first.id,
                              quantity: 1,
                              unit: first.baseUnit,
                              costCents: Math.round(first.costPerBaseUnit * 1 * 100),
                            },
                          ],
                        });
                      }}
                      className="text-xs font-semibold text-[#9C4266] hover:underline"
                    >
                      + Agregar Ingrediente
                    </button>
                  </div>

                  {recipeForm.ingredients.length === 0 ? (
                    <p className="text-[11px] text-[#7D6E65] text-center py-2">
                      Haz clic en &ldquo;+ Agregar Ingrediente&rdquo; para componer la receta.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {recipeForm.ingredients.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={item.ingredientId}
                            onChange={(e) => {
                              const found = availableIngredients.find((a) => a.id === e.target.value);
                              if (!found) return;
                              const next = [...recipeForm.ingredients];
                              next[idx] = {
                                ...next[idx],
                                ingredientId: found.id,
                                unit: found.baseUnit,
                                costCents: Math.round(found.costPerBaseUnit * next[idx].quantity * 100),
                              };
                              setRecipeForm({ ...recipeForm, ingredients: next });
                            }}
                            className="col-span-6 px-2 py-1.5 text-xs rounded border border-[#E8E2D9] bg-white"
                          >
                            {availableIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} (RD$ {ing.costPerBaseUnit.toFixed(2)}/{ing.baseUnit})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              const found = availableIngredients.find((a) => a.id === item.ingredientId);
                              const next = [...recipeForm.ingredients];
                              next[idx] = {
                                ...next[idx],
                                quantity: q,
                                costCents: found ? Math.round(found.costPerBaseUnit * q * 100) : item.costCents,
                              };
                              setRecipeForm({ ...recipeForm, ingredients: next });
                            }}
                            className="col-span-3 px-2 py-1.5 text-xs rounded border border-[#E8E2D9] tabular-nums"
                          />
                          <div className="col-span-2 text-right text-xs font-bold text-[#4A3B32] tabular-nums">
                            {formatDOP(item.costCents)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = recipeForm.ingredients.filter((_, i) => i !== idx);
                              setRecipeForm({ ...recipeForm, ingredients: next });
                            }}
                            className="col-span-1 text-[#C53030] flex justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resumen en vivo estilo Excel */}
                  <div className="pt-3 mt-2 border-t border-[#E8E2D9] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#7D6E65] block">Ingredientes:</span>
                      <strong className="text-[#4A3B32] tabular-nums">{formatDOP(modalIngTotalCents)}</strong>
                    </div>
                    <div>
                      <span className="text-[#7D6E65] block">SubTotal Real:</span>
                      <strong className="text-[#4A3B32] tabular-nums">{formatDOP(modalBatchRealCents)}</strong>
                    </div>
                    <div>
                      <span className="text-[#7D6E65] block">Costo x {recipeForm.yieldUnit}:</span>
                      <strong className="text-[#9C4266] tabular-nums">
                        RD$ {((modalBatchRealCents / Math.max(recipeForm.yieldQty, 0.1)) / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#7D6E65] block">Total c/ Gan. Base:</span>
                      <strong className="text-[#22543D] tabular-nums">{formatDOP(modalTotalWithGainCents)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E2D9]">
                  <button
                    type="button"
                    onClick={() => setIsRecipeModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#7D6E65]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#9C4266] text-white hover:bg-[#833554]"
                  >
                    {editingRecipeId ? "Guardar y Recalcular Cascada" : "Guardar Receta Madre"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CREAR / EDITAR PRESENTACIÓN DERIVADA */}
        {isPresModalOpen && selectedMotherRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setIsPresModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif font-bold text-[#4A3B32] mb-1">
                {editingPresRecordId ? "Editar Presentación Derivada" : "Nueva Presentación Derivada"}
              </h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                Derivando de <strong>{selectedMotherRecipe.name}</strong> (Costo Real: RD$ {(selectedMotherRecipe.costPerYieldUnit / 100).toFixed(2)}/{selectedMotherRecipe.yieldUnit})
              </p>

              <form onSubmit={handleSavePresentation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre Presentación *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Mini Brownies (Caja 25)"
                      value={presForm.name}
                      onChange={(e) => setPresForm({ ...presForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Tamaño / Contenido</label>
                    <input
                      type="text"
                      placeholder="Ej. Caja con 25 mini porciones"
                      value={presForm.sizeDescription}
                      onChange={(e) => setPresForm({ ...presForm, sizeDescription: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9]">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                      Cantidad Receta Madre que consume ({selectedMotherRecipe.yieldUnit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={presForm.motherRecipeQty}
                      onChange={(e) => setPresForm({ ...presForm, motherRecipeQty: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9] bg-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#7D6E65] mb-1">
                      O calcular por división del lote:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 6, 12, selectedMotherRecipe.yield].map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPresForm({ ...presForm, motherRecipeQty: q })}
                          className="px-2 py-1 text-[11px] bg-white border border-[#E8E2D9] rounded hover:border-[#9C4266] text-[#4A3B32] font-medium tabular-nums"
                        >
                          {q === selectedMotherRecipe.yield ? `1 Lote (${q})` : `${q} ${selectedMotherRecipe.yieldUnit.slice(0, 4)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Materiales y Empaques */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#4A3B32]">
                      Empaques, Toppings y Productos Adicionales ({presForm.materials.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {availableIngredients.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const found = availableIngredients.find((a) => a.id === e.target.value);
                            if (!found) return;
                            const unitCostDOP = Number(found.costPerBaseUnit.toFixed(4));
                            setPresForm({
                              ...presForm,
                              materials: [
                                ...presForm.materials,
                                {
                                  ingredientId: found.id,
                                  name: found.name,
                                  quantity: 1,
                                  unit: found.baseUnit,
                                  unitCostDOP,
                                  totalCostCents: Math.round(unitCostDOP * 1 * 100),
                                },
                              ],
                            });
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-[#E8E2D9] bg-white text-[#4A3B32] max-w-[170px]"
                        >
                          <option value="">+ Del Catálogo...</option>
                          {availableIngredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} (RD$ {ing.costPerBaseUnit.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPresForm({
                            ...presForm,
                            materials: [
                              ...presForm.materials,
                              { name: "Nuevo Producto", quantity: 1, unit: "unidad", unitCostDOP: 25, totalCostCents: 2500 },
                            ],
                          })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#9C4266] text-[#9C4266] rounded hover:bg-[#FAF5F7]"
                      >
                        + Producto Manual
                      </button>
                    </div>
                  </div>

                  {presForm.materials.length === 0 ? (
                    <p className="text-[11px] text-[#7D6E65] text-center py-2">
                      Sin materiales adicionales. Agrega del catálogo o crea un producto manual.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      <div className="grid grid-cols-12 gap-1.5 text-[10px] font-semibold text-[#7D6E65] uppercase px-0.5">
                        <span className="col-span-5">Concepto / Producto</span>
                        <span className="col-span-2 text-right">C. Unit (RD$)</span>
                        <span className="col-span-2 text-right">Cant.</span>
                        <span className="col-span-2 text-right">Importe</span>
                        <span className="col-span-1"></span>
                      </div>
                      {presForm.materials.map((m, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                          <input
                            type="text"
                            placeholder="Nombre del producto"
                            value={m.name}
                            onChange={(e) => {
                              const next = [...presForm.materials];
                              next[idx].name = e.target.value;
                              setPresForm({ ...presForm, materials: next });
                            }}
                            className="col-span-5 px-2 py-1 text-xs rounded border border-[#E8E2D9] bg-white"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="C.Unit"
                            value={m.unitCostDOP}
                            onChange={(e) => {
                              const c = parseFloat(e.target.value) || 0;
                              const next = [...presForm.materials];
                              next[idx].unitCostDOP = c;
                              next[idx].totalCostCents = Math.round(c * next[idx].quantity * 100);
                              setPresForm({ ...presForm, materials: next });
                            }}
                            className="col-span-2 px-2 py-1 text-xs text-right rounded border border-[#E8E2D9] bg-white tabular-nums"
                          />
                          <input
                            type="number"
                            step="0.1"
                            min="0.01"
                            placeholder="Cant"
                            value={m.quantity}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              const next = [...presForm.materials];
                              next[idx].quantity = q;
                              next[idx].totalCostCents = Math.round(next[idx].unitCostDOP * q * 100);
                              setPresForm({ ...presForm, materials: next });
                            }}
                            className="col-span-2 px-2 py-1 text-xs text-right rounded border border-[#E8E2D9] bg-white tabular-nums"
                          />
                          <div className="col-span-2 text-right text-xs font-bold text-[#4A3B32] tabular-nums">
                            RD$ {(m.totalCostCents / 100).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPresForm({ ...presForm, materials: presForm.materials.filter((_, i) => i !== idx) })}
                            className="col-span-1 text-[#C53030] flex justify-center hover:bg-white rounded p-1"
                            title="Quitar producto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Método</label>
                    <select
                      value={presForm.pricingMethod}
                      onChange={(e) => setPresForm({ ...presForm, pricingMethod: e.target.value as PricingMethod })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="MARGIN">Margen sobre Venta</option>
                      <option value="MARKUP">Recargo sobre Costo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">% Deseado</label>
                    <input
                      type="number"
                      min="1"
                      max="95"
                      value={presForm.desiredMarginPercent}
                      onChange={(e) => setPresForm({ ...presForm, desiredMarginPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Precio Final (Opcional)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder={presPreview.suggestedPriceDOP.toFixed(0)}
                      value={presForm.finalPriceDOP || ""}
                      onChange={(e) => setPresForm({ ...presForm, finalPriceDOP: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                </div>

                {/* PREVIEW EN VIVO CON DESGLOSE TRANSPARENTE */}
                <div className="p-3.5 rounded-xl bg-[#FAF5F7] border border-[#F3D5E2] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4A3B32] pb-2 border-b border-[#F3D5E2]">
                    <span>
                      Base Receta ({presForm.motherRecipeQty} × RD$ {(selectedMotherRecipe.costPerYieldUnit / 100).toFixed(2)}):{" "}
                      <strong className="tabular-nums">RD$ {presPreview.baseCostDOP.toFixed(2)}</strong>
                    </span>
                    <span>
                      + Empaques/Adic.:{" "}
                      <strong className="tabular-nums">RD$ {presPreview.packagingCostDOP.toFixed(2)}</strong>
                    </span>
                    <span>
                      = Costo Total:{" "}
                      <strong className="text-[#9C4266] tabular-nums">RD$ {presPreview.totalCostDOP.toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-[#7D6E65] block uppercase font-semibold">Costo Total</span>
                      <span className="text-sm font-bold text-[#4A3B32] tabular-nums">
                        RD$ {presPreview.totalCostDOP.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#7D6E65] block uppercase font-semibold">Precio Sugerido</span>
                      <span className="text-sm font-bold text-[#9C4266] tabular-nums">
                        RD$ {presPreview.suggestedPriceDOP.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#7D6E65] block uppercase font-semibold">Ganancia / Margen</span>
                      <span className="text-sm font-bold text-[#22543D] tabular-nums">
                        RD$ {presPreview.profitDOP.toFixed(2)} ({presPreview.realMargin.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E2D9]">
                  <button
                    type="button"
                    onClick={() => setIsPresModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#7D6E65]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#9C4266] text-white hover:bg-[#833554]"
                  >
                    {editingPresRecordId ? "Guardar Cambios" : "Guardar Presentación"}
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

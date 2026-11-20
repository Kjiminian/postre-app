"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Plus,
  Search,
  AlertTriangle,
  Scale,
  Sparkles,
  X,
  Package,
  Edit2,
  Trash2,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";
import { calculateIngredientBaseCost } from "@/lib/ingredient-cost";
import { ItemCategory } from "@/types";

interface IngredientItem {
  id: string;
  code?: string | null;
  name: string;
  category: ItemCategory;
  supplierId?: string | null;
  supplierName?: string | null;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  factorId?: string | null;
  factorName?: string | null;
  conversionFactor?: number;
  costPerBaseUnit: number;
  density?: number | null;
  reviewFlag: boolean;
  isActive: boolean;
  notes?: string | null;
  importedFrom?: string | null;
}

interface SupplierItem {
  id: string;
  code?: string | null;
  name: string;
}

interface CategoryItem {
  id: string;
  code: string;
  slug: string;
  name: string;
}

interface UnitItem {
  id: string;
  code: string;
  symbol: string;
  name: string;
}

interface FactorItem {
  id: string;
  code?: string | null;
  name: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
}

export default function IngredientesPage() {
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [factors, setFactors] = useState<FactorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IngredientItem | null>(null);

  // Formulario nuevo/editar
  const [formData, setFormData] = useState({
    name: "",
    category: "INGREDIENT" as ItemCategory,
    supplierId: "",
    packagePriceDOP: 100,
    packageQty: 1,
    packageUnit: "unidad",
    baseUnit: "unidad",
    factorId: "",
    conversionFactor: "1",
    density: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resIng, resSup, resCat, resUni, resFac] = await Promise.all([
        fetch("/api/ingredientes?includeInactive=true"),
        fetch("/api/proveedores"),
        fetch("/api/categorias"),
        fetch("/api/unidades"),
        fetch("/api/conversiones"),
      ]);

      const [dataIng, dataSup, dataCat, dataUni, dataFac] = await Promise.all([
        resIng.json(),
        resSup.json(),
        resCat.json(),
        resUni.json(),
        resFac.json(),
      ]);

      if (dataIng.success) setIngredients(dataIng.data);
      else throw new Error(dataIng.error || "Error cargando productos");

      if (dataSup.success) setSuppliers(dataSup.data);
      else throw new Error(dataSup.error || "Error cargando suplidores");
      if (dataCat.success) setCategories(dataCat.data);
      else throw new Error(dataCat.error || "Error cargando categorías");
      if (dataUni.success) setUnits(dataUni.data);
      else throw new Error(dataUni.error || "Error cargando unidades");
      if (dataFac.success) setFactors(dataFac.data);
      else throw new Error(dataFac.error || "Error cargando factores");
    } catch (err: any) {
      setError(err.message || "Error al conectar con la base de datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cálculo en vivo del costo por unidad base
  const calcLiveCost = () => {
    const priceCents = Math.round((Number(formData.packagePriceDOP) || 0) * 100);
    const qty = Number(formData.packageQty) || 0;
    const factorNum = Number(formData.conversionFactor) || 0;
    const densityVal = formData.density ? Number(formData.density) : undefined;

    const baseResult = calculateIngredientBaseCost({
      packagePriceCents: priceCents,
      packageQty: qty,
      packageUnit: formData.packageUnit,
      baseUnit: formData.baseUnit,
      conversionFactor: factorNum,
      hasExplicitFactor: Boolean(formData.factorId) || factorNum !== 1,
      density: densityVal,
    });

    if (!baseResult.ok) {
      return { costFormatted: "—", effectiveQty: 0, error: baseResult.error };
    }

    return {
      costFormatted: `RD$ ${baseResult.costPerBaseUnit.toFixed(4)} por ${formData.baseUnit}`,
      effectiveQty: baseResult.effectiveBaseQty,
      costRaw: baseResult.costPerBaseUnit,
      error: null,
    };
  };

  const livePreview = calcLiveCost();

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: (selectedCategory !== "ALL" ? selectedCategory : categories[0]?.slug || "INGREDIENT") as ItemCategory,
      supplierId: "",
      packagePriceDOP: 100,
      packageQty: 1,
      packageUnit: "unidad",
      baseUnit: "unidad",
      factorId: "",
      conversionFactor: "1",
      density: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: IngredientItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      supplierId: item.supplierId || "",
      packagePriceDOP: item.packagePriceCents / 100,
      packageQty: item.packageQty,
      packageUnit: item.packageUnit,
      baseUnit: item.baseUnit,
      factorId: item.factorId || "",
      conversionFactor: String(item.conversionFactor ?? 1),
      density: item.density ? String(item.density) : "",
      notes: item.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const payload = {
      name: formData.name,
      category: formData.category,
      supplierId: formData.supplierId || null,
      packagePriceCents: Math.round(Number(formData.packagePriceDOP) * 100),
      packageQty: Number(formData.packageQty) || 1,
      packageUnit: formData.packageUnit,
      baseUnit: formData.baseUnit,
      factorId: formData.factorId || null,
      conversionFactor: Number(formData.conversionFactor) || 1,
      density: formData.density ? Number(formData.density) : null,
      notes: formData.notes,
    };

    try {
      if (editingItem) {
        const res = await fetch("/api/ingredientes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/ingredientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    }
  };

  const handleToggleActive = async (item: IngredientItem) => {
    try {
      const res = await fetch("/api/ingredientes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "No se pudo actualizar el estado");
      }
      loadData();
    } catch (err: any) {
      alert("Error al actualizar estado: " + err.message);
    }
  };

  const getCategoryLabel = (slug: string) => {
    const found = categories.find((c) => c.slug === slug);
    if (found) return found.name;
    const fallbacks: Record<string, string> = {
      INGREDIENT: "Ingrediente",
      PACKAGING: "Empaque",
      DECORATION: "Decoración",
      UTENSIL: "Utensilio",
    };
    return fallbacks[slug] || slug;
  };

  const parseCodeNumber = (code?: string | null) => {
    const match = code?.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const filtered = ingredients
    .filter((ing) => {
      const q = search.toLowerCase();
      const matchesSearch =
        ing.name.toLowerCase().includes(q) ||
        (ing.code && ing.code.toLowerCase().includes(q)) ||
        (ing.supplierName && ing.supplierName.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === "ALL" || ing.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => parseCodeNumber(b.code) - parseCodeNumber(a.code));

  const categoryOrder =
    categories.length > 0
      ? categories.map((c) => c.slug)
      : ["INGREDIENT", "PACKAGING", "DECORATION", "UTENSIL"];

  const groupedMap = new Map<string, IngredientItem[]>();
  for (const item of filtered) {
    const list = groupedMap.get(item.category) || [];
    list.push(item);
    groupedMap.set(item.category, list);
  }

  const orderedCategoryKeys = [
    ...categoryOrder.filter((slug) => groupedMap.has(slug)),
    ...Array.from(groupedMap.keys()).filter((slug) => !categoryOrder.includes(slug)),
  ];

  const groupedSections = orderedCategoryKeys.map((slug) => ({
    slug,
    label: getCategoryLabel(slug),
    items: groupedMap.get(slug) || [],
  }));

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabecera del módulo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <UtensilsCrossed className="w-4 h-4" />
              <span>Inventario y Mantenimiento</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Insumos, Empaques y Decoración
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Administra precios de compra, cantidades de empaque y cálculo exacto de costo por unidad base.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <Link
              href="/actualizacion-precios"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-[#E8E2D9] text-[#4A3B32] text-sm font-medium hover:bg-[#FAF8F6] hover:border-[#9C4266]/40 shadow-sm transition-all"
            >
              <TrendingUp className="w-4 h-4 text-[#9C4266]" />
              <span>Actualizar precios</span>
            </Link>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white rounded-xl p-4 border border-[#E8E2D9] shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
            <input
              type="text"
              placeholder="Buscar por nombre, suplidor o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#FAF8F6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "ALL", label: "Todos" },
              ...(categories.length > 0
                ? categories.map((c) => ({ id: c.slug, label: c.name }))
                : [
                    { id: "INGREDIENT", label: "Ingredientes" },
                    { id: "PACKAGING", label: "Empaques" },
                    { id: "DECORATION", label: "Decoración" },
                    { id: "UTENSIL", label: "Utensilios" },
                  ]),
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[#9C4266] text-white"
                    : "bg-[#FAF8F6] text-[#7D6E65] hover:bg-[#F3EFEA]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 ESTADOS DE INTERFAZ: LOADING, ERROR, EMPTY, DATA */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#4A3B32]">Cargando inventario persistente...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center">
            <AlertTriangle className="w-8 h-8 text-[#E53E3E] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg hover:bg-[#C53030]"
            >
              Reintentar Conexión
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <Package className="w-10 h-10 text-[#C4B5A5] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#4A3B32]">No se encontraron registros</h3>
            <p className="text-xs text-[#7D6E65] max-w-sm mx-auto mt-1">
              No hay elementos que coincidan con los criterios de búsqueda o categoría seleccionada.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-[#9C4266] text-white text-xs font-medium rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Nuevo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSections.map((section) => {
              const isCollapsed = Boolean(collapsedSections[section.slug]);
              return (
                <section
                  key={section.slug}
                  className="bg-white rounded-xl border border-[#E8E2D9] shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedSections((prev) => ({
                        ...prev,
                        [section.slug]: !prev[section.slug],
                      }))
                    }
                    className="w-full px-4 py-3 bg-[#FAF8F6] border-b border-[#E8E2D9] flex items-center justify-between text-left hover:bg-[#F3EFEA]/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-[#9C4266]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#9C4266]" />
                      )}
                      <h2 className="font-serif font-bold text-base text-[#4A3B32]">
                        {section.label}
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F3EFEA] text-[#9C4266] tabular-nums">
                        {section.items.length}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#7D6E65] font-medium">
                      Orden: ID descendente
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#FAF8F6]/60 border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                            <th className="py-3 px-4">ID</th>
                            <th className="py-3 px-4">Nombre / Producto</th>
                            <th className="py-3 px-4">Categoría</th>
                            <th className="py-3 px-4">Suplidor</th>
                            <th className="py-3 px-4">Presentación Compra</th>
                            <th className="py-3 px-4">Costo x Unidad Base</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8E2D9] text-sm">
                          {section.items.map((item) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-[#FAF8F6]/80 transition-colors ${
                                !item.isActive ? "opacity-60 bg-[#F3EFEA]/50" : ""
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F3EFEA] text-[#9C4266]">
                                  {item.code || item.id.slice(0, 8)}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-[#4A3B32]">
                                <div className="flex items-center gap-2">
                                  <span>{item.name}</span>
                                  {item.reviewFlag && (
                                    <span
                                      title={item.notes || "Dato importado con alerta"}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEFCBF] text-[#744210]"
                                    >
                                      Revisión
                                    </span>
                                  )}
                                </div>
                                {item.importedFrom && (
                                  <span className="text-[10px] text-[#A89F91] block">
                                    Origen: {item.importedFrom}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F3EFEA] text-[#7D6E65]">
                                  {getCategoryLabel(item.category)}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-[#7D6E65]">
                                {item.supplierName || "—"}
                              </td>
                              <td className="py-3.5 px-4 text-[#4A3B32] tabular-nums">
                                <div className="font-medium">{formatDOP(item.packagePriceCents)}</div>
                                <div className="text-xs text-[#7D6E65] flex items-center gap-1.5 flex-wrap">
                                  <span>
                                    por {item.packageQty} {item.packageUnit}
                                  </span>
                                  {(item.conversionFactor && item.conversionFactor !== 1) || item.factorName ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#FAF5F7] text-[#9C4266] border border-[#F3D5E2]">
                                      Factor ×{item.conversionFactor ?? 1}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-[#9C4266] font-semibold tabular-nums">
                                RD$ {(item.costPerBaseUnit).toFixed(4)} / {item.baseUnit}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    item.isActive
                                      ? "bg-[#C6F6D5] text-[#22543D]"
                                      : "bg-[#FED7D7] text-[#742A2A]"
                                  }`}
                                >
                                  {item.isActive ? "Activo" : "Inactivo"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenEdit(item)}
                                    title="Editar insumo"
                                    className="p-1.5 text-[#7D6E65] hover:text-[#9C4266] rounded hover:bg-[#F3EFEA] transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleToggleActive(item)}
                                    title={item.isActive ? "Desactivar" : "Reactivar"}
                                    className="p-1.5 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#F3EFEA] transition-colors"
                                  >
                                    {item.isActive ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* MODAL CREAR / EDITAR */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-serif font-bold text-[#4A3B32]">
                  {editingItem ? "Editar Producto / Insumo" : "Nuevo Producto / Insumo"}
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F3EFEA] text-[#9C4266]">
                  {editingItem ? editingItem.code || editingItem.id.slice(0, 8) : "PROD-XXX"}
                </span>
              </div>
              <p className="text-xs text-[#7D6E65] mb-5">
                Ingresa el costo del empaque comercial y su factor de conversión para calcular automáticamente el costo por unidad base.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Cobertura de chocolate blanca"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Categoría</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266] bg-white"
                    >
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <option key={c.id} value={c.slug}>
                            {c.name} ({c.code})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="INGREDIENT">Ingrediente</option>
                          <option value="PACKAGING">Empaque</option>
                          <option value="DECORATION">Decoración</option>
                          <option value="UTENSIL">Utensilio</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Suplidor</label>
                    <select
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266] bg-white"
                    >
                      <option value="">(Sin suplidor asignado)</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] space-y-3">
                  <div className="text-xs font-semibold text-[#4A3B32] flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[#9C4266]" />
                    <span>Presentación Comercial de Compra</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Precio (RD$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.packagePriceDOP}
                        onChange={(e) => setFormData({ ...formData, packagePriceDOP: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formData.packageQty}
                        onChange={(e) => setFormData({ ...formData, packageQty: parseFloat(e.target.value) || 1 })}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Unidad</label>
                      <select
                        value={formData.packageUnit}
                        onChange={(e) => setFormData({ ...formData, packageUnit: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      >
                        {units.length > 0 ? (
                          units.map((u) => (
                            <option key={u.id} value={u.symbol}>
                              {u.name} ({u.symbol})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="unidad">unidad</option>
                            <option value="g">gramos (g)</option>
                            <option value="kg">kilos (kg)</option>
                            <option value="lb">libras (lb)</option>
                            <option value="oz">onzas (oz)</option>
                            <option value="ml">mililitros (ml)</option>
                            <option value="l">litros (l)</option>
                            <option value="yarda">yarda</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Unidad Base para Recetas</label>
                      <select
                        value={formData.baseUnit}
                        onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      >
                        {units.length > 0 ? (
                          units.map((u) => (
                            <option key={u.id} value={u.symbol}>
                              {u.name} ({u.symbol})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="unidad">unidad</option>
                            <option value="g">gramo (g)</option>
                            <option value="ml">mililitro (ml)</option>
                            <option value="yarda">yarda</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">
                        Densidad (g/ml) <span className="text-[#A89F91]">opcional</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ej. 1.07"
                        value={formData.density}
                        onChange={(e) => setFormData({ ...formData, density: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN DE FACTOR */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9] space-y-2.5">
                  <div className="text-xs font-semibold text-[#4A3B32] flex items-center justify-between">
                    <span>Sección de Factor de Conversión</span>
                    <span className="text-[10px] font-normal text-[#7D6E65]">
                      Cantidad × Factor = Base ({formData.baseUnit})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Factor del Catálogo (opcional)</label>
                      <select
                        value={formData.factorId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const found = factors.find((f) => f.id === selectedId);
                          setFormData({
                            ...formData,
                            factorId: selectedId,
                            conversionFactor: found ? String(found.factor) : "1",
                          });
                        }}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      >
                        <option value="">(Conversión estándar / manual)</option>
                        {factors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.code ? `[${f.code}] ` : ""}
                            {f.name} (1 {f.fromUnit} = {f.factor} {f.toUnit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#7D6E65] mb-1">Factor (&gt; 0)</label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        required
                        value={formData.conversionFactor}
                        onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                  </div>
                </div>

                {/* Previsualización en vivo */}
                <div className="p-3 rounded-lg bg-[#FAF5F7] border border-[#F3D5E2] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[#7D6E65] block font-medium">
                      Costo unitario calculado
                      {livePreview.effectiveQty > 0
                        ? ` (${livePreview.effectiveQty.toFixed(2)} ${formData.baseUnit} efectivos)`
                        : ""}:
                    </span>
                    <span className="text-sm font-bold text-[#9C4266]">{livePreview.costFormatted}</span>
                    {livePreview.error && (
                      <span className="block text-[11px] text-[#C53030] mt-0.5">{livePreview.error}</span>
                    )}
                  </div>
                  <Sparkles className="w-5 h-5 text-[#9C4266]" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Notas u observaciones</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Detalles sobre presentación o conservación..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-[#7D6E65] hover:bg-[#FAF8F6] rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-[#9C4266] text-white rounded-lg hover:bg-[#833554] shadow-sm transition-all"
                  >
                    {editingItem ? "Actualizar" : "Guardar Insumo"}
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

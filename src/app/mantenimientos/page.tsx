"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Plus,
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Tag,
  Ruler,
  Calculator,
  Users,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

type TabKey = "SUPPLIERS" | "CATEGORIES" | "UNITS" | "FACTORS" | "CUSTOMERS";

interface SupplierRow {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { ingredients: number };
}

interface CategoryRow {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface UnitRow {
  id: string;
  code: string;
  symbol: string;
  name: string;
  unitType: string;
  isActive: boolean;
}

interface FactorRow {
  id: string;
  code: string | null;
  name: string;
  category: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  ingredient: string | null;
  notes: string | null;
  isActive: boolean;
}

interface CustomerRow {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { sales: number };
}

const TABS: { key: TabKey; label: string; endpoint: string; prefix: string; singular: string; icon: any }[] = [
  { key: "SUPPLIERS", label: "Suplidores", endpoint: "/api/proveedores", prefix: "SUP", singular: "Suplidor", icon: Truck },
  { key: "CATEGORIES", label: "Categorías", endpoint: "/api/categorias", prefix: "CAT", singular: "Categoría", icon: Tag },
  { key: "UNITS", label: "Unidades", endpoint: "/api/unidades", prefix: "UNI", singular: "Unidad", icon: Ruler },
  { key: "FACTORS", label: "Factores", endpoint: "/api/conversiones", prefix: "FAC", singular: "Factor", icon: Calculator },
  { key: "CUSTOMERS", label: "Clientes", endpoint: "/api/clientes", prefix: "CLI", singular: "Cliente", icon: Users },
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  MASS: "Masa",
  VOLUME: "Volumen",
  COUNT: "Conteo / Unidad",
  OTHER: "Otro",
};

export default function MantenimientosPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("SUPPLIERS");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [factors, setFactors] = useState<FactorRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    description: "",
    symbol: "",
    unitType: "MASS",
    category: "GENERAL",
    fromUnit: "",
    toUnit: "",
    factor: "1",
    ingredient: "",
  });

  const currentTabConfig = TABS.find((t) => t.key === activeTab)!;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSup, resCat, resUni, resFac, resCli] = await Promise.all([
        fetch("/api/proveedores?includeInactive=true"),
        fetch("/api/categorias?includeInactive=true"),
        fetch("/api/unidades?includeInactive=true"),
        fetch("/api/conversiones?includeInactive=true"),
        fetch("/api/clientes?includeInactive=true"),
      ]);
      const [dSup, dCat, dUni, dFac, dCli] = await Promise.all([
        resSup.json(),
        resCat.json(),
        resUni.json(),
        resFac.json(),
        resCli.json(),
      ]);

      if (!dSup.success) throw new Error(dSup.error || "Error cargando suplidores");
      if (!dCat.success) throw new Error(dCat.error || "Error cargando categorías");
      if (!dUni.success) throw new Error(dUni.error || "Error cargando unidades");
      if (!dFac.success) throw new Error(dFac.error || "Error cargando factores");
      if (!dCli.success) throw new Error(dCli.error || "Error cargando clientes");

      setSuppliers(dSup.data);
      setCategories(dCat.data);
      setUnits(dUni.data);
      setFactors(dFac.data);
      setCustomers(dCli.data);
    } catch (err: any) {
      setError(err.message || "Error al conectar con la base de datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      notes: "",
      description: "",
      symbol: "",
      unitType: "MASS",
      category: "GENERAL",
      fromUnit: units[0]?.symbol || "lb",
      toUnit: units[0]?.symbol || "g",
      factor: "1",
      ingredient: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (row: any) => {
    setEditingRecord(row);
    setForm({
      name: row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      notes: row.notes || "",
      description: row.description || "",
      symbol: row.symbol || "",
      unitType: row.unitType || "MASS",
      category: row.category || "GENERAL",
      fromUnit: row.fromUnit || "",
      toUnit: row.toUnit || "",
      factor: row.factor !== undefined ? String(row.factor) : "1",
      ingredient: row.ingredient || "",
    });
    setIsModalOpen(true);
  };

  const buildPayload = () => {
    const base = editingRecord ? { id: editingRecord.id } : {};
    switch (activeTab) {
      case "SUPPLIERS":
        return { ...base, name: form.name, phone: form.phone, notes: form.notes };
      case "CATEGORIES":
        return { ...base, name: form.name, description: form.description };
      case "UNITS":
        return { ...base, symbol: form.symbol, name: form.name, unitType: form.unitType };
      case "FACTORS":
        return {
          ...base,
          name: form.name,
          category: form.category,
          fromUnit: form.fromUnit,
          toUnit: form.toUnit,
          factor: Number(form.factor),
          ingredient: form.ingredient,
          notes: form.notes,
        };
      case "CUSTOMERS":
        return { ...base, name: form.name, phone: form.phone, email: form.email, notes: form.notes };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(currentTabConfig.endpoint, {
        method: editingRecord ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!json.success) {
        showToast("error", json.error || "No se pudo guardar el registro");
        return;
      }
      setIsModalOpen(false);
      showToast(
        "success",
        editingRecord
          ? `${currentTabConfig.singular} (${json.data?.code || editingRecord.code || ""}) actualizado.`
          : `${currentTabConfig.singular} creado con ID ${json.data?.code || "asignado"}.`
      );
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error de conexión al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: any) => {
    try {
      const res = await fetch(currentTabConfig.endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, isActive: !row.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast("error", json.error || "No se pudo cambiar el estado");
        return;
      }
      showToast("success", row.isActive ? "Registro desactivado." : "Registro reactivado.");
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Error al actualizar estado");
    }
  };

  const getActiveRows = (): any[] => {
    const map: Record<TabKey, any[]> = {
      SUPPLIERS: suppliers,
      CATEGORIES: categories,
      UNITS: units,
      FACTORS: factors,
      CUSTOMERS: customers,
    };
    const q = search.trim().toLowerCase();
    return map[activeTab].filter((row) => {
      if (!showInactive && !row.isActive) return false;
      if (!q) return true;
      const hay = [
        row.code,
        row.name,
        row.symbol,
        row.slug,
        row.phone,
        row.email,
        row.fromUnit,
        row.toUnit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  };

  const filteredRows = getActiveRows();

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F6]">
      <Header
        title="Mantenimientos Maestros"
        subtitle="Administra Suplidores, Categorías, Unidades, Factores y Clientes con ID identificador por registro"
      />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              feedback.type === "success"
                ? "bg-[#C6F6D5]/60 border-[#9AE6B4] text-[#22543D]"
                : "bg-[#FED7D7]/60 border-[#FEB2B2] text-[#742A2A]"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="p-1 rounded hover:bg-black/5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-[#E8E2D9] shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch("");
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#9C4266] text-white shadow-sm"
                    : "text-[#7D6E65] hover:bg-[#FAF8F6] hover:text-[#4A3B32]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Barra de búsqueda y acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E8E2D9] shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-[#A89F91] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar ${currentTabConfig.label.toLowerCase()} por ID o nombre...`}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-[#7D6E65] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-[#E8E2D9] text-[#9C4266] focus:ring-[#9C4266]"
              />
              Mostrar inactivos
            </label>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#9C4266] hover:bg-[#831843] text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo {currentTabConfig.singular}</span>
          </button>
        </div>

        {/* Contenido / 4 estados */}
        {loading ? (
          <div className="bg-white rounded-xl border border-[#E8E2D9] p-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-[#9C4266] animate-spin mx-auto" />
            <p className="text-sm text-[#7D6E65]">Cargando {currentTabConfig.label.toLowerCase()}...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-[#FEB2B2] p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#C53030] mx-auto" />
            <p className="text-sm font-semibold text-[#742A2A]">{error}</p>
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E2D9] p-12 text-center space-y-3">
            <Database className="w-9 h-9 text-[#A89F91] mx-auto" />
            <h3 className="text-base font-serif font-bold text-[#4A3B32]">
              No hay {currentTabConfig.label.toLowerCase()} registrados
            </h3>
            <p className="text-xs text-[#7D6E65] max-w-md mx-auto">
              Crea un nuevo registro para asignarle su ID identificador ({currentTabConfig.prefix}-001) y utilizarlo en todo el sistema.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9C4266] text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Crear {currentTabConfig.singular}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E8E2D9] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                    <th className="py-3 px-4">ID</th>
                    {activeTab === "SUPPLIERS" && (
                      <>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Notas</th>
                        <th className="py-3 px-4">Productos</th>
                      </>
                    )}
                    {activeTab === "CATEGORIES" && (
                      <>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Clave</th>
                        <th className="py-3 px-4">Descripción</th>
                      </>
                    )}
                    {activeTab === "UNITS" && (
                      <>
                        <th className="py-3 px-4">Símbolo</th>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Tipo</th>
                      </>
                    )}
                    {activeTab === "FACTORS" && (
                      <>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Conversión</th>
                        <th className="py-3 px-4">Factor</th>
                        <th className="py-3 px-4">Categoría</th>
                      </>
                    )}
                    {activeTab === "CUSTOMERS" && (
                      <>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Correo</th>
                        <th className="py-3 px-4">Ventas</th>
                      </>
                    )}
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-sm">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-[#FAF8F6]/80 transition-colors ${!row.isActive ? "opacity-60 bg-gray-50" : ""}`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F3EFEA] text-[#9C4266]">
                          {row.code || row.id.slice(0, 8)}
                        </span>
                      </td>

                      {activeTab === "SUPPLIERS" && (
                        <>
                          <td className="py-3.5 px-4 font-medium text-[#4A3B32]">{row.name}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{row.phone || "—"}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65] max-w-xs truncate">{row.notes || "—"}</td>
                          <td className="py-3.5 px-4 text-[#4A3B32] font-medium">{row._count?.ingredients ?? 0}</td>
                        </>
                      )}

                      {activeTab === "CATEGORIES" && (
                        <>
                          <td className="py-3.5 px-4 font-medium text-[#4A3B32]">{row.name}</td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[#7D6E65]">{row.slug}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{row.description || "—"}</td>
                        </>
                      )}

                      {activeTab === "UNITS" && (
                        <>
                          <td className="py-3.5 px-4 font-mono font-semibold text-[#4A3B32]">{row.symbol}</td>
                          <td className="py-3.5 px-4 font-medium text-[#4A3B32]">{row.name}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{UNIT_TYPE_LABELS[row.unitType] || row.unitType}</td>
                        </>
                      )}

                      {activeTab === "FACTORS" && (
                        <>
                          <td className="py-3.5 px-4 font-medium text-[#4A3B32]">{row.name}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">
                            1 {row.fromUnit} → {row.toUnit}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-[#9C4266]">× {row.factor}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{row.category}</td>
                        </>
                      )}

                      {activeTab === "CUSTOMERS" && (
                        <>
                          <td className="py-3.5 px-4 font-medium text-[#4A3B32]">{row.name}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{row.phone || "—"}</td>
                          <td className="py-3.5 px-4 text-[#7D6E65]">{row.email || "—"}</td>
                          <td className="py-3.5 px-4 text-[#4A3B32] font-medium">{row._count?.sales ?? 0}</td>
                        </>
                      )}

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            row.isActive ? "bg-[#C6F6D5] text-[#22543D]" : "bg-[#FED7D7] text-[#742A2A]"
                          }`}
                        >
                          {row.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(row)}
                            title="Editar"
                            className="p-1.5 text-[#7D6E65] hover:text-[#9C4266] rounded hover:bg-[#F3EFEA] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(row)}
                            title={row.isActive ? "Desactivar" : "Reactivar"}
                            className="p-1.5 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#F3EFEA] transition-colors"
                          >
                            {row.isActive ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL CREAR / EDITAR */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-serif font-bold text-[#4A3B32]">
                  {editingRecord ? `Editar ${currentTabConfig.singular}` : `Nuevo ${currentTabConfig.singular}`}
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F3EFEA] text-[#9C4266]">
                  {editingRecord ? editingRecord.code || editingRecord.id.slice(0, 8) : `${currentTabConfig.prefix}-XXX`}
                </span>
              </div>
              <p className="text-xs text-[#7D6E65] mb-5">
                {editingRecord
                  ? "El ID identificador se conserva automáticamente."
                  : `Se asignará un ID identificador único (${currentTabConfig.prefix}-XXX) al guardar.`}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === "UNITS" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Símbolo *</label>
                      <input
                        type="text"
                        required
                        value={form.symbol}
                        onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                        placeholder="Ej. kg, ml, caja"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Tipo *</label>
                      <select
                        value={form.unitType}
                        onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      >
                        <option value="MASS">Masa</option>
                        <option value="VOLUME">Volumen</option>
                        <option value="COUNT">Conteo / Unidad</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={
                      activeTab === "FACTORS"
                        ? "Ej. Saco 50 lb a gramos"
                        : activeTab === "UNITS"
                        ? "Ej. Kilogramo"
                        : "Nombre completo"
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                  />
                </div>

                {(activeTab === "SUPPLIERS" || activeTab === "CUSTOMERS") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="809-000-0000"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                      />
                    </div>
                    {activeTab === "CUSTOMERS" && (
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Correo electrónico</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="cliente@correo.com"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "CATEGORIES" && (
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Descripción</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Uso o alcance de esta categoría"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    />
                  </div>
                )}

                {activeTab === "FACTORS" && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Unidad Origen *</label>
                        <input
                          type="text"
                          required
                          value={form.fromUnit}
                          onChange={(e) => setForm({ ...form, fromUnit: e.target.value })}
                          placeholder="ej. lb"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Unidad Destino *</label>
                        <input
                          type="text"
                          required
                          value={form.toUnit}
                          onChange={(e) => setForm({ ...form, toUnit: e.target.value })}
                          placeholder="ej. g"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Factor (&gt;0) *</label>
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          required
                          value={form.factor}
                          onChange={(e) => setForm({ ...form, factor: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Categoría</label>
                        <select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        >
                          <option value="GENERAL">General</option>
                          <option value="MASS">Masa</option>
                          <option value="VOLUME">Volumen</option>
                          <option value="COUNT">Empaque / Conteo</option>
                          <option value="INGREDIENT">Ingrediente Específico</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Producto / Nota</label>
                        <input
                          type="text"
                          value={form.ingredient}
                          onChange={(e) => setForm({ ...form, ingredient: e.target.value })}
                          placeholder="Opcional"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                        />
                      </div>
                    </div>
                  </>
                )}

                {(activeTab === "SUPPLIERS" || activeTab === "CUSTOMERS" || activeTab === "FACTORS") && (
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Notas</label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Observaciones adicionales..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] focus:outline-none focus:ring-2 focus:ring-[#9C4266]"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-[#7D6E65] hover:bg-[#FAF8F6] rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-semibold text-white bg-[#9C4266] hover:bg-[#831843] rounded-lg shadow-sm disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : editingRecord ? "Guardar Cambios" : "Crear Registro"}
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

"use client";

import { useState, useEffect } from "react";
import {
  Scale,
  ArrowRightLeft,
  Sparkles,
  Edit2,
  Check,
  Plus,
  X,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { convertUnit } from "@/lib/conversions";

interface ConversionRef {
  id: string;
  name: string;
  category: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  ingredient?: string;
  isEditable: boolean;
  notes?: string;
}

export default function ConversionesPage() {
  const [conversions, setConversions] = useState<ConversionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculadora interactiva
  const [val, setVal] = useState<number>(1);
  const [fromUnit, setFromUnit] = useState<string>("lb");
  const [toUnit, setToUnit] = useState<string>("g");
  const [density, setDensity] = useState<number>(1.0);

  // Edición en línea
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFactor, setEditFactor] = useState<number>(1);

  // Modal nueva conversión
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "INGREDIENT",
    fromUnit: "taza",
    toUnit: "g",
    factor: 150,
    ingredient: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversiones");
      const json = await res.json();
      if (json.success) setConversions(json.data);
      else throw new Error(json.error);
    } catch (err: any) {
      setError(err.message || "Error cargando conversiones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const result = convertUnit(val, fromUnit, toUnit, density);

  const handleStartEdit = (ref: ConversionRef) => {
    setEditingId(ref.id);
    setEditFactor(ref.factor);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch("/api/conversiones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, factor: editFactor }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        loadData();
      } else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al actualizar: " + err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/conversiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        loadData();
      } else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al crear conversión: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Deseas eliminar esta equivalencia?")) return;
    try {
      const res = await fetch(`/api/conversiones?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) loadData();
      else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <Scale className="w-4 h-4" />
              <span>Metrología y Equivalencias</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Conversiones de Unidades y Densidades
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Conversiones exactas (1 lb = 453.59237 g), factores de densidad para volumen a masa y equivalencias editables del Excel.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Equivalencia</span>
          </button>
        </div>

        {/* CALCULADORA INTERACTIVA */}
        <div className="p-6 bg-white rounded-2xl border border-[#E8E2D9] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#9C4266]" />
            <h3 className="font-serif font-bold text-base text-[#4A3B32]">
              Calculadora Científica de Conversión
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">Cantidad</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={val}
                onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">Desde (Origen)</label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
              >
                <option value="lb">Libras (lb)</option>
                <option value="oz">Onzas (oz)</option>
                <option value="kg">Kilos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="taza">Tazas (taza)</option>
                <option value="cda">Cucharadas (cda)</option>
                <option value="ml">Mililitros (ml)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">Hacia (Destino)</label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
              >
                <option value="g">Gramos (g)</option>
                <option value="kg">Kilos (kg)</option>
                <option value="lb">Libras (lb)</option>
                <option value="oz">Onzas (oz)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="l">Litros (l)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7D6E65] mb-1">Densidad (g/ml)</label>
              <input
                type="number"
                step="0.01"
                value={density}
                onChange={(e) => setDensity(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF5F7] border border-[#F3D5E2] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#7D6E65] block font-medium">Resultado de la conversión:</span>
              <span className="text-lg font-bold text-[#9C4266] tabular-nums">
                {result.ok ? `${result.value.toFixed(4)} ${toUnit}` : result.error}
              </span>
            </div>
            <Sparkles className="w-5 h-5 text-[#9C4266]" />
          </div>
        </div>

        {/* TABLA DE EQUIVALENCIAS PERSISTENTES */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E8E2D9] flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-[#4A3B32]">
              Tabla de Factores y Equivalencias ({conversions.length})
            </h3>
            {error && (
              <button
                onClick={() => { setError(null); loadData(); }}
                className="text-xs text-[#9C4266] hover:underline flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-7 h-7 text-[#9C4266] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#7D6E65]">Cargando equivalencias...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-8 h-8 text-[#C53030] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#4A3B32] mb-1">Ocurrió un error al cargar las conversiones</p>
              <p className="text-xs text-[#7D6E65] mb-4">{error}</p>
              <button
                onClick={() => { setError(null); loadData(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9C4266] text-white text-xs font-medium hover:bg-[#833554]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar carga
              </button>
            </div>
          ) : conversions.length === 0 ? (
            <div className="p-12 text-center">
              <Scale className="w-8 h-8 text-[#A89F91] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#4A3B32] mb-1">No hay equivalencias registradas</p>
              <p className="text-xs text-[#7D6E65] mb-4">Puedes registrar factores personalizados para ingredientes o recipientes.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9C4266] text-white text-xs font-medium hover:bg-[#833554]"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar primera equivalencia
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                    <th className="py-3 px-4">Nombre / Equivalencia</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Destino</th>
                    <th className="py-3 px-4">Factor de Multiplicación</th>
                    <th className="py-3 px-4">Aplica A</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-sm">
                  {conversions.map((ref) => {
                    const isEditing = editingId === ref.id;
                    return (
                      <tr key={ref.id} className="hover:bg-[#FAF8F6]/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#4A3B32]">{ref.name}</td>
                        <td className="py-3 px-4 font-mono text-xs">{ref.fromUnit}</td>
                        <td className="py-3 px-4 font-mono text-xs">{ref.toUnit}</td>
                        <td className="py-3 px-4 font-bold text-[#9C4266] tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.0001"
                              value={editFactor}
                              onChange={(e) => setEditFactor(parseFloat(e.target.value) || 0)}
                              className="w-24 px-1.5 py-0.5 rounded border border-[#9C4266] bg-white text-xs"
                            />
                          ) : (
                            ref.factor
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#7D6E65]">
                          {ref.ingredient || "Estándar Universal"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(ref.id)}
                                  className="p-1 bg-[#22543D] text-white rounded hover:bg-[#1A4331]"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 bg-[#E8E2D9] text-[#7D6E65] rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              ref.isEditable && (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(ref)}
                                    className="p-1 text-[#7D6E65] hover:text-[#9C4266] rounded hover:bg-[#FAF8F6]"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(ref.id)}
                                    className="p-1 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#FAF8F6]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL NUEVA EQUIVALENCIA */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E8E2D9] relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-[#7D6E65]">
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-serif font-bold text-[#4A3B32] mb-1">Nueva Equivalencia</h3>
              <p className="text-xs text-[#7D6E65] mb-4">
                Define una relación personalizada (ej. 1 cucharada de azúcar = 15g).
              </p>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Taza de Harina Repostería"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Desde</label>
                    <input
                      type="text"
                      required
                      placeholder="taza"
                      value={formData.fromUnit}
                      onChange={(e) => setFormData({ ...formData, fromUnit: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Hacia</label>
                    <input
                      type="text"
                      required
                      placeholder="g"
                      value={formData.toUnit}
                      onChange={(e) => setFormData({ ...formData, toUnit: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Factor (Equivalente en destino)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.factor}
                    onChange={(e) => setFormData({ ...formData, factor: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-[#E8E2D9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Ingrediente específico (opcional)</label>
                  <input
                    type="text"
                    placeholder="Harina, Azúcar..."
                    value={formData.ingredient}
                    onChange={(e) => setFormData({ ...formData, ingredient: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E8E2D9]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 text-xs text-[#7D6E65]">
                    Cancelar
                  </button>
                  <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-[#9C4266] text-white rounded-lg">
                    Guardar
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

"use client";

import { useState, useEffect } from "react";
import {
  Receipt,
  Plus,
  Search,
  AlertTriangle,
  X,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface ExpenseItem {
  id: string;
  expenseDate: string;
  categoryId: string;
  category: { id: string; name: string };
  concept: string;
  baseAmountCents?: number | null;
  percentage?: number | null;
  amountCents: number;
  paymentMethod: string;
  isIngredientPurchase: boolean;
  notes?: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

export default function GastosPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    categoryId: "",
    concept: "",
    baseAmountDOP: 0,
    percentage: 10,
    paymentMethod: "EFECTIVO",
    isIngredientPurchase: false,
    notes: "",
  });

  const calculatedAmountCents = Math.round(
    Math.round((Number(formData.baseAmountDOP) || 0) * 100) * ((Number(formData.percentage) || 0) / 100)
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gastos");
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data.expenses);
        setCategories(json.data.categories);
        if (json.data.categories.length > 0 && !formData.categoryId) {
          setFormData((prev) => ({ ...prev, categoryId: json.data.categories[0].id }));
        }
      } else throw new Error(json.error);
    } catch (err: any) {
      setError(err.message || "Error cargando gastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.concept || formData.baseAmountDOP <= 0 || formData.percentage <= 0 || !formData.categoryId) return;

    try {
      const res = await fetch("/api/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: formData.categoryId,
          concept: formData.concept,
          baseAmountCents: Math.round(formData.baseAmountDOP * 100),
          percentage: Number(formData.percentage),
          expenseDate: formData.expenseDate,
          paymentMethod: formData.paymentMethod,
          isIngredientPurchase: formData.isIngredientPurchase,
          notes: formData.notes,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsModalOpen(false);
      setFormData((prev) => ({
        ...prev,
        concept: "",
        baseAmountDOP: 0,
        percentage: 10,
        notes: "",
        isIngredientPurchase: false,
      }));
      loadData();
    } catch (err: any) {
      alert("Error al registrar gasto: " + err.message);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("¿Deseas eliminar este gasto?")) return;
    try {
      const res = await fetch(`/api/gastos?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) loadData();
      else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.concept.toLowerCase().includes(search.toLowerCase()) ||
      e.category.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || e.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalExpensesCents = filteredExpenses.reduce((acc, e) => acc + e.amountCents, 0);

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <Receipt className="w-4 h-4" />
              <span>Gastos del Obrador</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Gastos Operativos
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Control de servicios básicos, empaques, transporte y gastos fijos para el cuadre semanal.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Gasto</span>
          </button>
        </div>

        {/* Banner de advertencia RF-020 */}
        <div className="p-4 rounded-xl bg-white border border-[#E8E2D9] shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FAF5F7] text-[#9C4266] flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-xs text-[#7D6E65] space-y-1">
            <h4 className="font-bold text-[#4A3B32] text-sm">
              Prevención de Duplicación de Costos (RF-020)
            </h4>
            <p>
              Si registras una <strong>compra de materia prima</strong> aquí, márcala con la casilla especial para advertir que dicho insumo ya es imputado al costo de los postres (COGS) y evitar duplicar el gasto en el resultado semanal.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl p-4 border border-[#E8E2D9] shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
            <input
              type="text"
              placeholder="Buscar gasto por concepto o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#FAF8F6]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                selectedCategory === "ALL" ? "bg-[#9C4266] text-white" : "bg-[#FAF8F6] text-[#7D6E65]"
              }`}
            >
              Todos ({formatDOP(totalExpensesCents)})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  selectedCategory === c.id ? "bg-[#9C4266] text-white" : "bg-[#FAF8F6] text-[#7D6E65]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 4 ESTADOS UI */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#4A3B32]">Cargando gastos operativos...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center">
            <AlertTriangle className="w-8 h-8 text-[#E53E3E] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg">
              Reintentar
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <Receipt className="w-10 h-10 text-[#C4B5A5] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#4A3B32]">No hay gastos registrados</h3>
            <p className="text-xs text-[#7D6E65] max-w-sm mx-auto mt-1">
              Registra los gastos del obrador para mantener el cuadre semanal al día.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Concepto / Detalle</th>
                    <th className="py-3 px-4">Porcentaje / Base</th>
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4">Monto Calculado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-sm">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#FAF8F6]/60 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-[#7D6E65]">
                        {new Date(exp.expenseDate).toLocaleDateString("es-DO")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FAF5F7] text-[#9C4266]">
                          {exp.category.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#4A3B32]">
                        <div className="font-medium">{exp.concept}</div>
                        {exp.isIngredientPurchase && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Compra de Insumos (Señalada)
                          </span>
                        )}
                        {exp.notes && <div className="text-xs text-[#7D6E65]">{exp.notes}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7D6E65] tabular-nums">
                        {exp.percentage != null && exp.baseAmountCents != null ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-[#FAF5F7] text-[#9C4266] border border-[#F3D5E2]">
                              {exp.percentage}%
                            </span>
                            <div className="text-[11px] text-[#7D6E65] mt-0.5">
                              sobre {formatDOP(exp.baseAmountCents)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#A89F91]">Monto directo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7D6E65]">
                        <span className="px-2 py-0.5 rounded bg-[#FAF8F6] border border-[#E8E2D9]">
                          {exp.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-base text-[#4A3B32] tabular-nums">
                        {formatDOP(exp.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#FAF8F6]"
                          title="Eliminar gasto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL NUEVO GASTO */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-[#7D6E65]">
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif font-bold text-[#4A3B32] mb-1">Registrar Gasto Operativo</h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                Ingresa el monto base y el porcentaje (%) para calcular el gasto operativo y deducirlo del cuadre semanal.
              </p>

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Fecha</label>
                    <input
                      type="date"
                      required
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Categoría</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Concepto del Gasto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Recarga de gas industrial 100 lbs"
                    value={formData.concept}
                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Monto Base (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.baseAmountDOP || ""}
                      onChange={(e) => setFormData({ ...formData, baseAmountDOP: parseFloat(e.target.value) || 0 })}
                      placeholder="Ej. 1000.00"
                      className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Porcentaje (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.percentage || ""}
                      onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                      placeholder="Ej. 15"
                      className="w-full px-3 py-2 text-sm font-bold text-[#9C4266] rounded-lg border border-[#E8E2D9] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Método de Pago</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="EFECTIVO">Efectivo (Impacta Arqueo)</option>
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="TARJETA">Tarjeta de Débito/Crédito</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF5F7] border border-[#F3D5E2] flex items-center justify-between">
                  <span className="text-xs font-medium text-[#7D6E65]">
                    Monto calculado del gasto ({formData.percentage || 0}% de RD$ {(formData.baseAmountDOP || 0).toFixed(2)}):
                  </span>
                  <span className="text-base font-bold text-[#9C4266] tabular-nums">
                    {formatDOP(calculatedAmountCents)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isIngredientPurchase}
                      onChange={(e) => setFormData({ ...formData, isIngredientPurchase: e.target.checked })}
                      className="rounded text-[#9C4266] focus:ring-[#9C4266]"
                    />
                    <span className="text-xs font-semibold text-[#4A3B32]">
                      Es compra de insumos/ingredientes (Señalar para evitar duplicación con COGS)
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Notas u observaciones</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-[#7D6E65]">
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium bg-[#9C4266] text-white rounded-lg">
                    Guardar Gasto
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

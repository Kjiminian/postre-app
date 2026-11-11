"use client";

import { useState } from "react";
import {
  Receipt,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  Info,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface ExpenseItem {
  id: string;
  expenseDate: string;
  category: string;
  concept: string;
  amountCents: number;
  paymentMethod: string;
  isIngredientPurchase: boolean; // Alerta RF-020
  notes?: string;
}

const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: "GAS-001",
    expenseDate: "2026-11-10",
    category: "Servicios Básicos (Luz/Agua/Gas)",
    concept: "Recarga de tanque de gas propano para hornos",
    amountCents: 250000, // RD$ 2,500.00
    paymentMethod: "EFECTIVO",
    isIngredientPurchase: false,
  },
  {
    id: "GAS-002",
    expenseDate: "2026-11-10",
    category: "Empaque y Embalaje",
    concept: "Cajas kraft de repostería y lazos rosa ciruela",
    amountCents: 320000, // RD$ 3,200.00
    paymentMethod: "TRANSFERENCIA",
    isIngredientPurchase: false,
  },
  {
    id: "GAS-003",
    expenseDate: "2026-11-11",
    category: "Transporte / Delivery",
    concept: "Envío de pedidos a domicilio en Santo Domingo",
    amountCents: 110000, // RD$ 1,100.00
    paymentMethod: "EFECTIVO",
    isIngredientPurchase: false,
  },
  {
    id: "GAS-004",
    expenseDate: "2026-11-11",
    category: "Publicidad y Redes Sociales",
    concept: "Campaña en Instagram para postres de temporada",
    amountCents: 100000, // RD$ 1,000.00
    paymentMethod: "TARJETA",
    isIngredientPurchase: false,
  },
];

const CATEGORIES = [
  "Servicios Básicos (Luz/Agua/Gas)",
  "Empaque y Embalaje",
  "Transporte / Delivery",
  "Publicidad y Redes Sociales",
  "Alquiler de Espacio",
  "Limpieza y Mantenimiento",
  "Compra de Insumos (Señalar para no duplicar en COGS)",
  "Otros Gastos Menores",
];

export default function GastosPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario nuevo gasto
  const [newExpense, setNewExpense] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: CATEGORIES[0],
    concept: "",
    amountDOP: 0,
    paymentMethod: "EFECTIVO",
    isIngredientPurchase: false,
    notes: "",
  });

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.concept.trim()) return;

    const created: ExpenseItem = {
      id: `GAS-${Date.now().toString(36).toUpperCase()}`,
      expenseDate: newExpense.expenseDate,
      category: newExpense.category,
      concept: newExpense.concept,
      amountCents: Math.round(Number(newExpense.amountDOP) * 100),
      paymentMethod: newExpense.paymentMethod,
      isIngredientPurchase: newExpense.isIngredientPurchase,
      notes: newExpense.notes || undefined,
    };

    setExpenses([created, ...expenses]);
    setIsModalOpen(false);
  };

  const filtered = expenses.filter(
    (g) =>
      g.concept.toLowerCase().includes(search.toLowerCase()) ||
      g.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpensesCents = filtered.reduce((acc, g) => acc + g.amountCents, 0);
  const operationalOnlyCents = filtered
    .filter((g) => !g.isIngredientPurchase)
    .reduce((acc, g) => acc + g.amountCents, 0);

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Gastos Operativos"
        subtitle="Registro por categoría, fecha y medio de pago • Exclusión de insumos para no duplicar en costo de lo vendido"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Banner de Control Anti-Duplicidad (RF-020) */}
        <div className="p-4 rounded-xl border border-cream-300 bg-white shadow-card flex items-start gap-3">
          <Info className="w-5 h-5 text-plum-500 shrink-0 mt-0.5" />
          <div className="text-xs text-ink-light leading-relaxed">
            <span className="font-semibold text-ink">Protección de Resultados (RF-020):</span> Los ingredientes e
            insumos de repostería ya son contabilizados a través del costo histórico de las recetas en cada venta
            (Costo de lo Vendido / COGS). Si registra una factura de compra de harina o azúcar aquí, márquela como{" "}
            <strong>&quot;Compra de Insumos&quot;</strong> para evitar descontar dos veces el mismo gasto en el resultado semanal.
          </div>
        </div>

        {/* Barra de Acciones y Totales */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-cream-300 shadow-card">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por concepto o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:border-plum-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-ink-muted uppercase block">Total Gastos Operativos</span>
              <span className="font-serif font-bold text-lg text-ink">{formatDOP(operationalOnlyCents)}</span>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Gasto</span>
            </button>
          </div>
        </div>

        {/* Tabla de Gastos */}
        <div className="bg-white rounded-xl border border-cream-300 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 border-b border-cream-300 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4 text-center">Medio de Pago</th>
                  <th className="py-3 px-4 text-right">Importe</th>
                  <th className="py-3 px-4 text-center">Impacto COGS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted text-xs">
                      No se encontraron gastos para la búsqueda ingresada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-cream-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-ink-light">{item.expenseDate}</td>
                      <td className="py-3 px-4 font-medium text-xs text-ink-light">
                        <span className="px-2 py-0.5 rounded-full bg-cream-200 text-ink">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">{item.concept}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-medium text-ink-light">
                          {item.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-ink tabular-nums">
                        {formatDOP(item.amountCents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.isIngredientPurchase ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Aislado (Insumo)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-sage-600">
                            <CheckCircle2 className="w-3 h-3" /> Gasto Operativo
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Registrar Gasto */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-cream-300 shadow-xl overflow-hidden">
              <div className="p-5 border-b border-cream-200 flex items-center justify-between bg-cream-50">
                <h3 className="font-serif font-bold text-lg text-ink">Registrar Gasto Operativo</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-cream-200 flex items-center justify-center text-ink-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Fecha</label>
                    <input
                      type="date"
                      value={newExpense.expenseDate}
                      onChange={(e) => setNewExpense({ ...newExpense, expenseDate: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Medio de Pago</label>
                    <select
                      value={newExpense.paymentMethod}
                      onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="TARJETA">Tarjeta de Débito/Crédito</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Categoría</label>
                  <select
                    value={newExpense.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setNewExpense({
                        ...newExpense,
                        category: cat,
                        isIngredientPurchase: cat.includes("Insumos"),
                      });
                    }}
                    className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Concepto / Detalle</label>
                  <input
                    type="text"
                    placeholder="Ej: Pago de cilindro de gas propano"
                    value={newExpense.concept}
                    onChange={(e) => setNewExpense({ ...newExpense, concept: e.target.value })}
                    className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Importe (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={newExpense.amountDOP}
                    onChange={(e) => setNewExpense({ ...newExpense, amountDOP: Number(e.target.value) })}
                    className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg font-bold"
                    required
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="isIngCheck"
                    checked={newExpense.isIngredientPurchase}
                    onChange={(e) => setNewExpense({ ...newExpense, isIngredientPurchase: e.target.checked })}
                    className="mt-0.5 accent-plum-500"
                  />
                  <label htmlFor="isIngCheck" className="text-xs text-amber-900 leading-snug cursor-pointer">
                    <strong>¿Es compra de ingredientes o insumos?</strong> Marcar para que el sistema NO descuente
                    nuevamente este importe en el resultado neto de ventas (evita doble deducción contra el costo de recetas).
                  </label>
                </div>

                <div className="pt-4 border-t border-cream-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-cream-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-plum-500 hover:bg-plum-600 text-white font-medium shadow-sm"
                  >
                    Guardar Gasto
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

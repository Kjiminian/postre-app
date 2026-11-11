"use client";

import { useState } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface SaleRecord {
  id: string;
  saleDate: string;
  productName: string;
  customerName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  unitCostCents: number;
  totalCostCents: number;
  paymentMethod: string;
  collectedCents: number;
  balanceCents: number;
}

const CATALOG_PRESETS = [
  { name: "Cheesecake Clásico 8\"", defaultPriceCents: 140000, unitCostCents: 67200 },
  { name: "Bizcocho Dominicano Suspiro 1 lb", defaultPriceCents: 130000, unitCostCents: 67600 },
  { name: "Caja Brownies Artesanales (6 uds)", defaultPriceCents: 45000, unitCostCents: 18900 },
  { name: "Tres Leches Tradicional", defaultPriceCents: 60000, unitCostCents: 33000 },
  { name: "Tarta de Limón y Merengue", defaultPriceCents: 95000, unitCostCents: 48000 },
];

export default function VentasPage() {
  const [sales, setSales] = useState<SaleRecord[]>([
    {
      id: "VTA-001",
      saleDate: "2026-11-10",
      productName: "Cheesecake Clásico 8\"",
      customerName: "María Fernández",
      quantity: 2,
      unitPriceCents: 140000,
      totalCents: 280000,
      unitCostCents: 67200,
      totalCostCents: 134400,
      paymentMethod: "TRANSFERENCIA",
      collectedCents: 280000,
      balanceCents: 0,
    },
    {
      id: "VTA-002",
      saleDate: "2026-11-11",
      productName: "Bizcocho Dominicano Suspiro 1 lb",
      customerName: "Carlos Gómez",
      quantity: 1,
      unitPriceCents: 130000,
      totalCents: 130000,
      unitCostCents: 67600,
      totalCostCents: 67600,
      paymentMethod: "EFECTIVO",
      collectedCents: 80000,
      balanceCents: 50000, // Saldo pendiente
    },
    {
      id: "VTA-003",
      saleDate: "2026-11-11",
      productName: "Caja Brownies Artesanales (6 uds)",
      customerName: "Ana Rodríguez",
      quantity: 3,
      unitPriceCents: 45000,
      totalCents: 135000,
      unitCostCents: 18900,
      totalCostCents: 56700,
      paymentMethod: "TARJETA",
      collectedCents: 135000,
      balanceCents: 0,
    },
  ]);

  const [searchProduct, setSearchProduct] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario de nueva venta
  const [newSale, setNewSale] = useState({
    saleDate: new Date().toISOString().slice(0, 10),
    productName: CATALOG_PRESETS[0].name,
    customerName: "",
    quantity: 1,
    unitPriceDOP: 1400,
    unitCostDOP: 672,
    paymentMethod: "EFECTIVO",
    collectedDOP: 1400,
  });

  const handleSelectProductPreset = (name: string) => {
    const preset = CATALOG_PRESETS.find((p) => p.name === name);
    if (preset) {
      setNewSale({
        ...newSale,
        productName: preset.name,
        unitPriceDOP: preset.defaultPriceCents / 100,
        unitCostDOP: preset.unitCostCents / 100,
        collectedDOP: (preset.defaultPriceCents / 100) * newSale.quantity,
      });
    }
  };

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(newSale.quantity);
    const unitPriceCents = Math.round(Number(newSale.unitPriceDOP) * 100);
    const unitCostCents = Math.round(Number(newSale.unitCostDOP) * 100);
    const totalCents = qty * unitPriceCents;
    const totalCostCents = qty * unitCostCents;
    const collectedCents = Math.min(totalCents, Math.round(Number(newSale.collectedDOP) * 100));
    const balanceCents = totalCents - collectedCents;

    const created: SaleRecord = {
      id: `VTA-${Date.now().toString(36).toUpperCase()}`,
      saleDate: newSale.saleDate,
      productName: newSale.productName,
      customerName: newSale.customerName.trim() || "Cliente Ocasional",
      quantity: qty,
      unitPriceCents,
      totalCents,
      unitCostCents,
      totalCostCents,
      paymentMethod: newSale.paymentMethod,
      collectedCents,
      balanceCents,
    };

    setSales([created, ...sales]);
    setIsModalOpen(false);
  };

  const filteredSales = sales.filter((s) => {
    const matchesProduct = !searchProduct || s.productName.toLowerCase().includes(searchProduct.toLowerCase()) || s.customerName.toLowerCase().includes(searchProduct.toLowerCase());
    const matchesPayment = !filterPayment || s.paymentMethod === filterPayment;
    return matchesProduct && matchesPayment;
  });

  // Totales calculados
  const totalInvoiced = filteredSales.reduce((acc, s) => acc + s.totalCents, 0);
  const totalCost = filteredSales.reduce((acc, s) => acc + s.totalCostCents, 0);
  const totalCollected = filteredSales.reduce((acc, s) => acc + s.collectedCents, 0);
  const totalBalance = filteredSales.reduce((acc, s) => acc + s.balanceCents, 0);

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Módulo de Ventas & Cobranzas"
        subtitle="Registro con costos históricos congelados • Sin conversión automática de cotizaciones"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Barra superior de acciones y filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-cream-300 shadow-card">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por producto o cliente..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-cream-50 border border-cream-300 rounded-lg focus:outline-none focus:border-plum-500"
              />
            </div>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink focus:outline-none focus:border-plum-500"
            >
              <option value="">Todos los pagos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
        </div>

        {/* Resumen de totales filtrados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-cream-300 shadow-card">
            <span className="text-xs text-ink-muted font-medium uppercase">Total Facturado</span>
            <p className="text-xl font-bold font-serif text-ink mt-1">{formatDOP(totalInvoiced)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-cream-300 shadow-card">
            <span className="text-xs text-ink-muted font-medium uppercase">Costo Histórico</span>
            <p className="text-xl font-bold font-serif text-ink mt-1">{formatDOP(totalCost)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-cream-300 shadow-card">
            <span className="text-xs text-sage-600 font-medium uppercase">Total Cobrado</span>
            <p className="text-xl font-bold font-serif text-sage-600 mt-1">{formatDOP(totalCollected)}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-cream-300 shadow-card">
            <span className="text-xs text-amber-600 font-medium uppercase">Saldo Pendiente</span>
            <p className="text-xl font-bold font-serif text-amber-600 mt-1">{formatDOP(totalBalance)}</p>
          </div>
        </div>

        {/* Tabla de Ventas */}
        <div className="bg-white rounded-xl border border-cream-300 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 border-b border-cream-300 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-center">Cant.</th>
                  <th className="py-3 px-4 text-right">Precio Unit.</th>
                  <th className="py-3 px-4 text-right">Importe</th>
                  <th className="py-3 px-4 text-right">Costo Hist.</th>
                  <th className="py-3 px-4 text-center">Pago</th>
                  <th className="py-3 px-4 text-right">Cobrado</th>
                  <th className="py-3 px-4 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-ink-muted text-xs">
                      No se encontraron ventas registradas con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-cream-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-ink-light">{sale.saleDate}</td>
                      <td className="py-3 px-4 font-medium text-ink">{sale.productName}</td>
                      <td className="py-3 px-4 text-ink-light">{sale.customerName}</td>
                      <td className="py-3 px-4 text-center font-medium tabular-nums">{sale.quantity}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{formatDOP(sale.unitPriceCents)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-ink tabular-nums">{formatDOP(sale.totalCents)}</td>
                      <td className="py-3 px-4 text-right text-xs text-ink-muted tabular-nums">{formatDOP(sale.totalCostCents)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-cream-200 text-ink">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-sage-600 tabular-nums">{formatDOP(sale.collectedCents)}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums">
                        {sale.balanceCents > 0 ? (
                          <span className="text-amber-600 font-bold">{formatDOP(sale.balanceCents)}</span>
                        ) : (
                          <span className="text-xs text-sage-600 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saldo RD$ 0
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

        {/* Modal: Registrar Venta */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-cream-300 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-cream-200 flex items-center justify-between bg-cream-50">
                <h3 className="font-serif font-bold text-lg text-ink">Registrar Venta de Postre</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-cream-200 flex items-center justify-center text-ink-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSale} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                    Seleccionar del Catálogo Reutilizable
                  </label>
                  <select
                    value={newSale.productName}
                    onChange={(e) => handleSelectProductPreset(e.target.value)}
                    className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink focus:border-plum-500"
                  >
                    {CATALOG_PRESETS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} — Precio sugerido: RD$ {(p.defaultPriceCents / 100).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Fecha</label>
                    <input
                      type="date"
                      value={newSale.saleDate}
                      onChange={(e) => setNewSale({ ...newSale, saleDate: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Cliente</label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={newSale.customerName}
                      onChange={(e) => setNewSale({ ...newSale, customerName: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newSale.quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        setNewSale({
                          ...newSale,
                          quantity: q,
                          collectedDOP: newSale.unitPriceDOP * q,
                        });
                      }}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Precio Unit (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newSale.unitPriceDOP}
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        setNewSale({
                          ...newSale,
                          unitPriceDOP: p,
                          collectedDOP: p * newSale.quantity,
                        });
                      }}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Costo Unit (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newSale.unitCostDOP}
                      onChange={(e) => setNewSale({ ...newSale, unitCostDOP: Number(e.target.value) })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Medio de Pago</label>
                    <select
                      value={newSale.paymentMethod}
                      onChange={(e) => setNewSale({ ...newSale, paymentMethod: e.target.value })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="PENDIENTE">Pendiente de Cobro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Monto Cobrado (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newSale.collectedDOP}
                      onChange={(e) => setNewSale({ ...newSale, collectedDOP: Number(e.target.value) })}
                      className="w-full p-2 text-sm bg-cream-50 border border-cream-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-cream-200 flex items-center justify-between">
                  <div className="text-xs text-ink-muted">
                    Total: <span className="font-bold text-ink">RD$ {(newSale.quantity * newSale.unitPriceDOP).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-ink-light hover:bg-cream-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-plum-500 hover:bg-plum-600 text-white shadow-sm"
                    >
                      Guardar Venta
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

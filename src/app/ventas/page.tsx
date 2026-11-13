"use client";

import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface SaleItemData {
  id: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  unitCostCents: number;
  totalCostCents: number;
  presentation?: {
    id: string;
    name: string;
  };
}

interface PaymentData {
  id: string;
  amountCents: number;
  method: string;
  paidAt: string;
  reference?: string;
}

interface SaleRecord {
  id: string;
  saleDate: string;
  customerName?: string;
  customer?: { name: string; phone?: string };
  totalCents: number;
  totalCostCents: number;
  collectedCents: number;
  balanceCents: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  items: SaleItemData[];
  payments: PaymentData[];
}

interface PresentationOption {
  id: string;
  name: string;
  recipeName: string;
  finalPriceCents: number;
  totalCostCents: number;
}

export default function VentasPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [presentations, setPresentations] = useState<PresentationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [selectedSaleForAbono, setSelectedSaleForAbono] = useState<SaleRecord | null>(null);

  // Formulario nueva venta
  const [saleForm, setSaleForm] = useState({
    saleDate: new Date().toISOString().slice(0, 10),
    customerName: "",
    selectedPresentationId: "",
    quantity: 1,
    unitPriceDOP: 0,
    unitCostDOP: 0,
    collectedDOP: 0,
    paymentMethod: "EFECTIVO",
    paymentReference: "",
    notes: "",
  });

  // Formulario de abono
  const [abonoForm, setAbonoForm] = useState({
    amountDOP: 0,
    method: "EFECTIVO",
    reference: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resSales, resPres] = await Promise.all([
        fetch("/api/ventas"),
        fetch("/api/presentaciones"),
      ]);
      const dataSales = await resSales.json();
      const dataPres = await resPres.json();

      if (dataSales.success) setSales(dataSales.data);
      else throw new Error(dataSales.error);

      if (dataPres.success) {
        setPresentations(dataPres.data);
        if (dataPres.data.length > 0 && !saleForm.selectedPresentationId) {
          const first = dataPres.data[0];
          setSaleForm((prev) => ({
            ...prev,
            selectedPresentationId: first.id,
            unitPriceDOP: first.finalPriceCents / 100,
            unitCostDOP: first.totalCostCents / 100,
            collectedDOP: first.finalPriceCents / 100,
          }));
        }
      }
    } catch (err: any) {
      setError(err.message || "Error cargando ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPresentation = (presId: string) => {
    const selected = presentations.find((p) => p.id === presId);
    if (selected) {
      const priceDOP = selected.finalPriceCents / 100;
      setSaleForm({
        ...saleForm,
        selectedPresentationId: presId,
        unitPriceDOP: priceDOP,
        unitCostDOP: selected.totalCostCents / 100,
        collectedDOP: priceDOP * saleForm.quantity,
      });
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.selectedPresentationId) return;

    try {
      const selectedPres = presentations.find((p) => p.id === saleForm.selectedPresentationId);
      const payload = {
        saleDate: saleForm.saleDate,
        customerName: saleForm.customerName || "Cliente Mostrador",
        paymentMethod: saleForm.paymentMethod,
        collectedCents: Math.round(saleForm.collectedDOP * 100),
        paymentReference: saleForm.paymentReference,
        notes: saleForm.notes,
        items: [
          {
            presentationId: saleForm.selectedPresentationId,
            productName: selectedPres ? `${selectedPres.recipeName} — ${selectedPres.name}` : "Postre",
            quantity: saleForm.quantity,
            unitPriceCents: Math.round(saleForm.unitPriceDOP * 100),
            unitCostCents: Math.round(saleForm.unitCostDOP * 100),
          },
        ],
      };

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error al registrar venta: " + err.message);
    }
  };

  const handleOpenAbono = (sale: SaleRecord) => {
    setSelectedSaleForAbono(sale);
    setAbonoForm({
      amountDOP: sale.balanceCents / 100,
      method: "EFECTIVO",
      reference: "",
      notes: "",
    });
    setIsAbonoModalOpen(true);
  };

  const handleSaveAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForAbono || abonoForm.amountDOP <= 0) return;

    try {
      const res = await fetch("/api/abonos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: selectedSaleForAbono.id,
          amountCents: Math.round(abonoForm.amountDOP * 100),
          method: abonoForm.method,
          reference: abonoForm.reference,
          notes: abonoForm.notes,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setIsAbonoModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error al registrar abono: " + err.message);
    }
  };

  const handleCancelSale = async (id: string) => {
    if (!confirm("¿Seguro que deseas anular esta venta?")) return;
    try {
      const res = await fetch(`/api/ventas?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) loadData();
      else throw new Error(json.error);
    } catch (err: any) {
      alert("Error al anular venta: " + err.message);
    }
  };

  const filteredSales = sales.filter((s) => {
    const custName = s.customer?.name || s.customerName || "";
    const prodName = s.items.map((i) => i.productName).join(" ");
    const matchesSearch =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      prodName.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = filterPayment === "ALL" || s.paymentMethod === filterPayment;
    return matchesSearch && matchesPayment;
  });

  const totalInvoiced = filteredSales.reduce((acc, s) => acc + s.totalCents, 0);
  const totalCollected = filteredSales.reduce((acc, s) => acc + s.collectedCents, 0);
  const totalPending = filteredSales.reduce((acc, s) => acc + s.balanceCents, 0);
  const totalCost = filteredSales.reduce((acc, s) => acc + s.totalCostCents, 0);
  const totalProfit = totalInvoiced - totalCost;

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <ShoppingCart className="w-4 h-4" />
              <span>Ventas y Cobranzas</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Registro de Ventas y Abonos
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Selecciona presentación, carga precio activo y congela el costo unitario histórico de producción.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#9C4266] text-white text-sm font-medium hover:bg-[#833554] shadow-sm transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Venta</span>
          </button>
        </div>

        {/* Tarjetas de Resumen Rápido */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Total Facturado</span>
            <span className="text-xl font-bold text-[#4A3B32]">{formatDOP(totalInvoiced)}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Total Cobrado</span>
            <span className="text-xl font-bold text-[#22543D]">{formatDOP(totalCollected)}</span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Saldo Pendiente</span>
            <span className={`text-xl font-bold ${totalPending > 0 ? "text-[#C53030]" : "text-[#7D6E65]"}`}>
              {formatDOP(totalPending)}
            </span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
            <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Ganancia Neta (Histórica)</span>
            <span className="text-xl font-bold text-[#9C4266]">{formatDOP(totalProfit)}</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl p-4 border border-[#E8E2D9] shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7D6E65]" />
            <input
              type="text"
              placeholder="Buscar por cliente o postre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#FAF8F6]"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: "ALL", label: "Todos los Pagos" },
              { id: "EFECTIVO", label: "Efectivo" },
              { id: "TRANSFERENCIA", label: "Transferencia" },
              { id: "TARJETA", label: "Tarjeta" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setFilterPayment(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterPayment === p.id ? "bg-[#9C4266] text-white" : "bg-[#FAF8F6] text-[#7D6E65] hover:bg-[#F3EFEA]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 ESTADOS UI */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#4A3B32]">Cargando ventas y cobros...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center">
            <AlertCircle className="w-8 h-8 text-[#E53E3E] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg">
              Reintentar
            </button>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <ShoppingCart className="w-10 h-10 text-[#C4B5A5] mx-auto mb-3" />
            <h3 className="text-base font-semibold text-[#4A3B32]">No hay ventas registradas</h3>
            <p className="text-xs text-[#7D6E65] max-w-sm mx-auto mt-1">
              Registra tu primera venta seleccionando el postre y la presentación deseada.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F6] border-b border-[#E8E2D9] text-xs font-semibold text-[#7D6E65] uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Presentación / Items</th>
                    <th className="py-3 px-4">Costo Congelado</th>
                    <th className="py-3 px-4">Total Venta</th>
                    <th className="py-3 px-4">Cobrado</th>
                    <th className="py-3 px-4">Saldo</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E2D9] text-sm">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[#FAF8F6]/60 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-[#7D6E65]">
                        {new Date(sale.saleDate).toLocaleDateString("es-DO")}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#4A3B32]">
                        {sale.customer?.name || sale.customerName || "Mostrador"}
                      </td>
                      <td className="py-3 px-4 text-[#4A3B32]">
                        {sale.items.map((it) => (
                          <div key={it.id} className="text-xs">
                            <span className="font-medium">{it.productName}</span>{" "}
                            <span className="text-[#7D6E65]">({it.quantity}x {formatDOP(it.unitPriceCents)})</span>
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7D6E65]">
                        {formatDOP(sale.totalCostCents)}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#4A3B32]">
                        {formatDOP(sale.totalCents)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#22543D]">
                        {formatDOP(sale.collectedCents)}
                      </td>
                      <td className="py-3 px-4">
                        {sale.balanceCents > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#FED7D7] text-[#C53030]">
                            Pendiente: {formatDOP(sale.balanceCents)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#C6F6D5] text-[#22543D]">
                            Saldado
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7D6E65]">
                        <span className="px-2 py-0.5 rounded bg-[#FAF8F6] border border-[#E8E2D9]">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sale.balanceCents > 0 && (
                            <button
                              onClick={() => handleOpenAbono(sale)}
                              className="px-2.5 py-1 text-xs font-medium bg-[#22543D] text-white rounded hover:bg-[#1A4331]"
                              title="Registrar Abono"
                            >
                              Abonar
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelSale(sale.id)}
                            className="p-1.5 text-[#7D6E65] hover:text-[#C53030] rounded hover:bg-[#FAF8F6]"
                            title="Anular Venta"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* MODAL NUEVA VENTA */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2D9] relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-[#7D6E65] hover:bg-[#FAF8F6]"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif font-bold text-[#4A3B32] mb-1">Registrar Venta</h2>
              <p className="text-xs text-[#7D6E65] mb-4">
                El costo unitario de la presentación seleccionada quedará congelado en el histórico.
              </p>

              <form onSubmit={handleSaveSale} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Fecha</label>
                    <input
                      type="date"
                      required
                      value={saleForm.saleDate}
                      onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Cliente</label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={saleForm.customerName}
                      onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Seleccionar Presentación del Obrador
                  </label>
                  <select
                    value={saleForm.selectedPresentationId}
                    onChange={(e) => handleSelectPresentation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white font-medium text-[#4A3B32]"
                  >
                    {presentations.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.recipeName} — {p.name} (RD$ {(p.finalPriceCents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={saleForm.quantity}
                      onChange={(e) => {
                        const q = parseInt(e.target.value) || 1;
                        setSaleForm({
                          ...saleForm,
                          quantity: q,
                          collectedDOP: saleForm.unitPriceDOP * q,
                        });
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Precio Unitario (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleForm.unitPriceDOP}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value) || 0;
                        setSaleForm({
                          ...saleForm,
                          unitPriceDOP: p,
                          collectedDOP: p * saleForm.quantity,
                        });
                      }}
                      className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Costo Unitario (RD$)</label>
                    <input
                      type="number"
                      disabled
                      value={saleForm.unitCostDOP.toFixed(2)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-[#F3EFEA] text-[#7D6E65]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Método de Pago</label>
                    <select
                      value={saleForm.paymentMethod}
                      onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="TARJETA">Tarjeta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Monto Cobrado (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleForm.collectedDOP}
                      onChange={(e) => setSaleForm({ ...saleForm, collectedDOP: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm font-bold text-[#22543D] rounded-lg border border-[#E8E2D9]"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF8F6] border border-[#E8E2D9] flex justify-between text-xs font-medium">
                  <span>Total Venta: <strong>{formatDOP(Math.round(saleForm.unitPriceDOP * saleForm.quantity * 100))}</strong></span>
                  <span>Saldo Restante: <strong>{formatDOP(Math.max(0, Math.round((saleForm.unitPriceDOP * saleForm.quantity - saleForm.collectedDOP) * 100)))}</strong></span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-[#7D6E65]">
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium bg-[#9C4266] text-white rounded-lg hover:bg-[#833554]">
                    Guardar Venta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL ABONO */}
        {isAbonoModalOpen && selectedSaleForAbono && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E8E2D9] relative">
              <button onClick={() => setIsAbonoModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-[#7D6E65]">
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-serif font-bold text-[#4A3B32] mb-1">Registrar Abono</h3>
              <p className="text-xs text-[#7D6E65] mb-4">
                Saldo pendiente: <strong>{formatDOP(selectedSaleForAbono.balanceCents)}</strong>
              </p>

              <form onSubmit={handleSaveAbono} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Monto del Abono (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedSaleForAbono.balanceCents / 100}
                    required
                    value={abonoForm.amountDOP}
                    onChange={(e) => setAbonoForm({ ...abonoForm, amountDOP: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-base font-bold text-[#22543D] rounded-lg border border-[#E8E2D9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">Método de Pago</label>
                  <select
                    value={abonoForm.method}
                    onChange={(e) => setAbonoForm({ ...abonoForm, method: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E8E2D9] bg-white"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsAbonoModalOpen(false)} className="px-3 py-1.5 text-xs text-[#7D6E65]">
                    Cancelar
                  </button>
                  <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-[#22543D] text-white rounded-lg">
                    Confirmar Abono
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

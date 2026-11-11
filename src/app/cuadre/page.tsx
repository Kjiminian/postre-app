"use client";

import { useState } from "react";
import {
  CalendarDays,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  DollarSign,
  TrendingUp,
  History,
  Clock,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

export default function CuadrePage() {
  const [selectedWeek, setSelectedWeek] = useState("2026-W46"); // Semana actual
  const [cashFundDOP, setCashFundDOP] = useState<number>(3000); // RD$ 3,000 fondo de caja
  const [countedCashDOP, setCountedCashDOP] = useState<number>(24500); // Efectivo contado físico
  const [isClosed, setIsClosed] = useState(false);
  const [alertPostClose, setAlertPostClose] = useState(false);

  // Métricas dinámicas calculadas de la semana
  const metrics = {
    period: "Lunes 09/11/2026 al Domingo 15/11/2026",
    invoicedCents: 4850000,
    collectedCents: 4200000,
    pendingCents: 650000,
    costOfGoodsCents: 1940000,
    expensesCents: 780000,
    netResultCents: 2130000,
    cashCollectedCents: 2350000, // Cobrado en efectivo
    cashExpensesCents: 200000, // Pagos en efectivo
  };

  const cashFundCents = Math.round(cashFundDOP * 100);
  const countedCashCents = Math.round(countedCashDOP * 100);

  // Efectivo esperado = Fondo Inicial + Cobros Efectivo - Gastos Efectivo
  const expectedCashCents = cashFundCents + metrics.cashCollectedCents - metrics.cashExpensesCents;
  const cashDiffCents = countedCashCents - expectedCashCents;

  const handleCloseWeek = () => {
    setIsClosed(true);
  };

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Cuadre Semanal (Lunes a Domingo)"
        subtitle="Control de caja, costos de lo vendido (COGS) y resultado operativo semanal"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Selector de semana y estado */}
        <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-plum-100 text-plum-600 flex items-center justify-center font-bold">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-ink text-base">Semana 46 / 2026</h3>
              <p className="text-xs text-ink-muted">{metrics.period}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-500/10 text-sage-600 font-semibold text-xs border border-sage-500/20">
                <Lock className="w-3.5 h-3.5" /> Semana Cerrada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold text-xs border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> En Curso (Abierta)
              </span>
            )}

            {!isClosed && (
              <button
                onClick={handleCloseWeek}
                className="px-4 py-2 rounded-lg bg-plum-500 hover:bg-plum-600 text-white font-medium text-xs shadow-sm transition-colors"
              >
                Cerrar Semana y Fijar Arqueo
              </button>
            )}
          </div>
        </div>

        {/* Alerta de modificaciones post-cierre (RF-009) */}
        {alertPostClose && (
          <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-900 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Advertencia de Modificación Posterior al Cierre:</p>
              <p className="text-xs text-red-800 mt-0.5">
                Se detectaron movimientos registrados o editados con fecha de esta semana después de haberse realizado el cierre. La integridad del cuadre histórico ha sido señalada.
              </p>
            </div>
          </div>
        )}

        {/* Resumen Financiero del Período */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-muted uppercase mb-3">
              <span>Flujo de Ventas</span>
              <Receipt className="w-4 h-4 text-plum-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink">Facturado Total:</span>
                <span className="font-bold text-ink">{formatDOP(metrics.invoicedCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sage-600">Cobrado Real:</span>
                <span className="font-semibold text-sage-600">{formatDOP(metrics.collectedCents)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-cream-200">
                <span className="text-amber-600 font-medium">Por Cobrar:</span>
                <span className="font-bold text-amber-600">{formatDOP(metrics.pendingCents)}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-muted uppercase mb-3">
              <span>Costos & Gastos</span>
              <DollarSign className="w-4 h-4 text-plum-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink">Costo de lo Vendido (COGS):</span>
                <span className="font-bold text-ink">{formatDOP(metrics.costOfGoodsCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink">Gastos Operativos:</span>
                <span className="font-semibold text-ink">{formatDOP(metrics.expensesCents)}</span>
              </div>
              <p className="text-[11px] text-ink-muted pt-2 border-t border-cream-200">
                * Las compras de insumos para stock se aíslan para no duplicar con el costo unitario de recetas.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-sage-500/30 shadow-card bg-gradient-to-br from-white to-sage-500/5">
            <div className="flex items-center justify-between text-xs font-semibold text-sage-600 uppercase mb-3">
              <span>Resultado Operativo Estimado</span>
              <TrendingUp className="w-4 h-4 text-sage-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-sage-600">
              {formatDOP(metrics.netResultCents)}
            </p>
            <div className="mt-4 space-y-1 text-xs text-ink-muted">
              <div className="flex justify-between">
                <span>Margen Operativo Bruto:</span>
                <span className="font-semibold text-ink">60.0%</span>
              </div>
              <div className="flex justify-between">
                <span>Margen Operativo Neto:</span>
                <span className="font-semibold text-sage-600">43.9%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Módulo de Arqueo Físico de Efectivo */}
        <div className="p-6 rounded-xl bg-white border border-cream-300 shadow-card">
          <h4 className="font-serif font-bold text-ink text-base mb-1">
            Arqueo de Efectivo Físico
          </h4>
          <p className="text-xs text-ink-muted mb-6">
            Comparativa entre el efectivo esperado en gaveta y el conteo físico de billetes y monedas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Fondo Inicial de Caja (RD$)
              </label>
              <input
                type="number"
                step="100"
                value={cashFundDOP}
                disabled={isClosed}
                onChange={(e) => setCashFundDOP(Number(e.target.value))}
                className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-semibold"
              />
              <span className="text-[11px] text-ink-muted">Monto inicial para dar cambio</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Efectivo Esperado
              </label>
              <div className="p-2.5 rounded-lg bg-cream-100 border border-cream-300 font-bold text-ink text-sm">
                {formatDOP(expectedCashCents)}
              </div>
              <span className="text-[11px] text-ink-muted">Fondo + Cobros EF - Gastos EF</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Efectivo Contado Físico (RD$)
              </label>
              <input
                type="number"
                step="100"
                value={countedCashDOP}
                disabled={isClosed}
                onChange={(e) => setCountedCashDOP(Number(e.target.value))}
                className="w-full p-2.5 text-sm bg-cream-50 border border-cream-300 rounded-lg text-ink font-semibold"
              />
              <span className="text-[11px] text-ink-muted">Total del conteo manual de gaveta</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">
                Diferencia de Cuadre
              </label>
              <div
                className={`p-2.5 rounded-lg border font-bold text-sm ${
                  cashDiffCents === 0
                    ? "bg-sage-50 border-sage-300 text-sage-600"
                    : cashDiffCents > 0
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-red-50 border-red-300 text-red-600"
                }`}
              >
                {formatDOP(cashDiffCents)}
                {cashDiffCents === 0 && " (Exacto)"}
                {cashDiffCents > 0 && " (Sobrante)"}
                {cashDiffCents < 0 && " (Faltante)"}
              </div>
              <span className="text-[11px] text-ink-muted">Contado menos esperado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

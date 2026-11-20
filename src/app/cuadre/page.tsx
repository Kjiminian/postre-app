"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Coins,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

interface ExistingClose {
  id: string;
  status: string;
  isClosed?: boolean;
  closedAt: string;
  notes?: string | null;
  differenceCents?: number;
}

interface WeeklyCloseData {
  weekStart: string;
  weekEnd: string;
  invoicedCents: number;
  collectedCents: number;
  pendingCents: number;
  costOfGoodsCents: number;
  operationalExpCents: number;
  netResultCents: number;
  cashCollectedCents: number;
  cashExpensesCents: number;
  salesCount: number;
  expensesCount: number;
  existingClose?: ExistingClose | null;
}

export default function CuadrePage() {
  const [data, setData] = useState<WeeklyCloseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cashFundDOP, setCashFundDOP] = useState<number>(3000);
  const [countedCashDOP, setCountedCashDOP] = useState<number>(3000);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadWeeklyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cuadre");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.existingClose) {
          setCashFundDOP(json.data.existingClose.cashFundCents / 100);
          setCountedCashDOP(json.data.existingClose.countedCashCents / 100);
          setNotes(json.data.existingClose.notes || "");
        } else {
          // Prellenar counted con lo esperado
          const exp = (3000 * 100) + json.data.cashCollectedCents - json.data.cashExpensesCents;
          setCountedCashDOP(exp / 100);
        }
      } else throw new Error(json.error);
    } catch (err: any) {
      setError(err.message || "Error cargando cuadre");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeeklyData();
  }, []);

  const cashFundCents = Math.round(cashFundDOP * 100);
  const countedCashCents = Math.round(countedCashDOP * 100);

  const expectedCashCents = data
    ? cashFundCents + data.cashCollectedCents - data.cashExpensesCents
    : cashFundCents;
  const cashDifferenceCents = countedCashCents - expectedCashCents;

  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveClose = async () => {
    if (!data) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/cuadre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          cashFundCents,
          countedCashCents,
          notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowConfirmClose(false);
        setFeedback({ type: "success", text: "Cuadre semanal fijado y cerrado exitosamente." });
        loadWeeklyData();
      } else throw new Error(json.error);
    } catch (err: any) {
      setShowConfirmClose(false);
      setFeedback({ type: "error", text: "Error al fijar cuadre: " + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isClosed = Boolean(data?.existingClose?.isClosed);

  return (
    <div className="min-h-screen bg-[#FAF8F6]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9C4266] mb-1">
              <CalendarDays className="w-4 h-4" />
              <span>Cierre Operativo (Lunes a Domingo)</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#4A3B32]">
              Cuadre Semanal y Arqueo de Caja
            </h1>
            <p className="text-sm text-[#7D6E65] mt-1">
              Balance de ventas, cobros, costo de mercancía vendida (COGS), gastos operativos y verificación de efectivo físico.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C6F6D5] text-[#22543D] font-bold text-xs">
                <Lock className="w-3.5 h-3.5" /> Semana Cerrada
              </span>
            ) : (
              <button
                onClick={() => setShowConfirmClose(true)}
                disabled={isSaving || loading}
                className="px-4 py-2.5 rounded-lg bg-[#9C4266] hover:bg-[#833554] text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : "Fijar Arqueo y Cerrar Semana"}
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              feedback.type === "success"
                ? "bg-[#C6F6D5]/60 border-[#9AE6B4] text-[#22543D]"
                : "bg-[#FED7D7]/60 border-[#FEB2B2] text-[#742A2A]"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="underline text-[11px]">
              Cerrar
            </button>
          </div>
        )}

        {showConfirmClose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E2D9] space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#4A3B32]">Confirmar Cierre Semanal</h3>
              <p className="text-xs text-[#7D6E65] leading-relaxed">
                Estás a punto de cerrar el cuadre semanal con un efectivo contado de{" "}
                <strong className="text-[#4A3B32]">{formatDOP(countedCashCents)}</strong> (diferencia:{" "}
                <strong className="text-[#9C4266]">{formatDOP(cashDifferenceCents)}</strong>). ¿Deseas continuar?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7D6E65] hover:bg-[#FAF8F6] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#9C4266] hover:bg-[#831843] rounded-lg disabled:opacity-60"
                >
                  {isSaving ? "Cerrando..." : "Confirmar Cierre"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-[#E8E2D9] text-center">
            <RefreshCw className="w-8 h-8 text-[#9C4266] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-[#4A3B32]">Consolidando ventas y gastos de la semana...</p>
          </div>
        ) : error || !data ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center">
            <AlertTriangle className="w-8 h-8 text-[#E53E3E] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error || "No se pudo cargar el cuadre"}</p>
            <button onClick={loadWeeklyData} className="mt-4 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Panel de Período */}
            <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#7D6E65] block font-semibold">Período de Liquidación:</span>
                <span className="text-sm font-bold text-[#4A3B32]">
                  {new Date(data.weekStart).toLocaleDateString("es-DO")} al {new Date(data.weekEnd).toLocaleDateString("es-DO")}
                </span>
              </div>
              <div className="text-right text-xs text-[#7D6E65]">
                <span>{data.salesCount} ventas registradas</span> • <span>{data.expensesCount} gastos registrados</span>
              </div>
            </div>

            {/* Cuadrícula de Resultados Financieros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
                <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Facturación Bruta</span>
                <span className="text-xl font-bold text-[#4A3B32]">{formatDOP(data.invoicedCents)}</span>
                <span className="text-[10px] text-[#7D6E65] block mt-1">Total vendido en la semana</span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
                <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Costo Ventas (COGS)</span>
                <span className="text-xl font-bold text-[#9C4266]">{formatDOP(data.costOfGoodsCents)}</span>
                <span className="text-[10px] text-[#7D6E65] block mt-1">Costos de insumos y empaques</span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
                <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Gastos Operativos</span>
                <span className="text-xl font-bold text-[#7D6E65]">{formatDOP(data.operationalExpCents)}</span>
                <span className="text-[10px] text-[#7D6E65] block mt-1">Gas, luz, agua y transporte</span>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[#E8E2D9] shadow-sm">
                <span className="text-[11px] text-[#7D6E65] uppercase block font-semibold">Resultado Neto Semanal</span>
                <span className={`text-xl font-bold ${data.netResultCents >= 0 ? "text-[#22543D]" : "text-[#C53030]"}`}>
                  {formatDOP(data.netResultCents)}
                </span>
                <span className="text-[10px] text-[#7D6E65] block mt-1">Ventas - Costos - Gastos</span>
              </div>
            </div>

            {/* SECCIÓN DE ARQUEO FÍSICO DE EFECTIVO */}
            <div className="p-6 bg-white rounded-2xl border border-[#E8E2D9] shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-[#9C4266]" />
                <h3 className="font-serif font-bold text-base text-[#4A3B32]">
                  Arqueo de Efectivo Físico en Caja
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Fondo Inicial de Caja (RD$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashFundDOP}
                    onChange={(e) => setCashFundDOP(parseFloat(e.target.value) || 0)}
                    disabled={isClosed}
                    className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9] bg-white"
                  />
                  <span className="text-[11px] text-[#7D6E65]">Fondo para cambio en caja</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                    Efectivo Contado Físico (RD$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={countedCashDOP}
                    onChange={(e) => setCountedCashDOP(parseFloat(e.target.value) || 0)}
                    disabled={isClosed}
                    className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-[#E8E2D9] bg-white text-[#22543D]"
                  />
                  <span className="text-[11px] text-[#7D6E65]">Dinero contado en el cajón</span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF8F6] border border-[#E8E2D9]">
                  <span className="text-[10px] text-[#7D6E65] uppercase block font-semibold">Efectivo Esperado</span>
                  <span className="text-base font-bold text-[#4A3B32]">{formatDOP(expectedCashCents)}</span>
                  <span className="text-[10px] text-[#7D6E65] block mt-0.5">
                    Fondo + Cobros EF ({formatDOP(data.cashCollectedCents)}) − Gastos EF ({formatDOP(data.cashExpensesCents)})
                  </span>
                </div>
              </div>

              {/* Resultado de Diferencia */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  cashDifferenceCents === 0
                    ? "bg-[#F0FFF4] border-[#9AE6B4] text-[#22543D]"
                    : cashDifferenceCents > 0
                    ? "bg-[#FEFCBF] border-[#F6E05E] text-[#744210]"
                    : "bg-[#FFF5F5] border-[#FEB2B2] text-[#9B2C2C]"
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">
                    {cashDifferenceCents === 0
                      ? "Caja Cuadrada Exacta (Sin diferencia)"
                      : cashDifferenceCents > 0
                      ? `Sobrante de Efectivo (+${formatDOP(cashDifferenceCents)})`
                      : `Faltante de Efectivo (-${formatDOP(Math.abs(cashDifferenceCents))})`}
                  </span>
                  <span className="text-[11px]">
                    Contado: {formatDOP(countedCashCents)} vs Esperado: {formatDOP(expectedCashCents)}
                  </span>
                </div>
                {cashDifferenceCents === 0 && <CheckCircle2 className="w-5 h-5 text-[#22543D]" />}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3B32] mb-1">
                  Notas u Observaciones del Cierre
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isClosed}
                  placeholder="Detalles sobre billetes deteriorados, sobrantes o justificaciones..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#E8E2D9]"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

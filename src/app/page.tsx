"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  ChefHat,
  ArrowRight,
  Clock,
  Sparkles,
  CalendarCheck2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEK_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weeklyMetrics, setWeeklyMetrics] = useState({
    invoicedCents: 0,
    collectedCents: 0,
    pendingCents: 0,
    costOfGoodsCents: 0,
    expensesCents: 0,
    netResultCents: 0,
  });
  const [salesByDay, setSalesByDay] = useState<Array<{ day: string; amountCents: number; count: number }>>(
    WEEK_ORDER.map((day) => ({ day, amountCents: 0, count: 0 }))
  );
  const [topProducts, setTopProducts] = useState<
    Array<{ name: string; sold: number; totalCents: number; margin: string }>
  >([]);
  const [reviewCount, setReviewCount] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resCuadre, resVentas, resRecetas, resIngredientes] = await Promise.all([
        fetch("/api/cuadre"),
        fetch("/api/ventas?status=ACTIVE"),
        fetch("/api/recetas"),
        fetch("/api/ingredientes"),
      ]);

      const [dCuadre, dVentas, dRecetas, dIng] = await Promise.all([
        resCuadre.json(),
        resVentas.json(),
        resRecetas.json(),
        resIngredientes.json(),
      ]);

      if (!dCuadre.success) throw new Error(dCuadre.error || "Error cargando cuadre semanal");
      if (!dVentas.success) throw new Error(dVentas.error || "Error cargando ventas");

      const c = dCuadre.data;
      setWeeklyMetrics({
        invoicedCents: c.invoicedCents || 0,
        collectedCents: c.collectedCents || 0,
        pendingCents: c.pendingCents || 0,
        costOfGoodsCents: c.costOfGoodsCents || 0,
        expensesCents: c.operationalExpCents || 0,
        netResultCents: c.netResultCents || 0,
      });

      const weekStartMs = new Date(c.weekStart).getTime();
      const weekEndMs = new Date(c.weekEnd).getTime();

      const dayBuckets: Record<string, { amountCents: number; count: number }> = {};
      for (const d of WEEK_ORDER) dayBuckets[d] = { amountCents: 0, count: 0 };

      const prodMap = new Map<string, { name: string; sold: number; totalCents: number; costCents: number }>();

      for (const sale of dVentas.data || []) {
        const sTime = new Date(sale.saleDate).getTime();
        if (sTime >= weekStartMs && sTime <= weekEndMs) {
          // Ajustar a AST (UTC-4) para determinar el día exacto en RD
          const ast = new Date(sTime - 4 * 60 * 60 * 1000);
          const dayName = DAY_NAMES[ast.getUTCDay()];
          if (dayBuckets[dayName]) {
            dayBuckets[dayName].amountCents += sale.totalCents || 0;
            dayBuckets[dayName].count += 1;
          }
        }

        for (const item of sale.items || []) {
          const key = item.productName || "Producto";
          const curr = prodMap.get(key) || { name: key, sold: 0, totalCents: 0, costCents: 0 };
          curr.sold += item.quantity || 0;
          curr.totalCents += item.totalCents || 0;
          curr.costCents += item.totalCostCents || 0;
          prodMap.set(key, curr);
        }
      }

      setSalesByDay(WEEK_ORDER.map((day) => ({ day, ...dayBuckets[day] })));

      const top = Array.from(prodMap.values())
        .sort((a, b) => b.totalCents - a.totalCents)
        .slice(0, 5)
        .map((p) => {
          const marginPct = p.totalCents > 0 ? ((p.totalCents - p.costCents) / p.totalCents) * 100 : 0;
          return {
            name: p.name,
            sold: Number(p.sold.toFixed(1)),
            totalCents: p.totalCents,
            margin: `${marginPct.toFixed(0)}%`,
          };
        });
      setTopProducts(top);

      const recReview = (dRecetas.success ? dRecetas.data : []).filter((r: any) => r.reviewFlag).length;
      const ingReview = (dIng.success ? dIng.data : []).filter((i: any) => i.reviewFlag).length;
      setReviewCount(recReview + ingReview);
    } catch (err: any) {
      setError(err.message || "Error cargando métricas del panel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const maxDayAmount = Math.max(100000, ...salesByDay.map((d) => d.amountCents));

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Panel General — K_Sweet"
        subtitle="Semana activa (Lunes a Domingo) • República Dominicana (RD$)"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
        {loading ? (
          <div className="bg-white rounded-xl p-12 border border-cream-300 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-plum-500 animate-spin mx-auto" />
            <p className="text-sm font-medium text-ink">Cargando métricas reales de la semana...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FFF5F5] rounded-xl p-8 border border-[#FED7D7] text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#E53E3E] mx-auto" />
            <p className="text-sm font-semibold text-[#9B2C2C]">{error}</p>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#E53E3E] text-white text-xs font-semibold rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : (
          <>
            {reviewCount > 0 && (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 shadow-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-amber-900">
                    Atención ({reviewCount} recetas/insumos marcados para revisión):
                  </span>{" "}
                  <span className="text-amber-800">
                    Existen registros importados desde Excel con referencias comerciales o alertas pendientes de validación.
                  </span>
                  <div className="mt-2 flex gap-3">
                    <Link
                      href="/recetas"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-plum-600 hover:text-plum-700 underline"
                    >
                      Revisar recetas <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/ingredientes"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-plum-600 hover:text-plum-700 underline"
                    >
                      Revisar productos <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
                <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
                  <span>Facturado Semana</span>
                  <ShoppingCart className="w-4 h-4 text-plum-500" />
                </div>
                <p className="text-2xl font-serif font-bold text-ink tabular-nums">
                  {formatDOP(weeklyMetrics.invoicedCents)}
                </p>
                <p className="text-[11px] text-ink-muted mt-1 tabular-nums">
                  Cobrado: {formatDOP(weeklyMetrics.collectedCents)}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
                <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
                  <span>Por Cobrar (Saldo)</span>
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-serif font-bold text-amber-700 tabular-nums">
                  {formatDOP(weeklyMetrics.pendingCents)}
                </p>
                <p className="text-[11px] text-ink-muted mt-1">Saldo pendiente de ventas activas</p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
                <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
                  <span>Costos + Gastos Oper.</span>
                  <Receipt className="w-4 h-4 text-ink-muted" />
                </div>
                <p className="text-2xl font-serif font-bold text-ink tabular-nums">
                  {formatDOP(weeklyMetrics.costOfGoodsCents + weeklyMetrics.expensesCents)}
                </p>
                <p className="text-[11px] text-ink-muted mt-1 tabular-nums">
                  COGS: {formatDOP(weeklyMetrics.costOfGoodsCents)} • Gastos: {formatDOP(weeklyMetrics.expensesCents)}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white border border-plum-200 shadow-card">
                <div className="flex items-center justify-between text-xs text-plum-600 font-semibold mb-2">
                  <span>Resultado Neto Semana</span>
                  <TrendingUp className="w-4 h-4 text-plum-500" />
                </div>
                <p
                  className={`text-2xl font-serif font-bold tabular-nums ${
                    weeklyMetrics.netResultCents >= 0 ? "text-sage-600" : "text-red-600"
                  }`}
                >
                  {formatDOP(weeklyMetrics.netResultCents)}
                </p>
                <p className="text-[11px] text-ink-muted mt-1">Facturado − COGS − Gastos Operativos</p>
              </div>
            </div>

            {/* Ventas por Día & Productos Principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-cream-300 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-serif font-bold text-ink">Ventas por Día (Semana Actual)</h3>
                    <p className="text-xs text-ink-muted">Distribución de ingresos y órdenes de Lunes a Domingo</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-cream-200 text-ink-light font-medium tabular-nums">
                    {salesByDay.reduce((acc, d) => acc + d.count, 0)} órdenes
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {salesByDay.map((item) => {
                    const percentage = Math.min(100, Math.round((item.amountCents / maxDayAmount) * 100));
                    return (
                      <div key={item.day} className="flex items-center gap-3 text-xs">
                        <span className="w-20 font-medium text-ink shrink-0">{item.day}</span>
                        <div className="flex-1 bg-cream-200/80 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-plum-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-24 text-right font-semibold text-ink tabular-nums">
                          {formatDOP(item.amountCents)}
                        </span>
                        <span className="w-16 text-right text-ink-muted tabular-nums">({item.count} ped.)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 rounded-xl bg-white border border-cream-300 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-bold text-ink">Postres Más Vendidos</h3>
                    <ChefHat className="w-4 h-4 text-plum-500" />
                  </div>

                  {topProducts.length === 0 ? (
                    <p className="text-xs text-ink-muted py-6 text-center">
                      Aún no hay ventas registradas para mostrar el ranking.
                    </p>
                  ) : (
                    <div className="space-y-3.5">
                      {topProducts.map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center justify-between text-xs pb-3 border-b border-cream-200 last:border-0 last:pb-0 gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{p.name}</p>
                            <p className="text-[11px] text-ink-muted tabular-nums">
                              {p.sold} vendidos • Margen: {p.margin}
                            </p>
                          </div>
                          <span className="font-bold text-plum-600 tabular-nums shrink-0">
                            {formatDOP(p.totalCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  href="/ventas"
                  className="mt-6 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cream-100 hover:bg-cream-200 text-plum-600 font-semibold text-xs transition-colors border border-cream-300"
                >
                  <span>Ver reporte detallado de ventas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Acceso Rápido a Módulos Críticos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            href="/cuadre"
            className="p-5 rounded-xl bg-white border border-cream-300 hover:border-plum-400 shadow-card transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-plum-100 text-plum-600 flex items-center justify-center mb-3 group-hover:bg-plum-500 group-hover:text-white transition-colors">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-ink text-sm">Cuadre Semanal (L-D)</h4>
            <p className="text-xs text-ink-muted mt-1">
              Arqueo de efectivo contado vs esperado, control de cobranzas y cierre dominical.
            </p>
          </Link>

          <Link
            href="/costos-precios"
            className="p-5 rounded-xl bg-white border border-cream-300 hover:border-plum-400 shadow-card transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-plum-100 text-plum-600 flex items-center justify-center mb-3 group-hover:bg-plum-500 group-hover:text-white transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-ink text-sm">Costos y Precios P = C / (1 - M)</h4>
            <p className="text-xs text-ink-muted mt-1">
              Diferenciación matemática entre margen sobre venta y recargo sobre costo.
            </p>
          </Link>

          <Link
            href="/conversiones"
            className="p-5 rounded-xl bg-white border border-cream-300 hover:border-plum-400 shadow-card transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-plum-100 text-plum-600 flex items-center justify-center mb-3 group-hover:bg-plum-500 group-hover:text-white transition-colors">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-ink text-sm">Calculadora de Conversiones</h4>
            <p className="text-xs text-ink-muted mt-1">
              Conversiones exactas (1 lb = 453.59g) con densidad y tabla de equivalencias Excel.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

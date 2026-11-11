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
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { formatDOP } from "@/lib/utils";

export default function DashboardPage() {
  // Métricas del hito presente para K_Sweet (datos demostrativos basados en el modelo de dominio)
  const weeklyMetrics = {
    invoicedCents: 4850000, // RD$ 48,500.00
    collectedCents: 4200000, // RD$ 42,000.00
    pendingCents: 650000, // RD$ 6,500.00
    costOfGoodsCents: 1940000, // RD$ 19,400.00
    expensesCents: 780000, // RD$ 7,800.00
    netResultCents: 2130000, // RD$ 21,300.00
  };

  const pendingReviewAlerts = [
    {
      id: "REC-01",
      title: "Cheesecake de Fresa",
      reason: "Fórmula #REF! detectada en filas 47-51 del archivo de origen",
      severity: "alta",
    },
    {
      id: "ING-02",
      title: "Harina de Trigo (Paquete 5 Libras)",
      reason: "Factor de empaque multiplicado erróneamente en el Excel original (453g vs 2,267.96g)",
      severity: "alta",
    },
    {
      id: "REC-03",
      title: "Galletas de Chispas",
      reason: "Unidad ambigua 'unidad según Excel' requiere validación de porciones",
      severity: "media",
    },
  ];

  const topProducts = [
    { name: "Cheesecake Clásico 8\"", sold: 18, totalCents: 2520000, margin: "52%" },
    { name: "Bizcocho Dominicano Suspiro 1 lb", sold: 12, totalCents: 1560000, margin: "48%" },
    { name: "Caja Brownies Artesanales (6 uds)", sold: 25, totalCents: 1125000, margin: "58%" },
    { name: "Tres Leches Tradicional", sold: 14, totalCents: 840000, margin: "45%" },
  ];

  const salesByDay = [
    { day: "Lunes", amountCents: 520000, count: 4 },
    { day: "Martes", amountCents: 680000, count: 5 },
    { day: "Miércoles", amountCents: 450000, count: 3 },
    { day: "Jueves", amountCents: 790000, count: 6 },
    { day: "Viernes", amountCents: 1120000, count: 9 },
    { day: "Sábado", amountCents: 890000, count: 8 },
    { day: "Domingo", amountCents: 400000, count: 3 },
  ];

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <Header
        title="Panel General — K_Sweet"
        subtitle="Semana activa (Lunes a Domingo) • República Dominicana (RD$)"
      />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Banner de Bienvenida y Alertas Críticas */}
        {pendingReviewAlerts.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 shadow-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-amber-900">
                Atención ({pendingReviewAlerts.length} recetas/ingredientes requieren revisión):
              </span>{" "}
              <span className="text-amber-800">
                Se detectaron inconsistencias en las fórmulas del Excel de origen. Están marcadas como borradores y no como costos definitivos.
              </span>
              <div className="mt-2 flex gap-2">
                <Link
                  href="/recetas"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-plum-600 hover:text-plum-700 underline"
                >
                  Revisar recetas pendientes <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tarjetas de Métricas Principales (Semana L-D) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Facturado */}
          <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium uppercase tracking-wider mb-2">
              <span>Facturado Semanal</span>
              <ShoppingCart className="w-4 h-4 text-plum-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-ink">
              {formatDOP(weeklyMetrics.invoicedCents)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span>Cobrado: {formatDOP(weeklyMetrics.collectedCents)}</span>
              <span className="text-amber-600 font-medium">
                Pend: {formatDOP(weeklyMetrics.pendingCents)}
              </span>
            </div>
          </div>

          {/* Costo de lo Vendido (COGS) */}
          <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium uppercase tracking-wider mb-2">
              <span>Costo de lo Vendido</span>
              <Receipt className="w-4 h-4 text-plum-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-ink">
              {formatDOP(weeklyMetrics.costOfGoodsCents)}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Costos históricos congelados por cada venta
            </p>
          </div>

          {/* Gastos Operativos */}
          <div className="p-5 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between text-ink-muted text-xs font-medium uppercase tracking-wider mb-2">
              <span>Gastos Operativos</span>
              <DollarSign className="w-4 h-4 text-plum-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-ink">
              {formatDOP(weeklyMetrics.expensesCents)}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Excluye compras de insumos para no duplicar
            </p>
          </div>

          {/* Resultado Estimado (Utilidad Neta) */}
          <div className="p-5 rounded-xl bg-white border border-sage-500/30 shadow-card bg-gradient-to-br from-white to-sage-500/5">
            <div className="flex items-center justify-between text-sage-600 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Resultado Estimado</span>
              <TrendingUp className="w-4 h-4 text-sage-500" />
            </div>
            <p className="text-2xl font-bold font-serif text-sage-600">
              {formatDOP(weeklyMetrics.netResultCents)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-sage-600 font-medium">
              <span>Margen Neto: 43.9%</span>
              <span className="text-ink-muted">Lunes a Domingo</span>
            </div>
          </div>
        </div>

        {/* Sección: Ventas por Día & Productos Principales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ventas por Día de la Semana */}
          <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-cream-300 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-ink">Ventas por Día (Semana Actual)</h3>
                <p className="text-xs text-ink-muted">Distribución de ingresos y órdenes de Lunes a Domingo</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cream-200 text-ink-light font-medium">
                {salesByDay.reduce((acc, d) => acc + d.count, 0)} órdenes
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {salesByDay.map((item) => {
                const maxAmount = 1200000;
                const percentage = Math.min(100, Math.round((item.amountCents / maxAmount) * 100));
                return (
                  <div key={item.day} className="flex items-center gap-4 text-xs">
                    <span className="w-20 font-medium text-ink shrink-0">{item.day}</span>
                    <div className="flex-1 bg-cream-200/80 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-plum-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="w-28 text-right font-semibold text-ink">
                      {formatDOP(item.amountCents)}
                    </span>
                    <span className="w-16 text-right text-ink-muted">({item.count} ped.)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Productos Principales */}
          <div className="p-6 rounded-xl bg-white border border-cream-300 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-ink">Postres Más Vendidos</h3>
                <ChefHat className="w-4 h-4 text-plum-500" />
              </div>

              <div className="space-y-3.5">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs pb-3 border-b border-cream-200 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="text-[11px] text-ink-muted">{p.sold} vendidos • Margen: {p.margin}</p>
                    </div>
                    <span className="font-bold text-plum-600">{formatDOP(p.totalCents)}</span>
                  </div>
                ))}
              </div>
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

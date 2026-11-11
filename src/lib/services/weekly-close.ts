// Servicio de Cuadre Semanal (Lunes a Domingo) — K_Sweet (RF-006 a RF-009)
import { prisma } from "@/lib/prisma";
import { getWeekBounds } from "@/lib/constants";

/**
 * Calcula en tiempo real las métricas semanales de Lunes a Domingo
 */
export async function calculateWeekMetrics(referenceDate: Date) {
  const { start, end } = getWeekBounds(referenceDate);

  // 1. Ventas de la semana
  const sales = await prisma.sale.findMany({
    where: {
      status: "ACTIVE",
      saleDate: {
        gte: start,
        lte: end,
      },
    },
    include: {
      payments: true,
      items: true,
    },
  });

  let invoicedCents = 0;
  let collectedCents = 0;
  let costOfGoodsCents = 0;
  let cashCollectedCents = 0;

  for (const sale of sales) {
    invoicedCents += sale.totalCents;
    collectedCents += sale.collectedCents;
    costOfGoodsCents += sale.totalCostCents;

    for (const payment of sale.payments) {
      if (payment.method === "EFECTIVO") {
        cashCollectedCents += payment.amountCents;
      }
    }
  }

  const pendingCents = invoicedCents - collectedCents;

  // 2. Gastos operativos de la semana
  const expenses = await prisma.operationalExpense.findMany({
    where: {
      expenseDate: {
        gte: start,
        lte: end,
      },
    },
  });

  let operationalExpCents = 0;
  let cashExpensesCents = 0;

  for (const expense of expenses) {
    // Si no es compra de insumos duplicada con COGS
    if (!expense.isIngredientPurchase) {
      operationalExpCents += expense.amountCents;
    }
    if (expense.paymentMethod === "EFECTIVO") {
      cashExpensesCents += expense.amountCents;
    }
  }

  // 3. Resultado estimado (Utilidad Neta del período)
  const netResultCents = invoicedCents - costOfGoodsCents - operationalExpCents;

  return {
    weekStart: start,
    weekEnd: end,
    salesCount: sales.length,
    invoicedCents,
    collectedCents,
    pendingCents,
    costOfGoodsCents,
    operationalExpCents,
    netResultCents,
    cashCollectedCents,
    cashExpensesCents,
  };
}

/**
 * Genera o actualiza el cierre semanal y calcula arqueo de caja
 */
export async function closeWeek(params: {
  referenceDate: Date;
  cashFundCents: number;
  countedCashCents: number;
  notes?: string;
}) {
  const metrics = await calculateWeekMetrics(params.referenceDate);

  // Efectivo esperado = Fondo Inicial + Cobros en efectivo - Gastos en efectivo
  const expectedCashCents = params.cashFundCents + metrics.cashCollectedCents - metrics.cashExpensesCents;
  const cashDifferenceCents = params.countedCashCents - expectedCashCents;

  return await prisma.weeklyClose.upsert({
    where: {
      weekStart: metrics.weekStart,
    },
    create: {
      weekStart: metrics.weekStart,
      weekEnd: metrics.weekEnd,
      invoicedCents: metrics.invoicedCents,
      collectedCents: metrics.collectedCents,
      pendingCents: metrics.pendingCents,
      costOfGoodsCents: metrics.costOfGoodsCents,
      operationalExpCents: metrics.operationalExpCents,
      netResultCents: metrics.netResultCents,
      cashFundCents: params.cashFundCents,
      expectedCashCents,
      countedCashCents: params.countedCashCents,
      cashDifferenceCents,
      isClosed: true,
      closedAt: new Date(),
      notes: params.notes,
      modifiedAfterClose: false,
    },
    update: {
      invoicedCents: metrics.invoicedCents,
      collectedCents: metrics.collectedCents,
      pendingCents: metrics.pendingCents,
      costOfGoodsCents: metrics.costOfGoodsCents,
      operationalExpCents: metrics.operationalExpCents,
      netResultCents: metrics.netResultCents,
      cashFundCents: params.cashFundCents,
      expectedCashCents,
      countedCashCents: params.countedCashCents,
      cashDifferenceCents,
      isClosed: true,
      closedAt: new Date(),
      notes: params.notes,
    },
  });
}

/**
 * Verifica si hay ventas o gastos ingresados/alterados en un período ya cerrado (RF-009)
 */
export async function checkPostCloseAlterations(weekStart: Date) {
  const closed = await prisma.weeklyClose.findUnique({
    where: { weekStart },
  });

  if (!closed || !closed.isClosed) return { hasAlterations: false };

  const current = await calculateWeekMetrics(weekStart);

  const hasAlterations =
    current.invoicedCents !== closed.invoicedCents ||
    current.costOfGoodsCents !== closed.costOfGoodsCents ||
    current.operationalExpCents !== closed.operationalExpCents;

  if (hasAlterations && !closed.modifiedAfterClose) {
    await prisma.weeklyClose.update({
      where: { weekStart },
      data: { modifiedAfterClose: true },
    });
  }

  return {
    hasAlterations,
    diffInvoiced: current.invoicedCents - closed.invoicedCents,
    diffCogs: current.costOfGoodsCents - closed.costOfGoodsCents,
    diffExpenses: current.operationalExpCents - closed.operationalExpCents,
  };
}

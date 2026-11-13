import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getWeekBounds(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { weekStart: monday, weekEnd: sunday };
}

// GET /api/cuadre — Resumen de la semana actual o específica
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const { weekStart, weekEnd } = getWeekBounds(targetDate);

    // Ventas de la semana
    const sales = await prisma.sale.findMany({
      where: {
        status: "ACTIVE",
        saleDate: { gte: weekStart, lte: weekEnd },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    // Gastos de la semana
    const expenses = await prisma.operationalExpense.findMany({
      where: {
        expenseDate: { gte: weekStart, lte: weekEnd },
      },
      include: { category: true },
    });

    let invoicedCents = 0;
    let collectedCents = 0;
    let costOfGoodsCents = 0;
    let cashCollectedCents = 0;

    for (const s of sales) {
      invoicedCents += s.totalCents;
      collectedCents += s.collectedCents;
      costOfGoodsCents += s.totalCostCents;

      for (const p of s.payments) {
        if (p.method === "EFECTIVO") {
          cashCollectedCents += p.amountCents;
        }
      }
    }

    let operationalExpCents = 0;
    let cashExpensesCents = 0;

    for (const e of expenses) {
      operationalExpCents += e.amountCents;
      if (e.paymentMethod === "EFECTIVO") {
        cashExpensesCents += e.amountCents;
      }
    }

    const pendingCents = Math.max(0, invoicedCents - collectedCents);
    const netResultCents = invoicedCents - costOfGoodsCents - operationalExpCents;

    // Buscar si ya existe un cierre guardado para esta semana
    const existingClose = await prisma.weeklyClose.findFirst({
      where: {
        weekStart: { gte: new Date(weekStart.getTime() - 1000), lte: new Date(weekStart.getTime() + 1000) },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        invoicedCents,
        collectedCents,
        pendingCents,
        costOfGoodsCents,
        operationalExpCents,
        netResultCents,
        cashCollectedCents,
        cashExpensesCents,
        salesCount: sales.length,
        expensesCount: expenses.length,
        existingClose,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/cuadre — Registrar arqueo físico y cerrar semana
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      weekStart,
      weekEnd,
      cashFundCents = 0,
      countedCashCents = 0,
      notes,
    } = body;

    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);

    // Recalcular totales reales
    const sales = await prisma.sale.findMany({
      where: { status: "ACTIVE", saleDate: { gte: startDate, lte: endDate } },
      include: { payments: true },
    });
    const expenses = await prisma.operationalExpense.findMany({
      where: { expenseDate: { gte: startDate, lte: endDate } },
    });

    let invoicedCents = 0;
    let collectedCents = 0;
    let costOfGoodsCents = 0;
    let cashCollectedCents = 0;

    for (const s of sales) {
      invoicedCents += s.totalCents;
      collectedCents += s.collectedCents;
      costOfGoodsCents += s.totalCostCents;
      for (const p of s.payments) {
        if (p.method === "EFECTIVO") cashCollectedCents += p.amountCents;
      }
    }

    let operationalExpCents = 0;
    let cashExpensesCents = 0;
    for (const e of expenses) {
      operationalExpCents += e.amountCents;
      if (e.paymentMethod === "EFECTIVO") cashExpensesCents += e.amountCents;
    }

    const expectedCashCents = (parseInt(cashFundCents) || 0) + cashCollectedCents - cashExpensesCents;
    const counted = parseInt(countedCashCents) || 0;
    const cashDifferenceCents = counted - expectedCashCents;

    const saved = await prisma.weeklyClose.upsert({
      where: { weekStart: startDate },
      create: {
        weekStart: startDate,
        weekEnd: endDate,
        invoicedCents,
        collectedCents,
        pendingCents: invoicedCents - collectedCents,
        costOfGoodsCents,
        operationalExpCents,
        netResultCents: invoicedCents - costOfGoodsCents - operationalExpCents,
        cashFundCents: parseInt(cashFundCents) || 0,
        expectedCashCents,
        countedCashCents: counted,
        cashDifferenceCents,
        isClosed: true,
        closedAt: new Date(),
        notes: notes || null,
      },
      update: {
        invoicedCents,
        collectedCents,
        pendingCents: invoicedCents - collectedCents,
        costOfGoodsCents,
        operationalExpCents,
        netResultCents: invoicedCents - costOfGoodsCents - operationalExpCents,
        cashFundCents: parseInt(cashFundCents) || 0,
        expectedCashCents,
        countedCashCents: counted,
        cashDifferenceCents,
        isClosed: true,
        closedAt: new Date(),
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

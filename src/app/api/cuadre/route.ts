import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWeekBounds } from "@/lib/constants";
import { handleApiError } from "@/lib/api-errors";

const closeWeekSchema = z.object({
  weekStart: z.string().min(1),
  weekEnd: z.string().min(1),
  cashFundCents: z.coerce.number().int().min(0).default(0),
  countedCashCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

async function computeWeeklySummary(weekStart: Date, weekEnd: Date) {
  const [sales, cashPayments, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "ACTIVE",
        saleDate: { gte: weekStart, lte: weekEnd },
      },
      select: {
        totalCents: true,
        collectedCents: true,
        totalCostCents: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        method: "EFECTIVO",
        paidAt: { gte: weekStart, lte: weekEnd },
        sale: { status: "ACTIVE" },
      },
      select: { amountCents: true },
    }),
    prisma.operationalExpense.findMany({
      where: {
        expenseDate: { gte: weekStart, lte: weekEnd },
      },
      select: {
        amountCents: true,
        paymentMethod: true,
        isIngredientPurchase: true,
      },
    }),
  ]);

  let invoicedCents = 0;
  let collectedCents = 0;
  let costOfGoodsCents = 0;
  for (const s of sales) {
    invoicedCents += s.totalCents;
    collectedCents += s.collectedCents;
    costOfGoodsCents += s.totalCostCents;
  }

  let cashCollectedCents = 0;
  for (const p of cashPayments) {
    cashCollectedCents += p.amountCents;
  }

  let operationalExpCents = 0;
  let cashExpensesCents = 0;
  for (const e of expenses) {
    // RF-020: excluir compras de ingredientes ya imputadas al COGS para no duplicar gastos
    if (e.isIngredientPurchase) continue;
    operationalExpCents += e.amountCents;
    if (e.paymentMethod === "EFECTIVO") {
      cashExpensesCents += e.amountCents;
    }
  }

  const pendingCents = Math.max(0, invoicedCents - collectedCents);
  const netResultCents = invoicedCents - costOfGoodsCents - operationalExpCents;

  return {
    invoicedCents,
    collectedCents,
    pendingCents,
    costOfGoodsCents,
    operationalExpCents,
    netResultCents,
    cashCollectedCents,
    cashExpensesCents,
    salesCount: sales.length,
    expensesCount: expenses.filter((e: { isIngredientPurchase: boolean }) => !e.isIngredientPurchase).length,
  };
}

// GET /api/cuadre — Resumen de la semana actual o específica (Lunes a Domingo AST UTC-4)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ success: false, error: "Fecha inválida para el cuadre." }, { status: 400 });
    }

    const { start: weekStart, end: weekEnd } = getWeekBounds(targetDate);
    const summary = await computeWeeklySummary(weekStart, weekEnd);

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
        ...summary,
        existingClose,
      },
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/cuadre — Registrar arqueo físico y cerrar semana
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = closeWeekSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos para cerrar el cuadre semanal." },
        { status: 400 }
      );
    }

    const rawStart = new Date(parsed.data.weekStart);
    if (Number.isNaN(rawStart.getTime())) {
      return NextResponse.json({ success: false, error: "Fecha de inicio inválida." }, { status: 400 });
    }

    const { start: startDate, end: endDate } = getWeekBounds(rawStart);
    const summary = await computeWeeklySummary(startDate, endDate);

    const cashFundCents = parsed.data.cashFundCents;
    const countedCashCents = parsed.data.countedCashCents;
    const expectedCashCents = cashFundCents + summary.cashCollectedCents - summary.cashExpensesCents;
    const cashDifferenceCents = countedCashCents - expectedCashCents;

    const saved = await prisma.weeklyClose.upsert({
      where: { weekStart: startDate },
      create: {
        weekStart: startDate,
        weekEnd: endDate,
        invoicedCents: summary.invoicedCents,
        collectedCents: summary.collectedCents,
        pendingCents: summary.pendingCents,
        costOfGoodsCents: summary.costOfGoodsCents,
        operationalExpCents: summary.operationalExpCents,
        netResultCents: summary.netResultCents,
        cashFundCents,
        expectedCashCents,
        countedCashCents,
        cashDifferenceCents,
        isClosed: true,
        closedAt: new Date(),
        modifiedAfterClose: false,
        notes: parsed.data.notes || null,
      },
      update: {
        invoicedCents: summary.invoicedCents,
        collectedCents: summary.collectedCents,
        pendingCents: summary.pendingCents,
        costOfGoodsCents: summary.costOfGoodsCents,
        operationalExpCents: summary.operationalExpCents,
        netResultCents: summary.netResultCents,
        cashFundCents,
        expectedCashCents,
        countedCashCents,
        cashDifferenceCents,
        isClosed: true,
        closedAt: new Date(),
        modifiedAfterClose: false,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return handleApiError(error);
  }
}

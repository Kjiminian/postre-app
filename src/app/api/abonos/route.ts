import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWeekBounds } from "@/lib/constants";
import { handleApiError } from "@/lib/api-errors";

const abonoSchema = z.object({
  saleId: z.string().min(1),
  amountCents: z.coerce.number().int().positive(),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA"]).default("EFECTIVO"),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// POST /api/abonos — Registrar abono o cobro a una venta existente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = abonoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Venta, método de pago válido y monto (> 0) son requeridos." },
        { status: 400 }
      );
    }

    const { saleId, amountCents, method, reference, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx: any) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) {
        return { error: "Venta no encontrada", status: 404 as const };
      }
      if (sale.status === "CANCELLED") {
        return { error: "No se pueden registrar abonos sobre una venta anulada.", status: 400 as const };
      }

      const pendingBalance = Math.max(0, sale.totalCents - sale.collectedCents);
      if (amountCents > pendingBalance) {
        return {
          error: `El abono (RD$ ${(amountCents / 100).toFixed(2)}) excede el saldo pendiente (RD$ ${(pendingBalance / 100).toFixed(2)}).`,
          status: 400 as const,
        };
      }

      const newCollectedCents = sale.collectedCents + amountCents;
      const newBalanceCents = Math.max(0, sale.totalCents - newCollectedCents);
      const paidAt = new Date();

      const payment = await tx.payment.create({
        data: {
          saleId,
          amountCents,
          method,
          paidAt,
          reference: reference || null,
          notes: notes || null,
        },
      });

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          collectedCents: newCollectedCents,
          balanceCents: newBalanceCents,
        },
        include: { payments: true, customer: true, items: true },
      });

      // RF-009: marcar si el abono afecta una semana ya cerrada
      const { start } = getWeekBounds(paidAt);
      await tx.weeklyClose.updateMany({
        where: {
          weekStart: { gte: new Date(start.getTime() - 1000), lte: new Date(start.getTime() + 1000) },
          isClosed: true,
        },
        data: { modifiedAfterClose: true },
      });

      return { payment, sale: updatedSale };
    });

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return handleApiError(error);
  }
}

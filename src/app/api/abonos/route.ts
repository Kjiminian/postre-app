import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/abonos — Registrar abono o cobro a una venta existente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { saleId, amountCents, method = "EFECTIVO", reference, notes } = body;

    if (!saleId || !amountCents || amountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "Venta y monto válido (>0) son requeridos" },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });

    const newCollectedCents = sale.collectedCents + parseInt(amountCents);
    const newBalanceCents = Math.max(0, sale.totalCents - newCollectedCents);

    const [payment, updatedSale] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          saleId,
          amountCents: parseInt(amountCents),
          method,
          reference: reference || null,
          notes: notes || null,
        },
      }),
      prisma.sale.update({
        where: { id: saleId },
        data: {
          collectedCents: newCollectedCents,
          balanceCents: newBalanceCents,
        },
        include: { payments: true, customer: true, items: true },
      }),
    ]);

    return NextResponse.json({ success: true, data: { payment, sale: updatedSale } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

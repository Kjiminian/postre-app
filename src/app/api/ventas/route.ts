import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ventas — Listar ventas con sus items, cliente y pagos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    const sales = await prisma.sale.findMany({
      where: status === "ALL" ? {} : { status },
      include: {
        customer: true,
        items: {
          include: {
            recipe: true,
            presentation: true,
          },
        },
        payments: {
          orderBy: { paidAt: "asc" },
        },
      },
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json({ success: true, data: sales });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/ventas — Registrar nueva venta con congelación histórica de costos y precios
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerId,
      customerName,
      saleDate,
      items = [], // Array de { recipeId, presentationId, productName, quantity, unitPriceCents, unitCostCents }
      paymentMethod = "EFECTIVO",
      collectedCents = 0,
      paymentReference,
      notes,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: "La venta debe incluir al menos un producto" }, { status: 400 });
    }

    let calculatedTotalCents = 0;
    let calculatedTotalCostCents = 0;

    // Procesar items y congelar costos y precios (RF-014)
    const formattedItems = await Promise.all(
      items.map(async (item: any) => {
        let unitCostCents = parseInt(item.unitCostCents) || 0;
        let unitPriceCents = parseInt(item.unitPriceCents) || 0;
        let productName = item.productName || "Producto K_Sweet";

        // Si viene presentationId, cargar datos reales de la presentación
        if (item.presentationId) {
          const pres = await prisma.recipePresentation.findUnique({
            where: { id: item.presentationId },
            include: { recipe: true },
          });
          if (pres) {
            productName = `${pres.recipe.name} — ${pres.name}`;
            if (!unitPriceCents) unitPriceCents = pres.finalPriceCents;
            if (!unitCostCents) unitCostCents = pres.totalCostCents;
          }
        } else if (item.recipeId) {
          const rec = await prisma.recipe.findUnique({ where: { id: item.recipeId } });
          if (rec) {
            productName = rec.name;
            if (!unitPriceCents) unitPriceCents = rec.currentPriceCents;
            if (!unitCostCents) unitCostCents = rec.unitCostCents;
          }
        }

        const qty = parseFloat(item.quantity) || 1;
        const totalLineCents = Math.round(qty * unitPriceCents);
        const totalLineCostCents = Math.round(qty * unitCostCents);

        calculatedTotalCents += totalLineCents;
        calculatedTotalCostCents += totalLineCostCents;

        return {
          recipeId: item.recipeId || null,
          presentationId: item.presentationId || null,
          productName,
          quantity: qty,
          unitPriceCents,
          totalCents: totalLineCents,
          unitCostCents, // CONGELADO HISTORICAMENTE
          totalCostCents: totalLineCostCents, // CONGELADO HISTORICAMENTE
          notes: item.notes || null,
        };
      })
    );

    const paidCents = parseInt(collectedCents) || 0;
    const balanceCents = Math.max(0, calculatedTotalCents - paidCents);

    const created = await prisma.sale.create({
      data: {
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        customerId: customerId || null,
        customerName: customerName || null,
        totalCents: calculatedTotalCents,
        totalCostCents: calculatedTotalCostCents,
        collectedCents: paidCents,
        balanceCents,
        paymentMethod,
        status: "ACTIVE",
        notes: notes || null,
        items: {
          create: formattedItems,
        },
        ...(paidCents > 0 && {
          payments: {
            create: [
              {
                amountCents: paidCents,
                method: paymentMethod,
                reference: paymentReference || null,
                notes: "Cobro inicial al registrar venta",
              },
            ],
          },
        }),
      },
      include: {
        customer: true,
        items: { include: { presentation: true, recipe: true } },
        payments: true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/ventas — Anular venta
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const cancelled = await prisma.sale.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true, data: cancelled });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

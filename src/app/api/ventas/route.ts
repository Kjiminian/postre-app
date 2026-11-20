import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWeekBounds } from "@/lib/constants";
import { handleApiError } from "@/lib/api-errors";

const saleItemSchema = z.object({
  recipeId: z.string().optional().nullable(),
  presentationId: z.string().optional().nullable(),
  productName: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPriceCents: z.coerce.number().int().min(0).optional(),
  unitCostCents: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const createSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  saleDate: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "PENDIENTE"]).default("EFECTIVO"),
  collectedCents: z.coerce.number().int().min(0).default(0),
  paymentReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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
    return handleApiError(error);
  }
}

// POST /api/ventas — Registrar nueva venta con congelación histórica de costos y precios (RF-014)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos de venta inválidos. Verifica productos, cantidades y montos." },
        { status: 400 }
      );
    }

    const {
      customerId,
      customerName,
      saleDate,
      items,
      paymentMethod,
      collectedCents,
      paymentReference,
      notes,
    } = parsed.data;

    const parsedDate = saleDate ? new Date(saleDate) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ success: false, error: "Fecha de venta inválida." }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx: any) => {
      // Batch lookup para evitar consultas N+1
      const presIds = items.map((i) => i.presentationId).filter(Boolean) as string[];
      const recIds = items.map((i) => i.recipeId).filter(Boolean) as string[];

      const [presentations, recipes] = await Promise.all([
        presIds.length
          ? tx.recipePresentation.findMany({
              where: { id: { in: presIds } },
              include: { recipe: true },
            })
          : [],
        recIds.length
          ? tx.recipe.findMany({ where: { id: { in: recIds } } })
          : [],
      ]);

      const presMap = new Map<string, any>(presentations.map((p: any) => [p.id, p]));
      const recMap = new Map<string, any>(recipes.map((r: any) => [r.id, r]));

      let calculatedTotalCents = 0;
      let calculatedTotalCostCents = 0;

      const formattedItems = items.map((item) => {
        let unitCostCents = item.unitCostCents ?? 0;
        let unitPriceCents = item.unitPriceCents ?? 0;
        let productName = item.productName?.trim() || "Producto K_Sweet";
        let resolvedRecipeId = item.recipeId || null;

        if (item.presentationId) {
          const pres = presMap.get(item.presentationId);
          if (pres) {
            productName = `${pres.recipe.name} — ${pres.name}`;
            resolvedRecipeId = pres.recipeId;
            if (!unitPriceCents) unitPriceCents = pres.finalPriceCents;
            if (!unitCostCents) unitCostCents = pres.totalCostCents;
          }
        } else if (item.recipeId) {
          const rec = recMap.get(item.recipeId);
          if (rec) {
            productName = rec.name;
            if (!unitPriceCents) unitPriceCents = rec.currentPriceCents;
            if (!unitCostCents) unitCostCents = rec.unitCostCents;
          }
        }

        const totalLineCents = Math.round(item.quantity * unitPriceCents);
        const totalLineCostCents = Math.round(item.quantity * unitCostCents);

        calculatedTotalCents += totalLineCents;
        calculatedTotalCostCents += totalLineCostCents;

        return {
          recipeId: resolvedRecipeId,
          presentationId: item.presentationId || null,
          productName,
          quantity: item.quantity,
          unitPriceCents,
          totalCents: totalLineCents,
          unitCostCents, // CONGELADO HISTÓRICAMENTE
          totalCostCents: totalLineCostCents, // CONGELADO HISTÓRICAMENTE
          notes: item.notes || null,
        };
      });

      if (collectedCents > calculatedTotalCents) {
        throw new Error("El monto cobrado no puede superar el total de la venta.");
      }

      const balanceCents = Math.max(0, calculatedTotalCents - collectedCents);
      const effectiveMethod = paymentMethod === "PENDIENTE" && collectedCents > 0 ? "EFECTIVO" : paymentMethod;

      const sale = await tx.sale.create({
        data: {
          saleDate: parsedDate,
          customerId: customerId || null,
          customerName: customerName || null,
          totalCents: calculatedTotalCents,
          totalCostCents: calculatedTotalCostCents,
          collectedCents,
          balanceCents,
          paymentMethod,
          status: "ACTIVE",
          notes: notes || null,
          items: { create: formattedItems },
          ...(collectedCents > 0 && {
            payments: {
              create: {
                amountCents: collectedCents,
                method: effectiveMethod,
                paidAt: parsedDate,
                reference: paymentReference || null,
              },
            },
          }),
        },
        include: {
          customer: true,
          items: true,
          payments: true,
        },
      });

      // RF-009: marcar si afecta semana cerrada
      const { start } = getWeekBounds(parsedDate);
      await tx.weeklyClose.updateMany({
        where: {
          weekStart: { gte: new Date(start.getTime() - 1000), lte: new Date(start.getTime() + 1000) },
          isClosed: true,
        },
        data: { modifiedAfterClose: true },
      });

      return sale;
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    if (error?.message?.includes("superar el total")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}

// DELETE /api/ventas — Anular venta (conserva historial)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const cancelled = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.sale.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.sale.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      const { start } = getWeekBounds(existing.saleDate);
      await tx.weeklyClose.updateMany({
        where: {
          weekStart: { gte: new Date(start.getTime() - 1000), lte: new Date(start.getTime() + 1000) },
          isClosed: true,
        },
        data: { modifiedAfterClose: true },
      });

      return updated;
    });

    if (!cancelled) {
      return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: cancelled });
  } catch (error: any) {
    return handleApiError(error);
  }
}

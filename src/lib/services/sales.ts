// Servicio de Ventas — K_Sweet (RF-001 a RF-005)
import { prisma } from "@/lib/prisma";
import { SaleCreateInput, PaymentMethod } from "@/types";

export interface SaleFilterOptions {
  startDate?: string;
  endDate?: string;
  productId?: string;
  customerId?: string;
  paymentMethod?: string;
}

/**
 * Crea una venta registrando costos históricos congelados por ítem (RF-014, RF-001)
 * Regla: No se convierten cotizaciones en ventas automáticamente.
 */
export async function createSale(input: SaleCreateInput) {
  // Calcular total de venta y costo histórico
  let totalCents = 0;
  let totalCostCents = 0;

  const itemsData = input.items.map((item) => {
    const itemTotal = Math.round(item.quantity * item.unitPriceCents);
    const itemCost = Math.round(item.quantity * item.unitCostCents);
    totalCents += itemTotal;
    totalCostCents += itemCost;

    return {
      recipeId: item.recipeId || null,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: itemTotal,
      unitCostCents: item.unitCostCents,
      totalCostCents: itemCost,
      notes: item.notes || null,
    };
  });

  const collected = Math.min(input.collectedCents, totalCents);
  const balance = totalCents - collected;

  return await prisma.sale.create({
    data: {
      saleDate: new Date(input.saleDate),
      customerId: input.customerId || null,
      customerName: input.customerName || null,
      notes: input.notes || null,
      totalCents,
      totalCostCents,
      collectedCents: collected,
      balanceCents: balance,
      paymentMethod: input.paymentMethod,
      items: {
        create: itemsData,
      },
      payments:
        collected > 0
          ? {
              create: [
                {
                  amountCents: collected,
                  method: input.paymentMethod === "PENDIENTE" ? "EFECTIVO" : input.paymentMethod,
                },
              ],
            }
          : undefined,
    },
    include: {
      items: true,
      payments: true,
      customer: true,
    },
  });
}

/**
 * Registra un cobro parcial o total sobre una venta existente
 */
export async function registerPayment(saleId: string, amountCents: number, method: PaymentMethod, reference?: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
  });

  if (!sale) throw new Error("Venta no encontrada");
  if (sale.status === "CANCELLED") throw new Error("No se pueden recibir pagos en una venta cancelada");

  const newCollected = sale.collectedCents + amountCents;
  const newBalance = Math.max(0, sale.totalCents - newCollected);

  const [payment, updatedSale] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        saleId,
        amountCents,
        method: method === "PENDIENTE" ? "EFECTIVO" : method,
        reference: reference || null,
      },
    }),
    prisma.sale.update({
      where: { id: saleId },
      data: {
        collectedCents: newCollected,
        balanceCents: newBalance,
      },
    }),
  ]);

  return { payment, sale: updatedSale };
}

/**
 * Obtiene ventas con filtros por fecha y producto
 */
export async function getSales(options?: SaleFilterOptions) {
  const where: any = {
    status: "ACTIVE",
  };

  if (options?.startDate || options?.endDate) {
    where.saleDate = {};
    if (options.startDate) where.saleDate.gte = new Date(options.startDate);
    if (options.endDate) where.saleDate.lte = new Date(options.endDate);
  }

  if (options?.paymentMethod) {
    where.paymentMethod = options.paymentMethod;
  }

  if (options?.customerId) {
    where.customerId = options.customerId;
  }

  if (options?.productId) {
    where.items = {
      some: {
        recipeId: options.productId,
      },
    };
  }

  return await prisma.sale.findMany({
    where,
    include: {
      items: {
        include: {
          recipe: true,
        },
      },
      payments: true,
      customer: true,
    },
    orderBy: {
      saleDate: "desc",
    },
  });
}

// Servicio de Gastos Operativos — K_Sweet (RF-019, RF-020)
import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@/types";

export interface CreateExpenseInput {
  expenseDate: string; // ISO
  categoryId: string;
  concept: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  isIngredientPurchase?: boolean; // Advertencia RF-020
}

/**
 * Registra un gasto operativo. Si se marca como compra de ingredientes,
 * se señaliza para NO duplicar con el costo de ventas (COGS) en el cuadre semanal.
 */
export async function createExpense(input: CreateExpenseInput) {
  if (input.amountCents <= 0) {
    throw new Error("El importe del gasto debe ser mayor a RD$ 0.00");
  }

  return await prisma.operationalExpense.create({
    data: {
      expenseDate: new Date(input.expenseDate),
      categoryId: input.categoryId,
      concept: input.concept,
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      notes: input.notes || null,
      isIngredientPurchase: input.isIngredientPurchase ?? false,
    },
    include: {
      category: true,
    },
  });
}

/**
 * Obtiene categorías de gastos disponibles o crea las predeterminadas
 */
export async function getOrCreateExpenseCategories() {
  const existing = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
  });

  if (existing.length > 0) return existing;

  const defaults = [
    "Servicios Básicos (Luz/Agua/Gas)",
    "Empaque y Embalaje",
    "Transporte / Delivery",
    "Publicidad y Redes Sociales",
    "Alquiler de Espacio",
    "Limpieza y Mantenimiento",
    "Otros Gastos Menores",
  ];

  await prisma.expenseCategory.createMany({
    data: defaults.map((name) => ({ name })),
  });

  return await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
  });
}

/**
 * Lista gastos en rango de fechas con desglose
 */
export async function getExpenses(startDate?: string, endDate?: string) {
  const where: any = {};
  if (startDate || endDate) {
    where.expenseDate = {};
    if (startDate) where.expenseDate.gte = new Date(startDate);
    if (endDate) where.expenseDate.lte = new Date(endDate);
  }

  return await prisma.operationalExpense.findMany({
    where,
    include: { category: true },
    orderBy: { expenseDate: "desc" },
  });
}

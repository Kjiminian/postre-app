import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";
import { parseAssistedPriceLines, ApplyStrategy } from "@/lib/services/price-adapters";
import { createOrDeduplicateProposal } from "@/lib/services/price-proposals";

const previewSchema = z.object({
  mode: z.literal("PREVIEW"),
  rawText: z.string().min(1),
});

const createItemSchema = z.object({
  ingredientId: z.string().min(1),
  detectedPriceCents: z.coerce.number().int().positive(),
  detectedPackQty: z.coerce.number().positive().optional().nullable(),
  detectedPackUnit: z.string().optional().nullable(),
  detectedRawTitle: z.string().optional().nullable(),
  applyStrategy: z.enum(["STRICT_SAME_PACK", "REBASE_UNIT_COST", "ADOPT_SOURCE_PACK"]).default("STRICT_SAME_PACK"),
  taxRatePct: z.coerce.number().refine((v) => v === 0 || v === 16 || v === 18).default(0),
});

const createSchema = z.object({
  mode: z.literal("CREATE"),
  sourceId: z.string().optional(),
  triggerType: z.enum(["ASSISTED_TEXT", "ASSISTED_CSV", "ASSISTED_INVOICE"]).default("ASSISTED_TEXT"),
  items: z.array(createItemSchema).min(1),
  registerExpense: z.boolean().default(false),
  expense: z
    .object({
      expenseDate: z.string().min(1),
      paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA"]).default("EFECTIVO"),
      amountCents: z.coerce.number().int().positive(),
      concept: z.string().trim().min(1),
      notes: z.string().optional().nullable(),
    })
    .optional(),
});

// POST /api/precios/asistido — Plan B: Parseo y envío a Bandeja de Aprobación (+ Gasto opcional)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.mode === "PREVIEW") {
      const parsed = previewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Debes pegar el texto o CSV de cotización." },
          { status: 400 }
        );
      }

      const ingredients = await prisma.ingredient.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          packagePriceCents: true,
          packageQty: true,
          packageUnit: true,
          baseUnit: true,
        },
      });

      const lines = parseAssistedPriceLines(parsed.data.rawText, ingredients);
      return NextResponse.json({ success: true, data: { lines, ingredients } });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos para carga asistida.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    let parsedExpenseDate: Date | null = null;
    if (d.registerExpense && d.expense) {
      parsedExpenseDate = new Date(d.expense.expenseDate);
      if (Number.isNaN(parsedExpenseDate.getTime())) {
        throw new AppError("Fecha de gasto inválida.", 400, "INVALID_DATE");
      }
    }

    const source = d.sourceId
      ? await prisma.priceSource.findUnique({ where: { id: d.sourceId } })
      : await prisma.priceSource.findUnique({ where: { code: "canal_asistido" } });

    if (!source) {
      throw new AppError("No se encontró el canal asistido configurado.", 404, "SOURCE_NOT_FOUND");
    }

    const ingIds = d.items.map((i) => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingIds } },
    });
    const ingMap = new Map<string, any>(ingredients.map((i: any) => [i.id, i]));

    const run = await prisma.priceSyncRun.create({
      data: {
        sourceId: source.id,
        triggerType: d.triggerType,
        status: "RUNNING",
        totalChecked: d.items.length,
      },
    });

    const createdProposals = [];
    let expenseCreated = null;

    try {
      for (const item of d.items) {
        const ing = ingMap.get(item.ingredientId);
        if (!ing) continue;

        const res = await createOrDeduplicateProposal({
          runId: run.id,
          ingredient: ing,
          source,
          detectedPriceCentsRaw: item.detectedPriceCents,
          detectedInStock: true,
          detectedPackQty: item.detectedPackQty ?? ing.packageQty,
          detectedPackUnit: item.detectedPackUnit ?? ing.packageUnit,
          detectedRawTitle: item.detectedRawTitle || ing.name,
          taxRatePct: item.taxRatePct,
          applyStrategy: item.applyStrategy as ApplyStrategy,
          packTolerancePct: 5,
        });
        if (res.proposal) createdProposals.push(res.proposal);
      }

      if (d.registerExpense && d.expense && parsedExpenseDate) {
        const category = await prisma.expenseCategory.upsert({
          where: { name: "Compra de Insumos" },
          create: { name: "Compra de Insumos", isActive: true },
          update: { isActive: true },
        });
        expenseCreated = await prisma.operationalExpense.create({
          data: {
            expenseDate: parsedExpenseDate,
            categoryId: category.id,
            concept: d.expense.concept,
            amountCents: d.expense.amountCents,
            paymentMethod: d.expense.paymentMethod,
            isIngredientPurchase: true,
            notes: d.expense.notes || "Registrado desde Carga Asistida de Precios",
          },
        });
      }

      await prisma.priceSyncRun.update({
        where: { id: run.id },
        data: {
          status: "OK",
          proposalsCreated: createdProposals.length,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.priceSyncRun.update({
        where: { id: run.id },
        data: { status: "ERROR", finishedAt: new Date() },
      });
      throw err;
    }

    return NextResponse.json({
      success: true,
      data: {
        runId: run.id,
        proposalsCreated: createdProposals.length,
        proposals: createdProposals,
        expenseCreated,
      },
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

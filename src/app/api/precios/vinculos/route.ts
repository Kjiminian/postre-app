import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";
import { calculateIngredientBaseCost } from "@/lib/ingredient-cost";
import { validateExternalUrlSafe } from "@/lib/services/price-adapters";

const createLinkSchema = z.object({
  ingredientId: z.string().min(1),
  sourceId: z.string().min(1),
  isPrimary: z.boolean().default(false),
  externalSku: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  externalName: z.string().optional().nullable(),
  packTolerancePct: z.coerce.number().min(0).max(100).default(5),
  applyStrategy: z.enum(["STRICT_SAME_PACK", "REBASE_UNIT_COST", "ADOPT_SOURCE_PACK"]).default("STRICT_SAME_PACK"),
  taxRatePct: z.coerce.number().refine((v) => v === 0 || v === 16 || v === 18, {
    message: "ITBIS debe ser 0%, 16% o 18%",
  }).default(0),
});

const updateLinkSchema = z.object({
  id: z.string().min(1),
  isPrimary: z.boolean().optional(),
  externalSku: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  externalName: z.string().optional().nullable(),
  packTolerancePct: z.coerce.number().min(0).max(100).optional(),
  applyStrategy: z.enum(["STRICT_SAME_PACK", "REBASE_UNIT_COST", "ADOPT_SOURCE_PACK"]).optional(),
  taxRatePct: z.coerce.number().refine((v) => v === 0 || v === 16 || v === 18).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ingredientId = searchParams.get("ingredientId");
    const sourceId = searchParams.get("sourceId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (ingredientId) where.ingredientId = ingredientId;
    if (sourceId) where.sourceId = sourceId;

    const links = await prisma.productSourceLink.findMany({
      where,
      include: {
        ingredient: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            packagePriceCents: true,
            packageQty: true,
            packageUnit: true,
            baseUnit: true,
            conversionFactor: true,
            costPerBaseUnit: true,
          },
        },
        source: {
          select: { id: true, code: true, name: true, adapterType: true, captureMode: true, taxMode: true },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: links });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al vincular producto con portal.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const [ingredient, source] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: d.ingredientId } }),
      prisma.priceSource.findUnique({ where: { id: d.sourceId } }),
    ]);

    if (!ingredient) throw new AppError("Producto/ingrediente no encontrado.", 404, "NOT_FOUND");
    if (!source) throw new AppError("Fuente de precios no encontrada.", 404, "NOT_FOUND");

    if (source.adapterType !== "MANUAL_ASSISTED") {
      if (!d.externalUrl) {
        throw new AppError("La URL del producto en el portal es requerida para portales automáticos.", 400, "URL_REQUIRED");
      }
      const safe = await validateExternalUrlSafe(d.externalUrl, source.baseUrl);
      if (!safe.ok) {
        throw new AppError(safe.error, 400, "INVALID_EXTERNAL_URL");
      }
    }

    const baseCalc = calculateIngredientBaseCost({
      packagePriceCents: ingredient.packagePriceCents,
      packageQty: ingredient.packageQty,
      packageUnit: ingredient.packageUnit,
      baseUnit: ingredient.baseUnit,
      conversionFactor: ingredient.conversionFactor ?? 1,
      hasExplicitFactor: Boolean(ingredient.factorId) || (ingredient.conversionFactor ?? 1) !== 1,
      density: ingredient.density,
    });
    const expectedBaseQty = baseCalc.ok ? baseCalc.effectiveBaseQty : ingredient.packageQty * (ingredient.conversionFactor ?? 1);

    const created = await prisma.$transaction(async (tx: any) => {
      if (d.isPrimary) {
        await tx.productSourceLink.updateMany({
          where: { ingredientId: d.ingredientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return await tx.productSourceLink.create({
        data: {
          ingredientId: d.ingredientId,
          sourceId: d.sourceId,
          isPrimary: d.isPrimary,
          externalSku: d.externalSku || null,
          externalUrl: d.externalUrl || null,
          externalName: d.externalName || null,
          expectedPackageQty: ingredient.packageQty,
          expectedPackageUnit: ingredient.packageUnit,
          expectedConversionFactor: ingredient.conversionFactor ?? 1,
          expectedBaseQty,
          packTolerancePct: d.packTolerancePct,
          applyStrategy: d.applyStrategy,
          taxRatePct: d.taxRatePct,
          isActive: true,
        },
        include: {
          ingredient: { select: { id: true, code: true, name: true } },
          source: { select: { id: true, code: true, name: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al actualizar vínculo.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...rest } = parsed.data;
    const existing = await prisma.productSourceLink.findUnique({
      where: { id },
      include: { source: true },
    });
    if (!existing) throw new AppError("Vínculo no encontrado.", 404, "NOT_FOUND");

    if (rest.externalUrl !== undefined && !rest.externalUrl && existing.source.adapterType !== "MANUAL_ASSISTED") {
      throw new AppError("La URL del producto en el portal es obligatoria.", 400, "URL_REQUIRED");
    }

    if (rest.externalUrl && existing.source.adapterType !== "MANUAL_ASSISTED") {
      const safe = await validateExternalUrlSafe(rest.externalUrl, existing.source.baseUrl);
      if (!safe.ok) throw new AppError(safe.error, 400, "INVALID_EXTERNAL_URL");
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      if (rest.isPrimary) {
        await tx.productSourceLink.updateMany({
          where: { ingredientId: existing.ingredientId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }
      return await tx.productSourceLink.update({
        where: { id },
        data: rest,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });

    const deactivated = await prisma.productSourceLink.update({
      where: { id },
      data: { isActive: false, isPrimary: false },
    });
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

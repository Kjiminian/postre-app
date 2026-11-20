import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";
import {
  applyTaxMode,
  evaluatePackCompatibility,
  fetchPortalProduct,
  ApplyStrategy,
} from "@/lib/services/price-adapters";

const verifySchema = z.object({
  sourceId: z.string().min(1),
  ingredientId: z.string().min(1),
  externalUrl: z.string().url(),
  externalSku: z.string().optional().nullable(),
  taxRatePct: z.coerce.number().refine((v) => v === 0 || v === 16 || v === 18).default(0),
  applyStrategy: z.enum(["STRICT_SAME_PACK", "REBASE_UNIT_COST", "ADOPT_SOURCE_PACK"]).default("STRICT_SAME_PACK"),
  packTolerancePct: z.coerce.number().min(0).max(100).default(5),
});

// POST /api/precios/vinculos/verificar — Consulta en vivo solo lectura antes de guardar vínculo
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos para verificar enlace.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const [source, ingredient] = await Promise.all([
      prisma.priceSource.findUnique({ where: { id: d.sourceId } }),
      prisma.ingredient.findUnique({ where: { id: d.ingredientId } }),
    ]);

    if (!source) throw new AppError("Fuente no encontrada.", 404, "NOT_FOUND");
    if (!ingredient) throw new AppError("Producto no encontrado.", 404, "NOT_FOUND");

    const fetchRes = await fetchPortalProduct({
      adapterType: source.adapterType,
      externalUrl: d.externalUrl,
      externalSku: d.externalSku,
      allowedBaseUrl: source.baseUrl,
      timeoutMs: source.timeoutMs,
    });

    if (fetchRes.status !== "OK" || !fetchRes.priceCents) {
      return NextResponse.json(
        {
          success: false,
          blocked: fetchRes.status === "BLOCKED",
          error: fetchRes.error || "No se pudo leer el precio del portal.",
        },
        { status: fetchRes.status === "BLOCKED" ? 502 : 400 }
      );
    }

    const effectivePriceCents = applyTaxMode(fetchRes.priceCents, source.taxMode, d.taxRatePct);
    const evaluation = evaluatePackCompatibility({
      currentPackagePriceCents: ingredient.packagePriceCents,
      currentPackageQty: ingredient.packageQty,
      currentPackageUnit: ingredient.packageUnit,
      currentBaseUnit: ingredient.baseUnit,
      currentConversionFactor: ingredient.conversionFactor ?? 1,
      hasExplicitFactor: Boolean(ingredient.factorId) || (ingredient.conversionFactor ?? 1) !== 1,
      currentCostPerBaseUnit: ingredient.costPerBaseUnit,
      density: ingredient.density,
      detectedPriceCents: effectivePriceCents,
      detectedInStock: fetchRes.inStock ?? true,
      detectedPackQty: fetchRes.packQty,
      detectedPackUnit: fetchRes.packUnit,
      packTolerancePct: d.packTolerancePct,
      applyStrategy: d.applyStrategy as ApplyStrategy,
      priceAlertThresholdPct: source.priceAlertThresholdPct,
      ambiguousVariant: fetchRes.ambiguousVariant,
      ambiguousPriceRange: fetchRes.ambiguousPriceRange,
    });

    return NextResponse.json({
      success: true,
      data: {
        detectedTitle: fetchRes.title,
        detectedPriceRawCents: fetchRes.priceCents,
        detectedPriceWithTaxCents: effectivePriceCents,
        detectedInStock: fetchRes.inStock ?? true,
        detectedPackQty: fetchRes.packQty,
        detectedPackUnit: fetchRes.packUnit,
        variants: fetchRes.variants,
        ambiguousVariant: fetchRes.ambiguousVariant,
        evidenceUrl: fetchRes.evidenceUrl,
        ...evaluation,
      },
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

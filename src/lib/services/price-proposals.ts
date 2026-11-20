// Helper compartido para crear propuestas de actualización de precios sin duplicación ni duplicados PENDING

import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { applyTaxMode, evaluatePackCompatibility, ApplyStrategy } from "@/lib/services/price-adapters";

export async function createOrDeduplicateProposal(params: {
  runId: string;
  linkId?: string | null;
  ingredient: any;
  source: any;
  detectedPriceCentsRaw: number; // Precio crudo del portal/factura antes de taxMode
  detectedInStock: boolean;
  detectedPackQty?: number | null;
  detectedPackUnit?: string | null;
  detectedRawTitle?: string | null;
  taxRatePct?: number;
  applyStrategy?: ApplyStrategy;
  packTolerancePct?: number;
  evidenceUrl?: string | null;
  extraAlerts?: string[];
  ambiguousVariant?: boolean;
  ambiguousPriceRange?: boolean;
}) {
  const taxRate = params.taxRatePct ?? 0;
  const effectivePriceCents = applyTaxMode(params.detectedPriceCentsRaw, params.source.taxMode, taxRate);
  const strategy = params.applyStrategy || "STRICT_SAME_PACK";

  const evalRes = evaluatePackCompatibility({
    currentPackagePriceCents: params.ingredient.packagePriceCents,
    currentPackageQty: params.ingredient.packageQty,
    currentPackageUnit: params.ingredient.packageUnit,
    currentBaseUnit: params.ingredient.baseUnit,
    currentConversionFactor: params.ingredient.conversionFactor ?? 1,
    hasExplicitFactor: Boolean(params.ingredient.factorId) || (params.ingredient.conversionFactor ?? 1) !== 1,
    currentCostPerBaseUnit: params.ingredient.costPerBaseUnit,
    density: params.ingredient.density,
    detectedPriceCents: effectivePriceCents,
    detectedInStock: params.detectedInStock,
    detectedPackQty: params.detectedPackQty,
    detectedPackUnit: params.detectedPackUnit,
    packTolerancePct: params.packTolerancePct ?? 5,
    applyStrategy: strategy,
    priceAlertThresholdPct: params.source.priceAlertThresholdPct ?? 20,
    ambiguousVariant: params.ambiguousVariant,
    ambiguousPriceRange: params.ambiguousPriceRange,
  });

  const mergedAlerts = Array.from(new Set([...(evalRes.alerts || []), ...(params.extraAlerts || [])]));

  // No crear propuesta si el precio propuesto es igual al actual y no hay alertas de empaque/stock
  if (
    evalRes.proposedPriceCents === params.ingredient.packagePriceCents &&
    mergedAlerts.length === 0 &&
    strategy !== "ADOPT_SOURCE_PACK"
  ) {
    return { status: "UNCHANGED" as const, proposal: null };
  }

  // Idempotencia: no duplicar si ya existe propuesta PENDING vigente con mismo ingrediente, fuente y precio
  const now = new Date();
  const existingPending = await prisma.priceUpdateProposal.findFirst({
    where: {
      ingredientId: params.ingredient.id,
      sourceId: params.source.id,
      status: "PENDING",
      expiresAt: { gt: now },
      proposedPriceCents: evalRes.proposedPriceCents,
      packCheckStatus: evalRes.packCheckStatus,
    },
  });

  if (existingPending) {
    return { status: "DUPLICATE_PENDING" as const, proposal: existingPending };
  }

  const ttlHours = params.source.proposalTtlHours || 168;
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  const created = await createWithSequentialCode(
    async () => {
      const rows = await prisma.priceUpdateProposal.findMany({ select: { code: true } });
      return rows.map((r: { code: string }) => r.code);
    },
    ENTITY_CODE_PREFIX.PROPOSAL,
    (code) =>
      prisma.priceUpdateProposal.create({
        data: {
          code,
          runId: params.runId,
          linkId: params.linkId || null,
          ingredientId: params.ingredient.id,
          sourceId: params.source.id,
          status: "PENDING",
          applyStrategyUsed: strategy,
          currentPriceCents: params.ingredient.packagePriceCents,
          currentCostPerBaseUnit: params.ingredient.costPerBaseUnit,
          currentIngredientUpdatedAt: params.ingredient.updatedAt,
          detectedPriceCents: effectivePriceCents,
          detectedInStock: params.detectedInStock,
          detectedPackQty: params.detectedPackQty ?? null,
          detectedPackUnit: params.detectedPackUnit ?? null,
          detectedRawTitle: params.detectedRawTitle ?? null,
          proposedPriceCents: evalRes.proposedPriceCents,
          proposedCostPerBaseUnit: evalRes.proposedCostPerBaseUnit,
          proposedPackageQty: evalRes.proposedPackageQty,
          proposedPackageUnit: evalRes.proposedPackageUnit,
          proposedConversionFactor: evalRes.proposedConversionFactor,
          diffPriceCents: evalRes.diffPriceCents,
          diffPercent: evalRes.diffPercent,
          packCheckStatus: evalRes.packCheckStatus,
          alertsJson: mergedAlerts.length > 0 ? JSON.stringify(mergedAlerts) : null,
          evidenceUrl: params.evidenceUrl || null,
          expiresAt,
        },
        include: {
          ingredient: { select: { id: true, code: true, name: true, baseUnit: true, packageQty: true, packageUnit: true } },
          source: { select: { id: true, code: true, name: true } },
        },
      })
  );

  return { status: "CREATED" as const, proposal: created };
}

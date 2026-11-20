// Servicio de Dominio: Recetas Madre, Variantes, Presentaciones Agrupadas y Cascada Reactiva
// GEM PROYECTOS SOFTWARE V3.0 (PRE-001, PRE-002, RN-001, RF-014, RF-017, RF-018)

import { prisma } from "@/lib/prisma";
import {
  calcPriceByMethod,
  calcRealProfitCents,
  calcMarginOnSale,
  PricingMethod,
} from "@/types";

export type ConsumptionMode = "YIELD_PER_BATCH" | "BATCH_FRACTION";

/**
 * Calcula el costo del lote de una Receta Madre aplicando la contingencia una sola vez
 * sobre el subtotal (ingredientes + gastos indirectos + mano de obra + empaque de lote).
 * Mantiene `batchCostExactCents` en coma flotante para evitar deriva de redondeo al dividir entre N minis.
 */
export function calculateMotherRecipeCosts(params: {
  ingredientsCostCents: number;
  laborPercent: number;
  overheadPercent: number;
  contingencyPercent?: number;
  packageCostCents: number;
  yieldQty: number;
}) {
  const {
    ingredientsCostCents,
    laborPercent,
    overheadPercent,
    contingencyPercent = 0,
    packageCostCents,
    yieldQty,
  } = params;

  const overheadCents = Math.round((ingredientsCostCents * overheadPercent) / 100);
  const laborCents = Math.round((ingredientsCostCents * laborPercent) / 100);
  const subtotalBeforeContingencyCents =
    ingredientsCostCents + overheadCents + laborCents + packageCostCents;

  const safeContingency = Number.isFinite(contingencyPercent) && contingencyPercent >= 0 ? contingencyPercent : 0;
  const contingencyExactCents = subtotalBeforeContingencyCents * (safeContingency / 100);
  const batchCostExactCents = subtotalBeforeContingencyCents + contingencyExactCents;
  const batchCostCents = Math.round(batchCostExactCents);

  const validYield = yieldQty > 0 ? yieldQty : 1;
  const costPerYieldUnit = batchCostExactCents / validYield;
  const unitCostCents = Math.round(costPerYieldUnit);

  return {
    subtotalBeforeContingencyCents,
    contingencyExactCents,
    contingencyCents: Math.round(contingencyExactCents),
    batchCostExactCents,
    batchCostCents,
    unitCostCents,
    costPerYieldUnit,
    overheadCents,
    laborCents,
  };
}

/**
 * Resuelve de forma única e inequívoca la fracción de lote y el rendimiento por lote
 * para evitar valores contradictorios entre ambos campos.
 */
export function resolveConsumption(params: {
  consumptionMode?: string;
  presentationYield?: number;
  batchFraction?: number;
  motherBatchYield?: number;
}) {
  const mode: ConsumptionMode =
    params.consumptionMode === "BATCH_FRACTION" ? "BATCH_FRACTION" : "YIELD_PER_BATCH";
  const motherYield = params.motherBatchYield && params.motherBatchYield > 0 ? params.motherBatchYield : 1;

  if (mode === "BATCH_FRACTION") {
    const fraction = params.batchFraction && params.batchFraction > 0 ? params.batchFraction : 1;
    const yieldPerBatch = 1 / fraction;
    return {
      consumptionMode: mode,
      batchFraction: fraction,
      presentationYield: yieldPerBatch,
      motherRecipeQty: motherYield * fraction,
    };
  }

  const yieldPerBatch = params.presentationYield && params.presentationYield > 0 ? params.presentationYield : 1;
  const fraction = 1 / yieldPerBatch;
  return {
    consumptionMode: mode,
    batchFraction: fraction,
    presentationYield: yieldPerBatch,
    motherRecipeQty: motherYield * fraction,
  };
}

/**
 * Calcula los valores financieros de una Variante Individual derivada de una Receta Madre.
 */
export function calculateVariantValues(params: {
  motherBatchYield: number;
  motherBatchCostExactCents: number;
  consumptionMode?: string;
  presentationYield?: number;
  batchFraction?: number;
  packagingCostCents: number;
  additionalCostCents: number;
  pricingMethod: PricingMethod;
  desiredMarginPercent: number;
  currentFinalPriceCents?: number;
}) {
  const consumption = resolveConsumption({
    consumptionMode: params.consumptionMode,
    presentationYield: params.presentationYield,
    batchFraction: params.batchFraction,
    motherBatchYield: params.motherBatchYield,
  });

  const baseCostExactCents = params.motherBatchCostExactCents * consumption.batchFraction;
  const baseCostCents = Math.round(baseCostExactCents);
  const unitTotalCostExactCents =
    baseCostExactCents + params.packagingCostCents + params.additionalCostCents;
  const totalCostCents = Math.round(unitTotalCostExactCents);

  const suggestedPriceCents = calcPriceByMethod(
    unitTotalCostExactCents,
    params.desiredMarginPercent,
    params.pricingMethod
  );

  const finalPriceCents =
    params.currentFinalPriceCents !== undefined && params.currentFinalPriceCents > 0
      ? params.currentFinalPriceCents
      : suggestedPriceCents;

  const realProfitCents = calcRealProfitCents(finalPriceCents, totalCostCents);
  const realMarginPercent = calcMarginOnSale(finalPriceCents, totalCostCents);

  return {
    ...consumption,
    baseCostExactCents,
    baseCostCents,
    unitTotalCostExactCents,
    totalCostCents,
    suggestedPriceCents,
    finalPriceCents,
    realProfitCents,
    realMarginPercent,
  };
}

/**
 * Calcula los valores financieros de una Presentación Agrupada (ej. Caja de 15 minis).
 * El empaque y extras del grupo se cobran UNA SOLA VEZ por presentación.
 */
export function calculateGroupPresentationValues(params: {
  variantUnitTotalCostExactCents: number;
  groupQty: number;
  groupPackagingCostCents: number;
  groupAdditionalCostCents: number;
  pricingMethod: PricingMethod;
  desiredMarginPercent: number;
  currentFinalPriceCents?: number;
}) {
  const qty = params.groupQty > 0 ? params.groupQty : 1;
  const baseCostExactCents = params.variantUnitTotalCostExactCents * qty;
  const baseCostCents = Math.round(baseCostExactCents);
  const unitTotalCostExactCents =
    baseCostExactCents + params.groupPackagingCostCents + params.groupAdditionalCostCents;
  const totalCostCents = Math.round(unitTotalCostExactCents);

  const suggestedPriceCents = calcPriceByMethod(
    unitTotalCostExactCents,
    params.desiredMarginPercent,
    params.pricingMethod
  );

  const finalPriceCents =
    params.currentFinalPriceCents !== undefined && params.currentFinalPriceCents > 0
      ? params.currentFinalPriceCents
      : suggestedPriceCents;

  const realProfitCents = calcRealProfitCents(finalPriceCents, totalCostCents);
  const realMarginPercent = calcMarginOnSale(finalPriceCents, totalCostCents);

  return {
    groupQty: qty,
    baseCostExactCents,
    baseCostCents,
    unitTotalCostExactCents,
    totalCostCents,
    suggestedPriceCents,
    finalPriceCents,
    realProfitCents,
    realMarginPercent,
  };
}

/**
 * Helper de compatibilidad para llamadas previas.
 */
export function calculatePresentationValues(params: {
  motherBatchYield: number;
  motherCostPerYieldUnit: number;
  motherRecipeQty: number;
  packagingCostCents: number;
  additionalCostCents: number;
  pricingMethod: PricingMethod;
  desiredMarginPercent: number;
  currentFinalPriceCents?: number;
}) {
  const batchCostExact = params.motherCostPerYieldUnit * params.motherBatchYield;
  const fraction = params.motherBatchYield > 0 ? params.motherRecipeQty / params.motherBatchYield : 1;
  return calculateVariantValues({
    motherBatchYield: params.motherBatchYield,
    motherBatchCostExactCents: batchCostExact,
    consumptionMode: "BATCH_FRACTION",
    batchFraction: fraction,
    packagingCostCents: params.packagingCostCents,
    additionalCostCents: params.additionalCostCents,
    pricingMethod: params.pricingMethod,
    desiredMarginPercent: params.desiredMarginPercent,
    currentFinalPriceCents: params.currentFinalPriceCents,
  });
}

function sumMaterialsAndSubrecipes(pres: any) {
  const packagingCostCents = (pres.materials || []).reduce(
    (sum: number, m: any) => sum + (m.totalCostCents || 0),
    0
  );
  const additionalCostCents = (pres.subrecipes || []).reduce(
    (sum: number, s: any) => sum + (s.costCents || 0),
    0
  );
  return { packagingCostCents, additionalCostCents };
}

/**
 * RECALCULO EN CASCADA REACTIVA (PRE-002):
 * Orden topológico en 2 pasos:
 * 1) Recalcula la Receta Madre
 * 2) Recalcula primero variantes raíz (parentId == null) y luego presentaciones agrupadas hijas (parentId != null).
 * Conserva estrictamente `finalPriceCents` manuales existentes.
 */
export async function recalculateRecipeAndPresentations(recipeId: string) {
  return await prisma.$transaction(async (tx: any) => {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: { include: { ingredient: true } },
        subRecipeUses: { include: { child: true } },
        presentations: {
          include: { materials: true, subrecipes: true },
        },
      },
    });

    if (!recipe) throw new Error(`Receta no encontrada: ${recipeId}`);

    let ingredientsCostCents = 0;
    for (const ri of recipe.ingredients) {
      ingredientsCostCents += ri.costCents;
    }
    for (const sub of recipe.subRecipeUses || []) {
      ingredientsCostCents += sub.costCents;
    }

    const motherCosts = calculateMotherRecipeCosts({
      ingredientsCostCents,
      laborPercent: recipe.laborPercent,
      overheadPercent: recipe.overheadPercent,
      contingencyPercent: recipe.contingencyPercent ?? 0,
      packageCostCents: recipe.packageCostCents,
      yieldQty: recipe.yield,
    });

    const updatedMother = await tx.recipe.update({
      where: { id: recipeId },
      data: {
        subtotalBeforeContingencyCents: motherCosts.subtotalBeforeContingencyCents,
        batchCostExactCents: motherCosts.batchCostExactCents,
        batchCostCents: motherCosts.batchCostCents,
        unitCostCents: motherCosts.unitCostCents,
        costPerYieldUnit: motherCosts.costPerYieldUnit,
      },
    });

    const rootVariants = recipe.presentations.filter((p: any) => !p.parentId);
    const groupChildren = recipe.presentations.filter((p: any) => Boolean(p.parentId));
    const exactCostByVariantId = new Map<string, number>();
    const updatedPresentations = [];

    // Paso 1: Variantes individuales (raíz)
    for (const pres of rootVariants) {
      const { packagingCostCents, additionalCostCents } = sumMaterialsAndSubrecipes(pres);
      const vals = calculateVariantValues({
        motherBatchYield: recipe.yield,
        motherBatchCostExactCents: motherCosts.batchCostExactCents,
        consumptionMode: pres.consumptionMode,
        presentationYield: pres.presentationYield,
        batchFraction: pres.batchFraction,
        packagingCostCents,
        additionalCostCents,
        pricingMethod: pres.pricingMethod as PricingMethod,
        desiredMarginPercent: pres.desiredMarginPercent,
        currentFinalPriceCents: pres.finalPriceCents,
      });

      exactCostByVariantId.set(pres.id, vals.unitTotalCostExactCents);

      const up = await tx.recipePresentation.update({
        where: { id: pres.id },
        data: {
          consumptionMode: vals.consumptionMode,
          batchFraction: vals.batchFraction,
          motherRecipeQty: vals.motherRecipeQty,
          presentationYield: vals.presentationYield,
          baseCostCents: vals.baseCostCents,
          unitTotalCostExactCents: vals.unitTotalCostExactCents,
          packagingCostCents,
          additionalCostCents,
          totalCostCents: vals.totalCostCents,
          suggestedPriceCents: vals.suggestedPriceCents,
          finalPriceCents: vals.finalPriceCents,
          realProfitCents: vals.realProfitCents,
          realMarginPercent: vals.realMarginPercent,
        },
      });
      updatedPresentations.push(up);
    }

    // Paso 2: Presentaciones agrupadas hijas vinculadas a su variante
    for (const grp of groupChildren) {
      const parentExact = exactCostByVariantId.get(grp.parentId) ?? 0;
      const { packagingCostCents, additionalCostCents } = sumMaterialsAndSubrecipes(grp);
      const vals = calculateGroupPresentationValues({
        variantUnitTotalCostExactCents: parentExact,
        groupQty: grp.groupQty || 1,
        groupPackagingCostCents: packagingCostCents,
        groupAdditionalCostCents: additionalCostCents,
        pricingMethod: grp.pricingMethod as PricingMethod,
        desiredMarginPercent: grp.desiredMarginPercent,
        currentFinalPriceCents: grp.finalPriceCents,
      });

      const up = await tx.recipePresentation.update({
        where: { id: grp.id },
        data: {
          baseCostCents: vals.baseCostCents,
          unitTotalCostExactCents: vals.unitTotalCostExactCents,
          packagingCostCents,
          additionalCostCents,
          totalCostCents: vals.totalCostCents,
          suggestedPriceCents: vals.suggestedPriceCents,
          finalPriceCents: vals.finalPriceCents,
          realProfitCents: vals.realProfitCents,
          realMarginPercent: vals.realMarginPercent,
        },
      });
      updatedPresentations.push(up);
    }

    return {
      motherRecipe: updatedMother,
      presentations: updatedPresentations,
    };
  });
}

/**
 * Recalcula únicamente una variante individual y sus presentaciones agrupadas hijas (`parentId = variantId`),
 * sin alterar la Receta Madre ni las demás variantes hermanas.
 */
export async function recalculateVariantAndGroups(variantId: string) {
  return await prisma.$transaction(async (tx: any) => {
    const variant = await tx.recipePresentation.findUnique({
      where: { id: variantId },
      include: {
        recipe: true,
        materials: true,
        subrecipes: true,
        groupPresentations: {
          include: { materials: true, subrecipes: true },
        },
      },
    });

    if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);

    const motherExactCost =
      variant.recipe.batchCostExactCents && variant.recipe.batchCostExactCents > 0
        ? variant.recipe.batchCostExactCents
        : variant.recipe.batchCostCents;

    const { packagingCostCents, additionalCostCents } = sumMaterialsAndSubrecipes(variant);
    const vVals = calculateVariantValues({
      motherBatchYield: variant.recipe.yield,
      motherBatchCostExactCents: motherExactCost,
      consumptionMode: variant.consumptionMode,
      presentationYield: variant.presentationYield,
      batchFraction: variant.batchFraction,
      packagingCostCents,
      additionalCostCents,
      pricingMethod: variant.pricingMethod as PricingMethod,
      desiredMarginPercent: variant.desiredMarginPercent,
      currentFinalPriceCents: variant.finalPriceCents,
    });

    const updatedVariant = await tx.recipePresentation.update({
      where: { id: variant.id },
      data: {
        consumptionMode: vVals.consumptionMode,
        batchFraction: vVals.batchFraction,
        motherRecipeQty: vVals.motherRecipeQty,
        presentationYield: vVals.presentationYield,
        baseCostCents: vVals.baseCostCents,
        unitTotalCostExactCents: vVals.unitTotalCostExactCents,
        packagingCostCents,
        additionalCostCents,
        totalCostCents: vVals.totalCostCents,
        suggestedPriceCents: vVals.suggestedPriceCents,
        finalPriceCents: vVals.finalPriceCents,
        realProfitCents: vVals.realProfitCents,
        realMarginPercent: vVals.realMarginPercent,
      },
    });

    const updatedGroups = [];
    for (const grp of variant.groupPresentations || []) {
      const grpCosts = sumMaterialsAndSubrecipes(grp);
      const gVals = calculateGroupPresentationValues({
        variantUnitTotalCostExactCents: vVals.unitTotalCostExactCents,
        groupQty: grp.groupQty || 1,
        groupPackagingCostCents: grpCosts.packagingCostCents,
        groupAdditionalCostCents: grpCosts.additionalCostCents,
        pricingMethod: grp.pricingMethod as PricingMethod,
        desiredMarginPercent: grp.desiredMarginPercent,
        currentFinalPriceCents: grp.finalPriceCents,
      });

      const upGrp = await tx.recipePresentation.update({
        where: { id: grp.id },
        data: {
          baseCostCents: gVals.baseCostCents,
          unitTotalCostExactCents: gVals.unitTotalCostExactCents,
          packagingCostCents: grpCosts.packagingCostCents,
          additionalCostCents: grpCosts.additionalCostCents,
          totalCostCents: gVals.totalCostCents,
          suggestedPriceCents: gVals.suggestedPriceCents,
          finalPriceCents: gVals.finalPriceCents,
          realProfitCents: gVals.realProfitCents,
          realMarginPercent: gVals.realMarginPercent,
        },
      });
      updatedGroups.push(upGrp);
    }

    return { variant: updatedVariant, groupPresentations: updatedGroups };
  });
}

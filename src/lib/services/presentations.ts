// Servicio de Dominio: Recetas Madre, Presentaciones y Cascada Reactiva
// GEM PROYECTOS SOFTWARE V3.0 (PRE-001, PRE-002, RN-001, RF-014, RF-017, RF-018)

import { prisma } from "@/lib/prisma";
import {
  calcPresentationCost,
  calcPriceByMethod,
  calcRealProfitCents,
  calcMarginOnSale,
  PricingMethod,
} from "@/types";

/**
 * Calcula el costo total del lote y el costo por unidad de rendimiento de una Receta Madre.
 * Costo Lote = Sum(Ingredientes) + Overhead + Mano de Obra + Empaque de Lote.
 */
export function calculateMotherRecipeCosts(params: {
  ingredientsCostCents: number;
  laborPercent: number;
  overheadPercent: number;
  packageCostCents: number;
  yieldQty: number;
}) {
  const { ingredientsCostCents, laborPercent, overheadPercent, packageCostCents, yieldQty } = params;
  const overheadCents = Math.round((ingredientsCostCents * overheadPercent) / 100);
  const laborCents = Math.round((ingredientsCostCents * laborPercent) / 100);
  const batchCostCents = ingredientsCostCents + overheadCents + laborCents + packageCostCents;

  const validYield = yieldQty > 0 ? yieldQty : 1;
  const costPerYieldUnit = batchCostCents / validYield;
  const unitCostCents = Math.round(costPerYieldUnit);

  return {
    batchCostCents,
    unitCostCents,
    costPerYieldUnit,
    overheadCents,
    laborCents,
  };
}

/**
 * Calcula todos los valores financieros de una Presentación:
 * - Costo base consumido de la receta madre
 * - Costo unitario total
 * - Rendimiento por lote de la receta madre
 * - Precio sugerido según método (MARGIN vs MARKUP)
 * - Precio final (si se pasa, o igual a sugerido)
 * - Ganancia y margen real
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
  const {
    motherBatchYield,
    motherCostPerYieldUnit,
    motherRecipeQty,
    packagingCostCents,
    additionalCostCents,
    pricingMethod,
    desiredMarginPercent,
    currentFinalPriceCents,
  } = params;

  // Costo total
  const totalCostCents = calcPresentationCost(
    motherCostPerYieldUnit,
    motherRecipeQty,
    packagingCostCents,
    additionalCostCents
  );

  // Rendimiento de la presentación por lote
  const presentationYield = motherRecipeQty > 0 ? motherBatchYield / motherRecipeQty : 1;

  // Precio sugerido según método
  const suggestedPriceCents = calcPriceByMethod(totalCostCents, desiredMarginPercent, pricingMethod);

  // Precio final: si ya tenía precio final manual > 0, se preserva; si no, hereda sugerido
  const finalPriceCents =
    currentFinalPriceCents !== undefined && currentFinalPriceCents > 0
      ? currentFinalPriceCents
      : suggestedPriceCents;

  // Ganancia real y margen real
  const realProfitCents = calcRealProfitCents(finalPriceCents, totalCostCents);
  const realMarginPercent = calcMarginOnSale(finalPriceCents, totalCostCents);

  return {
    totalCostCents,
    presentationYield,
    suggestedPriceCents,
    finalPriceCents,
    realProfitCents,
    realMarginPercent,
  };
}

/**
 * RECALCULO EN CASCADA REACTIVA (PRE-002):
 * Actualiza una Receta Madre y propaga el nuevo costo a todas sus Presentaciones hijas
 * dentro de una transacción Prisma, conservando estrictamente los precios de venta finales
 * fijados en carta (`finalPriceCents`).
 */
export async function recalculateRecipeAndPresentations(recipeId: string) {
  return await prisma.$transaction(async (tx: any) => {
    // 1. Obtener la receta madre con sus ingredientes y presentaciones
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: { ingredient: true },
        },
        presentations: {
          include: {
            materials: true,
            subrecipes: true,
          },
        },
      },
    });

    if (!recipe) throw new Error(`Receta no encontrada: ${recipeId}`);

    // 2. Sumar costo de ingredientes actuales
    let ingredientsCostCents = 0;
    for (const ri of recipe.ingredients) {
      ingredientsCostCents += ri.costCents;
    }

    // 3. Recalcular costos de la receta madre
    const motherCosts = calculateMotherRecipeCosts({
      ingredientsCostCents,
      laborPercent: recipe.laborPercent,
      overheadPercent: recipe.overheadPercent,
      packageCostCents: recipe.packageCostCents,
      yieldQty: recipe.yield,
    });

    const updatedMother = await tx.recipe.update({
      where: { id: recipeId },
      data: {
        batchCostCents: motherCosts.batchCostCents,
        unitCostCents: motherCosts.unitCostCents,
        costPerYieldUnit: motherCosts.costPerYieldUnit,
      },
    });

    // 4. Recalcular cada presentación hija dependiente
    const updatedPresentations = [];
    for (const pres of recipe.presentations) {
      // Sumar materiales de empaque
      const packagingCostCents = pres.materials.reduce(
        (sum: number, m: any) => sum + m.totalCostCents,
        0
      );

      // Sumar subrecetas adicionales
      const additionalCostCents = pres.subrecipes.reduce(
        (sum: number, s: any) => sum + s.costCents,
        0
      );

      const presVals = calculatePresentationValues({
        motherBatchYield: recipe.yield,
        motherCostPerYieldUnit: motherCosts.costPerYieldUnit,
        motherRecipeQty: pres.motherRecipeQty,
        packagingCostCents,
        additionalCostCents,
        pricingMethod: pres.pricingMethod as PricingMethod,
        desiredMarginPercent: pres.desiredMarginPercent,
        currentFinalPriceCents: pres.finalPriceCents, // MANTIENE PRECIO FINAL MANUAL
      });

      const up = await tx.recipePresentation.update({
        where: { id: pres.id },
        data: {
          packagingCostCents,
          additionalCostCents,
          totalCostCents: presVals.totalCostCents,
          presentationYield: presVals.presentationYield,
          suggestedPriceCents: presVals.suggestedPriceCents,
          finalPriceCents: presVals.finalPriceCents,
          realProfitCents: presVals.realProfitCents,
          realMarginPercent: presVals.realMarginPercent,
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

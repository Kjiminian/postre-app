// Servicio de Dominio: Recetas Madre, Variantes, Presentaciones Agrupadas y Cascada Reactiva
// GEM PROYECTOS SOFTWARE V3.0 (PRE-001, PRE-002, RN-001, RF-014, RF-017, RF-018)

import { prisma } from "@/lib/prisma";
import { normalizeToBase } from "@/lib/conversions";
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

export interface CascadeWarning {
  scope: "RECIPE_INGREDIENT" | "PRESENTATION_MATERIAL" | "PRESENTATION_SUBRECIPE" | "PRESENTATION_CYCLE";
  entityId: string;
  entityName: string;
  message: string;
}

/**
 * Ordenamiento topológico generalizado para RecipePresentation.parentId con detección
 * de auto-ciclos (parentId === id), ciclos arbitrarios y padres inexistentes (PRE-001).
 */
export function orderPresentationsTopologically<T extends { id: string; name: string; parentId?: string | null }>(
  presentations: T[]
): { ordered: T[]; fallbackParentIds: Set<string>; warnings: CascadeWarning[] } {
  const byId = new Map(presentations.map((p) => [p.id, p]));
  const fallbackParentIds = new Set<string>();
  const warnings: CascadeWarning[] = [];

  for (const p of presentations) {
    if (!p.parentId) continue;
    if (p.parentId === p.id) {
      fallbackParentIds.add(p.id);
      warnings.push({
        scope: "PRESENTATION_CYCLE",
        entityId: p.id,
        entityName: p.name,
        message: `Auto-ciclo detectado en "${p.name}" (parentId apuntaba a sí misma); recalculado desde fracción directa.`,
      });
    } else if (!byId.has(p.parentId)) {
      fallbackParentIds.add(p.id);
      warnings.push({
        scope: "PRESENTATION_CYCLE",
        entityId: p.id,
        entityName: p.name,
        message: `Variante origen ausente o inactiva en "${p.name}"; recalculado desde fracción directa.`,
      });
    }
  }

  const ordered: T[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (node: T) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      // Ciclo multi-salto detectado: romper en este nodo con fallback seguro
      fallbackParentIds.add(node.id);
      warnings.push({
        scope: "PRESENTATION_CYCLE",
        entityId: node.id,
        entityName: node.name,
        message: `Ciclo detectado en cadena de variantes para "${node.name}"; recalculado desde fracción directa.`,
      });
      return;
    }

    visiting.add(node.id);
    if (node.parentId && !fallbackParentIds.has(node.id)) {
      const parent = byId.get(node.parentId);
      if (parent) visit(parent);
    }
    visiting.delete(node.id);
    visited.add(node.id);
    ordered.push(node);
  };

  for (const p of presentations) {
    visit(p);
  }

  return { ordered, fallbackParentIds, warnings };
}

/**
 * Núcleo reutilizable dentro de una transacción Prisma externa (`tx`) para recalcular
 * una Receta Madre, sus líneas (con política no-destructiva PRE-002), su `suggestedPriceCents`,
 * y todas sus variantes/presentaciones en orden topológico (PRE-001).
 * Nunca abre una transacción anidada sobre SQLite.
 */
export async function recalculateRecipeTreeInTx(
  tx: any,
  recipeId: string,
  options: {
    recomputeLinesFromMaster?: boolean;
    activePresentationsOnly?: boolean;
    overrideIngredientMap?: Map<string, { costPerBaseUnit: number; baseUnit: string; density?: number | null }>;
    overrideSubRecipeUnitCostMap?: Map<string, number>;
  } = {}
) {
  const recipe = await tx.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: { include: { ingredient: true } },
      subRecipeUses: { include: { child: true } },
      presentations: {
        where: options.activePresentationsOnly ? { isActive: true } : undefined,
        include: {
          materials: { include: { ingredient: true } },
          subrecipes: { include: { subRecipe: true } },
        },
      },
    },
  });

  if (!recipe) throw new Error(`Receta no encontrada: ${recipeId}`);

  const warnings: CascadeWarning[] = [];
  let ingredientsCostCents = 0;

  // 1. Líneas de Ingredientes de la Receta
  for (const ri of recipe.ingredients) {
    let lineCostCents = ri.costCents;
    if (options.recomputeLinesFromMaster && ri.ingredient) {
      const ingOverride = options.overrideIngredientMap?.get(ri.ingredientId);
      const costPerBaseUnit = ingOverride ? ingOverride.costPerBaseUnit : ri.ingredient.costPerBaseUnit;
      const baseUnit = ingOverride ? ingOverride.baseUnit : ri.ingredient.baseUnit;
      const density = ingOverride ? ingOverride.density : ri.ingredient.density;

      const norm = normalizeToBase(ri.quantity, ri.unit, baseUnit, density ?? undefined);
      if (norm.ok) {
        lineCostCents = Math.round(norm.value * costPerBaseUnit * 100);
        if (lineCostCents !== ri.costCents) {
          await tx.recipeIngredient.update({
            where: { id: ri.id },
            data: { costCents: lineCostCents },
          });
        }
      } else {
        // PRE-002: conservar costo previo de líneas legacy incompatibles y emitir warning
        warnings.push({
          scope: "RECIPE_INGREDIENT",
          entityId: ri.id,
          entityName: `${recipe.name} -> ${ri.ingredient.name}`,
          message: `Se conservó costo previo (RD$ ${(ri.costCents / 100).toFixed(2)}) por unidad incompatible: ${norm.error}`,
        });
      }
    }
    ingredientsCostCents += lineCostCents;
  }

  // 2. Líneas de Subrecetas usadas en la Receta
  for (const sub of recipe.subRecipeUses || []) {
    let subLineCost = sub.costCents;
    if (options.recomputeLinesFromMaster && (sub.child || options.overrideSubRecipeUnitCostMap?.has(sub.childId))) {
      const childUnitCost = options.overrideSubRecipeUnitCostMap?.get(sub.childId) ?? sub.child.unitCostCents;
      subLineCost = Math.round(sub.quantity * childUnitCost);
      if (subLineCost !== sub.costCents) {
        await tx.subRecipeUse.update({
          where: { id: sub.id },
          data: { costCents: subLineCost },
        });
      }
    }
    ingredientsCostCents += subLineCost;
  }

  // 3. Costos de Receta Madre (con contingencia y suggestedPriceCents)
  const motherCosts = calculateMotherRecipeCosts({
    ingredientsCostCents,
    laborPercent: recipe.laborPercent,
    overheadPercent: recipe.overheadPercent,
    contingencyPercent: recipe.contingencyPercent ?? 0,
    packageCostCents: recipe.packageCostCents,
    yieldQty: recipe.yield,
  });

  const targetMarginFrac = (recipe.targetMargin ?? 40) / 100;
  const suggestedPriceCents =
    targetMarginFrac >= 0 && targetMarginFrac < 1
      ? Math.ceil(motherCosts.unitCostCents / (1 - targetMarginFrac))
      : motherCosts.unitCostCents;

  const updatedMother = await tx.recipe.update({
    where: { id: recipeId },
    data: {
      subtotalBeforeContingencyCents: motherCosts.subtotalBeforeContingencyCents,
      batchCostExactCents: motherCosts.batchCostExactCents,
      batchCostCents: motherCosts.batchCostCents,
      unitCostCents: motherCosts.unitCostCents,
      costPerYieldUnit: motherCosts.costPerYieldUnit,
      suggestedPriceCents,
      // Preserva currentPriceCents explícito
    },
  });

  // 4. Presentaciones en orden topológico arbitrario con detección de ciclos
  const topo = orderPresentationsTopologically(recipe.presentations);
  warnings.push(...topo.warnings);

  const exactCostByVariantId = new Map<string, number>();
  const updatedPresentations = [];

  for (const pres of topo.ordered as any[]) {
    let packagingCostCents = 0;
    for (const m of pres.materials || []) {
      let matTotal = m.totalCostCents || 0;
      if (options.recomputeLinesFromMaster && m.ingredientId && m.ingredient) {
        const ingOverride = options.overrideIngredientMap?.get(m.ingredientId);
        const costPerBaseUnit = ingOverride ? ingOverride.costPerBaseUnit : m.ingredient.costPerBaseUnit;
        const baseUnit = ingOverride ? ingOverride.baseUnit : m.ingredient.baseUnit;
        const density = ingOverride ? ingOverride.density : m.ingredient.density;

        const norm = normalizeToBase(m.quantity, m.unit, baseUnit, density ?? undefined);
        if (norm.ok) {
          matTotal = Math.round(norm.value * costPerBaseUnit * 100);
          const newUnitCostCents = m.quantity > 0 ? Math.round(matTotal / m.quantity) : matTotal;
          if (matTotal !== m.totalCostCents || newUnitCostCents !== m.unitCostCents) {
            await tx.presentationMaterial.update({
              where: { id: m.id },
              data: { totalCostCents: matTotal, unitCostCents: newUnitCostCents },
            });
          }
        } else {
          warnings.push({
            scope: "PRESENTATION_MATERIAL",
            entityId: m.id,
            entityName: `${pres.name} -> ${m.name}`,
            message: `Se conservó costo previo de empaque/decoración por unidad incompatible: ${norm.error}`,
          });
        }
      }
      packagingCostCents += matTotal;
    }

    let additionalCostCents = 0;
    for (const s of pres.subrecipes || []) {
      let subCost = s.costCents || 0;
      if (options.recomputeLinesFromMaster && s.subRecipeId && (s.subRecipe || options.overrideSubRecipeUnitCostMap?.has(s.subRecipeId))) {
        const childUnitCost = options.overrideSubRecipeUnitCostMap?.get(s.subRecipeId) ?? s.subRecipe.unitCostCents;
        subCost = Math.round(s.quantity * childUnitCost);
        if (subCost !== s.costCents) {
          await tx.presentationSubrecipe.update({
            where: { id: s.id },
            data: { costCents: subCost },
          });
        }
      }
      additionalCostCents += subCost;
    }

    const useAsGroup = Boolean(pres.parentId) && !topo.fallbackParentIds.has(pres.id) && exactCostByVariantId.has(pres.parentId);

    if (useAsGroup) {
      const parentExact = exactCostByVariantId.get(pres.parentId)!;
      const vals = calculateGroupPresentationValues({
        variantUnitTotalCostExactCents: parentExact,
        groupQty: pres.groupQty || 1,
        groupPackagingCostCents: packagingCostCents,
        groupAdditionalCostCents: additionalCostCents,
        pricingMethod: pres.pricingMethod as PricingMethod,
        desiredMarginPercent: pres.desiredMarginPercent,
        currentFinalPriceCents: pres.finalPriceCents,
      });

      exactCostByVariantId.set(pres.id, vals.unitTotalCostExactCents);

      const up = await tx.recipePresentation.update({
        where: { id: pres.id },
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
    } else {
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
  }

  return {
    motherRecipe: updatedMother,
    presentations: updatedPresentations,
    warnings,
  };
}

/**
 * RECALCULO EN CASCADA REACTIVA (PRE-002):
 * Abre una transacción propia y delega en `recalculateRecipeTreeInTx`.
 */
export async function recalculateRecipeAndPresentations(recipeId: string) {
  return await prisma.$transaction(async (tx: any) => {
    return await recalculateRecipeTreeInTx(tx, recipeId);
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

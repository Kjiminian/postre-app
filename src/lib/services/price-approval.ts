// Simulador de Impacto y Aprobación Transaccional de Propuestas de Precios
// GEM PROYECTOS SOFTWARE V3.0 (PRE-001, PRE-002, PRE-003, RF-014)

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/api-errors";
import { normalizeToBase } from "@/lib/conversions";
import { calculateIngredientBaseCost } from "@/lib/ingredient-cost";
import { PricingMethod } from "@/types";
import {
  calculateMotherRecipeCosts,
  calculateVariantValues,
  calculateGroupPresentationValues,
  orderPresentationsTopologically,
  CascadeWarning,
} from "@/lib/services/presentations";
import { ApplyStrategy, evaluatePackCompatibility } from "@/lib/services/price-adapters";

export interface ProposalOverride {
  proposedPriceCents?: number;
  applyStrategy?: ApplyStrategy;
}

export interface RecipeImpactDto {
  recipeId: string;
  recipeName: string;
  recipeType: string;
  batchCostBeforeCents: number;
  batchCostAfterCents: number;
  unitCostBeforeCents: number;
  unitCostAfterCents: number;
  suggestedPriceBeforeCents: number;
  suggestedPriceAfterCents: number;
  deltaBatchCents: number;
  deltaPercent: number;
}

export interface PresentationImpactDto {
  presentationId: string;
  recipeId: string;
  recipeName: string;
  presentationName: string;
  isComposite: boolean;
  totalCostBeforeCents: number;
  totalCostAfterCents: number;
  finalPriceCents: number;
  suggestedPriceAfterCents: number;
  desiredMarginPercent: number;
  realMarginBeforePct: number;
  realMarginAfterPct: number;
  healthStatus: "OK" | "BELOW_TARGET_MARGIN" | "NEGATIVE_PROFIT";
}

export interface IngredientImpactDto {
  ingredientId: string;
  code: string | null;
  name: string;
  priceBeforeCents: number;
  priceAfterCents: number;
  costPerBaseBefore: number;
  costPerBaseAfter: number;
  baseUnit: string;
}

export interface ImpactSimulationReport {
  ingredients: IngredientImpactDto[];
  recipes: RecipeImpactDto[];
  presentations: PresentationImpactDto[];
  warnings: CascadeWarning[];
  summary: {
    affectedIngredientsCount: number;
    affectedRecipesCount: number;
    affectedPresentationsCount: number;
    belowTargetMarginCount: number;
  };
}

interface UpdatedIngredientState {
  id: string;
  code: string | null;
  name: string;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  factorId: string | null;
  conversionFactor: number;
  costPerBaseUnit: number;
  density: number | null;
}

interface ComputedCascadeResult {
  report: ImpactSimulationReport;
  recipeLineUpdates: Array<{ id: string; costCents: number }>;
  subRecipeUseUpdates: Array<{ id: string; costCents: number }>;
  recipeUpdates: Array<{
    id: string;
    subtotalBeforeContingencyCents: number;
    batchCostExactCents: number;
    batchCostCents: number;
    unitCostCents: number;
    costPerYieldUnit: number;
    suggestedPriceCents: number;
    targetMargin: number;
    triggerIngredientId: string | null;
  }>;
  materialUpdates: Array<{ id: string; unitCostCents: number; totalCostCents: number }>;
  subrecipePresUpdates: Array<{ id: string; costCents: number }>;
  presentationUpdates: Array<{
    id: string;
    baseCostCents: number;
    unitTotalCostExactCents: number;
    packagingCostCents: number;
    additionalCostCents: number;
    totalCostCents: number;
    suggestedPriceCents: number;
    finalPriceCents: number;
    realProfitCents: number;
    realMarginPercent: number;
  }>;
}

/**
 * Ordena un conjunto de recetas afectadas en orden topológico (subrecetas hijas antes que recetas madre)
 * detectando ciclos en `SubRecipeUse` (422).
 */
function orderRecipesTopologically(
  targetRecipeIds: Set<string>,
  recipesById: Map<string, any>
): any[] {
  const ordered: any[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (recId: string) => {
    if (visited.has(recId)) return;
    if (visiting.has(recId)) {
      throw new AppError(
        "Dependencia circular detectada entre subrecetas (SubRecipeUse).",
        422,
        "SUBRECIPE_CYCLE"
      );
    }
    const rec = recipesById.get(recId);
    if (!rec) return;

    visiting.add(recId);
    for (const sub of rec.subRecipeUses || []) {
      if (targetRecipeIds.has(sub.childId)) {
        visit(sub.childId);
      }
    }
    for (const pres of rec.presentations || []) {
      for (const ps of pres.subrecipes || []) {
        if (ps.subRecipeId && targetRecipeIds.has(ps.subRecipeId)) {
          visit(ps.subRecipeId);
        }
      }
    }
    visiting.delete(recId);
    visited.add(recId);
    ordered.push(rec);
  };

  for (const id of targetRecipeIds) {
    visit(id);
  }
  return ordered;
}

/**
 * Núcleo compartido 1:1 entre `simulatePriceImpact` (solo lectura) y `approveProposals` (transaccional).
 */
export async function computeCascadeFromIngredients(
  dbOrTx: any,
  ingredientIds: string[],
  overrideMap: Map<string, UpdatedIngredientState>
): Promise<ComputedCascadeResult> {
  if (ingredientIds.length === 0) {
    return {
      report: {
        ingredients: [],
        recipes: [],
        presentations: [],
        warnings: [],
        summary: {
          affectedIngredientsCount: 0,
          affectedRecipesCount: 0,
          affectedPresentationsCount: 0,
          belowTargetMarginCount: 0,
        },
      },
      recipeLineUpdates: [],
      subRecipeUseUpdates: [],
      recipeUpdates: [],
      materialUpdates: [],
      subrecipePresUpdates: [],
      presentationUpdates: [],
    };
  }

  // 1. Encontrar recetas directamente afectadas (RecipeIngredient o PresentationMaterial)
  const [directRi, directMats] = await Promise.all([
    dbOrTx.recipeIngredient.findMany({
      where: {
        ingredientId: { in: ingredientIds },
        recipe: { status: { in: ["ACTIVE", "DRAFT"] } },
      },
      select: { recipeId: true },
    }),
    dbOrTx.presentationMaterial.findMany({
      where: {
        ingredientId: { in: ingredientIds },
        presentation: { isActive: true, recipe: { status: { in: ["ACTIVE", "DRAFT"] } } },
      },
      select: { presentation: { select: { recipeId: true } } },
    }),
  ]);

  const affectedRecipeIds = new Set<string>();
  for (const r of directRi) affectedRecipeIds.add(r.recipeId);
  for (const m of directMats) affectedRecipeIds.add(m.presentation.recipeId);

  // 2. Expansión transitiva por SubRecipeUse y PresentationSubrecipe
  let frontier = Array.from(affectedRecipeIds);
  const seenExpanded = new Set<string>(frontier);
  while (frontier.length > 0) {
    const [parentUses, presSubs] = await Promise.all([
      dbOrTx.subRecipeUse.findMany({
        where: {
          childId: { in: frontier },
          parent: { status: { in: ["ACTIVE", "DRAFT"] } },
        },
        select: { parentId: true },
      }),
      dbOrTx.presentationSubrecipe.findMany({
        where: {
          subRecipeId: { in: frontier },
          presentation: { isActive: true, recipe: { status: { in: ["ACTIVE", "DRAFT"] } } },
        },
        select: { presentation: { select: { recipeId: true } } },
      }),
    ]);

    const nextFrontier: string[] = [];
    for (const u of parentUses) {
      if (!seenExpanded.has(u.parentId)) {
        seenExpanded.add(u.parentId);
        affectedRecipeIds.add(u.parentId);
        nextFrontier.push(u.parentId);
      }
    }
    for (const ps of presSubs) {
      const pid = ps.presentation.recipeId;
      if (!seenExpanded.has(pid)) {
        seenExpanded.add(pid);
        affectedRecipeIds.add(pid);
        nextFrontier.push(pid);
      }
    }
    frontier = nextFrontier;
  }

  if (affectedRecipeIds.size === 0) {
    return {
      report: {
        ingredients: [],
        recipes: [],
        presentations: [],
        warnings: [],
        summary: {
          affectedIngredientsCount: ingredientIds.length,
          affectedRecipesCount: 0,
          affectedPresentationsCount: 0,
          belowTargetMarginCount: 0,
        },
      },
      recipeLineUpdates: [],
      subRecipeUseUpdates: [],
      recipeUpdates: [],
      materialUpdates: [],
      subrecipePresUpdates: [],
      presentationUpdates: [],
    };
  }

  const fullRecipes = await dbOrTx.recipe.findMany({
    where: { id: { in: Array.from(affectedRecipeIds) } },
    include: {
      ingredients: { include: { ingredient: true } },
      subRecipeUses: { include: { child: true } },
      presentations: {
        where: { isActive: true },
        include: {
          materials: { include: { ingredient: true } },
          subrecipes: { include: { subRecipe: true } },
        },
      },
    },
  });

  const recipesById = new Map<string, any>(fullRecipes.map((r: any) => [r.id, r]));
  const orderedRecipes = orderRecipesTopologically(affectedRecipeIds, recipesById);

  const updatedSubRecipeUnitCost = new Map<string, number>();
  const subRecipeTriggerIngredient = new Map<string, string>();
  const warnings: CascadeWarning[] = [];

  const recipeLineUpdates: ComputedCascadeResult["recipeLineUpdates"] = [];
  const subRecipeUseUpdates: ComputedCascadeResult["subRecipeUseUpdates"] = [];
  const recipeUpdates: ComputedCascadeResult["recipeUpdates"] = [];
  const materialUpdates: ComputedCascadeResult["materialUpdates"] = [];
  const subrecipePresUpdates: ComputedCascadeResult["subrecipePresUpdates"] = [];
  const presentationUpdates: ComputedCascadeResult["presentationUpdates"] = [];

  const recipeImpacts: RecipeImpactDto[] = [];
  const presentationImpacts: PresentationImpactDto[] = [];

  for (const recipe of orderedRecipes) {
    let ingredientsCostCents = 0;
    let triggerIngredientId: string | null = null;

    for (const ri of recipe.ingredients) {
      let lineCostCents = ri.costCents;
      const ov = overrideMap.get(ri.ingredientId);
      const ing = ov || ri.ingredient;
      if (ing && overrideMap.has(ri.ingredientId)) {
        if (!triggerIngredientId) triggerIngredientId = ri.ingredientId;
        const norm = normalizeToBase(ri.quantity, ri.unit, ing.baseUnit, ing.density ?? undefined);
        if (norm.ok) {
          lineCostCents = Math.round(norm.value * ing.costPerBaseUnit * 100);
          if (lineCostCents !== ri.costCents) {
            recipeLineUpdates.push({ id: ri.id, costCents: lineCostCents });
          }
        } else {
          warnings.push({
            scope: "RECIPE_INGREDIENT",
            entityId: ri.id,
            entityName: `${recipe.name} -> ${ing.name}`,
            message: `Se conservó costo previo (RD$ ${(ri.costCents / 100).toFixed(2)}) por unidad incompatible: ${norm.error}`,
          });
        }
      }
      ingredientsCostCents += lineCostCents;
    }

    for (const sub of recipe.subRecipeUses || []) {
      let subCost = sub.costCents;
      if (updatedSubRecipeUnitCost.has(sub.childId)) {
        if (!triggerIngredientId && subRecipeTriggerIngredient.has(sub.childId)) {
          triggerIngredientId = subRecipeTriggerIngredient.get(sub.childId)!;
        }
        subCost = Math.round(sub.quantity * updatedSubRecipeUnitCost.get(sub.childId)!);
        if (subCost !== sub.costCents) {
          subRecipeUseUpdates.push({ id: sub.id, costCents: subCost });
        }
      }
      ingredientsCostCents += subCost;
    }

    if (!triggerIngredientId) {
      for (const pres of recipe.presentations || []) {
        for (const m of pres.materials || []) {
          if (m.ingredientId && overrideMap.has(m.ingredientId)) {
            triggerIngredientId = m.ingredientId;
            break;
          }
        }
        if (triggerIngredientId) break;
        for (const ps of pres.subrecipes || []) {
          if (ps.subRecipeId && subRecipeTriggerIngredient.has(ps.subRecipeId)) {
            triggerIngredientId = subRecipeTriggerIngredient.get(ps.subRecipeId)!;
            break;
          }
        }
        if (triggerIngredientId) break;
      }
    }
    if (triggerIngredientId) {
      subRecipeTriggerIngredient.set(recipe.id, triggerIngredientId);
    }

    const motherCosts = calculateMotherRecipeCosts({
      ingredientsCostCents,
      laborPercent: recipe.laborPercent,
      overheadPercent: recipe.overheadPercent,
      contingencyPercent: recipe.contingencyPercent ?? 0,
      packageCostCents: recipe.packageCostCents,
      yieldQty: recipe.yield,
    });

    const targetMarginFrac = (recipe.targetMargin ?? 40) / 100;
    const suggestedPriceAfterCents =
      targetMarginFrac >= 0 && targetMarginFrac < 1
        ? Math.ceil(motherCosts.unitCostCents / (1 - targetMarginFrac))
        : motherCosts.unitCostCents;

    updatedSubRecipeUnitCost.set(recipe.id, motherCosts.unitCostCents);

    recipeUpdates.push({
      id: recipe.id,
      subtotalBeforeContingencyCents: motherCosts.subtotalBeforeContingencyCents,
      batchCostExactCents: motherCosts.batchCostExactCents,
      batchCostCents: motherCosts.batchCostCents,
      unitCostCents: motherCosts.unitCostCents,
      costPerYieldUnit: motherCosts.costPerYieldUnit,
      suggestedPriceCents: suggestedPriceAfterCents,
      targetMargin: recipe.targetMargin ?? 40,
      triggerIngredientId,
    });

    const deltaBatchCents = motherCosts.batchCostCents - recipe.batchCostCents;
    const deltaPct =
      recipe.batchCostCents > 0 ? Number(((deltaBatchCents / recipe.batchCostCents) * 100).toFixed(2)) : 0;

    recipeImpacts.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeType: recipe.recipeType,
      batchCostBeforeCents: recipe.batchCostCents,
      batchCostAfterCents: motherCosts.batchCostCents,
      unitCostBeforeCents: recipe.unitCostCents,
      unitCostAfterCents: motherCosts.unitCostCents,
      suggestedPriceBeforeCents: recipe.suggestedPriceCents,
      suggestedPriceAfterCents,
      deltaBatchCents,
      deltaPercent: deltaPct,
    });

    // Presentaciones en orden topológico con detección de ciclos
    const topo = orderPresentationsTopologically(recipe.presentations || []);
    warnings.push(...topo.warnings);
    const exactByPresId = new Map<string, number>();

    for (const pres of topo.ordered as any[]) {
      let pkgCost = 0;
      for (const m of pres.materials || []) {
        let matTotal = m.totalCostCents || 0;
        if (m.ingredientId && overrideMap.has(m.ingredientId)) {
          const ing = overrideMap.get(m.ingredientId)!;
          const norm = normalizeToBase(m.quantity, m.unit, ing.baseUnit, ing.density ?? undefined);
          if (norm.ok) {
            matTotal = Math.round(norm.value * ing.costPerBaseUnit * 100);
            const unitCostCents = m.quantity > 0 ? Math.round(matTotal / m.quantity) : matTotal;
            if (matTotal !== m.totalCostCents || unitCostCents !== m.unitCostCents) {
              materialUpdates.push({ id: m.id, unitCostCents, totalCostCents: matTotal });
            }
          } else {
            warnings.push({
              scope: "PRESENTATION_MATERIAL",
              entityId: m.id,
              entityName: `${pres.name} -> ${m.name}`,
              message: `Se conservó costo previo de material por unidad incompatible: ${norm.error}`,
            });
          }
        }
        pkgCost += matTotal;
      }

      let addCost = 0;
      for (const ps of pres.subrecipes || []) {
        let sCost = ps.costCents || 0;
        if (ps.subRecipeId && updatedSubRecipeUnitCost.has(ps.subRecipeId)) {
          sCost = Math.round(ps.quantity * updatedSubRecipeUnitCost.get(ps.subRecipeId)!);
          if (sCost !== ps.costCents) {
            subrecipePresUpdates.push({ id: ps.id, costCents: sCost });
          }
        }
        addCost += sCost;
      }

      const useAsGroup =
        Boolean(pres.parentId) &&
        !topo.fallbackParentIds.has(pres.id) &&
        exactByPresId.has(pres.parentId);

      const vals = useAsGroup
        ? calculateGroupPresentationValues({
            variantUnitTotalCostExactCents: exactByPresId.get(pres.parentId)!,
            groupQty: pres.groupQty || 1,
            groupPackagingCostCents: pkgCost,
            groupAdditionalCostCents: addCost,
            pricingMethod: pres.pricingMethod as PricingMethod,
            desiredMarginPercent: pres.desiredMarginPercent,
            currentFinalPriceCents: pres.finalPriceCents,
          })
        : calculateVariantValues({
            motherBatchYield: recipe.yield,
            motherBatchCostExactCents: motherCosts.batchCostExactCents,
            consumptionMode: pres.consumptionMode,
            presentationYield: pres.presentationYield,
            batchFraction: pres.batchFraction,
            packagingCostCents: pkgCost,
            additionalCostCents: addCost,
            pricingMethod: pres.pricingMethod as PricingMethod,
            desiredMarginPercent: pres.desiredMarginPercent,
            currentFinalPriceCents: pres.finalPriceCents,
          });

      exactByPresId.set(pres.id, vals.unitTotalCostExactCents);

      presentationUpdates.push({
        id: pres.id,
        baseCostCents: vals.baseCostCents,
        unitTotalCostExactCents: vals.unitTotalCostExactCents,
        packagingCostCents: pkgCost,
        additionalCostCents: addCost,
        totalCostCents: vals.totalCostCents,
        suggestedPriceCents: vals.suggestedPriceCents,
        finalPriceCents: vals.finalPriceCents,
        realProfitCents: vals.realProfitCents,
        realMarginPercent: vals.realMarginPercent,
      });

      const marginBefore =
        pres.finalPriceCents > 0
          ? Number((((pres.finalPriceCents - pres.totalCostCents) / pres.finalPriceCents) * 100).toFixed(2))
          : 0;
      const marginAfter = Number(vals.realMarginPercent.toFixed(2));
      const healthStatus: PresentationImpactDto["healthStatus"] =
        vals.realProfitCents < 0
          ? "NEGATIVE_PROFIT"
          : pres.pricingMethod === "MARGIN" && marginAfter < pres.desiredMarginPercent
          ? "BELOW_TARGET_MARGIN"
          : "OK";

      presentationImpacts.push({
        presentationId: pres.id,
        recipeId: recipe.id,
        recipeName: recipe.name,
        presentationName: pres.name,
        isComposite: Boolean(pres.isComposite || pres.parentId),
        totalCostBeforeCents: pres.totalCostCents,
        totalCostAfterCents: vals.totalCostCents,
        finalPriceCents: vals.finalPriceCents,
        suggestedPriceAfterCents: vals.suggestedPriceCents,
        desiredMarginPercent: pres.desiredMarginPercent,
        realMarginBeforePct: marginBefore,
        realMarginAfterPct: marginAfter,
        healthStatus,
      });
    }
  }

  return {
    report: {
      ingredients: [],
      recipes: recipeImpacts,
      presentations: presentationImpacts,
      warnings,
      summary: {
        affectedIngredientsCount: ingredientIds.length,
        affectedRecipesCount: recipeImpacts.length,
        affectedPresentationsCount: presentationImpacts.length,
        belowTargetMarginCount: presentationImpacts.filter((p) => p.healthStatus !== "OK").length,
      },
    },
    recipeLineUpdates,
    subRecipeUseUpdates,
    recipeUpdates,
    materialUpdates,
    subrecipePresUpdates,
    presentationUpdates,
  };
}

/**
 * Construye el nuevo estado de un Ingredient al evaluar una propuesta (con posibles overrides de precio/estrategia).
 */
function buildTargetIngredientState(
  prop: any,
  override?: ProposalOverride
): { state: UpdatedIngredientState; usedStrategy: ApplyStrategy; adoptedPackChanged: boolean } {
  const ing = prop.ingredient;
  const strategy = (override?.applyStrategy || prop.applyStrategyUsed || "STRICT_SAME_PACK") as ApplyStrategy;
  const strategyOverridden = Boolean(override?.applyStrategy && override.applyStrategy !== prop.applyStrategyUsed);

  let targetPriceCents = override?.proposedPriceCents ?? prop.proposedPriceCents;
  let overridePkgQty: number | null = prop.proposedPackageQty ?? null;
  let overridePkgUnit: string | null = prop.proposedPackageUnit ?? null;
  let overrideFactor: number | null = prop.proposedConversionFactor ?? null;

  const needsPackOrStrategyEval =
    (override?.proposedPriceCents === undefined && strategyOverridden) ||
    (strategy === "ADOPT_SOURCE_PACK" && (!overridePkgQty || !overridePkgUnit));

  if (needsPackOrStrategyEval) {
    if (strategy === "ADOPT_SOURCE_PACK" && (!prop.detectedPackQty || !prop.detectedPackUnit)) {
      throw new AppError(
        `La propuesta para ${ing.name} no contiene empaque detectado para adoptar.`,
        400,
        "MISSING_DETECTED_PACK"
      );
    }

    if (prop.detectedPackQty && prop.detectedPackUnit) {
      const evalRes = evaluatePackCompatibility({
        currentPackagePriceCents: ing.packagePriceCents,
        currentPackageQty: ing.packageQty,
        currentPackageUnit: ing.packageUnit,
        currentBaseUnit: ing.baseUnit,
        currentConversionFactor: ing.conversionFactor ?? 1,
        hasExplicitFactor: Boolean(ing.factorId) || (ing.conversionFactor ?? 1) !== 1,
        currentCostPerBaseUnit: ing.costPerBaseUnit,
        density: ing.density,
        detectedPriceCents: prop.detectedPriceCents,
        detectedInStock: prop.detectedInStock ?? true,
        detectedPackQty: prop.detectedPackQty,
        detectedPackUnit: prop.detectedPackUnit,
        applyStrategy: strategy,
      });

      if (
        evalRes.packCheckStatus === "UNIT_INCOMPATIBLE" &&
        (strategy === "REBASE_UNIT_COST" || strategy === "ADOPT_SOURCE_PACK")
      ) {
        throw new AppError(
          `Unidades incompatibles para rebasar/adoptar empaque en ${ing.name}; define la densidad del insumo primero.`,
          400,
          "UNIT_INCOMPATIBLE"
        );
      }

      if (override?.proposedPriceCents === undefined) {
        targetPriceCents = evalRes.proposedPriceCents;
      }
      overridePkgQty = evalRes.proposedPackageQty;
      overridePkgUnit = evalRes.proposedPackageUnit;
      overrideFactor = evalRes.proposedConversionFactor;
    } else if (strategy === "REBASE_UNIT_COST" && override?.proposedPriceCents === undefined) {
      throw new AppError(
        `La propuesta para ${ing.name} no contiene empaque detectado para rebasar costo.`,
        400,
        "MISSING_DETECTED_PACK"
      );
    }
  }

  if (!Number.isFinite(targetPriceCents) || targetPriceCents <= 0) {
    throw new AppError(`El precio propuesto para ${ing.name} debe ser mayor a 0.`, 400, "INVALID_PRICE");
  }

  let nextQty = ing.packageQty;
  let nextPkgUnit = ing.packageUnit;
  let nextFactor = ing.conversionFactor ?? 1;
  let nextFactorId = ing.factorId;
  let adoptedPackChanged = false;

  if (
    strategy === "ADOPT_SOURCE_PACK" &&
    overridePkgQty &&
    overridePkgQty > 0 &&
    overridePkgUnit
  ) {
    nextQty = overridePkgQty;
    nextPkgUnit = overridePkgUnit;
    const samePackAndUnit = nextPkgUnit === ing.packageUnit && nextQty === ing.packageQty;
    if (samePackAndUnit) {
      nextFactor = ing.conversionFactor ?? 1;
      nextFactorId = ing.factorId;
    } else {
      nextFactor = overrideFactor ?? 1;
      if (nextPkgUnit !== ing.packageUnit) {
        nextFactorId = null; // PRE-003: evitar multiplicar nuevo empaque por factor legacy viejo
      }
    }
    adoptedPackChanged = !samePackAndUnit;
  }

  const costCalc = calculateIngredientBaseCost({
    packagePriceCents: targetPriceCents,
    packageQty: nextQty,
    packageUnit: nextPkgUnit,
    baseUnit: ing.baseUnit,
    conversionFactor: nextFactor,
    hasExplicitFactor: Boolean(nextFactorId) || nextFactor !== 1,
    density: ing.density,
  });

  if (!costCalc.ok) {
    throw new AppError(`No se puede recalcular costo base de ${ing.name}: ${costCalc.error}`, 400, "COST_CALC_ERROR");
  }

  return {
    usedStrategy: strategy,
    adoptedPackChanged,
    state: {
      id: ing.id,
      code: ing.code,
      name: ing.name,
      packagePriceCents: targetPriceCents,
      packageQty: nextQty,
      packageUnit: nextPkgUnit,
      baseUnit: ing.baseUnit,
      factorId: nextFactorId,
      conversionFactor: nextFactor,
      costPerBaseUnit: costCalc.costPerBaseUnit,
      density: ing.density,
    },
  };
}

/**
 * Simulador en solo lectura antes de aprobar (PRE-001, PRE-002).
 */
export async function simulatePriceImpact(
  proposalIds: string[],
  overridesByProposalId: Record<string, ProposalOverride> = {},
  db: any = prisma
): Promise<ImpactSimulationReport> {
  if (proposalIds.length === 0) {
    throw new AppError("Debes seleccionar al menos una propuesta.", 400, "EMPTY_PROPOSALS");
  }

  const proposals = await db.priceUpdateProposal.findMany({
    where: { id: { in: proposalIds } },
    include: { ingredient: true },
  });

  if (proposals.length !== proposalIds.length) {
    throw new AppError("Una o más propuestas no fueron encontradas.", 404, "PROPOSAL_NOT_FOUND");
  }

  const seenIng = new Set<string>();
  const overrideMap = new Map<string, UpdatedIngredientState>();
  const ingImpacts: IngredientImpactDto[] = [];

  for (const p of proposals) {
    if (seenIng.has(p.ingredientId)) {
      throw new AppError(
        `No puedes simular ni aprobar dos propuestas del mismo producto (${p.ingredient.name}) a la vez.`,
        400,
        "DUPLICATE_INGREDIENT_PROPOSAL"
      );
    }
    seenIng.add(p.ingredientId);

    const { state } = buildTargetIngredientState(p, overridesByProposalId[p.id]);
    overrideMap.set(p.ingredientId, state);

    ingImpacts.push({
      ingredientId: p.ingredient.id,
      code: p.ingredient.code,
      name: p.ingredient.name,
      priceBeforeCents: p.ingredient.packagePriceCents,
      priceAfterCents: state.packagePriceCents,
      costPerBaseBefore: p.ingredient.costPerBaseUnit,
      costPerBaseAfter: state.costPerBaseUnit,
      baseUnit: p.ingredient.baseUnit,
    });
  }

  const cascade = await computeCascadeFromIngredients(db, Array.from(seenIng), overrideMap);
  return {
    ...cascade.report,
    ingredients: ingImpacts,
  };
}

const BLOCKING_ALERTS = new Set([
  "PACK_MISMATCH",
  "UNIT_INCOMPATIBLE",
  "OUT_OF_STOCK",
  "PRICE_SPIKE_GT_20",
  "PRICE_DROP_GT_30",
  "AMBIGUOUS_VARIANT",
  "UNKNOWN_PACK",
]);

/**
 * Aprobación atómica transaccional (CAS + Drift Check + Cascada Topológica + Trazabilidad).
 * Invariantes: NUNCA modifica `Sale`, `SaleItem`, `Payment`, `WeeklyClose`,
 * `Recipe.currentPriceCents` ni `RecipePresentation.finalPriceCents`.
 */
export async function approveProposals(
  params: {
    proposalIds: string[];
    confirmCriticalAlerts?: boolean;
    allowStaleDrift?: boolean;
    overridesByProposalId?: Record<string, ProposalOverride>;
    reviewNote?: string | null;
  },
  db: any = prisma
) {
  const uniqueIds = Array.from(new Set(params.proposalIds));
  if (uniqueIds.length === 0) {
    throw new AppError("Debes seleccionar al menos una propuesta.", 400, "EMPTY_PROPOSALS");
  }

  const proposals = await db.priceUpdateProposal.findMany({
    where: { id: { in: uniqueIds } },
    include: { ingredient: true },
  });

  if (proposals.length !== uniqueIds.length) {
    throw new AppError("Una o más propuestas no fueron encontradas.", 404, "PROPOSAL_NOT_FOUND");
  }

  // Validar unicidad de ingredientId y verificar alertas críticas
  const seenIng = new Set<string>();
  const blockedIds: string[] = [];

  for (const p of proposals) {
    if (seenIng.has(p.ingredientId)) {
      throw new AppError(
        `No se pueden aprobar dos propuestas del mismo ingrediente (${p.ingredient.name}) en el mismo lote.`,
        400,
        "DUPLICATE_INGREDIENT_PROPOSAL"
      );
    }
    seenIng.add(p.ingredientId);

    const ov = params.overridesByProposalId?.[p.id];
    const effectiveStrategy = ov?.applyStrategy || p.applyStrategyUsed;

    if (p.packCheckStatus === "PACK_MISMATCH" && effectiveStrategy === "STRICT_SAME_PACK") {
      blockedIds.push(p.id);
      continue;
    }

    if (
      p.packCheckStatus === "UNIT_INCOMPATIBLE" &&
      (effectiveStrategy === "REBASE_UNIT_COST" || effectiveStrategy === "ADOPT_SOURCE_PACK")
    ) {
      throw new AppError(
        `Unidades incompatibles para rebasar/adoptar empaque en ${p.ingredient.name}; define la densidad del insumo primero.`,
        400,
        "UNIT_INCOMPATIBLE"
      );
    }

    let alerts: string[] = [];
    try {
      alerts = p.alertsJson ? JSON.parse(p.alertsJson) : [];
    } catch {
      alerts = [];
    }

    if (alerts.some((a) => BLOCKING_ALERTS.has(a)) && !params.confirmCriticalAlerts) {
      blockedIds.push(p.id);
    }
  }

  if (blockedIds.length > 0) {
    throw new AppError(
      "Existen propuestas con alertas críticas o cambio de empaque sin confirmación explícita.",
      409,
      "CRITICAL_ALERTS_REQUIRE_CONFIRMATION",
      { blockedProposalIds: blockedIds }
    );
  }

  const now = new Date();

  return await db.$transaction(async (tx: any) => {
    // Paso 1: Optimistic Lock CAS (status = PENDING y vigente)
    const lockResult = await tx.priceUpdateProposal.updateMany({
      where: {
        id: { in: uniqueIds },
        status: "PENDING",
        expiresAt: { gt: now },
      },
      data: {
        status: "APPROVED",
        reviewedAt: now,
        reviewNote: params.reviewNote || null,
      },
    });

    if (lockResult.count !== uniqueIds.length) {
      throw new AppError(
        "Una o más propuestas ya fueron procesadas o expiraron. Recarga la bandeja.",
        409,
        "CONFLICT_PROPOSAL_STATE"
      );
    }

    const overrideMap = new Map<string, UpdatedIngredientState>();
    const ingImpacts: IngredientImpactDto[] = [];
    const primaryProposalByIngredient = new Map<string, string>();

    const freshIngredients = await tx.ingredient.findMany({
      where: { id: { in: Array.from(seenIng) } },
    });
    const freshIngMap = new Map<string, any>(freshIngredients.map((i: any) => [i.id, i]));

    // Paso 2 & 3 & 4: Drift Check, Expirar competidoras y Actualizar Ingredients
    for (const p of proposals) {
      const freshIng = freshIngMap.get(p.ingredientId);
      if (!freshIng) {
        throw new AppError(`Ingrediente ${p.ingredientId} no encontrado.`, 404, "INGREDIENT_NOT_FOUND");
      }

      if (
        !params.allowStaleDrift &&
        freshIng.updatedAt.getTime() !== new Date(p.currentIngredientUpdatedAt).getTime()
      ) {
        throw new AppError(
          `El producto "${freshIng.name}" fue editado manualmente desde que se generó la propuesta.`,
          409,
          "STALE_PROPOSAL",
          { proposalId: p.id, ingredientId: freshIng.id }
        );
      }

      const { state, usedStrategy, adoptedPackChanged } = buildTargetIngredientState(
        { ...p, ingredient: freshIng },
        params.overridesByProposalId?.[p.id]
      );
      overrideMap.set(freshIng.id, state);
      primaryProposalByIngredient.set(freshIng.id, p.id);

      ingImpacts.push({
        ingredientId: freshIng.id,
        code: freshIng.code,
        name: freshIng.name,
        priceBeforeCents: freshIng.packagePriceCents,
        priceAfterCents: state.packagePriceCents,
        costPerBaseBefore: freshIng.costPerBaseUnit,
        costPerBaseAfter: state.costPerBaseUnit,
        baseUnit: freshIng.baseUnit,
      });

      await tx.ingredient.update({
        where: { id: freshIng.id },
        data: {
          packagePriceCents: state.packagePriceCents,
          costPerBaseUnit: state.costPerBaseUnit,
          ...(adoptedPackChanged
            ? {
                packageQty: state.packageQty,
                packageUnit: state.packageUnit,
                conversionFactor: state.conversionFactor,
                factorId: state.factorId,
              }
            : {}),
        },
      });

      await tx.priceUpdateProposal.update({
        where: { id: p.id },
        data: {
          applyStrategyUsed: usedStrategy,
          proposedPriceCents: state.packagePriceCents,
          proposedCostPerBaseUnit: state.costPerBaseUnit,
          ...(adoptedPackChanged
            ? {
                proposedPackageQty: state.packageQty,
                proposedPackageUnit: state.packageUnit,
                proposedConversionFactor: state.conversionFactor,
              }
            : {}),
        },
      });
    }

    // Expirar otras propuestas PENDING de los mismos ingredientes
    await tx.priceUpdateProposal.updateMany({
      where: {
        ingredientId: { in: Array.from(seenIng) },
        status: "PENDING",
        id: { notIn: uniqueIds },
      },
      data: { status: "EXPIRED" },
    });

    // Paso 5: Ejecutar y persistir la cascada topológica completa en tx
    const cascade = await computeCascadeFromIngredients(tx, Array.from(seenIng), overrideMap);

    await persistCascadeUpdatesInTx(
      tx,
      cascade,
      uniqueIds[0],
      "portal_price_approval",
      primaryProposalByIngredient
    );

    const finalReport: ImpactSimulationReport = {
      ...cascade.report,
      ingredients: ingImpacts,
    };

    const snapshotStr = JSON.stringify({
      appliedAt: now.toISOString(),
      summary: finalReport.summary,
      warnings: finalReport.warnings,
    });

    await tx.priceUpdateProposal.updateMany({
      where: { id: { in: uniqueIds } },
      data: { appliedSnapshotJson: snapshotStr },
    });

    return finalReport;
  });
}

async function persistCascadeUpdatesInTx(
  tx: any,
  cascade: ComputedCascadeResult,
  fallbackProposalId: string | null,
  historyReason: string,
  proposalIdByIngredient?: Map<string, string>
) {
  for (const rl of cascade.recipeLineUpdates) {
    await tx.recipeIngredient.update({ where: { id: rl.id }, data: { costCents: rl.costCents } });
  }
  for (const su of cascade.subRecipeUseUpdates) {
    await tx.subRecipeUse.update({ where: { id: su.id }, data: { costCents: su.costCents } });
  }
  for (const mat of cascade.materialUpdates) {
    await tx.presentationMaterial.update({
      where: { id: mat.id },
      data: { unitCostCents: mat.unitCostCents, totalCostCents: mat.totalCostCents },
    });
  }
  for (const sp of cascade.subrecipePresUpdates) {
    await tx.presentationSubrecipe.update({
      where: { id: sp.id },
      data: { costCents: sp.costCents },
    });
  }
  for (const rec of cascade.recipeUpdates) {
    const resolvedProposalId =
      (rec.triggerIngredientId && proposalIdByIngredient?.get(rec.triggerIngredientId)) ||
      fallbackProposalId;
    await tx.recipe.update({
      where: { id: rec.id },
      data: {
        subtotalBeforeContingencyCents: rec.subtotalBeforeContingencyCents,
        batchCostExactCents: rec.batchCostExactCents,
        batchCostCents: rec.batchCostCents,
        unitCostCents: rec.unitCostCents,
        costPerYieldUnit: rec.costPerYieldUnit,
        suggestedPriceCents: rec.suggestedPriceCents,
      },
    });
    await tx.recipePriceHistory.create({
      data: {
        recipeId: rec.id,
        proposalId: resolvedProposalId,
        batchCostCents: rec.batchCostCents,
        unitCostCents: rec.unitCostCents,
        priceCents: rec.suggestedPriceCents,
        margin: rec.targetMargin,
        reason: historyReason,
      },
    });
  }
  for (const pres of cascade.presentationUpdates) {
    await tx.recipePresentation.update({
      where: { id: pres.id },
      data: {
        baseCostCents: pres.baseCostCents,
        unitTotalCostExactCents: pres.unitTotalCostExactCents,
        packagingCostCents: pres.packagingCostCents,
        additionalCostCents: pres.additionalCostCents,
        totalCostCents: pres.totalCostCents,
        suggestedPriceCents: pres.suggestedPriceCents,
        finalPriceCents: pres.finalPriceCents,
        realProfitCents: pres.realProfitCents,
        realMarginPercent: pres.realMarginPercent,
      },
    });
  }
}

/**
 * Unifica la cascada cuando se edita manualmente un ingrediente desde `/api/ingredientes` (PUT).
 */
export async function recalculateFromIngredientsInTx(tx: any, ingredientIds: string[]) {
  if (ingredientIds.length === 0) return null;
  const freshIngredients = await tx.ingredient.findMany({
    where: { id: { in: ingredientIds } },
  });
  const map = new Map<string, UpdatedIngredientState>(
    freshIngredients.map((i: any) => [
      i.id,
      {
        id: i.id,
        code: i.code,
        name: i.name,
        packagePriceCents: i.packagePriceCents,
        packageQty: i.packageQty,
        packageUnit: i.packageUnit,
        baseUnit: i.baseUnit,
        factorId: i.factorId,
        conversionFactor: i.conversionFactor ?? 1,
        costPerBaseUnit: i.costPerBaseUnit,
        density: i.density,
      },
    ])
  );
  const cascade = await computeCascadeFromIngredients(tx, ingredientIds, map);
  await persistCascadeUpdatesInTx(tx, cascade, null, "ingredient_update");
  return cascade.report;
}

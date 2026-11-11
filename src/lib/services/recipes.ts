// Servicio de Recetas, Costos y Precios — K_Sweet (RF-012 a RF-018)
import { prisma } from "@/lib/prisma";
import { normalizeToBase } from "@/lib/conversions";
import { calcSuggestedPrice, calcMarginOnSale, calcMarkupOnCost } from "@/types";
import { toSlug } from "@/lib/utils";

export interface RecipeIngredientInput {
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface RecipeSubrecipeInput {
  childRecipeId: string;
  quantity: number; // Porciones o lotes usados
}

export interface CreateRecipeInput {
  name: string;
  description?: string;
  yield: number; // Rendimiento > 0
  yieldUnit?: string;
  packageCostCents?: number; // Costo de caja/empaque por lote
  laborPercent?: number; // % mano de obra sobre costo de ingredientes
  overheadPercent?: number; // % gastos indirectos
  targetMargin?: number; // Margen objetivo sobre venta (0 a 99.99%)
  currentPriceCents?: number; // Precio de venta fijado
  ingredients: RecipeIngredientInput[];
  subRecipes?: RecipeSubrecipeInput[];
  notes?: string;
}

/**
 * Valida reglas matemáticas de costeo (RF-017, RF-018)
 */
export function validateCostingParams(yieldVal: number, marginPercent: number) {
  if (yieldVal <= 0) {
    throw new Error("El rendimiento de la receta debe ser estrictamente mayor a 0.");
  }
  if (marginPercent >= 100) {
    throw new Error("El margen sobre venta debe ser estrictamente menor al 100%. Para un margen del 100% el precio tendería al infinito.");
  }
  if (marginPercent < 0) {
    throw new Error("El margen sobre venta no puede ser negativo.");
  }
}

/**
 * Calcula el costo de un ingrediente dentro de una receta
 */
export async function calculateIngredientLineCost(
  ingredientId: string,
  quantity: number,
  unit: string
): Promise<number> {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
  });
  if (!ingredient) throw new Error(`Ingrediente ${ingredientId} no encontrado`);

  // Convertir cantidad a la unidad base del ingrediente
  const norm = normalizeToBase(quantity, unit, ingredient.baseUnit, ingredient.density ?? undefined);
  if (!norm.ok) {
    throw new Error(`Conversión inválida para ${ingredient.name}: ${norm.error}`);
  }

  // Costo en centavos = cantidad_en_base * costo_por_base
  return Math.round(norm.value * ingredient.costPerBaseUnit);
}

/**
 * Crea una receta calculando costo de lote, costo unitario y precio sugerido P = C / (1 - M)
 */
export async function createRecipe(input: CreateRecipeInput) {
  validateCostingParams(input.yield, input.targetMargin ?? 40);

  // 1. Calcular costo de ingredientes
  let rawIngredientsCost = 0;
  const ingredientsData: Array<{ ingredientId: string; quantity: number; unit: string; costCents: number; notes?: string }> = [];

  for (const item of input.ingredients) {
    const costCents = await calculateIngredientLineCost(item.ingredientId, item.quantity, item.unit);
    rawIngredientsCost += costCents;
    ingredientsData.push({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unit: item.unit,
      costCents,
      notes: item.notes,
    });
  }

  // 2. Calcular costo de subrecetas (si aplica)
  let subrecipesCost = 0;
  const subrecipesData: Array<{ childId: string; quantity: number; costCents: number }> = [];

  if (input.subRecipes && input.subRecipes.length > 0) {
    for (const sub of input.subRecipes) {
      const child = await prisma.recipe.findUnique({ where: { id: sub.childRecipeId } });
      if (!child) throw new Error(`Subreceta ${sub.childRecipeId} no encontrada`);
      const costCents = Math.round(sub.quantity * child.unitCostCents);
      subrecipesCost += costCents;
      subrecipesData.push({
        childId: sub.childRecipeId,
        quantity: sub.quantity,
        costCents,
      });
    }
  }

  // 3. Empaque, mano de obra y gastos indirectos
  const packageCost = input.packageCostCents ?? 0;
  const baseCostForLabor = rawIngredientsCost + subrecipesCost;
  const laborCost = Math.round(baseCostForLabor * ((input.laborPercent ?? 0) / 100));
  const overheadCost = Math.round(baseCostForLabor * ((input.overheadPercent ?? 0) / 100));

  // Costo total de lote
  const batchCostCents = rawIngredientsCost + subrecipesCost + packageCost + laborCost + overheadCost;

  // Costo unitario
  const unitCostCents = Math.ceil(batchCostCents / input.yield);

  // Precio sugerido: P = unitCost / (1 - marginFraction) (RF-017)
  const marginFraction = (input.targetMargin ?? 40) / 100;
  const suggestedPriceCents = calcSuggestedPrice(unitCostCents, marginFraction);
  const currentPriceCents = input.currentPriceCents && input.currentPriceCents > 0
    ? input.currentPriceCents
    : suggestedPriceCents;

  const baseSlug = toSlug(input.name);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  return await prisma.recipe.create({
    data: {
      name: input.name,
      slug: uniqueSlug,
      description: input.description,
      yield: input.yield,
      yieldUnit: input.yieldUnit || "unidad",
      packageCostCents: packageCost,
      laborPercent: input.laborPercent ?? 0,
      overheadPercent: input.overheadPercent ?? 0,
      targetMargin: input.targetMargin ?? 40,
      batchCostCents,
      unitCostCents,
      suggestedPriceCents,
      currentPriceCents,
      status: "ACTIVE",
      notes: input.notes,
      ingredients: {
        create: ingredientsData,
      },
      subRecipeUses: {
        create: subrecipesData,
      },
      priceHistory: {
        create: [
          {
            batchCostCents,
            unitCostCents,
            priceCents: currentPriceCents,
            margin: calcMarginOnSale(currentPriceCents, unitCostCents),
            reason: "initial_creation",
          },
        ],
      },
    },
    include: {
      ingredients: { include: { ingredient: true } },
      subRecipeUses: { include: { child: true } },
    },
  });
}

/**
 * Duplicar receta (RF-013)
 */
export async function duplicateRecipe(recipeId: string, newName?: string) {
  const original = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: true,
      subRecipeUses: true,
    },
  });

  if (!original) throw new Error("Receta a duplicar no encontrada");

  const name = newName || `${original.name} (Copia)`;

  return await createRecipe({
    name,
    description: original.description || undefined,
    yield: original.yield,
    yieldUnit: original.yieldUnit,
    packageCostCents: original.packageCostCents,
    laborPercent: original.laborPercent,
    overheadPercent: original.overheadPercent,
    targetMargin: original.targetMargin,
    currentPriceCents: original.currentPriceCents,
    ingredients: original.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes || undefined,
    })),
    subRecipes: original.subRecipeUses.map((sub) => ({
      childRecipeId: sub.childId,
      quantity: sub.quantity,
    })),
    notes: `Duplicada a partir de ${original.name}`,
  });
}

/**
 * Recalcula recetas activas tras actualizar ingredientes (RF-014)
 * No altera ventas históricas (las ventas guardan totalCostCents congelado).
 */
export async function recalculateActiveRecipes() {
  const recipes = await prisma.recipe.findMany({
    where: { status: "ACTIVE" },
    include: {
      ingredients: true,
      subRecipeUses: true,
    },
  });

  const updatedIds: string[] = [];

  for (const recipe of recipes) {
    let rawIngredientsCost = 0;
    for (const item of recipe.ingredients) {
      const costCents = await calculateIngredientLineCost(item.ingredientId, item.quantity, item.unit);
      await prisma.recipeIngredient.update({
        where: { id: item.id },
        data: { costCents },
      });
      rawIngredientsCost += costCents;
    }

    let subrecipesCost = 0;
    for (const sub of recipe.subRecipeUses) {
      const child = await prisma.recipe.findUnique({ where: { id: sub.childId } });
      if (child) {
        const costCents = Math.round(sub.quantity * child.unitCostCents);
        await prisma.subRecipeUse.update({
          where: { id: sub.id },
          data: { costCents },
        });
        subrecipesCost += costCents;
      }
    }

    const baseCostForLabor = rawIngredientsCost + subrecipesCost;
    const laborCost = Math.round(baseCostForLabor * (recipe.laborPercent / 100));
    const overheadCost = Math.round(baseCostForLabor * (recipe.overheadPercent / 100));
    const batchCostCents = rawIngredientsCost + subrecipesCost + recipe.packageCostCents + laborCost + overheadCost;
    const unitCostCents = Math.ceil(batchCostCents / recipe.yield);

    const marginFraction = recipe.targetMargin / 100;
    const suggestedPriceCents = calcSuggestedPrice(unitCostCents, marginFraction);

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        batchCostCents,
        unitCostCents,
        suggestedPriceCents,
      },
    });

    updatedIds.push(recipe.id);
  }

  return { recalculatedCount: updatedIds.length, updatedIds };
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateMotherRecipeCosts, recalculateRecipeAndPresentations } from "@/lib/services/presentations";
import { handleApiError } from "@/lib/api-errors";

const recipeIngredientSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).default("g"),
  costCents: z.coerce.number().int().min(0).optional(),
});

const createRecipeSchema = z.object({
  name: z.string().trim().min(1),
  recipeType: z.enum(["MOTHER", "SUBRECIPE"]).default("MOTHER"),
  description: z.string().optional().nullable(),
  yieldQty: z.coerce.number().positive().default(1),
  yieldUnit: z.string().trim().min(1).default("porciones"),
  laborPercent: z.coerce.number().min(0).default(0),
  overheadPercent: z.coerce.number().min(0).default(0),
  contingencyPercent: z.coerce.number().min(0).default(0),
  packageCostCents: z.coerce.number().int().min(0).default(0),
  targetMargin: z.coerce.number().min(0).lt(100).default(40),
  currentPriceCents: z.coerce.number().int().min(0).optional(),
  commercialRefCents: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).default([]),
});

const updateRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  recipeType: z.enum(["MOTHER", "SUBRECIPE"]).optional(),
  yieldQty: z.coerce.number().positive().optional(),
  yieldUnit: z.string().trim().min(1).optional(),
  laborPercent: z.coerce.number().min(0).optional(),
  overheadPercent: z.coerce.number().min(0).optional(),
  contingencyPercent: z.coerce.number().min(0).optional(),
  packageCostCents: z.coerce.number().int().min(0).optional(),
  targetMargin: z.coerce.number().min(0).lt(100).optional(),
  currentPriceCents: z.coerce.number().int().min(0).optional(),
  commercialRefCents: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).optional(),
});

// GET /api/recetas — Listar Recetas Madre y Subrecetas (excluye ARCHIVED por defecto)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // MOTHER | SUBRECIPE | ALL
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = {};
    if (type && type !== "ALL") where.recipeType = type;
    if (!includeArchived) where.status = { not: "ARCHIVED" };

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        ingredients: {
          include: { ingredient: true },
        },
        presentations: {
          where: { isActive: true },
          include: {
            materials: true,
            subrecipes: true,
            parent: { select: { id: true, name: true, unitTotalCostExactCents: true, totalCostCents: true } },
            groupPresentations: { where: { isActive: true }, select: { id: true, name: true, groupQty: true, totalCostCents: true, finalPriceCents: true } },
          },
          orderBy: [{ isComposite: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: recipes });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/recetas — Crear Receta Madre o Subreceta
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos de receta. Verifica nombre, rendimiento (>0) y porcentajes." },
        { status: 400 }
      );
    }

    const {
      name,
      recipeType,
      description,
      yieldQty,
      yieldUnit,
      laborPercent,
      overheadPercent,
      contingencyPercent,
      packageCostCents,
      targetMargin,
      currentPriceCents,
      commercialRefCents,
      notes,
      ingredients,
    } = parsed.data;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();

    let ingredientsCostCents = 0;
    const formattedIngredients = ingredients.map((ing) => {
      const lineCost = ing.costCents ?? 0;
      ingredientsCostCents += lineCost;
      return {
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        unit: ing.unit,
        costCents: lineCost,
      };
    });

    const costs = calculateMotherRecipeCosts({
      ingredientsCostCents,
      laborPercent,
      overheadPercent,
      contingencyPercent,
      packageCostCents,
      yieldQty,
    });

    const marginFraction = targetMargin / 100;
    const suggestedPriceCents =
      marginFraction < 1 ? Math.ceil(costs.unitCostCents / (1 - marginFraction)) : costs.unitCostCents;

    const created = await prisma.recipe.create({
      data: {
        name,
        slug,
        recipeType,
        description: description || null,
        yield: yieldQty,
        yieldUnit,
        laborPercent,
        overheadPercent,
        contingencyPercent,
        subtotalBeforeContingencyCents: costs.subtotalBeforeContingencyCents,
        batchCostExactCents: costs.batchCostExactCents,
        packageCostCents,
        commercialRefCents: commercialRefCents ?? null,
        targetMargin,
        batchCostCents: costs.batchCostCents,
        unitCostCents: costs.unitCostCents,
        costPerYieldUnit: costs.costPerYieldUnit,
        suggestedPriceCents,
        currentPriceCents: currentPriceCents ?? suggestedPriceCents,
        status: "ACTIVE",
        notes: notes || null,
        ingredients: {
          create: formattedIngredients,
        },
      },
      include: {
        ingredients: { include: { ingredient: true } },
        presentations: true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// PUT /api/recetas — Actualizar receta madre y recalcular en cascada topológica
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateRecipeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al actualizar receta madre." },
        { status: 400 }
      );
    }

    const {
      id,
      name,
      description,
      recipeType,
      yieldQty,
      yieldUnit,
      laborPercent,
      overheadPercent,
      contingencyPercent,
      packageCostCents,
      targetMargin,
      currentPriceCents,
      commercialRefCents,
      notes,
      ingredients,
    } = parsed.data;

    await prisma.$transaction(async (tx: any) => {
      if (Array.isArray(ingredients)) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing) => ({
              recipeId: id,
              ingredientId: ing.ingredientId,
              quantity: ing.quantity,
              unit: ing.unit,
              costCents: ing.costCents ?? 0,
            })),
          });
        }
      }

      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (recipeType !== undefined) updateData.recipeType = recipeType;
      if (yieldQty !== undefined) updateData.yield = yieldQty;
      if (yieldUnit !== undefined) updateData.yieldUnit = yieldUnit;
      if (laborPercent !== undefined) updateData.laborPercent = laborPercent;
      if (overheadPercent !== undefined) updateData.overheadPercent = overheadPercent;
      if (contingencyPercent !== undefined) updateData.contingencyPercent = contingencyPercent;
      if (packageCostCents !== undefined) updateData.packageCostCents = packageCostCents;
      if (targetMargin !== undefined) updateData.targetMargin = targetMargin;
      if (currentPriceCents !== undefined) updateData.currentPriceCents = currentPriceCents;
      if (commercialRefCents !== undefined) updateData.commercialRefCents = commercialRefCents;
      if (notes !== undefined) updateData.notes = notes;

      await tx.recipe.update({
        where: { id },
        data: updateData,
      });
    });

    const result = await recalculateRecipeAndPresentations(id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// DELETE /api/recetas — Desactivación / Archivo
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const archived = await prisma.recipe.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ success: true, data: archived });
  } catch (error: any) {
    return handleApiError(error);
  }
}

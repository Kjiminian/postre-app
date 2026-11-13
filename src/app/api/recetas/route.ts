import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMotherRecipeCosts, recalculateRecipeAndPresentations } from "@/lib/services/presentations";

// GET /api/recetas — Listar Recetas Madre y Subrecetas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // MOTHER | SUBRECIPE | ALL

    const where: any = {};
    if (type && type !== "ALL") where.recipeType = type;

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
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: recipes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/recetas — Crear Receta Madre o Subreceta
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      recipeType = "MOTHER",
      description,
      yieldQty = 1,
      yieldUnit = "porciones",
      laborPercent = 0,
      overheadPercent = 0,
      packageCostCents = 0,
      targetMargin = 40,
      currentPriceCents = 0,
      notes,
      ingredients = [], // Array de { ingredientId, quantity, unit, costCents }
    } = body;

    if (!name || yieldQty <= 0) {
      return NextResponse.json({ success: false, error: "Nombre y rendimiento (>0) son requeridos" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();

    // Sumar ingredientes
    let ingredientsCostCents = 0;
    const formattedIngredients = ingredients.map((ing: any) => {
      ingredientsCostCents += ing.costCents || 0;
      return {
        ingredientId: ing.ingredientId,
        quantity: parseFloat(ing.quantity) || 0,
        unit: ing.unit || "g",
        costCents: parseInt(ing.costCents) || 0,
      };
    });

    const costs = calculateMotherRecipeCosts({
      ingredientsCostCents,
      laborPercent: parseFloat(laborPercent) || 0,
      overheadPercent: parseFloat(overheadPercent) || 0,
      packageCostCents: parseInt(packageCostCents) || 0,
      yieldQty: parseFloat(yieldQty) || 1,
    });

    const marginFraction = (parseFloat(targetMargin) || 40) / 100;
    const suggestedPriceCents =
      marginFraction < 1 ? Math.ceil(costs.unitCostCents / (1 - marginFraction)) : costs.unitCostCents;

    const created = await prisma.recipe.create({
      data: {
        name,
        slug,
        recipeType,
        description: description || null,
        yield: parseFloat(yieldQty) || 1,
        yieldUnit,
        laborPercent: parseFloat(laborPercent) || 0,
        overheadPercent: parseFloat(overheadPercent) || 0,
        packageCostCents: parseInt(packageCostCents) || 0,
        targetMargin: parseFloat(targetMargin) || 40,
        batchCostCents: costs.batchCostCents,
        unitCostCents: costs.unitCostCents,
        costPerYieldUnit: costs.costPerYieldUnit,
        suggestedPriceCents,
        currentPriceCents: currentPriceCents ? parseInt(currentPriceCents) : suggestedPriceCents,
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/recetas — Actualizar receta y recalcular en cascada
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, recipeType, yieldQty, yieldUnit, laborPercent, overheadPercent, packageCostCents, targetMargin, currentPriceCents, notes, ingredients } = body;

    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    await prisma.$transaction(async (tx: any) => {
      // Si se envían nuevos ingredientes, reemplazar
      if (Array.isArray(ingredients)) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await tx.recipeIngredient.createMany({
          data: ingredients.map((ing: any) => ({
            recipeId: id,
            ingredientId: ing.ingredientId,
            quantity: parseFloat(ing.quantity) || 0,
            unit: ing.unit || "g",
            costCents: parseInt(ing.costCents) || 0,
          })),
        });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (recipeType !== undefined) updateData.recipeType = recipeType;
      if (yieldQty !== undefined) updateData.yield = parseFloat(yieldQty);
      if (yieldUnit !== undefined) updateData.yieldUnit = yieldUnit;
      if (laborPercent !== undefined) updateData.laborPercent = parseFloat(laborPercent);
      if (overheadPercent !== undefined) updateData.overheadPercent = parseFloat(overheadPercent);
      if (packageCostCents !== undefined) updateData.packageCostCents = parseInt(packageCostCents);
      if (targetMargin !== undefined) updateData.targetMargin = parseFloat(targetMargin);
      if (currentPriceCents !== undefined) updateData.currentPriceCents = parseInt(currentPriceCents);
      if (notes !== undefined) updateData.notes = notes;

      await tx.recipe.update({
        where: { id },
        data: updateData,
      });
    });

    // Ejecutar recálculo en cascada reactiva para recetas madre y presentaciones
    const result = await recalculateRecipeAndPresentations(id);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePresentationValues } from "@/lib/services/presentations";
import { PricingMethod } from "@/types";

// GET /api/presentaciones — Listar presentaciones (opcional filtro por recipeId)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get("recipeId");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (recipeId) where.recipeId = recipeId;

    const presentations = await prisma.recipePresentation.findMany({
      where,
      include: {
        recipe: true,
        materials: true,
        subrecipes: true,
      },
      orderBy: [{ recipe: { name: "asc" } }, { name: "asc" }],
    });

    const dtos = presentations.map((p: any) => ({
      id: p.id,
      recipeId: p.recipeId,
      recipeName: p.recipe.name,
      recipeYieldUnit: p.recipe.yieldUnit,
      name: p.name,
      sizeDescription: p.sizeDescription,
      motherRecipeQty: p.motherRecipeQty,
      motherRecipeUnit: p.motherRecipeUnit,
      presentationYield: p.presentationYield,
      packagingCostCents: p.packagingCostCents,
      additionalCostCents: p.additionalCostCents,
      totalCostCents: p.totalCostCents,
      pricingMethod: p.pricingMethod,
      desiredMarginPercent: p.desiredMarginPercent,
      suggestedPriceCents: p.suggestedPriceCents,
      finalPriceCents: p.finalPriceCents,
      realProfitCents: p.realProfitCents,
      realMarginPercent: p.realMarginPercent,
      isActive: p.isActive,
      isComposite: p.isComposite,
      notes: p.notes,
      materials: p.materials,
      subrecipes: p.subrecipes,
    }));

    return NextResponse.json({ success: true, data: dtos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/presentaciones — Crear nueva presentación
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      recipeId,
      name,
      sizeDescription,
      motherRecipeQty,
      motherRecipeUnit = "unidad",
      pricingMethod = "MARGIN",
      desiredMarginPercent = 40,
      finalPriceCents,
      isComposite = false,
      notes,
      materials = [], // Array de { name, quantity, unit, unitCostCents, totalCostCents }
      subrecipes = [], // Array de { name, quantity, unit, costCents }
    } = body;

    if (!recipeId || !name || motherRecipeQty <= 0) {
      return NextResponse.json(
        { success: false, error: "Receta Madre, nombre y cantidad consumida (>0) son requeridos" },
        { status: 400 }
      );
    }

    // 1. Obtener receta madre para costo base y rendimiento
    const mother = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!mother) return NextResponse.json({ success: false, error: "Receta madre no existe" }, { status: 404 });

    // 2. Sumar empaques y complementos
    let packagingCostCents = 0;
    const formattedMaterials = materials.map((m: any) => {
      const lineCost = parseInt(m.totalCostCents) || Math.round((parseFloat(m.quantity) || 0) * (parseInt(m.unitCostCents) || 0));
      packagingCostCents += lineCost;
      return {
        ingredientId: m.ingredientId || null,
        name: m.name,
        quantity: parseFloat(m.quantity) || 1,
        unit: m.unit || "unidad",
        unitCostCents: parseInt(m.unitCostCents) || lineCost,
        totalCostCents: lineCost,
      };
    });

    let additionalCostCents = 0;
    const formattedSubrecipes = subrecipes.map((s: any) => {
      const lineCost = parseInt(s.costCents) || 0;
      additionalCostCents += lineCost;
      return {
        subRecipeId: s.subRecipeId || null,
        name: s.name,
        quantity: parseFloat(s.quantity) || 1,
        unit: s.unit || "porciones",
        costCents: lineCost,
      };
    });

    // 3. Calcular valores financieros
    const values = calculatePresentationValues({
      motherBatchYield: mother.yield,
      motherCostPerYieldUnit: mother.costPerYieldUnit,
      motherRecipeQty: parseFloat(motherRecipeQty),
      packagingCostCents,
      additionalCostCents,
      pricingMethod: pricingMethod as PricingMethod,
      desiredMarginPercent: parseFloat(desiredMarginPercent) || 40,
      currentFinalPriceCents: finalPriceCents ? parseInt(finalPriceCents) : undefined,
    });

    // 4. Guardar en BD
    const created = await prisma.recipePresentation.create({
      data: {
        recipeId,
        name,
        sizeDescription: sizeDescription || null,
        motherRecipeQty: parseFloat(motherRecipeQty),
        motherRecipeUnit,
        presentationYield: values.presentationYield,
        packagingCostCents,
        additionalCostCents,
        totalCostCents: values.totalCostCents,
        pricingMethod,
        desiredMarginPercent: parseFloat(desiredMarginPercent) || 40,
        suggestedPriceCents: values.suggestedPriceCents,
        finalPriceCents: values.finalPriceCents,
        realProfitCents: values.realProfitCents,
        realMarginPercent: values.realMarginPercent,
        isActive: true,
        isComposite: Boolean(isComposite),
        notes: notes || null,
        materials: { create: formattedMaterials },
        subrecipes: { create: formattedSubrecipes },
      },
      include: {
        recipe: true,
        materials: true,
        subrecipes: true,
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/presentaciones — Actualizar presentación
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      sizeDescription,
      motherRecipeQty,
      motherRecipeUnit,
      pricingMethod,
      desiredMarginPercent,
      finalPriceCents,
      isActive,
      notes,
      materials,
      subrecipes,
    } = body;

    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const current = await prisma.recipePresentation.findUnique({
      where: { id },
      include: { recipe: true, materials: true, subrecipes: true },
    });
    if (!current) return NextResponse.json({ success: false, error: "Presentación no encontrada" }, { status: 404 });

    await prisma.$transaction(async (tx: any) => {
      // Reemplazar materiales si se enviaron
      if (Array.isArray(materials)) {
        await tx.presentationMaterial.deleteMany({ where: { presentationId: id } });
        await tx.presentationMaterial.createMany({
          data: materials.map((m: any) => ({
            presentationId: id,
            ingredientId: m.ingredientId || null,
            name: m.name,
            quantity: parseFloat(m.quantity) || 1,
            unit: m.unit || "unidad",
            unitCostCents: parseInt(m.unitCostCents) || 0,
            totalCostCents: parseInt(m.totalCostCents) || 0,
          })),
        });
      }

      // Reemplazar subrecetas si se enviaron
      if (Array.isArray(subrecipes)) {
        await tx.presentationSubrecipe.deleteMany({ where: { presentationId: id } });
        await tx.presentationSubrecipe.createMany({
          data: subrecipes.map((s: any) => ({
            presentationId: id,
            subRecipeId: s.subRecipeId || null,
            name: s.name,
            quantity: parseFloat(s.quantity) || 1,
            unit: s.unit || "porciones",
            costCents: parseInt(s.costCents) || 0,
          })),
        });
      }
    });

    // Reconsultar con nuevos hijos para recalcular
    const refreshed = await prisma.recipePresentation.findUnique({
      where: { id },
      include: { recipe: true, materials: true, subrecipes: true },
    });

    const packagingCostCents = refreshed!.materials.reduce((sum: number, m: any) => sum + m.totalCostCents, 0);
    const additionalCostCents = refreshed!.subrecipes.reduce((sum: number, s: any) => sum + s.costCents, 0);

    const values = calculatePresentationValues({
      motherBatchYield: refreshed!.recipe.yield,
      motherCostPerYieldUnit: refreshed!.recipe.costPerYieldUnit,
      motherRecipeQty: motherRecipeQty !== undefined ? parseFloat(motherRecipeQty) : refreshed!.motherRecipeQty,
      packagingCostCents,
      additionalCostCents,
      pricingMethod: (pricingMethod || refreshed!.pricingMethod) as PricingMethod,
      desiredMarginPercent: desiredMarginPercent !== undefined ? parseFloat(desiredMarginPercent) : refreshed!.desiredMarginPercent,
      currentFinalPriceCents: finalPriceCents !== undefined ? parseInt(finalPriceCents) : refreshed!.finalPriceCents,
    });

    const updated = await prisma.recipePresentation.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sizeDescription !== undefined && { sizeDescription }),
        ...(motherRecipeQty !== undefined && { motherRecipeQty: parseFloat(motherRecipeQty) }),
        ...(motherRecipeUnit && { motherRecipeUnit }),
        ...(pricingMethod && { pricingMethod }),
        ...(desiredMarginPercent !== undefined && { desiredMarginPercent: parseFloat(desiredMarginPercent) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(notes !== undefined && { notes }),
        packagingCostCents,
        additionalCostCents,
        totalCostCents: values.totalCostCents,
        presentationYield: values.presentationYield,
        suggestedPriceCents: values.suggestedPriceCents,
        finalPriceCents: values.finalPriceCents,
        realProfitCents: values.realProfitCents,
        realMarginPercent: values.realMarginPercent,
      },
      include: { recipe: true, materials: true, subrecipes: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/presentaciones — Desactivación lógica
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const deactivated = await prisma.recipePresentation.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

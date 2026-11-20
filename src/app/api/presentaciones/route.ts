import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  calculateVariantValues,
  calculateGroupPresentationValues,
  recalculateVariantAndGroups,
} from "@/lib/services/presentations";
import { PricingMethod } from "@/types";
import { handleApiError } from "@/lib/api-errors";

const materialSchema = z.object({
  ingredientId: z.string().optional().nullable(),
  materialType: z.enum(["PACKAGING", "DECORATION"]).default("PACKAGING"),
  name: z.string().trim().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().trim().min(1).default("unidad"),
  unitCostCents: z.coerce.number().int().min(0).default(0),
  totalCostCents: z.coerce.number().int().min(0).optional(),
});

const subrecipeSchema = z.object({
  subRecipeId: z.string().optional().nullable(),
  name: z.string().trim().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().trim().min(1).default("porciones"),
  costCents: z.coerce.number().int().min(0).default(0),
});

const createPresentationSchema = z.object({
  recipeId: z.string().min(1),
  name: z.string().trim().min(1),
  sizeDescription: z.string().optional().nullable(),
  consumptionMode: z.enum(["YIELD_PER_BATCH", "BATCH_FRACTION"]).default("YIELD_PER_BATCH"),
  presentationYield: z.coerce.number().positive().optional(),
  batchFraction: z.coerce.number().positive().optional(),
  motherRecipeQty: z.coerce.number().positive().optional(),
  motherRecipeUnit: z.string().trim().min(1).default("unidad"),
  parentId: z.string().optional().nullable(),
  groupQty: z.coerce.number().positive().default(1),
  isComposite: z.boolean().default(false),
  pricingMethod: z.enum(["MARGIN", "MARKUP"]).default("MARGIN"),
  desiredMarginPercent: z.coerce.number().min(0).default(40),
  finalPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  materials: z.array(materialSchema).default([]),
  subrecipes: z.array(subrecipeSchema).default([]),
});

const updatePresentationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  sizeDescription: z.string().optional().nullable(),
  consumptionMode: z.enum(["YIELD_PER_BATCH", "BATCH_FRACTION"]).optional(),
  presentationYield: z.coerce.number().positive().optional(),
  batchFraction: z.coerce.number().positive().optional(),
  motherRecipeQty: z.coerce.number().positive().optional(),
  motherRecipeUnit: z.string().trim().min(1).optional(),
  parentId: z.string().optional().nullable(),
  groupQty: z.coerce.number().positive().optional(),
  isComposite: z.boolean().optional(),
  pricingMethod: z.enum(["MARGIN", "MARKUP"]).optional(),
  desiredMarginPercent: z.coerce.number().min(0).optional(),
  finalPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  materials: z.array(materialSchema).optional(),
  subrecipes: z.array(subrecipeSchema).optional(),
});

// GET /api/presentaciones — Listar variantes y presentaciones agrupadas
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
        parent: { select: { id: true, name: true, unitTotalCostExactCents: true, totalCostCents: true } },
        groupPresentations: {
          where: { isActive: true },
          select: { id: true, name: true, groupQty: true, totalCostCents: true, finalPriceCents: true },
        },
      },
      orderBy: [{ recipe: { name: "asc" } }, { isComposite: "asc" }, { name: "asc" }],
    });

    const dtos = presentations.map((p: any) => ({
      id: p.id,
      recipeId: p.recipeId,
      recipeName: p.recipe.name,
      recipeYieldUnit: p.recipe.yieldUnit,
      recipeBatchCostCents: p.recipe.batchCostCents,
      name: p.name,
      sizeDescription: p.sizeDescription,
      consumptionMode: p.consumptionMode,
      batchFraction: p.batchFraction,
      motherRecipeQty: p.motherRecipeQty,
      motherRecipeUnit: p.motherRecipeUnit,
      presentationYield: p.presentationYield,
      baseCostCents: p.baseCostCents,
      unitTotalCostExactCents: p.unitTotalCostExactCents,
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
      parentId: p.parentId,
      parentName: p.parent?.name || null,
      groupQty: p.groupQty,
      groupPresentations: p.groupPresentations || [],
      notes: p.notes,
      materials: p.materials,
      subrecipes: p.subrecipes,
    }));

    return NextResponse.json({ success: true, data: dtos });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/presentaciones — Crear nueva variante o presentación agrupada (nunca modifica la Receta Madre)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPresentationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos de variante o presentación. Verifica nombre, rendimiento y porcentajes." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.pricingMethod === "MARGIN" && data.desiredMarginPercent >= 100) {
      return NextResponse.json(
        { success: false, error: "El margen sobre venta debe ser menor al 100%." },
        { status: 400 }
      );
    }

    const mother = await prisma.recipe.findUnique({ where: { id: data.recipeId } });
    if (!mother) {
      return NextResponse.json({ success: false, error: "Receta madre no existe." }, { status: 404 });
    }

    let packagingCostCents = 0;
    const formattedMaterials = data.materials.map((m) => {
      const lineCost = m.totalCostCents ?? Math.round(m.quantity * m.unitCostCents);
      packagingCostCents += lineCost;
      return {
        ingredientId: m.ingredientId || null,
        materialType: m.materialType,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        unitCostCents: m.unitCostCents || lineCost,
        totalCostCents: lineCost,
      };
    });

    let additionalCostCents = 0;
    const formattedSubrecipes = data.subrecipes.map((s) => {
      additionalCostCents += s.costCents;
      return {
        subRecipeId: s.subRecipeId || null,
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        costCents: s.costCents,
      };
    });

    // Determinar si es Presentación Agrupada vinculada a una variante padre
    if (data.parentId) {
      const parentVariant = await prisma.recipePresentation.findUnique({ where: { id: data.parentId } });
      if (!parentVariant || parentVariant.recipeId !== data.recipeId) {
        return NextResponse.json(
          { success: false, error: "La variante origen seleccionada no pertenece a esta receta madre." },
          { status: 400 }
        );
      }

      const parentExact =
        parentVariant.unitTotalCostExactCents > 0
          ? parentVariant.unitTotalCostExactCents
          : parentVariant.totalCostCents;

      const vals = calculateGroupPresentationValues({
        variantUnitTotalCostExactCents: parentExact,
        groupQty: data.groupQty,
        groupPackagingCostCents: packagingCostCents,
        groupAdditionalCostCents: additionalCostCents,
        pricingMethod: data.pricingMethod as PricingMethod,
        desiredMarginPercent: data.desiredMarginPercent,
        currentFinalPriceCents: data.finalPriceCents ?? undefined,
      });

      const created = await prisma.recipePresentation.create({
        data: {
          recipeId: data.recipeId,
          parentId: data.parentId,
          isComposite: true,
          groupQty: vals.groupQty,
          name: data.name,
          sizeDescription: data.sizeDescription || `Pack × ${vals.groupQty}`,
          consumptionMode: parentVariant.consumptionMode,
          batchFraction: parentVariant.batchFraction * vals.groupQty,
          motherRecipeQty: parentVariant.motherRecipeQty * vals.groupQty,
          motherRecipeUnit: parentVariant.motherRecipeUnit,
          presentationYield: parentVariant.presentationYield / vals.groupQty,
          baseCostCents: vals.baseCostCents,
          unitTotalCostExactCents: vals.unitTotalCostExactCents,
          packagingCostCents,
          additionalCostCents,
          totalCostCents: vals.totalCostCents,
          pricingMethod: data.pricingMethod,
          desiredMarginPercent: data.desiredMarginPercent,
          suggestedPriceCents: vals.suggestedPriceCents,
          finalPriceCents: vals.finalPriceCents,
          realProfitCents: vals.realProfitCents,
          realMarginPercent: vals.realMarginPercent,
          isActive: true,
          notes: data.notes || null,
          materials: { create: formattedMaterials },
          subrecipes: { create: formattedSubrecipes },
        },
        include: { recipe: true, materials: true, subrecipes: true, parent: true },
      });

      return NextResponse.json({ success: true, data: created });
    }

    // Variante Individual vinculada a la Receta Madre
    const motherExactCost =
      mother.batchCostExactCents && mother.batchCostExactCents > 0
        ? mother.batchCostExactCents
        : mother.batchCostCents;

    const fallbackFraction =
      data.consumptionMode === "BATCH_FRACTION"
        ? data.batchFraction ?? (data.motherRecipeQty && mother.yield > 0 ? data.motherRecipeQty / mother.yield : 1)
        : undefined;

    const fallbackYield =
      data.consumptionMode === "YIELD_PER_BATCH"
        ? data.presentationYield ?? (data.motherRecipeQty && mother.yield > 0 ? mother.yield / data.motherRecipeQty : 1)
        : undefined;

    const vals = calculateVariantValues({
      motherBatchYield: mother.yield,
      motherBatchCostExactCents: motherExactCost,
      consumptionMode: data.consumptionMode,
      presentationYield: fallbackYield,
      batchFraction: fallbackFraction,
      packagingCostCents,
      additionalCostCents,
      pricingMethod: data.pricingMethod as PricingMethod,
      desiredMarginPercent: data.desiredMarginPercent,
      currentFinalPriceCents: data.finalPriceCents ?? undefined,
    });

    const created = await prisma.recipePresentation.create({
      data: {
        recipeId: data.recipeId,
        name: data.name,
        sizeDescription: data.sizeDescription || null,
        consumptionMode: vals.consumptionMode,
        batchFraction: vals.batchFraction,
        motherRecipeQty: vals.motherRecipeQty,
        motherRecipeUnit: data.motherRecipeUnit,
        presentationYield: vals.presentationYield,
        baseCostCents: vals.baseCostCents,
        unitTotalCostExactCents: vals.unitTotalCostExactCents,
        packagingCostCents,
        additionalCostCents,
        totalCostCents: vals.totalCostCents,
        pricingMethod: data.pricingMethod,
        desiredMarginPercent: data.desiredMarginPercent,
        suggestedPriceCents: vals.suggestedPriceCents,
        finalPriceCents: vals.finalPriceCents,
        realProfitCents: vals.realProfitCents,
        realMarginPercent: vals.realMarginPercent,
        isActive: true,
        isComposite: Boolean(data.isComposite),
        notes: data.notes || null,
        materials: { create: formattedMaterials },
        subrecipes: { create: formattedSubrecipes },
      },
      include: { recipe: true, materials: true, subrecipes: true },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// PUT /api/presentaciones — Actualizar variante o presentación agrupada (y propagar a grupos hijos)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = updatePresentationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al actualizar presentación." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const current = await prisma.recipePresentation.findUnique({
      where: { id: data.id },
      include: { recipe: true, materials: true, subrecipes: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, error: "Presentación no encontrada." }, { status: 404 });
    }

    const effectiveMethod = (data.pricingMethod ?? current.pricingMethod) as PricingMethod;
    const effectiveMargin = data.desiredMarginPercent ?? current.desiredMarginPercent;
    if (effectiveMethod === "MARGIN" && effectiveMargin >= 100) {
      return NextResponse.json(
        { success: false, error: "El margen sobre venta debe ser menor al 100%." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx: any) => {
      if (Array.isArray(data.materials)) {
        await tx.presentationMaterial.deleteMany({ where: { presentationId: data.id } });
        if (data.materials.length > 0) {
          await tx.presentationMaterial.createMany({
            data: data.materials.map((m) => {
              const lineCost = m.totalCostCents ?? Math.round(m.quantity * m.unitCostCents);
              return {
                presentationId: data.id,
                ingredientId: m.ingredientId || null,
                materialType: m.materialType,
                name: m.name,
                quantity: m.quantity,
                unit: m.unit,
                unitCostCents: m.unitCostCents || lineCost,
                totalCostCents: lineCost,
              };
            }),
          });
        }
      }

      if (Array.isArray(data.subrecipes)) {
        await tx.presentationSubrecipe.deleteMany({ where: { presentationId: data.id } });
        if (data.subrecipes.length > 0) {
          await tx.presentationSubrecipe.createMany({
            data: data.subrecipes.map((s) => ({
              presentationId: data.id,
              subRecipeId: s.subRecipeId || null,
              name: s.name,
              quantity: s.quantity,
              unit: s.unit,
              costCents: s.costCents,
            })),
          });
        }
      }

      const patch: Record<string, any> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.sizeDescription !== undefined) patch.sizeDescription = data.sizeDescription;
      if (data.consumptionMode !== undefined) patch.consumptionMode = data.consumptionMode;
      if (data.presentationYield !== undefined) patch.presentationYield = data.presentationYield;
      if (data.batchFraction !== undefined) patch.batchFraction = data.batchFraction;
      if (data.motherRecipeQty !== undefined) patch.motherRecipeQty = data.motherRecipeQty;
      if (data.motherRecipeUnit !== undefined) patch.motherRecipeUnit = data.motherRecipeUnit;
      if (data.groupQty !== undefined) patch.groupQty = data.groupQty;
      if (data.pricingMethod !== undefined) patch.pricingMethod = data.pricingMethod;
      if (data.desiredMarginPercent !== undefined) patch.desiredMarginPercent = data.desiredMarginPercent;
      if (data.finalPriceCents !== undefined && data.finalPriceCents !== null) {
        patch.finalPriceCents = data.finalPriceCents;
      }
      if (data.isActive !== undefined) patch.isActive = data.isActive;
      if (data.notes !== undefined) patch.notes = data.notes;

      await tx.recipePresentation.update({
        where: { id: data.id },
        data: patch,
      });
    });

    // Si es presentación agrupada hija, recalcular solo ella contra su variante padre
    if (current.parentId) {
      const grp = await prisma.recipePresentation.findUnique({
        where: { id: data.id },
        include: { parent: true, materials: true, subrecipes: true, recipe: true },
      });
      if (grp?.parent) {
        const pkg = grp.materials.reduce((s: number, m: any) => s + m.totalCostCents, 0);
        const add = grp.subrecipes.reduce((s: number, sub: any) => s + sub.costCents, 0);
        const parentExact =
          grp.parent.unitTotalCostExactCents > 0 ? grp.parent.unitTotalCostExactCents : grp.parent.totalCostCents;

        const gVals = calculateGroupPresentationValues({
          variantUnitTotalCostExactCents: parentExact,
          groupQty: grp.groupQty || 1,
          groupPackagingCostCents: pkg,
          groupAdditionalCostCents: add,
          pricingMethod: grp.pricingMethod as PricingMethod,
          desiredMarginPercent: grp.desiredMarginPercent,
          currentFinalPriceCents: grp.finalPriceCents,
        });

        const updatedGrp = await prisma.recipePresentation.update({
          where: { id: grp.id },
          data: {
            baseCostCents: gVals.baseCostCents,
            unitTotalCostExactCents: gVals.unitTotalCostExactCents,
            packagingCostCents: pkg,
            additionalCostCents: add,
            totalCostCents: gVals.totalCostCents,
            suggestedPriceCents: gVals.suggestedPriceCents,
            finalPriceCents: gVals.finalPriceCents,
            realProfitCents: gVals.realProfitCents,
            realMarginPercent: gVals.realMarginPercent,
          },
          include: { recipe: true, materials: true, subrecipes: true, parent: true },
        });
        return NextResponse.json({ success: true, data: updatedGrp });
      }
    }

    // Si es variante raíz, recalcular ella y propagar a todas sus presentaciones agrupadas hijas
    const cascaded = await recalculateVariantAndGroups(data.id);
    const full = await prisma.recipePresentation.findUnique({
      where: { id: cascaded.variant.id },
      include: { recipe: true, materials: true, subrecipes: true, groupPresentations: true },
    });

    return NextResponse.json({ success: true, data: full, cascadedGroups: cascaded.groupPresentations });
  } catch (error: any) {
    return handleApiError(error);
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
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { calculateIngredientBaseCost } from "@/lib/ingredient-cost";
import { handleApiError } from "@/lib/api-errors";

function mapIngredientDto(i: any) {
  return {
    id: i.id,
    code: i.code ?? null,
    name: i.name,
    category: i.category,
    supplierId: i.supplierId,
    supplierName: i.supplier ? i.supplier.name : null,
    packagePriceCents: i.packagePriceCents,
    packageQty: i.packageQty,
    packageUnit: i.packageUnit,
    baseUnit: i.baseUnit,
    factorId: i.factorId ?? null,
    factorName: i.factorRef ? i.factorRef.name : null,
    conversionFactor: i.conversionFactor ?? 1,
    costPerBaseUnit: i.costPerBaseUnit,
    density: i.density,
    reviewFlag: i.reviewFlag,
    isActive: i.isActive,
    notes: i.notes,
    importedFrom: i.importedFrom,
  };
}

// GET /api/ingredientes — Lista insumos, empaques y decoraciones
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (category && category !== "ALL") where.category = category;

    const items = await prisma.ingredient.findMany({
      where,
      include: { supplier: true, factorRef: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: items.map(mapIngredientDto) });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/ingredientes — Crear nuevo producto / ingrediente / empaque
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "INGREDIENT";
    const supplierId = body?.supplierId || null;
    const packagePriceCents = Number(body?.packagePriceCents);
    const packageQty = Number(body?.packageQty);
    const baseUnit = typeof body?.baseUnit === "string" && body.baseUnit.trim() ? body.baseUnit.trim() : "unidad";
    const packageUnit =
      typeof body?.packageUnit === "string" && body.packageUnit.trim() ? body.packageUnit.trim() : baseUnit;
    const factorId = body?.factorId ? String(body.factorId) : null;
    const density = body?.density !== undefined && body?.density !== null && body?.density !== "" ? Number(body.density) : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

    if (!name || !Number.isFinite(packagePriceCents) || packagePriceCents <= 0 || !Number.isFinite(packageQty) || packageQty <= 0) {
      return NextResponse.json(
        { success: false, error: "Nombre, precio y cantidad de empaque son requeridos y deben ser mayores a 0." },
        { status: 400 }
      );
    }

    let resolvedFactor = body?.conversionFactor !== undefined && body?.conversionFactor !== null && body?.conversionFactor !== ""
      ? Number(body.conversionFactor)
      : 1;
    let hasExplicitFactor = body?.conversionFactor !== undefined && Number(body.conversionFactor) !== 1;

    if (factorId) {
      const ref = await prisma.unitConversionRef.findUnique({ where: { id: factorId } });
      if (!ref) {
        return NextResponse.json({ success: false, error: "El factor seleccionado no existe." }, { status: 400 });
      }
      if (body?.conversionFactor === undefined || body?.conversionFactor === null || body?.conversionFactor === "") {
        resolvedFactor = ref.factor;
      }
      hasExplicitFactor = true;
    }

    const costResult = calculateIngredientBaseCost({
      packagePriceCents,
      packageQty,
      packageUnit,
      baseUnit,
      conversionFactor: resolvedFactor,
      hasExplicitFactor,
      density,
    });

    if (!costResult.ok) {
      return NextResponse.json({ success: false, error: costResult.error }, { status: 400 });
    }

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.ingredient.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.PRODUCT,
      (code) =>
        prisma.ingredient.create({
          data: {
            code,
            name,
            category,
            supplierId,
            packagePriceCents: Math.round(packagePriceCents),
            packageQty,
            packageUnit,
            baseUnit,
            factorId,
            conversionFactor: resolvedFactor,
            costPerBaseUnit: costResult.costPerBaseUnit,
            density,
            notes,
            isActive: true,
          },
          include: { supplier: true, factorRef: true },
        })
    );

    return NextResponse.json({ success: true, data: mapIngredientDto(created) });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// PUT /api/ingredientes — Actualizar producto / ingrediente existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      category,
      supplierId,
      packagePriceCents,
      packageQty,
      packageUnit,
      baseUnit,
      factorId,
      conversionFactor,
      density,
      notes,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID de producto requerido." }, { status: 400 });
    }

    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Producto no encontrado." }, { status: 404 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "El nombre del producto no puede estar vacío." }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (category !== undefined) data.category = category;
    if (supplierId !== undefined) data.supplierId = supplierId || null;
    if (packagePriceCents !== undefined) data.packagePriceCents = Math.round(Number(packagePriceCents));
    if (packageQty !== undefined) data.packageQty = Number(packageQty);
    if (packageUnit !== undefined) data.packageUnit = packageUnit;
    if (baseUnit !== undefined) data.baseUnit = baseUnit;
    if (density !== undefined) data.density = density !== null && density !== "" ? Number(density) : null;
    if (notes !== undefined) data.notes = typeof notes === "string" ? notes.trim() || null : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (factorId !== undefined) {
      data.factorId = factorId || null;
      if (factorId) {
        const ref = await prisma.unitConversionRef.findUnique({ where: { id: factorId } });
        if (!ref) {
          return NextResponse.json({ success: false, error: "El factor seleccionado no existe." }, { status: 400 });
        }
        if (conversionFactor === undefined) {
          data.conversionFactor = ref.factor;
        }
      }
    }
    if (conversionFactor !== undefined) {
      data.conversionFactor = Number(conversionFactor);
    }

    const nextPriceCents = data.packagePriceCents ?? existing.packagePriceCents;
    const nextQty = data.packageQty ?? existing.packageQty;
    const nextPackageUnit = data.packageUnit ?? existing.packageUnit;
    const nextBaseUnit = data.baseUnit ?? existing.baseUnit;
    const nextFactorId = data.factorId !== undefined ? data.factorId : existing.factorId;
    const nextFactor = data.conversionFactor ?? existing.conversionFactor ?? 1;
    const nextDensity = data.density !== undefined ? data.density : existing.density;

    const costFieldsChanged =
      packagePriceCents !== undefined ||
      packageQty !== undefined ||
      packageUnit !== undefined ||
      baseUnit !== undefined ||
      factorId !== undefined ||
      conversionFactor !== undefined ||
      density !== undefined;

    if (costFieldsChanged) {
      const costResult = calculateIngredientBaseCost({
        packagePriceCents: nextPriceCents,
        packageQty: nextQty,
        packageUnit: nextPackageUnit,
        baseUnit: nextBaseUnit,
        conversionFactor: nextFactor,
        hasExplicitFactor: Boolean(nextFactorId) || nextFactor !== 1,
        density: nextDensity,
      });

      if (!costResult.ok) {
        return NextResponse.json({ success: false, error: costResult.error }, { status: 400 });
      }
      data.costPerBaseUnit = costResult.costPerBaseUnit;
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data,
      include: { supplier: true, factorRef: true },
    });

    return NextResponse.json({ success: true, data: mapIngredientDto(updated) });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// DELETE /api/ingredientes — Soft delete para preservar histórico
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const deactivated = await prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

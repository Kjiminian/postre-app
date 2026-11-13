import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      include: { supplier: true },
      orderBy: { name: "asc" },
    });

    const dtos = items.map((i: any) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      supplierId: i.supplierId,
      supplierName: i.supplier ? i.supplier.name : null,
      packagePriceCents: i.packagePriceCents,
      packageQty: i.packageQty,
      packageUnit: i.packageUnit,
      baseUnit: i.baseUnit,
      costPerBaseUnit: i.costPerBaseUnit,
      density: i.density,
      reviewFlag: i.reviewFlag,
      isActive: i.isActive,
      notes: i.notes,
      importedFrom: i.importedFrom,
    }));

    return NextResponse.json({ success: true, data: dtos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/ingredientes — Crear nuevo ingrediente / empaque / decoración
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      category = "INGREDIENT",
      supplierId,
      packagePriceCents,
      packageQty,
      packageUnit,
      baseUnit,
      density,
      notes,
    } = body;

    if (!name || packagePriceCents <= 0 || packageQty <= 0) {
      return NextResponse.json(
        { success: false, error: "Nombre, precio y cantidad de empaque son requeridos y deben ser mayores a 0" },
        { status: 400 }
      );
    }

    const costPerBaseUnit = packagePriceCents / 100 / packageQty;

    const created = await prisma.ingredient.create({
      data: {
        name,
        category,
        supplierId: supplierId || null,
        packagePriceCents,
        packageQty,
        packageUnit: packageUnit || baseUnit || "unidad",
        baseUnit: baseUnit || "unidad",
        costPerBaseUnit,
        density: density ? parseFloat(density) : null,
        notes: notes || null,
        isActive: true,
      },
      include: { supplier: true },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/ingredientes — Actualizar ingrediente existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, supplierId, packagePriceCents, packageQty, packageUnit, baseUnit, density, notes, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID de ingrediente requerido" }, { status: 400 });
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (supplierId !== undefined) data.supplierId = supplierId || null;
    if (packagePriceCents !== undefined) data.packagePriceCents = packagePriceCents;
    if (packageQty !== undefined) data.packageQty = packageQty;
    if (packageUnit !== undefined) data.packageUnit = packageUnit;
    if (baseUnit !== undefined) data.baseUnit = baseUnit;
    if (density !== undefined) data.density = density ? parseFloat(density) : null;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (packagePriceCents !== undefined && packageQty !== undefined && packageQty > 0) {
      data.costPerBaseUnit = packagePriceCents / 100 / packageQty;
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data,
      include: { supplier: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/ingredientes — Soft delete para preservar histórico
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const deactivated = await prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

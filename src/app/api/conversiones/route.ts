import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/conversiones
export async function GET() {
  try {
    const conversions = await prisma.unitConversionRef.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, data: conversions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/conversiones
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category = "GENERAL", fromUnit, toUnit, factor, ingredient, notes } = body;

    if (!name || !fromUnit || !toUnit || !factor || factor <= 0) {
      return NextResponse.json(
        { success: false, error: "Nombre, unidad origen, unidad destino y factor (>0) requeridos" },
        { status: 400 }
      );
    }

    const created = await prisma.unitConversionRef.create({
      data: {
        name,
        category,
        fromUnit,
        toUnit,
        factor: parseFloat(factor),
        ingredient: ingredient || null,
        notes: notes || null,
        isEditable: true,
        source: "USER",
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/conversiones
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, fromUnit, toUnit, factor, ingredient, notes } = body;

    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const updated = await prisma.unitConversionRef.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(fromUnit && { fromUnit }),
        ...(toUnit && { toUnit }),
        ...(factor && { factor: parseFloat(factor) }),
        ...(ingredient !== undefined && { ingredient }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/conversiones
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    await prisma.unitConversionRef.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Conversión eliminada" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

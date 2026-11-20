import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { handleApiError } from "@/lib/api-errors";

// GET /api/conversiones
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const conversions = await prisma.unitConversionRef.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, data: conversions });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/conversiones
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "GENERAL";
    const fromUnit = typeof body?.fromUnit === "string" ? body.fromUnit.trim() : "";
    const toUnit = typeof body?.toUnit === "string" ? body.toUnit.trim() : "";
    const factorNum = Number(body?.factor);
    const ingredient = typeof body?.ingredient === "string" ? body.ingredient.trim() || null : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

    if (!name || !fromUnit || !toUnit || !Number.isFinite(factorNum) || factorNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Nombre, unidad origen, unidad destino y factor (> 0) son requeridos." },
        { status: 400 }
      );
    }

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.unitConversionRef.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.FACTOR,
      (code) =>
        prisma.unitConversionRef.create({
          data: {
            code,
            name,
            category,
            fromUnit,
            toUnit,
            factor: factorNum,
            ingredient,
            notes,
            isEditable: true,
            isActive: true,
            source: "USER",
          },
        })
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// PUT /api/conversiones
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, category, fromUnit, toUnit, factor, ingredient, notes, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "El nombre del factor no puede estar vacío." }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (category !== undefined) data.category = category;
    if (fromUnit !== undefined) {
      const trimmed = typeof fromUnit === "string" ? fromUnit.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "La unidad origen no puede estar vacía." }, { status: 400 });
      }
      data.fromUnit = trimmed;
    }
    if (toUnit !== undefined) {
      const trimmed = typeof toUnit === "string" ? toUnit.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "La unidad destino no puede estar vacía." }, { status: 400 });
      }
      data.toUnit = trimmed;
    }
    if (factor !== undefined) {
      const factorNum = Number(factor);
      if (!Number.isFinite(factorNum) || factorNum <= 0) {
        return NextResponse.json({ success: false, error: "El factor debe ser mayor a 0." }, { status: 400 });
      }
      data.factor = factorNum;
    }
    if (ingredient !== undefined) data.ingredient = typeof ingredient === "string" ? ingredient.trim() || null : null;
    if (notes !== undefined) data.notes = typeof notes === "string" ? notes.trim() || null : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.unitConversionRef.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// DELETE /api/conversiones — Desactivación lógica para preservar integridad con productos
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const deactivated = await prisma.unitConversionRef.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

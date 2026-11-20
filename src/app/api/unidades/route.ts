import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { handleApiError } from "@/lib/api-errors";

const VALID_UNIT_TYPES = new Set(["MASS", "VOLUME", "COUNT", "OTHER"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const units = await prisma.measureUnit.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, data: units });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const symbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const unitType = typeof body?.unitType === "string" ? body.unitType.trim().toUpperCase() : "COUNT";

    if (!symbol || !name) {
      return NextResponse.json(
        { success: false, error: "El símbolo y el nombre de la unidad son requeridos." },
        { status: 400 }
      );
    }

    if (!VALID_UNIT_TYPES.has(unitType)) {
      return NextResponse.json(
        { success: false, error: "Tipo de unidad inválido (MASS, VOLUME, COUNT u OTHER)." },
        { status: 400 }
      );
    }

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.measureUnit.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.UNIT,
      (code) =>
        prisma.measureUnit.create({
          data: {
            code,
            symbol,
            name,
            unitType,
            isActive: true,
          },
        })
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, symbol, name, unitType, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const existing = await prisma.measureUnit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Unidad no encontrada." }, { status: 404 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: "El nombre de la unidad no puede estar vacío." },
          { status: 400 }
        );
      }
      data.name = trimmed;
    }

    if (symbol !== undefined) {
      const trimmedSym = typeof symbol === "string" ? symbol.trim() : "";
      if (!trimmedSym) {
        return NextResponse.json(
          { success: false, error: "El símbolo de la unidad no puede estar vacío." },
          { status: 400 }
        );
      }
      // PRE-003: proteger inmutabilidad de symbol si ya está en uso en ingredientes o recetas
      if (trimmedSym !== existing.symbol) {
        const [usedInIng, usedInRec] = await Promise.all([
          prisma.ingredient.count({
            where: { OR: [{ packageUnit: existing.symbol }, { baseUnit: existing.symbol }] },
          }),
          prisma.recipeIngredient.count({ where: { unit: existing.symbol } }),
        ]);
        if (usedInIng > 0 || usedInRec > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `No se puede cambiar el símbolo "${existing.symbol}" porque ya está en uso en productos o recetas.`,
            },
            { status: 409 }
          );
        }
        data.symbol = trimmedSym;
      }
    }

    if (unitType !== undefined) {
      const upper = typeof unitType === "string" ? unitType.trim().toUpperCase() : "";
      if (!VALID_UNIT_TYPES.has(upper)) {
        return NextResponse.json(
          { success: false, error: "Tipo de unidad inválido." },
          { status: 400 }
        );
      }
      data.unitType = upper;
    }

    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    const updated = await prisma.measureUnit.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const deactivated = await prisma.measureUnit.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

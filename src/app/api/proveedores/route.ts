import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { handleApiError } from "@/lib/api-errors";

// GET /api/proveedores
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const suppliers = await prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: { select: { ingredients: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/proveedores
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

    if (!name) {
      return NextResponse.json({ success: false, error: "El nombre del suplidor es requerido." }, { status: 400 });
    }

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.supplier.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.SUPPLIER,
      (code) =>
        prisma.supplier.create({
          data: {
            code,
            name,
            phone: phone || null,
            notes: notes || null,
            isActive: true,
          },
        })
    );

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// PUT /api/proveedores
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, notes, isActive } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "El nombre del suplidor no puede estar vacío." }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (phone !== undefined) data.phone = typeof phone === "string" ? phone.trim() || null : null;
    if (notes !== undefined) data.notes = typeof notes === "string" ? notes.trim() || null : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.supplier.update({
      where: { id },
      data,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// DELETE /api/proveedores — Desactivación lógica
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const deactivated = await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

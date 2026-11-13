import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/proveedores
export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { ingredients: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/proveedores
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, notes } = body;
    if (!name) return NextResponse.json({ success: false, error: "Nombre es requerido" }, { status: 400 });

    const created = await prisma.supplier.create({
      data: { name, phone: phone || null, notes: notes || null, isActive: true },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/proveedores
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, notes, isActive } = body;
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/proveedores — Desactivación lógica
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    const deactivated = await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

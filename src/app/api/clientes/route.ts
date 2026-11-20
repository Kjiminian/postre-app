import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX } from "@/lib/codes";
import { handleApiError } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const customers = await prisma.customer.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: { select: { sales: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: customers });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
    const email = typeof body?.email === "string" ? body.email.trim() : null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

    if (!name) {
      return NextResponse.json({ success: false, error: "El nombre del cliente es requerido." }, { status: 400 });
    }

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.customer.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.CUSTOMER,
      (code) =>
        prisma.customer.create({
          data: {
            code,
            name,
            phone: phone || null,
            email: email || null,
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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, notes, isActive } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "El nombre del cliente no puede estar vacío." }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (phone !== undefined) data.phone = typeof phone === "string" ? phone.trim() || null : null;
    if (email !== undefined) data.email = typeof email === "string" ? email.trim() || null : null;
    if (notes !== undefined) data.notes = typeof notes === "string" ? notes.trim() || null : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.customer.update({
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

    const deactivated = await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

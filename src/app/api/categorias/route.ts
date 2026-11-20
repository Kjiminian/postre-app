import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWithSequentialCode, ENTITY_CODE_PREFIX, slugifyCategory } from "@/lib/codes";
import { handleApiError } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const categories = await prisma.productCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "El nombre de la categoría es requerido." },
        { status: 400 }
      );
    }

    const baseSlug = slugifyCategory(
      typeof body?.slug === "string" && body.slug.trim() ? body.slug.trim() : name
    );

    const existingWithSlug = await prisma.productCategory.findUnique({ where: { slug: baseSlug } });
    const slug = existingWithSlug ? `${baseSlug}_${Date.now().toString().slice(-4)}` : baseSlug;

    const created = await createWithSequentialCode(
      async () => {
        const rows = await prisma.productCategory.findMany({ select: { code: true } });
        return rows.map((r: { code: string | null }) => r.code);
      },
      ENTITY_CODE_PREFIX.CATEGORY,
      (code) =>
        prisma.productCategory.create({
          data: {
            code,
            slug,
            name,
            description: description || null,
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
    const { id, name, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido." }, { status: 400 });
    }

    const data: Record<string, any> = {};
    if (name !== undefined) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: "El nombre de la categoría no puede estar vacío." },
          { status: 400 }
        );
      }
      data.name = trimmed;
    }
    if (description !== undefined) {
      data.description = typeof description === "string" ? description.trim() || null : null;
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    const updated = await prisma.productCategory.update({
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

    const deactivated = await prisma.productCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: deactivated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

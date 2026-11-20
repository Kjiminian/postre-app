import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";
import { validateExternalUrlSyntax } from "@/lib/services/price-adapters";

const createSourceSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1),
  baseUrl: z.string().url().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  adapterType: z.enum(["VTEX_IO", "SHOPIFY_JSON", "WOOCOMMERCE_HTML", "GENERIC_HTML", "MANUAL_ASSISTED"]),
  captureMode: z.enum(["AUTO", "ASSISTED", "MANUAL"]).default("AUTO"),
  taxMode: z.enum(["INCLUDED", "PLUS_ITBIS"]).default("INCLUDED"),
  rateLimitMs: z.coerce.number().int().min(0).default(2000),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).default(10000),
  proposalTtlHours: z.coerce.number().int().min(1).default(168),
  priceAlertThresholdPct: z.coerce.number().min(1).max(500).default(20),
});

const updateSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  baseUrl: z.string().url().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  taxMode: z.enum(["INCLUDED", "PLUS_ITBIS"]).optional(),
  rateLimitMs: z.coerce.number().int().min(0).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).optional(),
  proposalTtlHours: z.coerce.number().int().min(1).optional(),
  priceAlertThresholdPct: z.coerce.number().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const sources = await prisma.priceSource.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            links: { where: { isActive: true } },
            proposals: { where: { status: "PENDING" } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos de fuente de precios.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.baseUrl) {
      const check = validateExternalUrlSyntax(parsed.data.baseUrl);
      if (!check.ok) throw new AppError(check.error, 400, "INVALID_BASE_URL");
    }

    const created = await prisma.priceSource.create({
      data: {
        ...parsed.data,
        baseUrl: parsed.data.baseUrl || null,
        supplierId: parsed.data.supplierId?.trim() || null,
      },
    });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al actualizar fuente.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...rest } = parsed.data;
    if (rest.baseUrl) {
      const check = validateExternalUrlSyntax(rest.baseUrl);
      if (!check.ok) throw new AppError(check.error, 400, "INVALID_BASE_URL");
    }

    const updated = await prisma.priceSource.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.supplierId !== undefined
          ? { supplierId: rest.supplierId?.trim() || null }
          : {}),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return handleApiError(error);
  }
}

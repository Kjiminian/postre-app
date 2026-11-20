import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-errors";

function safeParseAlerts(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET /api/precios/propuestas — Bandeja de propuestas con expiración perezosa
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // PENDING | APPROVED | REJECTED | EXPIRED | ALL
    const sourceId = searchParams.get("sourceId");
    const onlyAlerts = searchParams.get("onlyAlerts") === "true";
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100));

    // Lazy expiration para propuestas PENDING vencidas
    const now = new Date();
    await prisma.priceUpdateProposal.updateMany({
      where: { status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (sourceId && sourceId !== "ALL") where.sourceId = sourceId;
    if (onlyAlerts) where.alertsJson = { not: null };

    const [proposals, pendingCount] = await Promise.all([
      prisma.priceUpdateProposal.findMany({
        where,
        take: limit,
        include: {
          ingredient: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              packagePriceCents: true,
              packageQty: true,
              packageUnit: true,
              baseUnit: true,
              conversionFactor: true,
              costPerBaseUnit: true,
            },
          },
          source: { select: { id: true, code: true, name: true, captureMode: true, taxMode: true } },
          link: { select: { id: true, externalUrl: true, applyStrategy: true, taxRatePct: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.priceUpdateProposal.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: proposals.map((p: any) => ({
        ...p,
        alerts: safeParseAlerts(p.alertsJson),
      })),
      pendingCount,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";
import { fetchPortalProduct, ApplyStrategy } from "@/lib/services/price-adapters";
import { createOrDeduplicateProposal } from "@/lib/services/price-proposals";

const syncSchema = z
  .object({
    scope: z.enum(["ALL", "SOURCE", "RECIPE", "LINKS"]).default("ALL"),
    sourceId: z.string().optional(),
    recipeId: z.string().optional(),
    linkIds: z.array(z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === "SOURCE" && !val.sourceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "sourceId es obligatorio cuando scope = SOURCE" });
    }
    if (val.scope === "RECIPE" && !val.recipeId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "recipeId es obligatorio cuando scope = RECIPE" });
    }
  });

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

// GET /api/precios/sincronizar — Historial de corridas
export async function GET() {
  try {
    const runs = await prisma.priceSyncRun.findMany({
      take: 30,
      orderBy: { startedAt: "desc" },
      include: {
        source: { select: { id: true, code: true, name: true } },
      },
    });
    return NextResponse.json({ success: true, data: runs });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/precios/sincronizar — Consultar portales vinculados bajo demanda
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = syncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Parámetros de sincronización inválidos." },
        { status: 400 }
      );
    }

    const { scope, sourceId, recipeId, linkIds } = parsed.data;

    // Evitar corridas RUNNING simultáneas en la misma fuente (stale lock > 5 min se ignora)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeRun = await prisma.priceSyncRun.findFirst({
      where: {
        status: "RUNNING",
        startedAt: { gt: fiveMinAgo },
        ...(sourceId ? { sourceId } : {}),
      },
    });
    if (activeRun) {
      throw new AppError("Ya existe una consulta en progreso para esta fuente.", 409, "SYNC_IN_PROGRESS");
    }

    const whereLinks: any = {
      isActive: true,
      source: { isActive: true, captureMode: "AUTO" },
    };
    if (scope === "SOURCE" && sourceId) whereLinks.sourceId = sourceId;
    if (scope === "LINKS" && linkIds?.length) whereLinks.id = { in: linkIds };
    if (scope === "RECIPE" && recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId },
        include: {
          ingredients: { select: { ingredientId: true } },
          presentations: { include: { materials: { select: { ingredientId: true } } } },
        },
      });
      if (!recipe) throw new AppError("Receta no encontrada.", 404, "NOT_FOUND");
      const ingIds = new Set<string>();
      for (const ri of recipe.ingredients) ingIds.add(ri.ingredientId);
      for (const p of recipe.presentations) {
        for (const m of p.materials) {
          if (m.ingredientId) ingIds.add(m.ingredientId);
        }
      }
      whereLinks.ingredientId = { in: Array.from(ingIds) };
    }

    const links = await prisma.productSourceLink.findMany({
      where: whereLinks,
      take: 50, // Límite por corrida para evitar timeouts HTTP
      include: { ingredient: true, source: true },
      orderBy: { lastCheckedAt: "asc" },
    });

    const triggerType =
      scope === "SOURCE"
        ? "MANUAL_SOURCE"
        : scope === "RECIPE"
        ? "MANUAL_RECIPE"
        : "MANUAL_ALL";

    const run = await prisma.priceSyncRun.create({
      data: {
        sourceId: sourceId || null,
        triggerType,
        status: "RUNNING",
      },
    });

    let totalChecked = 0;
    let proposalsCreated = 0;
    let errorsCount = 0;
    let blockedCount = 0;
    let fatalError = false;
    const details: Array<Record<string, any>> = [];
    const lastRequestBySource = new Map<string, number>();
    const sourceStatusMap = new Map<string, { syncedAt: Date; status: "OK" | "DEGRADED" | "BLOCKED" }>();

    try {
      for (const link of links) {
        if (!link.externalUrl) continue;

        const prevTs = lastRequestBySource.get(link.sourceId) || 0;
        const waitMs = Math.max(0, (link.source.rateLimitMs || 1500) - (Date.now() - prevTs));
        if (waitMs > 0) await sleep(waitMs);
        lastRequestBySource.set(link.sourceId, Date.now());

        totalChecked += 1;
        const res = await fetchPortalProduct({
          adapterType: link.source.adapterType,
          externalUrl: link.externalUrl,
          externalSku: link.externalSku,
          allowedBaseUrl: link.source.baseUrl,
          timeoutMs: link.source.timeoutMs,
        });

        const now = new Date();
        if (res.status !== "OK" || !res.priceCents) {
          errorsCount += 1;
          if (res.status === "BLOCKED") blockedCount += 1;

          await prisma.productSourceLink.update({
            where: { id: link.id },
            data: { lastCheckedAt: now, lastError: res.error || "Error al consultar" },
          });
          sourceStatusMap.set(link.sourceId, {
            syncedAt: now,
            status: res.status === "BLOCKED" ? "BLOCKED" : "DEGRADED",
          });
          details.push({
            linkId: link.id,
            ingredientName: link.ingredient.name,
            sourceName: link.source.name,
            status: res.status,
            error: res.error,
          });
          continue;
        }

        await prisma.productSourceLink.update({
          where: { id: link.id },
          data: {
            lastCheckedAt: now,
            lastSeenPriceCents: res.priceCents,
            lastSeenInStock: res.inStock ?? true,
            lastError: null,
          },
        });
        if (!sourceStatusMap.has(link.sourceId)) {
          sourceStatusMap.set(link.sourceId, { syncedAt: now, status: "OK" });
        }

        const propResult = await createOrDeduplicateProposal({
          runId: run.id,
          linkId: link.id,
          ingredient: link.ingredient,
          source: link.source,
          detectedPriceCentsRaw: res.priceCents,
          detectedInStock: res.inStock ?? true,
          detectedPackQty: res.packQty,
          detectedPackUnit: res.packUnit,
          detectedRawTitle: res.title,
          taxRatePct: link.taxRatePct,
          applyStrategy: link.applyStrategy as ApplyStrategy,
          packTolerancePct: link.packTolerancePct,
          evidenceUrl: res.evidenceUrl || link.externalUrl,
          ambiguousVariant: res.ambiguousVariant,
          ambiguousPriceRange: res.ambiguousPriceRange,
        });

        if (propResult.status === "CREATED") proposalsCreated += 1;
        details.push({
          linkId: link.id,
          ingredientName: link.ingredient.name,
          sourceName: link.source.name,
          status: propResult.status,
          proposalCode: propResult.proposal?.code || null,
        });
      }
    } catch (err) {
      fatalError = true;
      throw err;
    } finally {
      for (const [srcId, info] of sourceStatusMap.entries()) {
        await prisma.priceSource
          .update({
            where: { id: srcId },
            data: { lastSyncedAt: info.syncedAt, lastStatus: info.status },
          })
          .catch(() => {});
      }

      const finalStatus = fatalError
        ? "ERROR"
        : totalChecked === 0
        ? "OK"
        : blockedCount > 0 && blockedCount === totalChecked
        ? "BLOCKED"
        : errorsCount > 0
        ? "DEGRADED"
        : "OK";

      await prisma.priceSyncRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          totalChecked,
          proposalsCreated,
          errorsCount,
          summaryJson: JSON.stringify({ details }),
          finishedAt: new Date(),
        },
      });
    }

    const finishedRun = await prisma.priceSyncRun.findUnique({ where: { id: run.id } });
    return NextResponse.json({ success: true, data: { run: finishedRun, details } });
  } catch (error: any) {
    return handleApiError(error);
  }
}

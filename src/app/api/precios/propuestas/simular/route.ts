import { NextResponse } from "next/server";
import { z } from "zod";
import { simulatePriceImpact } from "@/lib/services/price-approval";
import { handleApiError } from "@/lib/api-errors";

const simulateSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1).max(100),
  overridesByProposalId: z
    .record(
      z.string(),
      z.object({
        proposedPriceCents: z.coerce.number().int().positive().optional(),
        applyStrategy: z.enum(["STRICT_SAME_PACK", "REBASE_UNIT_COST", "ADOPT_SOURCE_PACK"]).optional(),
      })
    )
    .optional(),
});

// POST /api/precios/propuestas/simular — Simulador de impacto read-only antes de aprobar
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = simulateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Parámetros inválidos para simulación.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const report = await simulatePriceImpact(
      parsed.data.proposalIds,
      parsed.data.overridesByProposalId
    );
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    return handleApiError(error);
  }
}

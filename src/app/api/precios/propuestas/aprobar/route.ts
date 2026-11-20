import { NextResponse } from "next/server";
import { z } from "zod";
import { approveProposals } from "@/lib/services/price-approval";
import { handleApiError } from "@/lib/api-errors";

const approveSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1).max(100),
  confirmCriticalAlerts: z.boolean().default(false),
  allowStaleDrift: z.boolean().default(false),
  reviewNote: z.string().optional().nullable(),
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

// POST /api/precios/propuestas/aprobar — Aprobación atómica y recálculo en cascada
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos al aprobar propuestas.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const report = await approveProposals(parsed.data);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, AppError } from "@/lib/api-errors";

const rejectSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1).max(100),
  reviewNote: z.string().optional().nullable(),
});

// POST /api/precios/propuestas/rechazar — Descartar propuestas pendientes sin alterar precios
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Debes indicar al menos una propuesta válida a rechazar." },
        { status: 400 }
      );
    }

    const now = new Date();
    const res = await prisma.priceUpdateProposal.updateMany({
      where: {
        id: { in: parsed.data.proposalIds },
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
        reviewedAt: now,
        reviewNote: parsed.data.reviewNote || "Rechazada manualmente por revisión",
      },
    });

    if (res.count === 0) {
      throw new AppError("Las propuestas indicadas ya no están pendientes.", 409, "CONFLICT_PROPOSAL_STATE");
    }

    return NextResponse.json({ success: true, rejectedCount: res.count });
  } catch (error: any) {
    return handleApiError(error);
  }
}

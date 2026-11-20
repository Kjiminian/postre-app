import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-errors";

// GET /api/gastos — Listar gastos operativos y categorías
export async function GET() {
  try {
    const [expenses, categories] = await Promise.all([
      prisma.operationalExpense.findMany({
        include: { category: true },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: { expenses, categories } });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// POST /api/gastos — Registrar nuevo gasto (por porcentaje sobre base o monto directo) o categoría
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      categoryName,
      categoryId,
      concept,
      baseAmountCents,
      percentage,
      amountCents,
      expenseDate,
      paymentMethod = "EFECTIVO",
      notes,
      isIngredientPurchase,
    } = body;

    if (action === "CREATE_CATEGORY") {
      const trimmedCat = typeof categoryName === "string" ? categoryName.trim() : "";
      if (!trimmedCat) {
        return NextResponse.json({ success: false, error: "Nombre de categoría requerido" }, { status: 400 });
      }
      const cat = await prisma.expenseCategory.create({
        data: { name: trimmedCat, isActive: true },
      });
      return NextResponse.json({ success: true, data: cat });
    }

    const trimmedConcept = typeof concept === "string" ? concept.trim() : "";
    if (!categoryId || !trimmedConcept) {
      return NextResponse.json(
        { success: false, error: "Categoría y concepto son requeridos." },
        { status: 400 }
      );
    }

    let resolvedAmountCents = 0;
    let resolvedBaseCents: number | null = null;
    let resolvedPercentage: number | null = null;

    if (percentage !== undefined && percentage !== null) {
      const pctNum = Number(percentage);
      const baseNum = Number(baseAmountCents);
      if (!Number.isFinite(pctNum) || pctNum <= 0 || !Number.isFinite(baseNum) || baseNum <= 0) {
        return NextResponse.json(
          { success: false, error: "El monto base y el porcentaje deben ser mayores a 0." },
          { status: 400 }
        );
      }
      resolvedBaseCents = Math.round(baseNum);
      resolvedPercentage = pctNum;
      resolvedAmountCents = Math.round(resolvedBaseCents * (pctNum / 100));
    } else {
      const amtNum = Number(amountCents);
      if (!Number.isFinite(amtNum) || amtNum <= 0) {
        return NextResponse.json(
          { success: false, error: "Monto válido (> 0) o base + porcentaje requeridos." },
          { status: 400 }
        );
      }
      resolvedAmountCents = Math.round(amtNum);
    }

    if (resolvedAmountCents <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto calculado del gasto debe ser mayor a RD$ 0.00." },
        { status: 400 }
      );
    }

    const expense = await prisma.operationalExpense.create({
      data: {
        categoryId,
        concept: trimmedConcept,
        baseAmountCents: resolvedBaseCents,
        percentage: resolvedPercentage,
        amountCents: resolvedAmountCents,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        paymentMethod,
        notes: typeof notes === "string" ? notes.trim() || null : null,
        isIngredientPurchase: Boolean(isIngredientPurchase),
      },
      include: { category: true },
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error: any) {
    return handleApiError(error);
  }
}

// DELETE /api/gastos — Eliminar gasto
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

    await prisma.operationalExpense.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Gasto eliminado" });
  } catch (error: any) {
    return handleApiError(error);
  }
}

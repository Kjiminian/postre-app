import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/gastos — Registrar nuevo gasto o categoría
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, categoryName, categoryId, concept, amountCents, expenseDate, paymentMethod = "EFECTIVO", notes, isIngredientPurchase } = body;

    // Crear categoría
    if (action === "CREATE_CATEGORY") {
      if (!categoryName) return NextResponse.json({ success: false, error: "Nombre de categoría requerido" }, { status: 400 });
      const cat = await prisma.expenseCategory.create({
        data: { name: categoryName, isActive: true },
      });
      return NextResponse.json({ success: true, data: cat });
    }

    // Registrar gasto
    if (!categoryId || !concept || !amountCents || amountCents <= 0) {
      return NextResponse.json({ success: false, error: "Categoría, concepto y monto válido (>0) son requeridos" }, { status: 400 });
    }

    const expense = await prisma.operationalExpense.create({
      data: {
        categoryId,
        concept,
        amountCents: parseInt(amountCents),
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        paymentMethod,
        notes: notes || null,
        isIngredientPurchase: Boolean(isIngredientPurchase),
      },
      include: { category: true },
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export function handleApiError(error: any, fallbackMessage = "Error interno del servidor") {
  if (error?.code === "P2002") {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : "registro";
    return NextResponse.json(
      { success: false, error: `Ya existe un registro con ese valor (${target}).` },
      { status: 409 }
    );
  }
  if (error?.code === "P2025") {
    return NextResponse.json(
      { success: false, error: "Registro no encontrado." },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { success: false, error: error?.message || fallbackMessage },
    { status: 500 }
  );
}

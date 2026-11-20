import { NextResponse } from "next/server";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function handleApiError(error: any, fallbackMessage = "Error interno del servidor") {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }
  if (error instanceof SyntaxError && error.message.toLowerCase().includes("json")) {
    return NextResponse.json(
      { success: false, error: "Cuerpo JSON inválido en la solicitud." },
      { status: 400 }
    );
  }
  if (error?.code === "P2002") {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(", ") : "registro";
    return NextResponse.json(
      { success: false, error: `Ya existe un registro con ese valor (${target}).` },
      { status: 409 }
    );
  }
  if (error?.code === "P2003") {
    return NextResponse.json(
      { success: false, error: "Referencia relacionada inválida o inexistente." },
      { status: 400 }
    );
  }
  if (error?.code === "P2025") {
    return NextResponse.json(
      { success: false, error: "Registro no encontrado." },
      { status: 404 }
    );
  }

  console.error("[API_ERROR]", error);
  const message =
    process.env.NODE_ENV === "production"
      ? fallbackMessage
      : error?.message || fallbackMessage;

  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

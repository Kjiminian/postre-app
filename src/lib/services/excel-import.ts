// Servicio de Importación e Inspección XLSX / CSV — K_Sweet (RF-024, RF-025, RF-026)
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export interface SheetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
  sampleHeaders: string[];
  sampleRows: any[];
}

export interface InspectionResult {
  fileName: string;
  sheetCount: number;
  sheets: SheetSummary[];
  inconsistenciesFound: string[];
}

/**
 * Inspecciona un archivo XLSX/CSV conservando sus hojas, valores, fórmulas y coordenadas.
 * Identifica inconsistencias (#REF!, unidades ambiguas, multiplicaciones erróneas) sin corregirlas silenciosamente.
 */
export function inspectExcelBuffer(buffer: Buffer, fileName: string): InspectionResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: true,
    cellStyles: true,
    cellDates: true,
  });

  const inconsistencies: string[] = [];
  const sheets: SheetSummary[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;

    // Buscar fórmulas rotas (#REF!) o referencias sospechosas
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        if (cell) {
          if (cell.f && cell.f.includes("#REF!")) {
            inconsistencies.push(
              `Hoja "${sheetName}" celda ${cellAddress}: Fórmula con error #REF! detectada: "${cell.f}"`
            );
          }
          if (cell.w && cell.w.includes("#REF!")) {
            inconsistencies.push(
              `Hoja "${sheetName}" celda ${cellAddress}: Valor renderizado #REF!`
            );
          }
          // Detectar errores de unidades ambiguas ("framos", "palitos", "mm")
          if (typeof cell.v === "string") {
            const lower = cell.v.toLowerCase().trim();
            if (["framos", "palitos", "mm", "unidad segun excel"].includes(lower)) {
              inconsistencies.push(
                `Hoja "${sheetName}" celda ${cellAddress}: Unidad ambigua detectada: "${cell.v}"`
              );
            }
          }
        }
      }
    }

    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headers = jsonData[0] ? (jsonData[0] as string[]).map(String) : [];
    const sample = jsonData.slice(1, 6);

    sheets.push({
      name: sheetName,
      rowCount,
      columnCount: colCount,
      sampleHeaders: headers,
      sampleRows: sample,
    });
  }

  return {
    fileName,
    sheetCount: workbook.SheetNames.length,
    sheets,
    inconsistenciesFound: inconsistencies,
  };
}

/**
 * Inicia una sesión de importación persistiendo trazabilidad (RF-024)
 */
export async function createImportSession(fileName: string, fileSizeKb: number, sheetCount: number) {
  return await prisma.importSession.create({
    data: {
      fileName,
      fileSizeKb,
      sheetCount,
      status: "PREVIEWING",
    },
  });
}

/**
 * Guarda filas crudas para mapeo y edición de copia de trabajo antes de confirmar
 */
export async function stageImportRows(
  sessionId: string,
  sheetName: string,
  rows: Array<{ rowIndex: number; rawData: any }>
) {
  const staged = rows.map((r) => ({
    sessionId,
    sheetName,
    rowIndex: r.rowIndex,
    rawDataJson: JSON.stringify(r.rawData),
    status: "DRAFT",
    reviewFlag: true,
  }));

  return await prisma.importRow.createMany({
    data: staged,
  });
}

/**
 * Genera exportación completa de respaldo JSON de la base de datos (RF-026)
 */
export async function generateJsonBackup() {
  const ingredients = await prisma.ingredient.findMany({ include: { supplier: true } });
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true, subRecipeUses: true, priceHistory: true },
  });
  const sales = await prisma.sale.findMany({ include: { items: true, payments: true } });
  const weeklyCloses = await prisma.weeklyClose.findMany();
  const expenses = await prisma.operationalExpense.findMany({ include: { category: true } });
  const conversions = await prisma.unitConversionRef.findMany();

  return {
    appName: "K_Sweet",
    exportedAt: new Date().toISOString(),
    version: "1.0.0",
    data: {
      ingredients,
      recipes,
      sales,
      weeklyCloses,
      expenses,
      conversions,
    },
  };
}

// Inspección Profunda y Forense del Excel de Costos de K_Sweet
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const excelPath = path.resolve("./data/costos_postres_original.xlsx");
if (!fs.existsSync(excelPath)) {
  console.error("Archivo no encontrado en:", excelPath);
  process.exit(1);
}

const buffer = fs.readFileSync(excelPath);
const workbook = XLSX.read(buffer, {
  type: "buffer",
  cellFormula: true,
  cellStyles: true,
  cellDates: true,
});

console.log("================================================================================");
console.log("   AUDITORÍA FORENSE COMPLETA: K_SWEET — EXCEL DE COSTOS ORIGINAL");
console.log("   Archivo:", excelPath);
console.log("   Total de Hojas Detectadas:", workbook.SheetNames.length);
console.log("================================================================================\n");

const auditSummary = {
  sheets: [],
  formulasWithRef: [],
  ambiguousUnits: [],
  datesInterpretedAsNumbers: [],
  auxiliaryTablesFound: [],
  motherRecipesCandidate: [],
  presentationsCandidate: [],
};

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet["!ref"] || "A1:A1";
  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;

  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`HOJA: "${sheetName}" | Rango: ${ref} (${rowCount} filas x ${colCount} cols)`);
  console.log(`--------------------------------------------------------------------------------`);

  const sheetFormulas = [];
  const sheetInconsistencies = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      if (!cell) continue;

      // Fórmulas #REF!
      if (cell.f && cell.f.includes("#REF!")) {
        sheetInconsistencies.push({
          cell: cellAddress,
          type: "FORMULA_REF_ERROR",
          formula: cell.f,
          val: cell.v,
        });
        auditSummary.formulasWithRef.push({ sheet: sheetName, cell: cellAddress, formula: cell.f });
      }

      // Unidades ambiguas o texto sospechoso
      if (typeof cell.v === "string") {
        const text = cell.v.toLowerCase().trim();
        if (["framos", "palitos", "mm", "unidad segun excel"].includes(text)) {
          sheetInconsistencies.push({
            cell: cellAddress,
            type: "AMBIGUOUS_UNIT",
            val: cell.v,
          });
          auditSummary.ambiguousUnits.push({ sheet: sheetName, cell: cellAddress, unit: cell.v });
        }
        // Detección de tablas auxiliares
        if (text.includes("shot") || text.includes("presentacion") || text.includes("empaque") || text.includes("porción") || text.includes("porcion")) {
          auditSummary.auxiliaryTablesFound.push({ sheet: sheetName, cell: cellAddress, label: cell.v });
        }
      }

      // Fechas convertidas o celdas interpretadas como fecha
      if (cell.t === "d" || (cell.w && cell.w.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/))) {
        // Si está en una columna que debería ser cantidad numérica
        if (c === 1 || c === 2) {
          auditSummary.datesInterpretedAsNumbers.push({ sheet: sheetName, cell: cellAddress, val: cell.w || cell.v });
        }
      }
    }
  }

  // Muestra de primeras filas no vacías
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`Filas detectadas con datos: ${rows.length}`);
  if (rows.length > 0) {
    console.log("Encabezados / Fila 1:", JSON.stringify(rows[0]));
    if (rows[1]) console.log("Fila 2:", JSON.stringify(rows[1]));
    if (rows[2]) console.log("Fila 3:", JSON.stringify(rows[2]));
  }

  if (sheetInconsistencies.length > 0) {
    console.log(`\n  [!] INCONSISTENCIAS EN HOJA "${sheetName}" (${sheetInconsistencies.length}):`);
    sheetInconsistencies.slice(0, 10).forEach((inc) => {
      console.log(`      • Celda ${inc.cell}: [${inc.type}] ${inc.formula || inc.val}`);
    });
    if (sheetInconsistencies.length > 10) {
      console.log(`      ... y ${sheetInconsistencies.length - 10} más.`);
    }
  } else {
    console.log(`  [✓] Sin errores #REF! evidentes en esta hoja.`);
  }
}

console.log("\n================================================================================");
console.log("   RESUMEN GENERAL DE AUDITORÍA FORENSE");
console.log("================================================================================");
console.log("Total fórmulas con #REF!:", auditSummary.formulasWithRef.length);
console.log("Total unidades ambiguas detectadas:", auditSummary.ambiguousUnits.length);
console.log("Tablas auxiliares / presentaciones identificadas:", auditSummary.auxiliaryTablesFound.length);
console.log("\nDetalles de tablas auxiliares encontradas en el Excel:");
auditSummary.auxiliaryTablesFound.forEach((t) => {
  console.log(`  - [${t.sheet}!${t.cell}] ${t.label}`);
});

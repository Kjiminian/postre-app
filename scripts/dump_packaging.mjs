import xlsx from "xlsx";
const wb = xlsx.readFile("data/costos_postres_original.xlsx");
const ws = wb.Sheets["Producto precios"];
const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
data.slice(50).forEach((row, idx) => {
  const text = row.map((c, colIdx) => c !== "" ? `[C${colIdx+1}] ${c}` : "").filter(Boolean).join(" | ");
  if (text) console.log(`R${idx + 51}: ${text}`);
});

import xlsx from "xlsx";
const wb = xlsx.readFile("data/costos_postres_original.xlsx");

for (const name of wb.SheetNames) {
  console.log(`\n=================== SHEET: ${name} ===================`);
  const ws = wb.Sheets[name];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  data.forEach((row, i) => {
    const text = row.map((c, colIdx) => c !== "" ? `[C${colIdx+1}] ${c}` : "").filter(Boolean).join(" | ");
    if (text) {
      console.log(`R${i + 1}: ${text}`);
    }
  });
}

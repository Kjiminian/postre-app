const XLSX = require("xlsx");
const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

const EXCEL_PATH =
  "C:/Users/katherinejiminian/.gemini/antigravity/brain/3a30da02-00dc-4af2-b5d5-abc002075296/.user_uploaded/media_1794599661445_300ac8b8.xlsx";

function padCode(prefix, num) {
  return `${prefix}-${String(num).padStart(3, "0")}`;
}

function maxSeq(rows, prefix) {
  const rx = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  for (const r of rows) {
    if (!r.code) continue;
    const m = r.code.match(rx);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function normalizeUnit(raw) {
  const u = String(raw || "").trim().toLowerCase();
  if (!u) return "unidad";
  if (["gr", "g", "gramo", "gramos", "gracmos"].includes(u)) return "g";
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(u)) return "kg";
  if (["lb", "lbs", "libra", "libras"].includes(u)) return "lb";
  if (["oz", "onza", "onzas"].includes(u)) return "oz";
  if (["ml", "mililitro", "mililitros"].includes(u)) return "ml";
  if (["l", "lt", "litro", "litros"].includes(u)) return "l";
  if (["unidad", "unidades", "ud", "uds", "pieza", "piezas"].includes(u)) return "unidad";
  if (["yarda", "yardas"].includes(u)) return "yarda";
  return u;
}

const STANDARD_TO_BASE = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  lb: { base: "g", factor: 453.59237 },
  oz: { base: "g", factor: 28.349523125 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  unidad: { base: "unidad", factor: 1 },
  yarda: { base: "yarda", factor: 1 },
};

function normalizeSupplierName(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "pan de azucar" || lower === "pan de azúcar") return "Pan de Azúcar";
  if (lower === "denicias") return "Denicias";
  if (lower === "dume") return "Dume";
  if (lower === "3i+") return "3i+";
  if (lower === "henrry") return "Henrry";
  return s;
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets["Producto precios"];
  if (!sheet) throw new Error("No se encontró la hoja 'Producto precios'");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Cargar suplidores e ingredientes existentes
  const existingSuppliers = await prisma.supplier.findMany();
  let supSeq = maxSeq(existingSuppliers, "SUP");
  const supplierByName = new Map(
    existingSuppliers.map((s) => [s.name.trim().toLowerCase(), s])
  );

  const ensureSupplier = async (name) => {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (supplierByName.has(key)) return supplierByName.get(key);
    supSeq += 1;
    const created = await prisma.supplier.create({
      data: {
        code: padCode("SUP", supSeq),
        name: name.trim(),
        isActive: true,
      },
    });
    supplierByName.set(key, created);
    return created;
  };

  const existingIngredients = await prisma.ingredient.findMany({ include: { supplier: true } });
  let prodSeq = maxSeq(existingIngredients, "PROD");

  const byOrigin = new Map();
  const bySignature = new Map();
  for (const ing of existingIngredients) {
    if (ing.importedFrom) byOrigin.set(ing.importedFrom, ing);
    const sig = `${ing.name.trim().toLowerCase()}|${ing.packagePriceCents}|${(ing.supplier?.name || "").trim().toLowerCase()}`;
    bySignature.set(sig, ing);
  }

  let currentCategory = "INGREDIENT";
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let reviewCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];
    const colA = String(r[0] || "").trim();
    if (!colA) continue;

    const lowerA = colA.toLowerCase();
    // Detectar encabezados de sección
    if (rowNum <= 3 || lowerA === "listado de ingredientes" || lowerA === "ingredientes") {
      currentCategory = "INGREDIENT";
      continue;
    }
    if (lowerA === "decoración" || lowerA === "decoracion") {
      currentCategory = "DECORATION";
      continue;
    }
    if (lowerA === "envasado" || lowerA === "empaques" || lowerA === "empaque") {
      currentCategory = "PACKAGING";
      continue;
    }
    if (lowerA === "moldes" || lowerA === "utensilios") {
      currentCategory = "UTENSIL";
      continue;
    }

    const priceNum = Number(r[1]);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      skippedCount += 1;
      continue;
    }
    const packagePriceCents = Math.round(priceNum * 100);

    const rawQty = Number(r[2]);
    const rawUnit = String(r[3] || "").trim();
    const rawConvQty = Number(r[4]);
    const rawConvUnit = String(r[5] || "").trim();
    const rawExcelUnitCost = Number(r[6]);
    const supplierName = normalizeSupplierName(r[8]);

    let reviewFlag = false;
    const notesParts = [];

    let packageQty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      reviewFlag = true;
      notesParts.push("Cantidad original vacía o cero en Excel");
    }

    let packageUnit = normalizeUnit(rawUnit);
    let baseUnit = "unidad";
    let conversionFactor = 1;

    if (STANDARD_TO_BASE[packageUnit]) {
      baseUnit = STANDARD_TO_BASE[packageUnit].base;
      conversionFactor = STANDARD_TO_BASE[packageUnit].factor;
    } else if (rawUnit) {
      // Unidad especial/ambigua (Paquete, Lata, Tabletas, Palitos, pies, mm)
      reviewFlag = true;
      notesParts.push(`Unidad original Excel: "${rawUnit}"`);
      if (Number.isFinite(rawConvQty) && rawConvQty > 0) {
        const convNorm = normalizeUnit(rawConvUnit);
        baseUnit = STANDARD_TO_BASE[convNorm] ? STANDARD_TO_BASE[convNorm].base : convNorm || "unidad";
        const stdSub = STANDARD_TO_BASE[convNorm]?.factor || 1;
        conversionFactor = (rawConvQty * stdSub) / packageQty;
      } else {
        baseUnit = "unidad";
        conversionFactor = 1;
      }
    } else if (Number.isFinite(rawConvQty) && rawConvQty > 0) {
      // Sin unidad en col D, pero tiene cantidad en col E
      const convNorm = normalizeUnit(rawConvUnit);
      baseUnit = STANDARD_TO_BASE[convNorm]?.base || convNorm || "unidad";
      packageUnit = baseUnit;
      packageQty = rawConvQty;
      conversionFactor = 1;
      reviewFlag = true;
      notesParts.push("Cantidad inferida desde columna auxiliar del Excel");
    } else {
      packageUnit = "unidad";
      baseUnit = "unidad";
      conversionFactor = 1;
      reviewFlag = true;
      notesParts.push("Unidad no especificada en Excel");
    }

    // Detectar discrepancias conocidas del Excel (ej. Harina 5 lb -> 453g en vez de 2267.96g)
    if (
      packageUnit === "lb" &&
      Number.isFinite(rawConvQty) &&
      rawConvQty > 0 &&
      Math.abs(rawConvQty - packageQty * 453.59237) > 50
    ) {
      reviewFlag = true;
      notesParts.push(`Excel indica ${rawConvQty} ${rawConvUnit || "g"} para ${packageQty} lb`);
    }

    const effectiveBaseQty = packageQty * conversionFactor;
    const costPerBaseUnit = effectiveBaseQty > 0 ? (packagePriceCents / 100) / effectiveBaseQty : priceNum;

    if (
      Number.isFinite(rawExcelUnitCost) &&
      rawExcelUnitCost > 0 &&
      Math.abs(rawExcelUnitCost - costPerBaseUnit) > 0.5
    ) {
      notesParts.push(`Costo ref. Excel: ${rawExcelUnitCost.toFixed(4)}`);
    }

    const supplier = await ensureSupplier(supplierName);
    const originKey = `Producto precios!R${rowNum}`;
    const sigKey = `${colA.toLowerCase()}|${packagePriceCents}|${(supplier?.name || "").toLowerCase()}`;

    const existing = byOrigin.get(originKey) || bySignature.get(sigKey);

    if (reviewFlag) reviewCount += 1;

    if (existing) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          category: currentCategory,
          supplierId: supplier ? supplier.id : existing.supplierId,
          importedFrom: existing.importedFrom || originKey,
        },
      });
      updatedCount += 1;
    } else {
      prodSeq += 1;
      const created = await prisma.ingredient.create({
        data: {
          code: padCode("PROD", prodSeq),
          name: colA,
          category: currentCategory,
          supplierId: supplier ? supplier.id : null,
          packagePriceCents,
          packageQty,
          packageUnit,
          baseUnit,
          conversionFactor,
          costPerBaseUnit,
          isActive: true,
          reviewFlag,
          notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
          importedFrom: originKey,
        },
      });
      byOrigin.set(originKey, created);
      bySignature.set(sigKey, created);
      createdCount += 1;
    }
  }

  const totalProducts = await prisma.ingredient.count();
  console.log(
    JSON.stringify({
      ok: true,
      createdCount,
      updatedCount,
      skippedCount,
      reviewFlagged: reviewCount,
      totalProductsInDb: totalProducts,
    })
  );
}

main()
  .catch((err) => {
    console.error("Import error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

function padCode(prefix, num) {
  return `${prefix}-${String(num).padStart(3, "0")}`;
}

function maxSeqFromCodes(rows, prefix) {
  const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let max = 0;
  for (const row of rows) {
    if (!row.code) continue;
    const m = row.code.match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

async function main() {
  // 1. Categorías base
  const defaultCategories = [
    { slug: "INGREDIENT", name: "Ingrediente", description: "Materias primas alimenticias" },
    { slug: "PACKAGING", name: "Empaque", description: "Cajas, vasos, tapas, bolsas y envases" },
    { slug: "DECORATION", name: "Decoración", description: "Cintas, etiquetas, toppers y acabados" },
    { slug: "UTENSIL", name: "Utensilio", description: "Cucharas, capacillos y descartables" },
  ];

  const existingCats = await prisma.productCategory.findMany({ select: { code: true, slug: true } });
  let catSeq = maxSeqFromCodes(existingCats, "CAT");
  const existingCatSlugs = new Set(existingCats.map((c) => c.slug));

  for (const cat of defaultCategories) {
    if (!existingCatSlugs.has(cat.slug)) {
      catSeq += 1;
      await prisma.productCategory.create({
        data: {
          code: padCode("CAT", catSeq),
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          isActive: true,
        },
      });
    }
  }

  // 2. Unidades base
  const defaultUnits = [
    { symbol: "g", name: "Gramo", unitType: "MASS" },
    { symbol: "kg", name: "Kilogramo", unitType: "MASS" },
    { symbol: "lb", name: "Libra", unitType: "MASS" },
    { symbol: "oz", name: "Onza", unitType: "MASS" },
    { symbol: "ml", name: "Mililitro", unitType: "VOLUME" },
    { symbol: "l", name: "Litro", unitType: "VOLUME" },
    { symbol: "taza", name: "Taza", unitType: "VOLUME" },
    { symbol: "cda", name: "Cucharada", unitType: "VOLUME" },
    { symbol: "cdita", name: "Cucharadita", unitType: "VOLUME" },
    { symbol: "unidad", name: "Unidad", unitType: "COUNT" },
  ];

  const existingUnits = await prisma.measureUnit.findMany({ select: { code: true, symbol: true } });
  let unitSeq = maxSeqFromCodes(existingUnits, "UNI");
  const existingSymbols = new Set(existingUnits.map((u) => u.symbol));

  for (const unit of defaultUnits) {
    if (!existingSymbols.has(unit.symbol)) {
      unitSeq += 1;
      await prisma.measureUnit.create({
        data: {
          code: padCode("UNI", unitSeq),
          symbol: unit.symbol,
          name: unit.name,
          unitType: unit.unitType,
          isActive: true,
        },
      });
    }
  }

  // 3. Backfill códigos en tablas existentes
  const backfillModel = async (model, prefix, orderBy = { createdAt: "asc" }) => {
    const allRows = await model.findMany({ select: { id: true, code: true }, orderBy });
    let seq = maxSeqFromCodes(allRows, prefix);
    let updatedCount = 0;
    for (const row of allRows) {
      if (!row.code) {
        seq += 1;
        await model.update({
          where: { id: row.id },
          data: { code: padCode(prefix, seq) },
        });
        updatedCount += 1;
      }
    }
    return updatedCount;
  };

  const supCount = await backfillModel(prisma.supplier, "SUP");
  const cliCount = await backfillModel(prisma.customer, "CLI");
  const facCount = await backfillModel(prisma.unitConversionRef, "FAC");
  const prodCount = await backfillModel(prisma.ingredient, "PROD");

  console.log(
    JSON.stringify({
      ok: true,
      backfilled: {
        suppliers: supCount,
        customers: cliCount,
        factors: facCount,
        products: prodCount,
      },
    })
  );
}

main()
  .catch((err) => {
    console.error("Backfill error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

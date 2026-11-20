const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

async function main() {
  // 1. Buscar suplidor existente "Dume" (SUP-011) sin crear duplicados
  const dumeSupplier = await prisma.supplier.findFirst({
    where: {
      OR: [{ code: "SUP-011" }, { name: { contains: "Dume" } }],
    },
  });

  // 2. Seed idempotente de fuentes de precios RD
  const defaultSources = [
    {
      code: "sirena_do",
      name: "La Sirena (sirena.do)",
      baseUrl: "https://www.sirena.do",
      supplierId: null,
      adapterType: "VTEX_IO",
      captureMode: "AUTO",
      taxMode: "INCLUDED",
      currency: "DOP",
      rateLimitMs: 2000,
      timeoutMs: 10000,
      proposalTtlHours: 168,
      priceAlertThresholdPct: 20,
      isActive: true,
    },
    {
      code: "ntd_ingredientes",
      name: "NTD Ingredientes",
      baseUrl: "https://ntdingredientes.do",
      supplierId: null,
      adapterType: "SHOPIFY_JSON",
      captureMode: "AUTO",
      taxMode: "PLUS_ITBIS",
      currency: "DOP",
      rateLimitMs: 1500,
      timeoutMs: 10000,
      proposalTtlHours: 168,
      priceAlertThresholdPct: 20,
      isActive: true,
    },
    {
      code: "empaketeria_rd",
      name: "Empaketería RD",
      baseUrl: "https://empaketeriard.com",
      supplierId: null,
      adapterType: "SHOPIFY_JSON",
      captureMode: "AUTO",
      taxMode: "INCLUDED",
      currency: "DOP",
      rateLimitMs: 1500,
      timeoutMs: 10000,
      proposalTtlHours: 168,
      priceAlertThresholdPct: 20,
      isActive: true,
    },
    {
      code: "dume_papeleria",
      name: "Dumé Papelería",
      baseUrl: "https://dumepapeleria.com",
      supplierId: dumeSupplier ? dumeSupplier.id : null,
      adapterType: "WOOCOMMERCE_HTML",
      captureMode: "AUTO",
      taxMode: "INCLUDED",
      currency: "DOP",
      rateLimitMs: 2000,
      timeoutMs: 10000,
      proposalTtlHours: 168,
      priceAlertThresholdPct: 20,
      isActive: true,
    },
    {
      code: "canal_asistido",
      name: "Carga Asistida / Facturas / WhatsApp",
      baseUrl: null,
      supplierId: null,
      adapterType: "MANUAL_ASSISTED",
      captureMode: "ASSISTED",
      taxMode: "INCLUDED",
      currency: "DOP",
      rateLimitMs: 0,
      timeoutMs: 10000,
      proposalTtlHours: 168,
      priceAlertThresholdPct: 20,
      isActive: true,
    },
  ];

  for (const src of defaultSources) {
    await prisma.priceSource.upsert({
      where: { code: src.code },
      create: src,
      update: {
        name: src.name,
        baseUrl: src.baseUrl,
        supplierId: src.supplierId,
        adapterType: src.adapterType,
        captureMode: src.captureMode,
        taxMode: src.taxMode,
      },
    });
  }

  // 3. Asegurar categoría de gasto "Compra de Insumos" (idempotente para integración Plan B)
  await prisma.expenseCategory.upsert({
    where: { name: "Compra de Insumos" },
    create: { name: "Compra de Insumos", isActive: true },
    update: { isActive: true },
  });

  // 4. Saneamiento de auto-ciclo en "Caja de 15 Minis" (PRE-001)
  let fixedCycle = false;
  const quesillo = await prisma.recipe.findFirst({
    where: { name: { contains: "Quesillo Redondo" } },
    include: { presentations: true },
  });

  if (quesillo) {
    const caja15 = quesillo.presentations.find(
      (p) => p.parentId === p.id || (p.name.toLowerCase().includes("caja") && p.name.toLowerCase().includes("mini"))
    );

    if (caja15 && (!caja15.parentId || caja15.parentId === caja15.id)) {
      let miniVariant = quesillo.presentations.find(
        (p) =>
          p.id !== caja15.id &&
          !p.isComposite &&
          p.name.toLowerCase().includes("mini")
      );

      if (!miniVariant) {
        const batchExact =
          quesillo.batchCostExactCents > 0 ? quesillo.batchCostExactCents : quesillo.batchCostCents;
        const miniBaseExact = batchExact / 15;
        const suggested = Math.ceil(miniBaseExact / (1 - 0.35));
        const finalPrice = 6500;

        miniVariant = await prisma.recipePresentation.create({
          data: {
            recipeId: quesillo.id,
            name: "Quesillo Mini",
            sizeDescription: "1/15 de lote (por unidad)",
            consumptionMode: "YIELD_PER_BATCH",
            presentationYield: 15,
            batchFraction: 1 / 15,
            motherRecipeQty: (quesillo.yield || 8) / 15,
            motherRecipeUnit: quesillo.yieldUnit || "porciones",
            baseCostCents: Math.round(miniBaseExact),
            packagingCostCents: 0,
            additionalCostCents: 0,
            unitTotalCostExactCents: miniBaseExact,
            totalCostCents: Math.round(miniBaseExact),
            pricingMethod: "MARGIN",
            desiredMarginPercent: 35,
            suggestedPriceCents: suggested,
            finalPriceCents: finalPrice,
            realProfitCents: finalPrice - Math.round(miniBaseExact),
            realMarginPercent: Number((((finalPrice - Math.round(miniBaseExact)) / finalPrice) * 100).toFixed(2)),
            isComposite: false,
            parentId: null,
            groupQty: 1,
            isActive: true,
          },
        });
      }

      await prisma.recipePresentation.update({
        where: { id: caja15.id },
        data: {
          parentId: miniVariant.id,
          isComposite: true,
          groupQty: caja15.groupQty > 0 ? caja15.groupQty : 15,
        },
      });
      fixedCycle = true;
    }
  }

  const sourcesCount = await prisma.priceSource.count();
  console.log(JSON.stringify({ ok: true, sourcesCount, fixedCycle }));
}

main()
  .catch((err) => {
    console.error("Seed price sources error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

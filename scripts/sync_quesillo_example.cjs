const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

async function main() {
  // 1. Backfill campos exactos en todas las recetas y presentaciones existentes
  const allRecipes = await prisma.recipe.findMany({
    include: { ingredients: true, presentations: { include: { materials: true, subrecipes: true } } },
  });

  for (const r of allRecipes) {
    const sub = r.subtotalBeforeContingencyCents > 0 ? r.subtotalBeforeContingencyCents : r.batchCostCents;
    const exact = r.batchCostExactCents > 0 ? r.batchCostExactCents : sub * (1 + (r.contingencyPercent || 0) / 100);
    await prisma.recipe.update({
      where: { id: r.id },
      data: {
        subtotalBeforeContingencyCents: sub,
        batchCostExactCents: exact,
      },
    });

    for (const p of r.presentations) {
      if (p.unitTotalCostExactCents <= 0) {
        const fraction =
          p.parentId
            ? p.batchFraction
            : r.yield > 0 && p.motherRecipeQty > 0
            ? p.motherRecipeQty / r.yield
            : 1;
        const presYield = fraction > 0 ? 1 / fraction : 1;
        const baseExact = exact * fraction;
        await prisma.recipePresentation.update({
          where: { id: p.id },
          data: {
            batchFraction: fraction,
            presentationYield: presYield,
            baseCostCents: Math.round(baseExact),
            unitTotalCostExactCents: p.totalCostCents > 0 ? p.totalCostCents : baseExact,
          },
        });
      }
    }
  }

  // 2. Sincronizar caso testigo del Excel: "Producción de Quesillo Redondo"
  const quesillo = await prisma.recipe.findFirst({
    where: { name: { contains: "Quesillo Redondo" } },
    include: { ingredients: true, presentations: { include: { materials: true, subrecipes: true } } },
  });

  if (!quesillo) {
    console.log(JSON.stringify({ ok: true, note: "No Quesillo Redondo recipe found to sync" }));
    return;
  }

  // Exacto del Excel hoja "Quesillos": Ingredientes 312.0462442, Overhead 30%, MO 50% -> 561.6832396 RD$
  const exactBatchCents = 56168.32396;
  await prisma.recipe.update({
    where: { id: quesillo.id },
    data: {
      laborPercent: 50,
      overheadPercent: 30,
      contingencyPercent: 0,
      subtotalBeforeContingencyCents: 56168,
      batchCostExactCents: exactBatchCents,
      batchCostCents: 56168,
      unitCostCents: Math.round(exactBatchCents / (quesillo.yield || 8)),
      costPerYieldUnit: exactBatchCents / (quesillo.yield || 8),
      commercialRefCents: 78636, // RD$786.36 (40% recargo comercial del Excel, marcado para revisión)
      reviewFlag: true,
      notes:
        "Excel hoja Quesillos: Costo lote antes de contingencia RD$561.68. Referencia comercial Excel (recargo 40%): RD$786.36.",
    },
  });

  const upsertVariant = async (matchName, payload) => {
    const existing = quesillo.presentations.find((p) =>
      p.name.toLowerCase().includes(matchName.toLowerCase())
    );
    if (existing) {
      return await prisma.recipePresentation.update({
        where: { id: existing.id },
        data: payload,
      });
    }
    return await prisma.recipePresentation.create({
      data: {
        recipeId: quesillo.id,
        ...payload,
      },
    });
  };

  // A) Quesillo Empacado Triangular (8 por lote -> RD$70.21)
  const triPkg = 2230; // Envase 13 + Cherry 3.30 + Etiqueta 6.00 = 22.30 RD$
  const triBaseExact = exactBatchCents / 8;
  const triTotalExact = triBaseExact + triPkg;
  const triSuggested = Math.ceil(triTotalExact / (1 - 0.35));
  await upsertVariant("Triangular", {
    name: "Quesillo Empacado Triangular",
    sizeDescription: "1 porción (1/8 de lote)",
    consumptionMode: "YIELD_PER_BATCH",
    presentationYield: 8,
    batchFraction: 1 / 8,
    motherRecipeQty: (quesillo.yield || 8) / 8,
    motherRecipeUnit: quesillo.yieldUnit || "porciones",
    baseCostCents: Math.round(triBaseExact),
    packagingCostCents: triPkg,
    additionalCostCents: 0,
    unitTotalCostExactCents: triTotalExact,
    totalCostCents: Math.round(triTotalExact),
    pricingMethod: "MARGIN",
    desiredMarginPercent: 35,
    suggestedPriceCents: triSuggested,
    finalPriceCents: 15000,
    realProfitCents: 15000 - Math.round(triTotalExact),
    realMarginPercent: Number((((15000 - Math.round(triTotalExact)) / 15000) * 100).toFixed(2)),
    isComposite: false,
    parentId: null,
    isActive: true,
  });

  // B) Quesillo Mediano Redondo (1/2 lote -> RD$280.84)
  const medPkg = 15157; // Grageas 16.76 + Envase 45 + Dulce leche 32.82 + Etiqueta 6 + Base 30 + Lazo 21
  const medBaseExact = exactBatchCents * 0.5;
  const medTotalExact = medBaseExact + medPkg;
  const medSuggested = Math.ceil(medTotalExact * 1.33);
  await upsertVariant("Mediano", {
    name: "Quesillo Mediano Redondo",
    sizeDescription: "1/2 lote",
    consumptionMode: "BATCH_FRACTION",
    presentationYield: 2,
    batchFraction: 0.5,
    motherRecipeQty: (quesillo.yield || 8) * 0.5,
    motherRecipeUnit: quesillo.yieldUnit || "porciones",
    baseCostCents: Math.round(medBaseExact),
    packagingCostCents: medPkg,
    additionalCostCents: 0,
    unitTotalCostExactCents: medTotalExact,
    totalCostCents: Math.round(medTotalExact),
    pricingMethod: "MARKUP",
    desiredMarginPercent: 33,
    suggestedPriceCents: medSuggested,
    finalPriceCents: 60000,
    realProfitCents: 60000 - Math.round(medTotalExact),
    realMarginPercent: Number((((60000 - Math.round(medTotalExact)) / 60000) * 100).toFixed(2)),
    isComposite: false,
    parentId: null,
    isActive: true,
  });

  // C) Quesillo Mini (15 por lote -> RD$37.45 antes de extras; sin empaque individual por defecto para validar base exacta)
  const miniBaseExact = exactBatchCents / 15;
  const miniSuggested = Math.ceil(miniBaseExact / (1 - 0.35));
  const miniVariant = await upsertVariant("Mini", {
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
    suggestedPriceCents: miniSuggested,
    finalPriceCents: 6500,
    realProfitCents: 6500 - Math.round(miniBaseExact),
    realMarginPercent: Number((((6500 - Math.round(miniBaseExact)) / 6500) * 100).toFixed(2)),
    isComposite: false,
    parentId: null,
    isActive: true,
  });

  // C.1) Presentación Agrupada: Caja de 15 Minis (+ RD$50 caja una sola vez)
  const existingBox = quesillo.presentations.find(
    (p) => p.name.toLowerCase().includes("caja") && p.name.toLowerCase().includes("mini")
  );
  const boxGroupBase = miniBaseExact * 15; // 56168.32396 -> RD$561.68
  const boxPkg = 5000; // RD$50.00 una sola vez por la caja
  const boxTotalExact = boxGroupBase + boxPkg;
  const boxSuggested = Math.ceil(boxTotalExact / (1 - 0.35));

  if (existingBox) {
    await prisma.recipePresentation.update({
      where: { id: existingBox.id },
      data: {
        parentId: miniVariant.id,
        isComposite: true,
        groupQty: 15,
        name: "Caja de 15 Minis",
        sizeDescription: "Caja x 15 minis",
        baseCostCents: Math.round(boxGroupBase),
        packagingCostCents: boxPkg,
        additionalCostCents: 0,
        unitTotalCostExactCents: boxTotalExact,
        totalCostCents: Math.round(boxTotalExact),
        pricingMethod: "MARGIN",
        desiredMarginPercent: 35,
        suggestedPriceCents: boxSuggested,
        finalPriceCents: existingBox.finalPriceCents > 0 ? existingBox.finalPriceCents : boxSuggested,
      },
    });
    const matCount = await prisma.presentationMaterial.count({ where: { presentationId: existingBox.id } });
    if (matCount === 0) {
      await prisma.presentationMaterial.create({
        data: {
          presentationId: existingBox.id,
          materialType: "PACKAGING",
          name: "Caja para 15 Minis",
          quantity: 1,
          unit: "unidad",
          unitCostCents: 5000,
          totalCostCents: 5000,
        },
      });
    }
  } else {
    await prisma.recipePresentation.create({
      data: {
        recipeId: quesillo.id,
        parentId: miniVariant.id,
        isComposite: true,
        groupQty: 15,
        name: "Caja de 15 Minis",
        sizeDescription: "Caja x 15 minis",
        consumptionMode: "YIELD_PER_BATCH",
        batchFraction: 1,
        motherRecipeQty: quesillo.yield || 8,
        motherRecipeUnit: quesillo.yieldUnit || "porciones",
        presentationYield: 1,
        baseCostCents: Math.round(boxGroupBase),
        packagingCostCents: boxPkg,
        additionalCostCents: 0,
        unitTotalCostExactCents: boxTotalExact,
        totalCostCents: Math.round(boxTotalExact),
        pricingMethod: "MARGIN",
        desiredMarginPercent: 35,
        suggestedPriceCents: boxSuggested,
        finalPriceCents: boxSuggested,
        realProfitCents: boxSuggested - Math.round(boxTotalExact),
        realMarginPercent: Number((((boxSuggested - Math.round(boxTotalExact)) / boxSuggested) * 100).toFixed(2)),
        isActive: true,
        materials: {
          create: [
            {
              materialType: "PACKAGING",
              name: "Caja para 15 Minis",
              quantity: 1,
              unit: "unidad",
              unitCostCents: 5000,
              totalCostCents: 5000,
            },
          ],
        },
      },
    });
  }

  // D) Quesillo Redondo Completo (1 lote entero -> RD$561.68)
  const fullPkg = 25611; // Lazo + Cherry + Dulce Leche + Etiqueta + Caja + Base + Tarjeta + Topper
  const fullTotalExact = exactBatchCents + fullPkg;
  const fullSuggested = Math.ceil(fullTotalExact * 1.3);
  await upsertVariant("Grande", {
    name: "Quesillo Redondo Completo",
    sizeDescription: "1 lote entero",
    consumptionMode: "BATCH_FRACTION",
    presentationYield: 1,
    batchFraction: 1,
    motherRecipeQty: quesillo.yield || 8,
    motherRecipeUnit: quesillo.yieldUnit || "porciones",
    baseCostCents: Math.round(exactBatchCents),
    packagingCostCents: fullPkg,
    additionalCostCents: 0,
    unitTotalCostExactCents: fullTotalExact,
    totalCostCents: Math.round(fullTotalExact),
    pricingMethod: "MARKUP",
    desiredMarginPercent: 30,
    suggestedPriceCents: fullSuggested,
    finalPriceCents: 115000,
    realProfitCents: 115000 - Math.round(fullTotalExact),
    realMarginPercent: Number((((115000 - Math.round(fullTotalExact)) / 115000) * 100).toFixed(2)),
    isComposite: false,
    parentId: null,
    isActive: true,
  });

  console.log(JSON.stringify({ ok: true, quesilloId: quesillo.id, batchCostRD: (exactBatchCents / 100).toFixed(2) }));
}

main()
  .catch((err) => {
    console.error("Sync error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

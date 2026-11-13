// Script idempotente para poblar todas las Recetas Madre y Presentaciones Derivadas
// del Excel maestro de K_Sweet siguiendo el modelo "Bronie receta 2"
// Conserva ventas, clientes y gastos existentes.

const { PrismaClient } = require("../src/generated/client");
const prisma = new PrismaClient();

function calcMotherCosts(ingredientsCostCents, overheadPercent, laborPercent, yieldQty) {
  const overheadCents = Math.round((ingredientsCostCents * overheadPercent) / 100);
  const laborCents = Math.round((ingredientsCostCents * laborPercent) / 100);
  const batchCostCents = ingredientsCostCents + overheadCents + laborCents;
  const validYield = yieldQty > 0 ? yieldQty : 1;
  const costPerYieldUnit = batchCostCents / validYield;
  const unitCostCents = Math.round(costPerYieldUnit);
  return { batchCostCents, unitCostCents, costPerYieldUnit };
}

function calcPresValues(motherBatchYield, motherCostPerYieldUnit, motherRecipeQty, materials, desiredMarginPercent, pricingMethod = "MARGIN", manualFinalPriceCents = null) {
  let packagingCostCents = 0;
  for (const m of materials) {
    packagingCostCents += m.totalCostCents;
  }
  const baseCostCents = Math.round(motherCostPerYieldUnit * motherRecipeQty);
  const totalCostCents = baseCostCents + packagingCostCents;
  const presentationYield = motherRecipeQty > 0 ? motherBatchYield / motherRecipeQty : 1;

  let suggestedPriceCents = totalCostCents;
  if (pricingMethod === "MARGIN") {
    const m = Math.min(desiredMarginPercent, 99) / 100;
    suggestedPriceCents = Math.ceil(totalCostCents / (1 - m));
  } else {
    const r = desiredMarginPercent / 100;
    suggestedPriceCents = Math.ceil(totalCostCents * (1 + r));
  }

  // Redondeo amigable a 5 o 10 pesos si no hay precio manual
  const finalPriceCents = manualFinalPriceCents || Math.ceil(suggestedPriceCents / 500) * 500;
  const realProfitCents = finalPriceCents - totalCostCents;
  const realMarginPercent = finalPriceCents > 0 ? Number(((realProfitCents / finalPriceCents) * 100).toFixed(2)) : 0;

  return {
    packagingCostCents,
    totalCostCents,
    presentationYield,
    suggestedPriceCents,
    finalPriceCents,
    realProfitCents,
    realMarginPercent,
  };
}

async function ensureIngredient(name, category, costPerBaseUnitDOP, baseUnit = "g", pkgPriceDOP = null, pkgQty = 1, importedFrom = "Excel Maestro") {
  const existing = await prisma.ingredient.findFirst({ where: { name } });
  if (existing) return existing;

  const packagePriceCents = Math.round((pkgPriceDOP !== null ? pkgPriceDOP : costPerBaseUnitDOP * pkgQty) * 100);
  return prisma.ingredient.create({
    data: {
      name,
      category,
      packagePriceCents,
      packageQty: pkgQty,
      packageUnit: baseUnit,
      baseUnit,
      costPerBaseUnit: costPerBaseUnitDOP,
      isActive: true,
      importedFrom,
    },
  });
}

async function upsertMotherRecipe(data) {
  const existing = await prisma.recipe.findFirst({ where: { slug: data.slug } });
  const ingList = [];
  let ingredientsCostCents = 0;

  for (const item of data.ingredients) {
    const ing = await ensureIngredient(
      item.name,
      item.category || "INGREDIENT",
      item.unitCostDOP,
      item.unit,
      item.pkgPriceDOP || null,
      item.pkgQty || 1,
      data.importedFrom
    );
    const lineCostCents = Math.round(item.unitCostDOP * item.quantity * 100);
    ingredientsCostCents += lineCostCents;
    ingList.push({
      ingredientId: ing.id,
      quantity: item.quantity,
      unit: item.unit,
      costCents: lineCostCents,
    });
  }

  const costs = calcMotherCosts(ingredientsCostCents, data.overheadPercent, data.laborPercent, data.yield);
  const marginFraction = (data.targetMargin || 30) / 100;
  const suggestedPriceCents = marginFraction < 1 ? Math.ceil(costs.unitCostCents / (1 - marginFraction)) : costs.unitCostCents;

  let recipe;
  if (existing) {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
    recipe = await prisma.recipe.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        recipeType: data.recipeType || "MOTHER",
        description: data.description,
        yield: data.yield,
        yieldUnit: data.yieldUnit,
        overheadPercent: data.overheadPercent,
        laborPercent: data.laborPercent,
        targetMargin: data.targetMargin,
        batchCostCents: costs.batchCostCents,
        unitCostCents: costs.unitCostCents,
        costPerYieldUnit: costs.costPerYieldUnit,
        suggestedPriceCents,
        currentPriceCents: suggestedPriceCents,
        importedFrom: data.importedFrom,
        ingredients: { create: ingList },
      },
    });
  } else {
    recipe = await prisma.recipe.create({
      data: {
        name: data.name,
        slug: data.slug,
        recipeType: data.recipeType || "MOTHER",
        description: data.description,
        yield: data.yield,
        yieldUnit: data.yieldUnit,
        overheadPercent: data.overheadPercent,
        laborPercent: data.laborPercent,
        targetMargin: data.targetMargin,
        batchCostCents: costs.batchCostCents,
        unitCostCents: costs.unitCostCents,
        costPerYieldUnit: costs.costPerYieldUnit,
        suggestedPriceCents,
        currentPriceCents: suggestedPriceCents,
        status: "ACTIVE",
        importedFrom: data.importedFrom,
        ingredients: { create: ingList },
      },
    });
  }

  // Upsert Presentations
  for (const pres of data.presentations) {
    const formattedMaterials = [];
    for (const m of pres.materials || []) {
      const matIng = await ensureIngredient(m.name, m.category || "PACKAGING", m.unitCostDOP, m.unit);
      const unitCostCents = Math.round(m.unitCostDOP * 100);
      const totalCostCents = Math.round(m.unitCostDOP * m.quantity * 100);
      formattedMaterials.push({
        ingredientId: matIng.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        unitCostCents,
        totalCostCents,
      });
    }

    const pVals = calcPresValues(
      recipe.yield,
      recipe.costPerYieldUnit,
      pres.motherRecipeQty,
      formattedMaterials,
      pres.desiredMarginPercent,
      pres.pricingMethod || "MARGIN",
      pres.manualFinalPriceCents || null
    );

    const existingPres = await prisma.recipePresentation.findFirst({
      where: { recipeId: recipe.id, name: pres.name },
    });

    if (existingPres) {
      await prisma.presentationMaterial.deleteMany({ where: { presentationId: existingPres.id } });
      await prisma.recipePresentation.update({
        where: { id: existingPres.id },
        data: {
          sizeDescription: pres.sizeDescription,
          motherRecipeQty: pres.motherRecipeQty,
          motherRecipeUnit: pres.motherRecipeUnit || recipe.yieldUnit,
          presentationYield: pVals.presentationYield,
          packagingCostCents: pVals.packagingCostCents,
          totalCostCents: pVals.totalCostCents,
          pricingMethod: pres.pricingMethod || "MARGIN",
          desiredMarginPercent: pres.desiredMarginPercent,
          suggestedPriceCents: pVals.suggestedPriceCents,
          finalPriceCents: existingPres.finalPriceCents > 0 ? existingPres.finalPriceCents : pVals.finalPriceCents,
          realProfitCents: (existingPres.finalPriceCents > 0 ? existingPres.finalPriceCents : pVals.finalPriceCents) - pVals.totalCostCents,
          realMarginPercent: Number(((((existingPres.finalPriceCents > 0 ? existingPres.finalPriceCents : pVals.finalPriceCents) - pVals.totalCostCents) / (existingPres.finalPriceCents > 0 ? existingPres.finalPriceCents : pVals.finalPriceCents)) * 100).toFixed(2)),
          isComposite: pres.isComposite || false,
          notes: pres.notes || null,
          materials: { create: formattedMaterials },
        },
      });
    } else {
      await prisma.recipePresentation.create({
        data: {
          recipeId: recipe.id,
          name: pres.name,
          sizeDescription: pres.sizeDescription,
          motherRecipeQty: pres.motherRecipeQty,
          motherRecipeUnit: pres.motherRecipeUnit || recipe.yieldUnit,
          presentationYield: pVals.presentationYield,
          packagingCostCents: pVals.packagingCostCents,
          additionalCostCents: 0,
          totalCostCents: pVals.totalCostCents,
          pricingMethod: pres.pricingMethod || "MARGIN",
          desiredMarginPercent: pres.desiredMarginPercent,
          suggestedPriceCents: pVals.suggestedPriceCents,
          finalPriceCents: pVals.finalPriceCents,
          realProfitCents: pVals.realProfitCents,
          realMarginPercent: pVals.realMarginPercent,
          isActive: true,
          isComposite: pres.isComposite || false,
          notes: pres.notes || null,
          materials: { create: formattedMaterials },
        },
      });
    }
  }

  return recipe;
}

async function main() {
  console.log("=== IMPORTANDO MODELO RECETA MADRE + PRESENTACIONES PARA TODAS LAS RECETAS ===");

  const recipesData = [
    // 1. Producción de Brownie (Modelo exacto Bronie receta 2)
    {
      name: "Producción de Brownie (Modelo Receta 2)",
      slug: "produccion-brownie-receta-2",
      description: "Receta madre estándar de brownies húmedos (lote de 15 porciones o 25 mini porciones).",
      yield: 15,
      yieldUnit: "porciones",
      overheadPercent: 30,
      laborPercent: 40,
      targetMargin: 60,
      importedFrom: "Bronie receta 2",
      ingredients: [
        { name: "Tableta Chocolate", unitCostDOP: 11.1667, quantity: 5, unit: "unidad" },
        { name: "Cocoa Amarga", unitCostDOP: 0.4409, quantity: 75, unit: "g" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.2138, quantity: 200, unit: "g" },
        { name: "Azúcar Blanca", unitCostDOP: 0.0882, quantity: 200, unit: "g" },
        { name: "Azúcar Morena", unitCostDOP: 0.0705, quantity: 200, unit: "g" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.3333, quantity: 6, unit: "unidad" },
        { name: "Vainilla", unitCostDOP: 0.0661, quantity: 5, unit: "g" },
        { name: "Harina de Trigo", unitCostDOP: 0.4591, quantity: 120, unit: "g" },
        { name: "Sal", unitCostDOP: 5.0, quantity: 1, unit: "g" },
      ],
      presentations: [
        {
          name: "Brownies Sin Topping (Unidad)",
          sizeDescription: "1 porción individual de 15 del lote en capacillo y fundita",
          motherRecipeQty: 1,
          desiredMarginPercent: 40,
          materials: [
            { name: "Capacillos Pequeños", unitCostDOP: 0.3, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Empaque Fundita", unitCostDOP: 2.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Brownies Con Topping (Lote 12 uds)",
          sizeDescription: "12 porciones decoradas con dulce de leche y grageas en caja",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 80, unit: "g", category: "INGREDIENT" },
            { name: "Grageas Doradas", unitCostDOP: 3.351, quantity: 30, unit: "g", category: "DECORATION" },
            { name: "Capacillos Pequeños", unitCostDOP: 0.3, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Mini Brownies (Caja 25 porciones)",
          sizeDescription: "Extrae 25 mini porciones del lote completo (15 porciones = 1 lote)",
          motherRecipeQty: 15,
          isComposite: true,
          desiredMarginPercent: 35,
          notes: "Rinde 25 mini brownies decorados por caja.",
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Grageas Doradas", unitCostDOP: 3.351, quantity: 25, unit: "g", category: "DECORATION" },
            { name: "Capacillos Mini", unitCostDOP: 2.5, quantity: 25, unit: "unidad", category: "PACKAGING" },
            { name: "Galleta Oreo", unitCostDOP: 15.0, quantity: 1, unit: "unidad", category: "INGREDIENT" },
            { name: "Chocolate Barra", unitCostDOP: 65.0, quantity: 1, unit: "unidad", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Box 12 Brownies Especial",
          sizeDescription: "Caja de 12 brownies con topping, Snickers y lazo",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Capacillos Pequeños", unitCostDOP: 0.3, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Caja Especial 150", unitCostDOP: 150.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Cinta San Valentín", unitCostDOP: 22.8, quantity: 2, unit: "yarda", category: "DECORATION" },
            { name: "Grageas Doradas", unitCostDOP: 3.351, quantity: 12, unit: "g", category: "DECORATION" },
            { name: "Snickers", unitCostDOP: 70.0, quantity: 1, unit: "unidad", category: "INGREDIENT" },
            { name: "Tarjeta Mensaje", unitCostDOP: 20.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Brownie Cuadrado Mediano (1/2 Lote)",
          sizeDescription: "Medio lote (7.5 porciones) decorado con Oreos, perlas crispadas y base",
          motherRecipeQty: 7.5,
          desiredMarginPercent: 35,
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 150, unit: "g", category: "INGREDIENT" },
            { name: "Grageas Doradas", unitCostDOP: 3.351, quantity: 5, unit: "g", category: "DECORATION" },
            { name: "Galleta Oreo", unitCostDOP: 15.0, quantity: 2, unit: "unidad", category: "INGREDIENT" },
            { name: "Chocolate Barra", unitCostDOP: 65.0, quantity: 1, unit: "unidad", category: "INGREDIENT" },
            { name: "Base Cartón #12", unitCostDOP: 55.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Caja 16x12x3 Blanca", unitCostDOP: 46.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Brownie Cuadrado Grande (1 Lote)",
          sizeDescription: "Lote completo (15 porciones) con Kinder, fresas y toppings premium",
          motherRecipeQty: 15,
          desiredMarginPercent: 35,
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 300, unit: "g", category: "INGREDIENT" },
            { name: "Chocolate Kinder", unitCostDOP: 140.0, quantity: 3, unit: "unidad", category: "INGREDIENT" },
            { name: "Fresas Frescas (Lote)", unitCostDOP: 200.0, quantity: 1, unit: "unidad", category: "INGREDIENT" },
            { name: "Base Cartón #12", unitCostDOP: 55.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 2. Fresas Bañadas en Chocolate (Completar ingredientes)
    {
      name: "Fresas Bañadas en Chocolate",
      slug: "fresas-banadas-en-chocolate",
      description: "Lote base de 25 fresas cubiertas en chocolate blanco y grageas.",
      yield: 25,
      yieldUnit: "unidades",
      overheadPercent: 20,
      laborPercent: 30,
      targetMargin: 40,
      importedFrom: "Fresas",
      ingredients: [
        { name: "Fresa Fresca", unitCostDOP: 13.8889, quantity: 25, unit: "unidad" },
        { name: "Cobertura Disco Blanca", unitCostDOP: 0.75, quantity: 350, unit: "g" },
        { name: "Grageas (mm/g)", unitCostDOP: 0.28, quantity: 25, unit: "g", category: "DECORATION" },
        { name: "Capacillos Fresas", unitCostDOP: 2.0, quantity: 25, unit: "unidad", category: "PACKAGING" },
      ],
      presentations: [
        {
          name: "Caja de Fresas Bañadas (6 uds)",
          sizeDescription: "Caja rosada con 6 fresas bañadas, pajín, lazo y etiqueta",
          motherRecipeQty: 6,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Caja Rosada 6/1", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Lazo Decorativo", unitCostDOP: 22.22, quantity: 1.5, unit: "yarda", category: "DECORATION" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Tarjeta Mensaje", unitCostDOP: 10.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Caja de Fresas Bañadas (8 uds)",
          sizeDescription: "Caja con 8 fresas bañadas y papel triturado",
          motherRecipeQty: 8,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Papel Triturado", unitCostDOP: 110.0, quantity: 0.5, unit: "lb", category: "PACKAGING" },
            { name: "Caja Rosada 6/1", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Lazo Decorativo", unitCostDOP: 22.22, quantity: 1.5, unit: "yarda", category: "DECORATION" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 3. Mousse de Chinola
    {
      name: "Mousse de Chinola",
      slug: "mousse-de-chinola",
      description: "Receta madre de mousse cremoso de maracuyá/chinola (rinde 15 shots de 2oz o 20 de 1oz).",
      yield: 15,
      yieldUnit: "porciones",
      overheadPercent: 10,
      laborPercent: 20,
      targetMargin: 40,
      importedFrom: "Mousse de Chinola",
      ingredients: [
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Leche Carnation", unitCostDOP: 70.0, quantity: 1, unit: "lata" },
        { name: "Pulpa de Chinola (Taza)", unitCostDOP: 200.0, quantity: 1, unit: "taza" },
        { name: "Gelatina sin Sabor", unitCostDOP: 0.1235, quantity: 150, unit: "g" },
        { name: "Azúcar Blanca", unitCostDOP: 0.0761, quantity: 150, unit: "g" },
      ],
      presentations: [
        {
          name: "Shots de Mousse Chinola 2 oz (Caja 15 uds)",
          sizeDescription: "15 vasitos de 2 oz con cucharitas, topping de chinola y caja",
          motherRecipeQty: 15,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso de Shots 2oz", unitCostDOP: 6.48, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Tope de Chinola", unitCostDOP: 6.5625, quantity: 15, unit: "porción", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Shots de Mousse Chinola 1 oz (Caja 12 uds)",
          sizeDescription: "12 vasitos de 1 oz (consume 9 porciones de 2 oz) con cucharitas y topping",
          motherRecipeQty: 9,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso de Shots 1oz", unitCostDOP: 5.9, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Tope de Chinola", unitCostDOP: 6.5625, quantity: 12, unit: "porción", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Mousse de Chinola Vaso 4 oz (Individual)",
          sizeDescription: "Vaso individual de 4 oz (consume 2.5 porciones base)",
          motherRecipeQty: 2.5,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso 5oz con Tapa", unitCostDOP: 9.8, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 4. Mousse de Fresa
    {
      name: "Mousse de Fresa",
      slug: "mousse-de-fresa",
      description: "Receta madre de mousse de fresa natural (rinde 15 shots de 2oz).",
      yield: 15,
      yieldUnit: "porciones",
      overheadPercent: 10,
      laborPercent: 10,
      targetMargin: 30,
      importedFrom: "Mousse de Fresa",
      ingredients: [
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Crema de Leche", unitCostDOP: 165.0, quantity: 1, unit: "unidad" },
        { name: "Fresa Fresca", unitCostDOP: 21.5, quantity: 12, unit: "unidad" },
        { name: "Gelatina sin Sabor", unitCostDOP: 0.1235, quantity: 150, unit: "g" },
      ],
      presentations: [
        {
          name: "Shots de Mousse Fresa 2 oz (Docena)",
          sizeDescription: "12 shots de 2 oz con tope de fresa y cucharitas",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso de Shots 2oz", unitCostDOP: 6.48, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Tope de Fresa", unitCostDOP: 7.16, quantity: 12, unit: "porción", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Shots de Mousse Fresa 1 oz (Docena)",
          sizeDescription: "12 shots de 1 oz (consume 9 porciones base)",
          motherRecipeQty: 9,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso de Shots 1oz", unitCostDOP: 4.5, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Tope de Fresa", unitCostDOP: 7.16, quantity: 12, unit: "porción", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 5. Tres Leches
    {
      name: "Tres Leches Artesanal",
      slug: "tres-leches-artesanal",
      description: "Bizcocho esponjoso bañado en mezcla tres leches (rinde 10 porciones estándar).",
      yield: 10,
      yieldUnit: "porciones",
      overheadPercent: 15,
      laborPercent: 30,
      targetMargin: 20,
      importedFrom: "Tres Leche",
      ingredients: [
        { name: "Bizcocho Base", unitCostDOP: 200.0, quantity: 1, unit: "unidad" },
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Leche Carnation", unitCostDOP: 69.0, quantity: 1, unit: "lata" },
        { name: "Crema de Leche", unitCostDOP: 165.0, quantity: 1, unit: "unidad" },
        { name: "Vainilla", unitCostDOP: 10.0, quantity: 1, unit: "cda" },
        { name: "Limón Ralladura", unitCostDOP: 14.0, quantity: 1, unit: "unidad" },
      ],
      presentations: [
        {
          name: "Tres Leches Vaso 9 oz (Individual)",
          sizeDescription: "Vaso 9 oz con tapa domo, dulce de leche y frutas (rinde 7 vasos por lote)",
          motherRecipeQty: 1.4286,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso Plástico Tapa Domo 9oz", unitCostDOP: 9.8, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 7, unit: "g", category: "INGREDIENT" },
            { name: "Cóctel de Frutas", unitCostDOP: 18.0, quantity: 1, unit: "porción", category: "INGREDIENT" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Tres Leches Vaso 5 oz (Individual)",
          sizeDescription: "Vaso 5 oz con topping (rinde 11 vasos por lote)",
          motherRecipeQty: 0.9091,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso Plástico Tapa Domo 9oz", unitCostDOP: 9.8, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Cóctel de Frutas", unitCostDOP: 18.0, quantity: 1, unit: "porción", category: "INGREDIENT" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Tres Leches Shots 1 oz (Caja 12 uds)",
          sizeDescription: "12 shots de 1 oz para eventos (consume 4.8 porciones del lote)",
          motherRecipeQty: 4.8,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso de Shots 1oz", unitCostDOP: 5.9, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Tres Leches Shots 2 oz (Caja 15 uds)",
          sizeDescription: "15 shots de 2 oz para eventos (consume 7.5 porciones del lote)",
          motherRecipeQty: 7.5,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso de Shots 2oz", unitCostDOP: 6.48, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 6. Carlota de Limón
    {
      name: "Carlota de Limón",
      slug: "carlota-de-limon",
      description: "Postre frío de limón y galletas María (rinde 6 porciones grandes).",
      yield: 6,
      yieldUnit: "porciones",
      overheadPercent: 20,
      laborPercent: 50,
      targetMargin: 30,
      importedFrom: "Carlota de Limón",
      ingredients: [
        { name: "Leche Carnation", unitCostDOP: 70.0, quantity: 1, unit: "lata" },
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Limones Frescos", unitCostDOP: 15.0, quantity: 4, unit: "unidad" },
        { name: "Galletas María", unitCostDOP: 41.25, quantity: 1.5, unit: "paquete" },
        { name: "Limón Ralladura", unitCostDOP: 14.0, quantity: 1, unit: "unidad" },
      ],
      presentations: [
        {
          name: "Carlota de Limón Individual",
          sizeDescription: "Porción individual de 1/6 de lote en envase de 9 oz",
          motherRecipeQty: 1,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso Plástico Tapa Domo 9oz", unitCostDOP: 9.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Carlota de Limón Grande (Familiar)",
          sizeDescription: "Lote completo (6 porciones) en envase grande con decoración",
          motherRecipeQty: 6,
          desiredMarginPercent: 35,
          materials: [
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Decoración Especial", unitCostDOP: 38.0, quantity: 1, unit: "unidad", category: "DECORATION" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Mini Carlota Vaso 2 oz (Caja 15 uds)",
          sizeDescription: "15 vasitos de 2 oz (consume 1 lote completo) con cucharitas y ralladura",
          motherRecipeQty: 6,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso de Shots 2oz", unitCostDOP: 6.48, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 2.5, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Mini Carlota Vaso 1 oz (Caja 12 uds)",
          sizeDescription: "12 vasitos de 1 oz (extrae 20 porciones del lote -> consume 3.6 porciones)",
          motherRecipeQty: 3.6,
          isComposite: true,
          desiredMarginPercent: 40,
          materials: [
            { name: "Vaso de Shots 1oz", unitCostDOP: 5.9, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 60.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 7. Producción de Quesillo Redondo
    {
      name: "Producción de Quesillo Redondo",
      slug: "produccion-quesillo-redondo",
      description: "Quesillo tradicional cremoso (rinde 8 porciones triangulares).",
      yield: 8,
      yieldUnit: "porciones",
      overheadPercent: 30,
      laborPercent: 50,
      targetMargin: 40,
      importedFrom: "Producción de Quesillo",
      ingredients: [
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Leche Carnation", unitCostDOP: 70.0, quantity: 1.5, unit: "lata" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.3333, quantity: 6, unit: "unidad" },
        { name: "Vainilla", unitCostDOP: 5.0, quantity: 1, unit: "cda" },
        { name: "Azúcar Blanca", unitCostDOP: 0.0882, quantity: 250, unit: "g" },
      ],
      presentations: [
        {
          name: "Quesillo Empacado Triangular (Porción)",
          sizeDescription: "1 porción triangular (1/8 lote) con cherry y envase triangular",
          motherRecipeQty: 1,
          desiredMarginPercent: 35,
          materials: [
            { name: "Bandeja Triangular Quesillo", unitCostDOP: 13.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Cherry", unitCostDOP: 0.6592, quantity: 5, unit: "g", category: "INGREDIENT" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Quesillo Mediano Redondo (1/2 Lote)",
          sizeDescription: "Medio quesillo redondo (4 porciones) con dulce de leche y grageas",
          motherRecipeQty: 4,
          desiredMarginPercent: 35,
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Grageas Doradas", unitCostDOP: 3.351, quantity: 5, unit: "g", category: "DECORATION" },
            { name: "Envase Redondo 45", unitCostDOP: 45.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Base Plateada Mediana", unitCostDOP: 30.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Quesillo Grande Completo (8 Porciones)",
          sizeDescription: "Quesillo entero con cherry, dulce de leche, caja y tarjeta",
          motherRecipeQty: 8,
          desiredMarginPercent: 35,
          materials: [
            { name: "Cherry", unitCostDOP: 0.6592, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 100, unit: "g", category: "INGREDIENT" },
            { name: "Caja 16x12x3 Blanca", unitCostDOP: 46.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Base Plateada Mediana", unitCostDOP: 30.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Tarjeta Mensaje", unitCostDOP: 20.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Quesillo Mini (Caja 15 uds)",
          sizeDescription: "15 mini quesillos en bowls gourmet con cucharitas y grageas (1 lote)",
          motherRecipeQty: 8,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Bowl Gourmet", unitCostDOP: 16.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 90, unit: "g", category: "INGREDIENT" },
            { name: "Grageas Doradas", unitCostDOP: 3.125, quantity: 15, unit: "g", category: "DECORATION" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 8. Chocoflan
    {
      name: "Chocoflan (Bizcocho Chocolate + Quesillo)",
      slug: "chocoflan-artesanal",
      description: "Combinación de bizcocho de chocolate húmedo y quesillo (rinde 8 porciones grandes).",
      yield: 8,
      yieldUnit: "porciones",
      overheadPercent: 30,
      laborPercent: 40,
      targetMargin: 30,
      importedFrom: "Chocoflan",
      ingredients: [
        { name: "Mezcla Betty Cake Chocolate", unitCostDOP: 345.0, quantity: 1, unit: "caja" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.2138, quantity: 250, unit: "g" },
        { name: "Leche Entera", unitCostDOP: 70.0, quantity: 0.7, unit: "litro" },
        { name: "Aceite", unitCostDOP: 169.31, quantity: 0.1, unit: "litro" },
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Leche Carnation", unitCostDOP: 70.0, quantity: 1, unit: "lata" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.3333, quantity: 8, unit: "unidad" },
        { name: "Azúcar Blanca", unitCostDOP: 0.0705, quantity: 250, unit: "g" },
      ],
      presentations: [
        {
          name: "Chocoflan Grande (Completo)",
          sizeDescription: "Chocoflan completo (8 porciones) con topping de dulce de leche y caja",
          motherRecipeQty: 8,
          desiredMarginPercent: 35,
          materials: [
            { name: "Base Cartón #12", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Cinta Satinada", unitCostDOP: 4.2, quantity: 10, unit: "yarda", category: "DECORATION" },
          ],
        },
        {
          name: "Chocoflan Mediano (1/2 Lote)",
          sizeDescription: "Medio chocoflan (4 porciones) con topper feliz cumpleaños",
          motherRecipeQty: 4,
          desiredMarginPercent: 35,
          materials: [
            { name: "Base Cartón #12", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Topper Feliz Cumpleaños", unitCostDOP: 20.0, quantity: 1, unit: "unidad", category: "DECORATION" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 50, unit: "g", category: "INGREDIENT" },
          ],
        },
        {
          name: "Chocoflan Porción Triangular",
          sizeDescription: "1 porción individual (1/8 lote) en envase triangular",
          motherRecipeQty: 1,
          desiredMarginPercent: 35,
          materials: [
            { name: "Bandeja Triangular Quesillo", unitCostDOP: 13.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.4631, quantity: 10, unit: "g", category: "INGREDIENT" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Chocoflan Mini (Caja 15 uds)",
          sizeDescription: "15 mini chocoflan en platicos cuadraditos con cucharitas (1 lote)",
          motherRecipeQty: 8,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Platicos Cuadraditos", unitCostDOP: 16.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 15, unit: "unidad", category: "PACKAGING" },
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.3983, quantity: 200, unit: "g", category: "INGREDIENT" },
            { name: "Caja Blanca 12.5 Lbs", unitCostDOP: 47.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 9. Pudín de Pan
    {
      name: "Pudín de Pan",
      slug: "pudin-de-pan",
      description: "Pudín de pan tradicional con mantequilla y leche evaporada (rinde 12 porciones).",
      yield: 12,
      yieldUnit: "porciones",
      overheadPercent: 10,
      laborPercent: 20,
      targetMargin: 50,
      importedFrom: "Pudín de Pan",
      ingredients: [
        { name: "Pan de Agua", unitCostDOP: 5.0, quantity: 8, unit: "unidad" },
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Leche Carnation", unitCostDOP: 70.0, quantity: 1, unit: "lata" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.3333, quantity: 4, unit: "unidad" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.2138, quantity: 200, unit: "g" },
        { name: "Leche Entera", unitCostDOP: 70.0, quantity: 1, unit: "litro" },
        { name: "Azúcar Blanca", unitCostDOP: 0.0882, quantity: 200, unit: "g" },
      ],
      presentations: [
        {
          name: "Cajita Pudín de Pan (Individual)",
          sizeDescription: "1 porción (1/12 lote) en bandeja cuadradita con etiqueta",
          motherRecipeQty: 1,
          desiredMarginPercent: 40,
          materials: [
            { name: "Bandeja Cuadradita", unitCostDOP: 4.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Pudín de Pan Completo",
          sizeDescription: "Lote completo (12 porciones) en baño de aluminio decorado con fresas",
          motherRecipeQty: 12,
          desiredMarginPercent: 35,
          materials: [
            { name: "Baño de Aluminio", unitCostDOP: 60.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Fresa Fresca", unitCostDOP: 0.6592, quantity: 50, unit: "g", category: "INGREDIENT" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 10. Alfajores
    {
      name: "Alfajores de Maicena",
      slug: "alfajores-de-maicena",
      description: "Masa suave de maicena y mantequilla (rinde 15 alfajores armados).",
      yield: 15,
      yieldUnit: "unidades",
      overheadPercent: 10,
      laborPercent: 20,
      targetMargin: 30,
      importedFrom: "Alfajores",
      ingredients: [
        { name: "Harina de Trigo", unitCostDOP: 0.4591, quantity: 200, unit: "g" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.7688, quantity: 250, unit: "g" },
        { name: "Polvo de Hornear", unitCostDOP: 0.5512, quantity: 11, unit: "g" },
        { name: "Azúcar Glass", unitCostDOP: 0.1235, quantity: 150, unit: "g" },
        { name: "Maicena", unitCostDOP: 0.1653, quantity: 300, unit: "g" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.0, quantity: 4, unit: "unidad" },
        { name: "Limón Ralladura", unitCostDOP: 14.0, quantity: 1, unit: "unidad" },
      ],
      presentations: [
        {
          name: "Combo de Alfajores (10 uds)",
          sizeDescription: "Caja de 10 alfajores rellenos de dulce de leche y coco",
          motherRecipeQty: 10,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Dulce de Leche Ombu", unitCostDOP: 0.6564, quantity: 100, unit: "g", category: "INGREDIENT" },
            { name: "Coco Rallado", unitCostDOP: 10.0, quantity: 5, unit: "porción", category: "INGREDIENT" },
            { name: "Capacillos Mini", unitCostDOP: 2.8, quantity: 5, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
        {
          name: "Alfajor Individual en Fundita",
          sizeDescription: "1 alfajor en capacillo y fundita de celofán",
          motherRecipeQty: 1,
          desiredMarginPercent: 40,
          materials: [
            { name: "Capacillos Mini", unitCostDOP: 2.8, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Empaque Fundita", unitCostDOP: 2.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 11. Galletas Oreo Bañadas en Chocolate
    {
      name: "Galletas Oreo Bañadas en Chocolate",
      slug: "galletas-oreo-banadas",
      description: "Lote de 4 galletas Oreo cubiertas con chocolate blanco/negro y grageas.",
      yield: 4,
      yieldUnit: "unidades",
      overheadPercent: 10,
      laborPercent: 20,
      targetMargin: 10,
      importedFrom: "Galletas Oreo en Chocolate",
      ingredients: [
        { name: "Galleta Oreo", unitCostDOP: 1.0938, quantity: 4, unit: "unidad" },
        { name: "Cobertura Disco Blanca", unitCostDOP: 0.63, quantity: 90, unit: "g" },
        { name: "Cobertura Disco Negra", unitCostDOP: 0.65, quantity: 90, unit: "g" },
        { name: "Capacillos Pequeños", unitCostDOP: 0.3, quantity: 1, unit: "unidad", category: "PACKAGING" },
        { name: "Grageas Doradas", unitCostDOP: 62.99, quantity: 0.5, unit: "g", category: "DECORATION" },
      ],
      presentations: [
        {
          name: "Oreos Revestidas Box (12 uds)",
          sizeDescription: "Caja de 12 Oreos revestidas decoradas con fondant/chocolate",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Caja Blanca 6x6x3", unitCostDOP: 45.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Capacillos Pequeños", unitCostDOP: 3.2, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Decoración Especial", unitCostDOP: 15.0, quantity: 12, unit: "unidad", category: "DECORATION" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 12. Arroz con Leche
    {
      name: "Arroz con Leche Cremoso",
      slug: "arroz-con-leche",
      description: "Arroz con leche tradicional con canela y pasas (rinde 12 shots de 2 oz).",
      yield: 12,
      yieldUnit: "porciones",
      overheadPercent: 40,
      laborPercent: 30,
      targetMargin: 60,
      importedFrom: "Arroz con leche",
      ingredients: [
        { name: "Arroz Largo (Taza)", unitCostDOP: 13.39, quantity: 1, unit: "taza" },
        { name: "Leche Evaporada Carnation", unitCostDOP: 70.0, quantity: 1, unit: "lata" },
        { name: "Leche Condensada", unitCostDOP: 130.0, quantity: 1, unit: "lata" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.2138, quantity: 100, unit: "g" },
        { name: "Canela + Clavo + Limón", unitCostDOP: 56.5, quantity: 1, unit: "lote" },
        { name: "Pasas", unitCostDOP: 19.0, quantity: 1, unit: "porción" },
      ],
      presentations: [
        {
          name: "Shots Arroz con Leche 2 oz (Servicio 12 uds)",
          sizeDescription: "12 vasitos de shots 2 oz con cucharitas",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Vaso de Shots 2oz", unitCostDOP: 6.48, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Cucharas Mini", unitCostDOP: 4.0, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 50.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 13. Galletas de Avena
    {
      name: "Galletas de Avena",
      slug: "galletas-de-avena",
      description: "Galletas saludables de avena, crema de coco y nueces (rinde 23 unidades).",
      yield: 23,
      yieldUnit: "unidades",
      overheadPercent: 10,
      laborPercent: 15,
      targetMargin: 20,
      importedFrom: "Galletas de Avena",
      ingredients: [
        { name: "Avena en Hojuelas", unitCostDOP: 100.0, quantity: 2, unit: "taza" },
        { name: "Crema de Coco", unitCostDOP: 150.0, quantity: 1, unit: "lata" },
        { name: "Nueces", unitCostDOP: 100.0, quantity: 1, unit: "porción" },
        { name: "Harina de Avena", unitCostDOP: 100.0, quantity: 1, unit: "taza" },
        { name: "Canela y Sal", unitCostDOP: 20.0, quantity: 1, unit: "lote" },
      ],
      presentations: [
        {
          name: "Galletas de Avena Empacadas (Unidad)",
          sizeDescription: "1 galleta en fundita con capacillo y etiqueta",
          motherRecipeQty: 1,
          desiredMarginPercent: 40,
          materials: [
            { name: "Empaque Fundita", unitCostDOP: 2.0, quantity: 2, unit: "unidad", category: "PACKAGING" },
            { name: "Capacillos Mini", unitCostDOP: 2.8, quantity: 2, unit: "unidad", category: "PACKAGING" },
            { name: "Etiqueta K_Sweet", unitCostDOP: 6.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },

    // 14. Cupcakes Artesanales
    {
      name: "Cupcakes Artesanales",
      slug: "cupcakes-artesanales",
      description: "Masa de cupcakes esponjosos (rinde 16 unidades estándar).",
      yield: 16,
      yieldUnit: "unidades",
      overheadPercent: 10,
      laborPercent: 20,
      targetMargin: 30,
      importedFrom: "Cupcake",
      ingredients: [
        { name: "Harina de Trigo", unitCostDOP: 0.4591, quantity: 200, unit: "g" },
        { name: "Mantequilla Margarina", unitCostDOP: 0.7688, quantity: 100, unit: "g" },
        { name: "Polvo de Hornear", unitCostDOP: 0.5512, quantity: 15, unit: "g" },
        { name: "Azúcar Glass", unitCostDOP: 0.1235, quantity: 200, unit: "g" },
        { name: "Maicena", unitCostDOP: 0.1653, quantity: 300, unit: "g" },
        { name: "Huevos (Cartón)", unitCostDOP: 8.0, quantity: 2, unit: "unidad" },
        { name: "Sal", unitCostDOP: 5.0, quantity: 1, unit: "g" },
      ],
      presentations: [
        {
          name: "Caja de Cupcakes con Buttercream (12 uds)",
          sizeDescription: "Docena de cupcakes decorados con tope de buttercream y perlas",
          motherRecipeQty: 12,
          isComposite: true,
          desiredMarginPercent: 35,
          materials: [
            { name: "Tope Buttercream", unitCostDOP: 17.35, quantity: 12, unit: "porción", category: "INGREDIENT" },
            { name: "Perlas Decorativas", unitCostDOP: 3.351, quantity: 12, unit: "g", category: "DECORATION" },
            { name: "Capacillos Mini", unitCostDOP: 2.8, quantity: 12, unit: "unidad", category: "PACKAGING" },
            { name: "Caja Blanca 6x6x3", unitCostDOP: 45.0, quantity: 1, unit: "unidad", category: "PACKAGING" },
          ],
        },
      ],
    },
  ];

  let count = 0;
  for (const r of recipesData) {
    await upsertMotherRecipe(r);
    count++;
    console.log(`[OK] Receta Madre + Presentaciones sincronizada: ${r.name}`);
  }

  console.log(`\n=== FINALIZADO: ${count} Recetas Madre con sus Presentaciones sincronizadas ===`);
}

main()
  .catch((err) => {
    console.error("ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

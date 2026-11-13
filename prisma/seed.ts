import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== INICIANDO SEED FORENSE: K_SWEET V2.0 ===");

  // 1. Limpiar datos existentes respetando integridad referencial
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.presentationMaterial.deleteMany();
  await prisma.presentationSubrecipe.deleteMany();
  await prisma.recipePresentation.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.subRecipeUse.deleteMany();
  await prisma.recipePriceHistory.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.operationalExpense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.weeklyClose.deleteMany();
  await prisma.unitConversionRef.deleteMany();

  // 2. Crear Suplidores del Excel
  console.log("Creando suplidores del Excel...");
  const henrry = await prisma.supplier.create({
    data: { name: "Henrry", phone: "809-555-0101", notes: "Suplidor de empaques y envases de aluminio" },
  });
  const panAzucar = await prisma.supplier.create({
    data: { name: "Pan de Azúcar", phone: "809-555-0102", notes: "Cajas de acetato, moldes y herramientas" },
  });
  const denicias = await prisma.supplier.create({
    data: { name: "Denicias", phone: "809-555-0103", notes: "Coberturas de chocolate y colorantes en gel" },
  });
  const tresI = await prisma.supplier.create({
    data: { name: "3i+", phone: "809-555-0104", notes: "Bases de cartón, cajas marrones y palitos" },
  });
  const lendoiro = await prisma.supplier.create({
    data: { name: "Lendoiro", phone: "809-555-0105", notes: "Cintas decorativas y papel triturado" },
  });
  const merceriaReina = await prisma.supplier.create({
    data: { name: "Mercería La Reina", phone: "809-555-0106", notes: "Cintas y lazos finos" },
  });

  // 3. Crear Ingredientes, Decoraciones y Empaques (Hoja 'Producto precios')
  console.log("Creando ingredientes, decoraciones y empaques...");
  const tabletaCho = await prisma.ingredient.create({
    data: {
      name: "Tableta Chocolate Munee",
      category: "INGREDIENT",
      packagePriceCents: 24800,
      packageQty: 30,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 8.2667,
      importedFrom: "Producto precios!A28",
    },
  });

  const cocoa = await prisma.ingredient.create({
    data: {
      name: "Cocoa Munee",
      category: "INGREDIENT",
      packagePriceCents: 14500,
      packageQty: 453.59,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.3197,
      importedFrom: "Producto precios!A31",
    },
  });

  const mantequilla = await prisma.ingredient.create({
    data: {
      name: "Mantequilla Margarina",
      category: "INGREDIENT",
      packagePriceCents: 48500,
      packageQty: 2267.96, // 5 Libras
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 1.0692,
      importedFrom: "Producto precios!A32",
    },
  });

  const azucarBlanca = await prisma.ingredient.create({
    data: {
      name: "Azúcar Blanca",
      category: "INGREDIENT",
      packagePriceCents: 16000,
      packageQty: 1814.37, // 4 Libras
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.352,
      importedFrom: "Producto precios!A33",
    },
  });

  const azucarMorena = await prisma.ingredient.create({
    data: {
      name: "Azúcar Morena",
      category: "INGREDIENT",
      packagePriceCents: 5600,
      packageQty: 900,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.0622,
      importedFrom: "Producto precios!A10",
    },
  });

  const huevos = await prisma.ingredient.create({
    data: {
      name: "Huevos (Cartón)",
      category: "INGREDIENT",
      packagePriceCents: 22000,
      packageQty: 30,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 7.3333,
      importedFrom: "Producto precios!A26",
    },
  });

  const harina = await prisma.ingredient.create({
    data: {
      name: "Harina de Trigo",
      category: "INGREDIENT",
      packagePriceCents: 19000,
      packageQty: 1000,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.19,
      importedFrom: "Producto precios!A8",
    },
  });

  const vainilla = await prisma.ingredient.create({
    data: {
      name: "Vainilla",
      category: "INGREDIENT",
      packagePriceCents: 3000,
      packageQty: 15,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 2.0,
      importedFrom: "Producto precios!A14",
    },
  });

  const sal = await prisma.ingredient.create({
    data: {
      name: "Sal",
      category: "INGREDIENT",
      packagePriceCents: 1900,
      packageQty: 453,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.0419,
      importedFrom: "Producto precios!A4",
    },
  });

  const fresasIng = await prisma.ingredient.create({
    data: {
      name: "Fresas Frescas",
      category: "INGREDIENT",
      packagePriceCents: 16500,
      packageQty: 21,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 7.8571,
      importedFrom: "Fresas!A3",
    },
  });

  const chocolateBlanco = await prisma.ingredient.create({
    data: {
      name: "Cobertura en Disco Blanca",
      category: "INGREDIENT",
      supplierId: denicias.id,
      packagePriceCents: 63000,
      packageQty: 1000,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.63,
      importedFrom: "Producto precios!A29",
    },
  });

  const chocolateNegro = await prisma.ingredient.create({
    data: {
      name: "Cobertura en Disco Negra",
      category: "INGREDIENT",
      supplierId: denicias.id,
      packagePriceCents: 65000,
      packageQty: 1000,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.65,
      importedFrom: "Producto precios!A30",
    },
  });

  const galletaOreo = await prisma.ingredient.create({
    data: {
      name: "Galleta Oreo (Paquete)",
      category: "INGREDIENT",
      packagePriceCents: 18700,
      packageQty: 12,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 15.5833,
      importedFrom: "Galletas Oreo en Chocolate!A3",
    },
  });

  const dulceLecheOmbu = await prisma.ingredient.create({
    data: {
      name: "Dulce de Leche Ombú",
      category: "INGREDIENT",
      packagePriceCents: 65500,
      packageQty: 996.6, // 2.2 lb
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.6572,
      importedFrom: "Producto precios!A24",
    },
  });

  // Materiales de Empaque
  const cajaAcetato = await prisma.ingredient.create({
    data: {
      name: "Caja Acetato Transparente 5*5*6",
      category: "PACKAGING",
      supplierId: panAzucar.id,
      packagePriceCents: 12500,
      packageQty: 1,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 125.0,
      importedFrom: "Producto precios!A83",
    },
  });

  const cajaFresas = await prisma.ingredient.create({
    data: {
      name: "Caja Rosada con Ventanillas 4/1",
      category: "PACKAGING",
      supplierId: panAzucar.id,
      packagePriceCents: 7000,
      packageQty: 1,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 70.0,
      importedFrom: "Producto precios!A86",
    },
  });

  const capacillos = await prisma.ingredient.create({
    data: {
      name: "Capacillos Pequeños (500 uds)",
      category: "PACKAGING",
      supplierId: henrry.id,
      packagePriceCents: 15000,
      packageQty: 500,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 0.3,
      importedFrom: "Producto precios!A57",
    },
  });

  const lazoYarda = await prisma.ingredient.create({
    data: {
      name: "Lazo Decorativo Ciruela",
      category: "PACKAGING",
      supplierId: merceriaReina.id,
      packagePriceCents: 15000,
      packageQty: 50,
      packageUnit: "yarda",
      baseUnit: "yarda",
      costPerBaseUnit: 3.0,
      importedFrom: "Fresas!A14",
    },
  });

  const vasoShot = await prisma.ingredient.create({
    data: {
      name: "Vaso de Shots #1 (50 uds)",
      category: "PACKAGING",
      supplierId: henrry.id,
      packagePriceCents: 13000,
      packageQty: 50,
      packageUnit: "unidad",
      baseUnit: "unidad",
      costPerBaseUnit: 2.6,
      importedFrom: "Producto precios!A62",
    },
  });

  // Decoraciones
  const grageasDoradas = await prisma.ingredient.create({
    data: {
      name: "Grageas Doradas",
      category: "DECORATION",
      packagePriceCents: 19000,
      packageQty: 56.7, // 2 oz
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 3.35,
      importedFrom: "Producto precios!A37",
    },
  });

  const grageasCrispi = await prisma.ingredient.create({
    data: {
      name: "Grageas Crispi Cremas",
      category: "DECORATION",
      packagePriceCents: 7500,
      packageQty: 100,
      packageUnit: "g",
      baseUnit: "g",
      costPerBaseUnit: 0.75,
      reviewFlag: true, // M labeled as '3 mm' in Excel
      notes: "Unidad original en Excel decía '3 mm'. Ajustado a 100g para costeo.",
      importedFrom: "Producto precios!A41",
    },
  });

  // 4. Crear Receta Madre 1: Receta Brownie (15 Porciones)
  console.log("Creando Receta Madre: Brownies Cuadrados (15 Porciones)...");
  const recetaBrownie = await prisma.recipe.create({
    data: {
      name: "Receta Brownie Artesanal (15 Porciones)",
      slug: "receta-brownie-15-porciones",
      recipeType: "MOTHER",
      description: "Receta madre tradicional de brownies húmedos de chocolate y cacao.",
      yield: 15,
      yieldUnit: "porciones",
      laborPercent: 20, // 20% Mano de obra
      overheadPercent: 10, // 10% Gas, agua y gastables
      packageCostCents: 0,
      batchCostCents: 54823, // 421.72 + 42.17 + 84.34
      unitCostCents: 3655, // ~RD$ 36.55 / porción
      costPerYieldUnit: 36.54866 * 100, // 3654.87 centavos
      targetMargin: 40,
      suggestedPriceCents: 6100, // 3655 / 0.60
      currentPriceCents: 6500, // RD$ 65.00 porción suelta
      status: "ACTIVE",
      importedFrom: "Brownies Cuadrados!A1",
      notes: "Fórmula canónica del Excel: 10% overhead, 20% mano de obra, 15 porciones.",
    },
  });

  // Ingredientes de la Receta Madre Brownie
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: recetaBrownie.id, ingredientId: tabletaCho.id, quantity: 5, unit: "unidad", costCents: 4133 },
      { recipeId: recetaBrownie.id, ingredientId: cocoa.id, quantity: 45, unit: "g", costCents: 1439 },
      { recipeId: recetaBrownie.id, ingredientId: mantequilla.id, quantity: 200, unit: "g", costCents: 21385 },
      { recipeId: recetaBrownie.id, ingredientId: azucarBlanca.id, quantity: 201, unit: "g", costCents: 7074 },
      { recipeId: recetaBrownie.id, ingredientId: azucarMorena.id, quantity: 202, unit: "g", costCents: 1257 },
      { recipeId: recetaBrownie.id, ingredientId: huevos.id, quantity: 6, unit: "unidad", costCents: 4400 },
      { recipeId: recetaBrownie.id, ingredientId: vainilla.id, quantity: 1, unit: "g", costCents: 200 },
      { recipeId: recetaBrownie.id, ingredientId: harina.id, quantity: 120, unit: "g", costCents: 2280 },
      { recipeId: recetaBrownie.id, ingredientId: sal.id, quantity: 1, unit: "g", costCents: 4 },
    ],
  });

  // 5. Presentaciones de Brownie
  console.log("Creando Presentaciones de Brownie...");
  // Presentación 1: Combo 1 San Valentín (2 Brownies + Caja + Capacillos + Lazo + Etiqueta + Mensaje)
  // Consumo base: 2 brownies * 3654.87 = 7310 centavos
  // Empaque: Caja (12500) + 2 Capacillos (60) + Lazo 3 yd (1667) + Etiqueta (600) + Mensaje (1000) = 15827
  // Costo total = 23137 centavos (RD$ 231.37)
  const presCombo1 = await prisma.recipePresentation.create({
    data: {
      recipeId: recetaBrownie.id,
      name: "Caja Brownie San Valentín (Combo 1)",
      sizeDescription: "Caja con 2 brownies artesanales",
      motherRecipeQty: 2,
      motherRecipeUnit: "porciones",
      presentationYield: 7.5, // 15 / 2
      packagingCostCents: 15827,
      additionalCostCents: 0,
      totalCostCents: 23137,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 42,
      suggestedPriceCents: 39891, // 23137 / 0.58
      finalPriceCents: 40000, // RD$ 400.00
      realProfitCents: 16863, // 40000 - 23137 = RD$ 168.63
      realMarginPercent: 42.16,
      isActive: true,
      notes: "Presentación San Valentín 2 unidades en caja acetato con lazo y mensaje.",
    },
  });

  await prisma.presentationMaterial.createMany({
    data: [
      { presentationId: presCombo1.id, name: "Caja Acetato", quantity: 1, unit: "unidad", unitCostCents: 12500, totalCostCents: 12500 },
      { presentationId: presCombo1.id, name: "Capacillos", quantity: 2, unit: "unidad", unitCostCents: 30, totalCostCents: 60 },
      { presentationId: presCombo1.id, name: "Lazo Ciruela", quantity: 3, unit: "yarda", unitCostCents: 556, totalCostCents: 1667 },
      { presentationId: presCombo1.id, name: "Etiqueta K_Sweet", quantity: 1, unit: "unidad", unitCostCents: 600, totalCostCents: 600 },
      { presentationId: presCombo1.id, name: "Tarjeta Mensaje", quantity: 1, unit: "unidad", unitCostCents: 1000, totalCostCents: 1000 },
    ],
  });

  // Presentación 2: Combo 2 San Valentín (6 Brownies + Dulce de Leche + Grageas + Empaque)
  // Consumo base: 6 brownies * 3654.87 = 21929 centavos
  // Topping: Dulce de leche 50g (3286) + Grageas (500) = 3786 centavos
  // Empaque: Caja (12500) + Capacillos (180) + Lazo (1667) + Etiqueta (600) + Mensaje (1000) = 15947
  // Costo total = 21929 + 3786 + 15947 = 41662 centavos (RD$ 416.62)
  const presCombo2 = await prisma.recipePresentation.create({
    data: {
      recipeId: recetaBrownie.id,
      name: "Caja Brownie San Valentín (Combo 2)",
      sizeDescription: "Caja con 6 brownies decorados",
      motherRecipeQty: 6,
      motherRecipeUnit: "porciones",
      presentationYield: 2.5, // 15 / 6
      packagingCostCents: 15947,
      additionalCostCents: 3786,
      totalCostCents: 41662,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 45,
      suggestedPriceCents: 75749, // 41662 / 0.55
      finalPriceCents: 75000, // RD$ 750.00
      realProfitCents: 33338, // RD$ 333.38
      realMarginPercent: 44.45,
      isActive: true,
      notes: "Combo 2 con 6 brownies, dulce de leche, grageas y empaque de lujo.",
    },
  });

  // Presentación 3: Shot Individual de Brownie (1 Porción + Vaso Shot + Tapa + Cuchara)
  const presShot = await prisma.recipePresentation.create({
    data: {
      recipeId: recetaBrownie.id,
      name: "Shot de Brownie (2 oz)",
      sizeDescription: "Vaso de 2 oz para eventos y mesas de postres",
      motherRecipeQty: 1,
      motherRecipeUnit: "porciones",
      presentationYield: 15,
      packagingCostCents: 560, // Vaso shot (260) + Cucharita (150) + Etiqueta (150)
      additionalCostCents: 0,
      totalCostCents: 4215, // 3655 + 560 = RD$ 42.15
      pricingMethod: "MARGIN",
      desiredMarginPercent: 50,
      suggestedPriceCents: 8430, // 4215 / 0.5
      finalPriceCents: 9000, // RD$ 90.00
      realProfitCents: 4785, // RD$ 47.85
      realMarginPercent: 53.17,
      isActive: true,
      notes: "Ideal para eventos corporativos y bodas.",
    },
  });

  // 6. Receta Madre 2: Fresas Bañadas en Chocolate
  console.log("Creando Receta Madre: Fresas Bañadas en Chocolate...");
  const recetaFresas = await prisma.recipe.create({
    data: {
      name: "Fresas Bañadas en Chocolate",
      slug: "fresas-banadas-chocolate",
      recipeType: "MOTHER",
      description: "Fresas seleccionadas bañadas en chocolate blanco y negro.",
      yield: 6,
      yieldUnit: "unidades",
      laborPercent: 20,
      overheadPercent: 10,
      batchCostCents: 17101, // 131.54 ing + 13.15 overhead + 26.31 labor = 171.01
      unitCostCents: 2850, // RD$ 28.50 cada fresa bañada
      costPerYieldUnit: 2850,
      targetMargin: 50,
      suggestedPriceCents: 5700,
      currentPriceCents: 6000,
      status: "ACTIVE",
      importedFrom: "Fresas!A1",
    },
  });

  // Presentación de Fresas: Caja 6 Unidades
  await prisma.recipePresentation.create({
    data: {
      recipeId: recetaFresas.id,
      name: "Caja de Fresas Bañadas (6 uds)",
      sizeDescription: "Caja rosada con ventanilla",
      motherRecipeQty: 6,
      motherRecipeUnit: "unidades",
      presentationYield: 1,
      packagingCostCents: 9050, // Caja 70 + Cinta 4.50 + Etiqueta 6 + Mensaje 10 = 90.50
      additionalCostCents: 0,
      totalCostCents: 26151, // 17101 + 9050 = RD$ 261.51
      pricingMethod: "MARKUP",
      desiredMarginPercent: 50, // Recargo 50%
      suggestedPriceCents: 39226, // 261.51 * 1.50 = RD$ 392.26
      finalPriceCents: 40000, // RD$ 400.00
      realProfitCents: 13849, // RD$ 138.49
      realMarginPercent: 34.62,
      isActive: true,
      notes: "Fórmula del Excel con recargo del 50%.",
    },
  });

  // 7. Clientes y Ventas Demostrativas con Costos Históricos Congelados
  console.log("Creando clientes y ventas históricas...");
  const cliente1 = await prisma.customer.create({
    data: { name: "María Fernández", phone: "829-555-1234", email: "maria@example.com" },
  });
  const cliente2 = await prisma.customer.create({
    data: { name: "Carlos Rodríguez", phone: "809-555-5678" },
  });

  const venta1 = await prisma.sale.create({
    data: {
      saleDate: new Date("2026-11-10T15:30:00Z"),
      customerId: cliente1.id,
      customerName: cliente1.name,
      totalCents: 80000, // 2 x RD$ 400.00
      totalCostCents: 46274, // 2 x RD$ 231.37 (congelado)
      collectedCents: 80000,
      balanceCents: 0,
      paymentMethod: "TRANSFERENCIA",
      status: "ACTIVE",
      notes: "Pedido especial San Valentín",
      items: {
        create: [
          {
            recipeId: recetaBrownie.id,
            presentationId: presCombo1.id,
            productName: "Caja Brownie San Valentín (Combo 1)",
            quantity: 2,
            unitPriceCents: 40000,
            totalCents: 80000,
            unitCostCents: 23137, // Costo unitario histórico congelado
            totalCostCents: 46274,
          },
        ],
      },
      payments: {
        create: [
          {
            amountCents: 80000,
            method: "TRANSFERENCIA",
            reference: "BHD-789123",
          },
        ],
      },
    },
  });

  // 8. Gastos Operativos y Categorías
  console.log("Creando categorías y gastos operativos...");
  const catServicios = await prisma.expenseCategory.create({ data: { name: "Servicios (Gas, Luz, Agua)" } });
  const catTransporte = await prisma.expenseCategory.create({ data: { name: "Transporte y Delivery" } });
  const catMarketing = await prisma.expenseCategory.create({ data: { name: "Publicidad y Redes" } });

  await prisma.operationalExpense.create({
    data: {
      expenseDate: new Date("2026-11-09T10:00:00Z"),
      categoryId: catServicios.id,
      concept: "Recarga de tanque de gas industrial",
      amountCents: 185000, // RD$ 1,850.00
      paymentMethod: "EFECTIVO",
      notes: "Consumo de cocina para horneado semanal",
    },
  });

  // 9. Conversiones Estándar y de Referencia (Módulo 7)
  console.log("Creando conversiones y equivalencias...");
  await prisma.unitConversionRef.createMany({
    data: [
      { name: "libra_a_gramos", category: "MASS", fromUnit: "lb", toUnit: "g", factor: 453.59237, isEditable: false, source: "STANDARD" },
      { name: "onza_a_gramos", category: "MASS", fromUnit: "oz", toUnit: "g", factor: 28.34952, isEditable: false, source: "STANDARD" },
      { name: "kilo_a_gramos", category: "MASS", fromUnit: "kg", toUnit: "g", factor: 1000.0, isEditable: false, source: "STANDARD" },
      { name: "litro_a_ml", category: "VOLUME", fromUnit: "l", toUnit: "ml", factor: 1000.0, isEditable: false, source: "STANDARD" },
      { name: "taza_a_ml", category: "VOLUME", fromUnit: "taza", toUnit: "ml", factor: 236.588, isEditable: false, source: "STANDARD" },
      { name: "cucharada_a_ml", category: "VOLUME", fromUnit: "cda", toUnit: "ml", factor: 14.787, isEditable: false, source: "STANDARD" },
      { name: "cda_azucar_excel", category: "INGREDIENT", fromUnit: "cda", toUnit: "g", factor: 15.0, ingredient: "Azúcar", isEditable: true, source: "EXCEL" },
      { name: "taza_harina_excel", category: "INGREDIENT", fromUnit: "taza", toUnit: "g", factor: 120.0, ingredient: "Harina", isEditable: true, source: "EXCEL" },
    ],
  });

  console.log("=== SEED COMPLETADO EXITOSAMENTE ===");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

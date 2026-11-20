import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@/generated/client";
import {
  orderPresentationsTopologically,
  calculateMotherRecipeCosts,
  calculateVariantValues,
  calculateGroupPresentationValues,
} from "@/lib/services/presentations";
import { simulatePriceImpact, approveProposals } from "@/lib/services/price-approval";

describe("Ordenamiento Topológico de Presentaciones (PRE-001)", () => {
  it("detecta auto-ciclo (parentId === id) y devuelve fallback seguro", () => {
    const res = orderPresentationsTopologically([
      { id: "p1", name: "Auto Ciclo", parentId: "p1" },
    ]);
    expect(res.ordered).toHaveLength(1);
    expect(res.fallbackParentIds.has("p1")).toBe(true);
    expect(res.warnings.some((w) => w.scope === "PRESENTATION_CYCLE")).toBe(true);
  });

  it("detecta ciclo multi-salto (A -> B -> A) sin recursión infinita", () => {
    const res = orderPresentationsTopologically([
      { id: "A", name: "Nodo A", parentId: "B" },
      { id: "B", name: "Nodo B", parentId: "A" },
    ]);
    expect(res.ordered).toHaveLength(2);
    expect(res.fallbackParentIds.size).toBeGreaterThanOrEqual(1);
    expect(res.warnings.some((w) => w.scope === "PRESENTATION_CYCLE")).toBe(true);
  });

  it("marca padre inexistente como fallback directo y ordena árbol válido raíz -> hijo -> nieto", () => {
    const missing = orderPresentationsTopologically([
      { id: "orphan", name: "Huérfana", parentId: "no-existe" },
    ]);
    expect(missing.fallbackParentIds.has("orphan")).toBe(true);
    expect(missing.warnings).toHaveLength(1);

    const tree = orderPresentationsTopologically([
      { id: "grandchild", name: "Super Pack", parentId: "child" },
      { id: "child", name: "Caja 15", parentId: "root" },
      { id: "root", name: "Mini", parentId: null },
    ]);
    expect(tree.warnings).toHaveLength(0);
    expect(tree.fallbackParentIds.size).toBe(0);
    expect(tree.ordered.map((p) => p.id)).toEqual(["root", "child", "grandchild"]);
  });
});

describe("Simulación, Aprobación CAS, Drift Check y Cascada Histórica (Copia Aislada ksweet.db)", () => {
  let tmpDir: string;
  let db: any;

  beforeAll(async () => {
    const srcDb = path.resolve(process.cwd(), "prisma", "ksweet.db");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ksweet-approval-test-"));
    const tmpDb = path.join(tmpDir, "ksweet-copy.db");
    fs.copyFileSync(srcDb, tmpDb);
    for (const suffix of ["-wal", "-shm"]) {
      if (fs.existsSync(srcDb + suffix)) {
        fs.copyFileSync(srcDb + suffix, tmpDb + suffix);
      }
    }

    db = new PrismaClient({
      datasources: {
        db: { url: `file:${tmpDb.replace(/\\/g, "/")}` },
      },
    });
    await db.$connect();
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("verifica estado sano de Producción de Quesillo Redondo (RD$561.68 y Caja de 15 Minis sin auto-ciclo)", async () => {
    const quesillo = await db.recipe.findFirst({
      where: { name: { contains: "Quesillo Redondo" } },
      include: { presentations: true },
    });

    expect(quesillo).toBeTruthy();
    expect(quesillo.batchCostCents).toBe(56168);

    const cajaMinis = quesillo.presentations.find((p: any) => p.name.includes("Caja de 15 Minis"));
    const miniRoot = quesillo.presentations.find((p: any) => p.name === "Quesillo Mini");
    expect(cajaMinis).toBeTruthy();
    expect(miniRoot).toBeTruthy();
    expect(cajaMinis.parentId).toBe(miniRoot.id);
    expect(cajaMinis.parentId).not.toBe(cajaMinis.id);

    const topo = orderPresentationsTopologically(quesillo.presentations);
    expect(topo.warnings.filter((w) => w.scope === "PRESENTATION_CYCLE")).toHaveLength(0);
  });

  it("garantiza paridad simulador/aprobación, CAS, drift check, ADOPT_SOURCE_PACK y preservación de ventas", async () => {
    const source = await db.priceSource.findFirst({ where: { code: "sirena_do" } });
    expect(source).toBeTruthy();

    const fiveLbG = 5 * 453.59237;
    const ingBase = await db.ingredient.create({
      data: {
        code: "PROD-TEST-901",
        name: "Azúcar Test Cascade",
        category: "Endulzantes",
        packagePriceCents: 45000, // RD$ 450.00 / 5 lb
        packageQty: 5,
        packageUnit: "lb",
        baseUnit: "g",
        conversionFactor: 453.59237,
        costPerBaseUnit: 450 / fiveLbG,
        isActive: true,
      },
    });

    const ingPkg = await db.ingredient.create({
      data: {
        code: "PROD-TEST-902",
        name: "Caja Cartón Test",
        category: "Empaques",
        packagePriceCents: 50000, // RD$ 500.00 / 100 ud -> RD$5/ud
        packageQty: 100,
        packageUnit: "ud",
        baseUnit: "ud",
        conversionFactor: 1,
        costPerBaseUnit: 5,
        isActive: true,
      },
    });

    const ingLineCost = Math.round(1000 * ingBase.costPerBaseUnit * 100);
    const motherCosts = calculateMotherRecipeCosts({
      ingredientsCostCents: ingLineCost,
      laborPercent: 10,
      overheadPercent: 5,
      contingencyPercent: 5,
      packageCostCents: 0,
      yieldQty: 10,
    });

    const recipe = await db.recipe.create({
      data: {
        name: "Receta Test Cascada Precios",
        slug: `receta-test-cascada-${Date.now()}`,
        recipeType: "MOTHER",
        yield: 10,
        yieldUnit: "unidad",
        laborPercent: 10,
        overheadPercent: 5,
        contingencyPercent: 5,
        subtotalBeforeContingencyCents: motherCosts.subtotalBeforeContingencyCents,
        batchCostExactCents: motherCosts.batchCostExactCents,
        packageCostCents: 0,
        targetMargin: 40,
        batchCostCents: motherCosts.batchCostCents,
        unitCostCents: motherCosts.unitCostCents,
        costPerYieldUnit: motherCosts.costPerYieldUnit,
        suggestedPriceCents: Math.ceil(motherCosts.unitCostCents / 0.6),
        currentPriceCents: 15000, // precio manual de catálogo que NO debe tocarse
        status: "ACTIVE",
        ingredients: {
          create: [
            {
              ingredientId: ingBase.id,
              quantity: 1000,
              unit: "g",
              costCents: ingLineCost,
            },
          ],
        },
      },
    });

    const rootVals = calculateVariantValues({
      motherBatchYield: 10,
      motherBatchCostExactCents: motherCosts.batchCostExactCents,
      consumptionMode: "YIELD_PER_BATCH",
      presentationYield: 10,
      packagingCostCents: 0,
      additionalCostCents: 0,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 40,
      currentFinalPriceCents: 12000,
    });

    const presRoot = await db.recipePresentation.create({
      data: {
        recipeId: recipe.id,
        name: "Porción Individual Test",
        consumptionMode: "YIELD_PER_BATCH",
        batchFraction: 0.1,
        motherRecipeQty: 1,
        motherRecipeUnit: "unidad",
        presentationYield: 10,
        baseCostCents: rootVals.baseCostCents,
        unitTotalCostExactCents: rootVals.unitTotalCostExactCents,
        packagingCostCents: 0,
        additionalCostCents: 0,
        totalCostCents: rootVals.totalCostCents,
        pricingMethod: "MARGIN",
        desiredMarginPercent: 40,
        suggestedPriceCents: rootVals.suggestedPriceCents,
        finalPriceCents: 12000,
        realProfitCents: rootVals.realProfitCents,
        realMarginPercent: rootVals.realMarginPercent,
        isActive: true,
        isComposite: false,
      },
    });

    const groupVals = calculateGroupPresentationValues({
      variantUnitTotalCostExactCents: rootVals.unitTotalCostExactCents,
      groupQty: 5,
      groupPackagingCostCents: 500,
      groupAdditionalCostCents: 0,
      pricingMethod: "MARGIN",
      desiredMarginPercent: 40,
      currentFinalPriceCents: 58000,
    });

    const presGroup = await db.recipePresentation.create({
      data: {
        recipeId: recipe.id,
        parentId: presRoot.id,
        isComposite: true,
        groupQty: 5,
        name: "Caja 5 Porciones Test",
        consumptionMode: "YIELD_PER_BATCH",
        batchFraction: 0.5,
        motherRecipeQty: 5,
        motherRecipeUnit: "unidad",
        presentationYield: 2,
        baseCostCents: groupVals.baseCostCents,
        unitTotalCostExactCents: groupVals.unitTotalCostExactCents,
        packagingCostCents: 500,
        additionalCostCents: 0,
        totalCostCents: groupVals.totalCostCents,
        pricingMethod: "MARGIN",
        desiredMarginPercent: 40,
        suggestedPriceCents: groupVals.suggestedPriceCents,
        finalPriceCents: 58000,
        realProfitCents: groupVals.realProfitCents,
        realMarginPercent: groupVals.realMarginPercent,
        isActive: true,
        materials: {
          create: [
            {
              ingredientId: ingPkg.id,
              materialType: "PACKAGING",
              name: "Caja Cartón Test",
              quantity: 1,
              unit: "ud",
              unitCostCents: 500,
              totalCostCents: 500,
            },
          ],
        },
      },
    });

    const origGroupCostCents = presGroup.totalCostCents;

    const sale = await db.sale.create({
      data: {
        saleDate: new Date(),
        customerName: "Cliente Histórico Test",
        totalCents: 58000,
        totalCostCents: origGroupCostCents,
        collectedCents: 58000,
        balanceCents: 0,
        paymentMethod: "EFECTIVO",
        status: "ACTIVE",
        items: {
          create: [
            {
              recipeId: recipe.id,
              presentationId: presGroup.id,
              productName: "Caja 5 Porciones Test",
              quantity: 1,
              unitPriceCents: 58000,
              totalCents: 58000,
              unitCostCents: origGroupCostCents,
              totalCostCents: origGroupCostCents,
            },
          ],
        },
      },
      include: { items: true },
    });

    const run = await db.priceSyncRun.create({
      data: {
        sourceId: source.id,
        triggerType: "MANUAL_SOURCE",
        status: "OK",
      },
    });

    const propMismatch = await db.priceUpdateProposal.create({
      data: {
        code: "PRP-901",
        runId: run.id,
        ingredientId: ingBase.id,
        sourceId: source.id,
        status: "PENDING",
        applyStrategyUsed: "STRICT_SAME_PACK",
        currentPriceCents: ingBase.packagePriceCents,
        currentCostPerBaseUnit: ingBase.costPerBaseUnit,
        currentIngredientUpdatedAt: ingBase.updatedAt,
        detectedPriceCents: 12000, // RD$ 120 por 16 oz (~RD$ 600 por 5 lb)
        detectedInStock: true,
        detectedPackQty: 16,
        detectedPackUnit: "oz",
        detectedRawTitle: "Azúcar 16 oz",
        proposedPriceCents: 12000,
        proposedCostPerBaseUnit: ingBase.costPerBaseUnit,
        diffPriceCents: -33000,
        diffPercent: -73.33,
        packCheckStatus: "PACK_MISMATCH",
        alertsJson: JSON.stringify(["PACK_MISMATCH"]),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    const propCompetitor = await db.priceUpdateProposal.create({
      data: {
        code: "PRP-901B",
        runId: run.id,
        ingredientId: ingBase.id,
        sourceId: source.id,
        status: "PENDING",
        applyStrategyUsed: "STRICT_SAME_PACK",
        currentPriceCents: ingBase.packagePriceCents,
        currentCostPerBaseUnit: ingBase.costPerBaseUnit,
        currentIngredientUpdatedAt: ingBase.updatedAt,
        detectedPriceCents: 46000,
        detectedInStock: true,
        detectedPackQty: 5,
        detectedPackUnit: "lb",
        detectedRawTitle: "Azúcar 5 lb competidora",
        proposedPriceCents: 46000,
        proposedCostPerBaseUnit: 460 / fiveLbG,
        diffPriceCents: 1000,
        diffPercent: 2.22,
        packCheckStatus: "MATCH",
        alertsJson: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    const weeklyClosesBefore = await db.weeklyClose.findMany({ orderBy: { id: "asc" } });

    // 1. PACK_MISMATCH con STRICT_SAME_PACK siempre se rechaza (incluso con confirmCriticalAlerts)
    await expect(
      approveProposals(
        { proposalIds: [propMismatch.id], confirmCriticalAlerts: true },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "CRITICAL_ALERTS_REQUIRE_CONFIRMATION" });

    // 2. Sin confirmCriticalAlerts, incluso con REBASE_UNIT_COST exige confirmación explícita
    await expect(
      approveProposals(
        {
          proposalIds: [propMismatch.id],
          confirmCriticalAlerts: false,
          overridesByProposalId: { [propMismatch.id]: { applyStrategy: "REBASE_UNIT_COST" } },
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "CRITICAL_ALERTS_REQUIRE_CONFIRMATION" });

    // 3. Simulación read-only con REBASE_UNIT_COST no muta la BD
    const simReport = await simulatePriceImpact(
      [propMismatch.id],
      { [propMismatch.id]: { applyStrategy: "REBASE_UNIT_COST" } },
      db
    );
    const ingAfterSim = await db.ingredient.findUnique({ where: { id: ingBase.id } });
    expect(ingAfterSim.packagePriceCents).toBe(45000);
    expect(simReport.ingredients[0].priceAfterCents).toBeGreaterThan(59000);

    // 4. Aprobación atómica coincide 1:1 con el simulador
    const appReport = await approveProposals(
      {
        proposalIds: [propMismatch.id],
        confirmCriticalAlerts: true,
        overridesByProposalId: { [propMismatch.id]: { applyStrategy: "REBASE_UNIT_COST" } },
        reviewNote: "Rebasado en prueba Vitest",
      },
      db
    );
    expect(appReport.ingredients[0].priceAfterCents).toBe(simReport.ingredients[0].priceAfterCents);
    expect(appReport.recipes[0].batchCostAfterCents).toBe(simReport.recipes[0].batchCostAfterCents);
    expect(appReport.presentations.map((p: any) => p.totalCostAfterCents)).toEqual(
      simReport.presentations.map((p: any) => p.totalCostAfterCents)
    );

    // 5. Doble aprobación falla por CAS optimista (409 CONFLICT_PROPOSAL_STATE)
    await expect(
      approveProposals(
        {
          proposalIds: [propMismatch.id],
          confirmCriticalAlerts: true,
          overridesByProposalId: { [propMismatch.id]: { applyStrategy: "REBASE_UNIT_COST" } },
        },
        db
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT_PROPOSAL_STATE" });

    // 6. Invariantes: Recipe.currentPriceCents, finalPriceCents y SaleItem histórico intactos + RecipePriceHistory creado
    const freshRecipe = await db.recipe.findUnique({ where: { id: recipe.id } });
    expect(freshRecipe.currentPriceCents).toBe(15000);
    expect(freshRecipe.batchCostCents).toBe(appReport.recipes[0].batchCostAfterCents);

    const freshRoot = await db.recipePresentation.findUnique({ where: { id: presRoot.id } });
    const freshGroup = await db.recipePresentation.findUnique({ where: { id: presGroup.id } });
    expect(freshRoot.finalPriceCents).toBe(12000);
    expect(freshGroup.finalPriceCents).toBe(58000);
    expect(freshGroup.totalCostCents).toBeGreaterThan(origGroupCostCents);

    const freshSaleItem = await db.saleItem.findUnique({ where: { id: sale.items[0].id } });
    expect(freshSaleItem.unitPriceCents).toBe(58000);
    expect(freshSaleItem.unitCostCents).toBe(origGroupCostCents);

    const historyRow = await db.recipePriceHistory.findFirst({
      where: { recipeId: recipe.id, proposalId: propMismatch.id },
    });
    expect(historyRow).toBeTruthy();
    expect(historyRow.reason).toBe("portal_price_approval");

    // 6b. Propuesta PENDING competidora expiró automáticamente y WeeklyClose intactos
    const freshComp = await db.priceUpdateProposal.findUnique({ where: { id: propCompetitor.id } });
    expect(freshComp.status).toBe("EXPIRED");
    const weeklyClosesAfter = await db.weeklyClose.findMany({ orderBy: { id: "asc" } });
    expect(weeklyClosesAfter).toEqual(weeklyClosesBefore);

    // 7. Drift check (STALE_PROPOSAL) cuando el insumo fue editado manualmente tras la propuesta
    const propDrift = await db.priceUpdateProposal.create({
      data: {
        code: "PRP-902",
        runId: run.id,
        ingredientId: ingPkg.id,
        sourceId: source.id,
        status: "PENDING",
        applyStrategyUsed: "STRICT_SAME_PACK",
        currentPriceCents: ingPkg.packagePriceCents,
        currentCostPerBaseUnit: ingPkg.costPerBaseUnit,
        currentIngredientUpdatedAt: ingPkg.updatedAt,
        detectedPriceCents: 60000,
        detectedInStock: true,
        detectedPackQty: 100,
        detectedPackUnit: "ud",
        detectedRawTitle: "Caja Cartón 100 uds",
        proposedPriceCents: 60000,
        proposedCostPerBaseUnit: 6,
        diffPriceCents: 10000,
        diffPercent: 20,
        packCheckStatus: "MATCH",
        alertsJson: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await new Promise((r) => setTimeout(r, 25));
    await db.ingredient.update({
      where: { id: ingPkg.id },
      data: { notes: "Editado manualmente antes de aprobar" },
    });

    await expect(
      approveProposals({ proposalIds: [propDrift.id] }, db)
    ).rejects.toMatchObject({ statusCode: 409, code: "STALE_PROPOSAL" });

    // 8. ADOPT_SOURCE_PACK adopta nuevo empaque (16 oz) y recalcula factor sin herencia corrupta
    const latestIngBase = await db.ingredient.findUnique({ where: { id: ingBase.id } });
    const propAdopt = await db.priceUpdateProposal.create({
      data: {
        code: "PRP-903",
        runId: run.id,
        ingredientId: ingBase.id,
        sourceId: source.id,
        status: "PENDING",
        applyStrategyUsed: "STRICT_SAME_PACK",
        currentPriceCents: latestIngBase.packagePriceCents,
        currentCostPerBaseUnit: latestIngBase.costPerBaseUnit,
        currentIngredientUpdatedAt: latestIngBase.updatedAt,
        detectedPriceCents: 13000,
        detectedInStock: true,
        detectedPackQty: 16,
        detectedPackUnit: "oz",
        detectedRawTitle: "Azúcar 16 oz",
        proposedPriceCents: 13000,
        proposedCostPerBaseUnit: latestIngBase.costPerBaseUnit,
        diffPriceCents: -47000,
        diffPercent: -78,
        packCheckStatus: "PACK_MISMATCH",
        alertsJson: JSON.stringify(["PACK_MISMATCH"]),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // 8. ADOPT_SOURCE_PACK + override combinado de precio manual adopta empaque y recalcula costo base
    const simAdopt = await simulatePriceImpact(
      [propAdopt.id],
      { [propAdopt.id]: { applyStrategy: "ADOPT_SOURCE_PACK", proposedPriceCents: 13500 } },
      db
    );
    await approveProposals(
      {
        proposalIds: [propAdopt.id],
        confirmCriticalAlerts: true,
        overridesByProposalId: { [propAdopt.id]: { applyStrategy: "ADOPT_SOURCE_PACK", proposedPriceCents: 13500 } },
      },
      db
    );

    const adoptedIng = await db.ingredient.findUnique({ where: { id: ingBase.id } });
    expect(adoptedIng.packageQty).toBe(16);
    expect(adoptedIng.packageUnit).toBe("oz");
    expect(adoptedIng.packagePriceCents).toBe(13500);
    expect(adoptedIng.conversionFactor).toBeCloseTo(28.349523125, 4);
    expect(adoptedIng.factorId).toBeNull();
    expect(adoptedIng.costPerBaseUnit).toBeCloseTo(simAdopt.ingredients[0].costPerBaseAfter, 6);
  });
});

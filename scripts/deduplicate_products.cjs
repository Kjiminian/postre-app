const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

// Pares explícitos [duplicateCodeToRemove, survivorCodeToKeep]
// Se reasignan todas las referencias en RecipeIngredient y PresentationMaterial antes de eliminar.
const MERGE_PAIRS = [
  ["PROD-104", "PROD-004"], // Azúcar Blanca 5 lb RD$160 (mismo producto que PROD-004)
  ["PROD-014", "PROD-131"], // Dulce de Leche Ombú
  ["PROD-027", "PROD-131"], // Dulce de Leche Ombu 1g placeholder
  ["PROD-117", "PROD-131"], // Dulce de Leche Ombu sin suplidor (PROD-131 tiene 3i+)
  ["PROD-023", "PROD-133"], // Cocoa Amarga (PROD-133 tiene Henrry y empaque completo)
  ["PROD-024", "PROD-222"], // Capacillos Pequeños (PROD-222 tiene Henrry 500 uds)
  ["PROD-030", "PROD-120"], // Galleta Oreo (PROD-120 tiene empaque 432g)
  ["PROD-046", "PROD-180"], // Papel Triturado (PROD-180 tiene Lendoiro)
  ["PROD-050", "PROD-132"], // Gelatina sin Sabor (PROD-132 tiene Henrry 2 lb)
  ["PROD-051", "PROD-228"], // Vaso de Shots 2oz (PROD-228 tiene Henrry 50 uds)
  ["PROD-052", "PROD-227"], // Cucharas Mini (PROD-227 tiene 50 uds)
  ["PROD-061", "PROD-137"], // Cóctel de Frutas
  ["PROD-063", "PROD-141"], // Galletas María (PROD-141 tiene 4 paquetes)
  ["PROD-065", "PROD-245"], // Bandeja Triangular Quesillo genérica -> 3i+
  ["PROD-066", "PROD-124"], // Cherry (PROD-124 tiene 16 oz)
  ["PROD-069", "PROD-226"], // Bowl Gourmet (PROD-226 tiene Henrry 12 uds)
  ["PROD-072", "PROD-163"], // Aceite (PROD-163 tiene 1.89 l)
  ["PROD-077", "PROD-139"], // Pan de Agua (PROD-139 tiene 10 uds)
  ["PROD-078", "PROD-217"], // Bandeja Cuadradita (PROD-217 tiene Henrry)
  ["PROD-181", "PROD-200"], // Fondant 4 oz RD$120 (PROD-200 tiene 3i+)
  ["PROD-101", "PROD-172"], // Harina 5 lb RD$207.95 vs RD$208.00 (PROD-172 sin error 453g)
  ["PROD-113", "PROD-003"], // Mantequilla Margarina duplicada si se prefiere conservar solo 1? No, 15oz vs 5lb son distintos; solo se fusionan duplicados reales arriba.
];

// Mantener Mantequilla Margarina 15oz vs 5lb separados porque son presentaciones distintas:
const EFFECTIVE_PAIRS = MERGE_PAIRS.filter(([dup]) => dup !== "PROD-113");

async function main() {
  const all = await prisma.ingredient.findMany({
    select: { id: true, code: true, name: true },
  });
  const byCode = new Map(all.map((i) => [i.code, i]));

  const merged = [];
  await prisma.$transaction(async (tx) => {
    for (const [dupCode, keepCode] of EFFECTIVE_PAIRS) {
      const dup = byCode.get(dupCode);
      const keep = byCode.get(keepCode);
      if (!dup || !keep || dup.id === keep.id) continue;

      await tx.recipeIngredient.updateMany({
        where: { ingredientId: dup.id },
        data: { ingredientId: keep.id },
      });

      await tx.presentationMaterial.updateMany({
        where: { ingredientId: dup.id },
        data: { ingredientId: keep.id },
      });

      await tx.ingredient.delete({ where: { id: dup.id } });
      merged.push({ removed: dupCode, kept: keepCode, name: keep.name });
    }
  });

  const remaining = await prisma.ingredient.count();
  console.log(JSON.stringify({ ok: true, mergedCount: merged.length, remainingProducts: remaining, merged }));
}

main()
  .catch((err) => {
    console.error("Deduplicate error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

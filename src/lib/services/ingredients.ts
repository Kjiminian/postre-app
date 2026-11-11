// Servicio de Ingredientes e Insumos — K_Sweet (RF-010, RF-011)
import { prisma } from "@/lib/prisma";
import { normalizeToBase } from "@/lib/conversions";

export interface CreateIngredientInput {
  name: string;
  supplierId?: string;
  packagePriceCents: number;
  packageQty: number;
  packageUnit: string;
  baseUnit: string;
  density?: number;
  notes?: string;
  reviewFlag?: boolean;
}

/**
 * Calcula el costo unitario por unidad base (g, ml o unidad)
 * respetando conversiones de masa/volumen y densidad
 */
export function calculateCostPerBaseUnit(
  packagePriceCents: number,
  packageQty: number,
  packageUnit: string,
  baseUnit: string,
  density?: number
): number {
  const norm = normalizeToBase(packageQty, packageUnit, baseUnit, density);
  if (!norm.ok) {
    throw new Error(`Error calculando costo base: ${norm.error}`);
  }
  if (norm.value <= 0) throw new Error("La cantidad del empaque en unidad base debe ser mayor a 0");
  return packagePriceCents / norm.value; // centavos por unidad base (ej: centavos por gramo)
}

/**
 * Registra o actualiza un ingrediente recalculando el costo por unidad base.
 * No fusiona variantes automáticamente: si existe nombre similar o duplicado,
 * se respeta o se marca para revisión manual (RF-011).
 */
export async function createIngredient(input: CreateIngredientInput) {
  // Verificar posible duplicado por nombre exacto
  const existing = await prisma.ingredient.findFirst({
    where: { name: { equals: input.name } },
  });

  if (existing) {
    throw new Error(
      `Ya existe un ingrediente con el nombre exacto "${input.name}". Bajo RF-011, no se fusionan variantes automáticamente. Edite el existente o use un nombre diferenciado.`
    );
  }

  const costPerBaseUnit = calculateCostPerBaseUnit(
    input.packagePriceCents,
    input.packageQty,
    input.packageUnit,
    input.baseUnit,
    input.density
  );

  return await prisma.ingredient.create({
    data: {
      name: input.name,
      supplierId: input.supplierId || null,
      packagePriceCents: input.packagePriceCents,
      packageQty: input.packageQty,
      packageUnit: input.packageUnit,
      baseUnit: input.baseUnit,
      costPerBaseUnit,
      density: input.density || null,
      notes: input.notes || null,
      reviewFlag: input.reviewFlag ?? false,
    },
  });
}

/**
 * Actualiza un ingrediente y desencadena el recálculo en cascada
 * de todas las recetas que lo utilizan (RF-014).
 */
export async function updateIngredient(id: string, input: Partial<CreateIngredientInput>) {
  const current = await prisma.ingredient.findUnique({
    where: { id },
  });

  if (!current) throw new Error("Ingrediente no encontrado");

  const packagePriceCents = input.packagePriceCents ?? current.packagePriceCents;
  const packageQty = input.packageQty ?? current.packageQty;
  const packageUnit = input.packageUnit ?? current.packageUnit;
  const baseUnit = input.baseUnit ?? current.baseUnit;
  const density = input.density !== undefined ? input.density : (current.density ?? undefined);

  const costPerBaseUnit = calculateCostPerBaseUnit(
    packagePriceCents,
    packageQty,
    packageUnit,
    baseUnit,
    density
  );

  const updated = await prisma.ingredient.update({
    where: { id },
    data: {
      name: input.name ?? current.name,
      supplierId: input.supplierId !== undefined ? input.supplierId : current.supplierId,
      packagePriceCents,
      packageQty,
      packageUnit,
      baseUnit,
      costPerBaseUnit,
      density: density || null,
      notes: input.notes !== undefined ? input.notes : current.notes,
      reviewFlag: input.reviewFlag !== undefined ? input.reviewFlag : current.reviewFlag,
    },
  });

  // Al actualizar ingrediente, se deben recalcular las recetas afectadas
  // (sin modificar costos históricos ya congelados en ventas pasadas, RF-014)
  return updated;
}

/**
 * Utilidades para generación y formateo de IDs identificadores legibles (SUP-001, CAT-001, etc.).
 */

export const ENTITY_CODE_PREFIX = {
  SUPPLIER: "SUP",
  CATEGORY: "CAT",
  UNIT: "UNI",
  FACTOR: "FAC",
  CUSTOMER: "CLI",
  PRODUCT: "PROD",
} as const;

export function formatSequentialCode(prefix: string, sequenceNumber: number): string {
  const safeNum = Math.max(1, Math.floor(sequenceNumber));
  return `${prefix}-${String(safeNum).padStart(3, "0")}`;
}

export function parseSequentialNumber(code: string | null | undefined, prefix: string): number {
  if (!code) return 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = code.match(new RegExp(`^${escaped}-(\\d+)$`, "i"));
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNextSequentialCode(
  existingCodes: Array<string | null | undefined>,
  prefix: string
): string {
  let maxNum = 0;
  for (const code of existingCodes) {
    const num = parseSequentialNumber(code, prefix);
    if (num > maxNum) maxNum = num;
  }
  return formatSequentialCode(prefix, maxNum + 1);
}

/**
 * Ejecuta una creación asignando el siguiente código secuencial y reintentando
 * si ocurre una colisión de unicidad (P2002) bajo concurrencia.
 */
export async function createWithSequentialCode<T>(
  fetchExistingCodes: () => Promise<Array<string | null | undefined>>,
  prefix: string,
  createFn: (code: string) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const existingCodes = await fetchExistingCodes();
    const nextCode = getNextSequentialCode(existingCodes, prefix);
    try {
      return await createFn(nextCode);
    } catch (error: any) {
      const isCodeCollision =
        error?.code === "P2002" &&
        Array.isArray(error?.meta?.target) &&
        error.meta.target.includes("code");
      if (isCodeCollision && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
  throw new Error(`No se pudo generar un código único para el prefijo ${prefix}`);
}

export function slugifyCategory(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "CATEGORIA";
}

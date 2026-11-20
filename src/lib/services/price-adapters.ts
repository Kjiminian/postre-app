// Adaptadores de Portales RD, Validación SSRF, Parser de Empaques y Plan B Asistido
// GEM PROYECTOS SOFTWARE V3.0 (PRE-003, PRE-004, PRE-005)

import dns from "dns";
import { convertUnit, normalizeUnitAlias } from "@/lib/conversions";
import { calculateIngredientBaseCost } from "@/lib/ingredient-cost";

export type AdapterType =
  | "VTEX_IO"
  | "SHOPIFY_JSON"
  | "WOOCOMMERCE_HTML"
  | "GENERIC_HTML"
  | "MANUAL_ASSISTED";

export type ApplyStrategy = "STRICT_SAME_PACK" | "REBASE_UNIT_COST" | "ADOPT_SOURCE_PACK";
export type PackCheckStatus = "MATCH" | "UNIT_CONVERTED" | "PACK_MISMATCH" | "UNIT_INCOMPATIBLE" | "UNKNOWN";

export interface DetectedVariantOption {
  id: string;
  sku?: string;
  title: string;
  priceCents: number;
  inStock: boolean;
  packQty: number | null;
  packUnit: string | null;
}

export interface PortalFetchResult {
  status: "OK" | "BLOCKED" | "ERROR";
  title?: string;
  priceCents?: number;
  inStock?: boolean;
  packQty?: number | null;
  packUnit?: string | null;
  variants?: DetectedVariantOption[];
  ambiguousVariant?: boolean;
  ambiguousPriceRange?: boolean;
  evidenceUrl?: string;
  error?: string;
}

// ─── Seguridad SSRF (PRE-004) ─────────────────────────────────────────────────

export function isPrivateOrReservedIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  // IPv6 loopback, unspecified, link-local (fe80::/10) y unique-local (fc00::/7)
  if (clean === "::1" || clean === "::") return true;
  if (/^fe[89ab][0-9a-f]?:/i.test(clean) || clean.startsWith("fc") || clean.startsWith("fd")) {
    return true;
  }
  if (clean.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(clean.slice(7));
  }
  const parts = clean.split(".").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function validateExternalUrlSyntax(
  urlStr: string,
  allowedBaseUrl?: string | null
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { ok: false, error: "URL externa inválida." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Solo se permiten URLs seguras HTTPS." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "Host local o interno bloqueado por seguridad." };
  }

  if (isPrivateOrReservedIp(host)) {
    return { ok: false, error: "Direcciones IP privadas o reservadas bloqueadas por seguridad." };
  }

  if (allowedBaseUrl) {
    try {
      const allowedHost = new URL(allowedBaseUrl).hostname.toLowerCase().replace(/^www\./, "");
      const cleanHost = host.replace(/^www\./, "");
      if (cleanHost !== allowedHost && !cleanHost.endsWith(`.${allowedHost}`)) {
        return {
          ok: false,
          error: `La URL debe pertenecer al dominio de la fuente (${allowedHost}).`,
        };
      }
    } catch {
      return { ok: false, error: "Base URL de la fuente configurada inválida." };
    }
  }

  return { ok: true, url: parsed };
}

export async function validateExternalUrlSafe(
  urlStr: string,
  allowedBaseUrl?: string | null,
  lookupFn: (hostname: string) => Promise<Array<{ address: string }>> = async (h) =>
    dns.promises.lookup(h, { all: true })
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  const syntax = validateExternalUrlSyntax(urlStr, allowedBaseUrl);
  if (!syntax.ok) return syntax;

  try {
    const records = await lookupFn(syntax.url.hostname);
    if (!records || records.length === 0) {
      return { ok: false, error: "No se pudo resolver el dominio indicado." };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, error: "El dominio resuelve a una IP privada o reservada (SSRF bloqueado)." };
      }
    }
    return { ok: true, url: syntax.url };
  } catch {
    return { ok: false, error: "Error resolviendo DNS del dominio." };
  }
}

function isWafOrCaptchaChallenge(status: number, bodyText: string): boolean {
  if (status === 403 || status === 429) return true;
  const lower = bodyText.slice(0, 8000).toLowerCase();
  return (
    lower.includes("cf-browser-verification") ||
    lower.includes("just a moment...") ||
    lower.includes("attention required! | cloudflare") ||
    lower.includes("challenge-platform") ||
    lower.includes("g-recaptcha") ||
    lower.includes("hcaptcha")
  );
}

export async function safeFetchPortal(
  urlStr: string,
  opts: {
    allowedBaseUrl?: string | null;
    timeoutMs?: number;
    maxBytes?: number;
    accept?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<
  | { status: "OK"; body: string; finalUrl: string; contentType: string }
  | { status: "BLOCKED" | "ERROR"; error: string }
> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const doFetch = opts.fetchImpl ?? fetch;

  let currentUrl = urlStr;
  let hops = 0;

  while (hops <= 3) {
    const check = await validateExternalUrlSafe(currentUrl, hops === 0 ? opts.allowedBaseUrl : null);
    if (!check.ok) {
      return { status: "ERROR", error: check.error };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await doFetch(check.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "K_Sweet-PriceChecker/1.0 (+https://ksweet.local)",
          Accept: opts.accept || "application/json,text/html;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-DO,es;q=0.9,en;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { status: "ERROR", error: "Redirección sin destino válido." };
        currentUrl = new URL(loc, check.url).toString();
        hops += 1;
        continue;
      }

      const contentLength = Number(res.headers.get("content-length") || 0);
      if (contentLength > maxBytes) {
        return { status: "ERROR", error: "La respuesta del portal excede el tamaño máximo permitido (2 MB)." };
      }

      const rawText = await res.text();
      if (Buffer.byteLength(rawText, "utf8") > maxBytes) {
        return { status: "ERROR", error: "El cuerpo HTML/JSON del portal excede 2 MB." };
      }

      if (isWafOrCaptchaChallenge(res.status, rawText)) {
        return {
          status: "BLOCKED",
          error: `Portal bloqueado por protección anti-bot/Cloudflare (HTTP ${res.status}). Usa Captura Asistida (Plan B).`,
        };
      }

      if (!res.ok) {
        return { status: "ERROR", error: `El portal respondió HTTP ${res.status}.` };
      }

      return {
        status: "OK",
        body: rawText,
        finalUrl: check.url.toString(),
        contentType: res.headers.get("content-type") || "",
      };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return { status: "ERROR", error: `Tiempo de espera agotado (${timeoutMs} ms).` };
      }
      return { status: "ERROR", error: err?.message || "Error de red al consultar portal." };
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: "ERROR", error: "Demasiadas redirecciones al consultar portal." };
}

// ─── Parsers de Precio RD$ y Presentación ────────────────────────────────────

export function parseDopPriceToCents(raw: string | number | null | undefined): {
  ok: true;
  cents: number;
} | { ok: false; error: string; isRange?: boolean } {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return { ok: false, error: "Precio numérico inválido." };
    return { ok: true, cents: Math.round(raw * 100) };
  }

  const text = String(raw || "").trim();
  if (!text) return { ok: false, error: "Precio vacío." };

  // Detectar rangos de precio (ej. "RD$ 150.00 - RD$ 450.00" o "150 – 450")
  if (/(?:rd\$|\$|dop)?\s*\d[\d.,]*\s*[-–]\s*(?:rd\$|\$|dop)?\s*\d[\d.,]*/i.test(text)) {
    return { ok: false, error: "Rango de precios ambiguo; selecciona una variante específica.", isRange: true };
  }

  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return { ok: false, error: "No se encontró monto numérico." };

  let normalized = cleaned;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Último separador suele ser el decimal
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length <= 2) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num) || num <= 0) {
    return { ok: false, error: "Monto RD$ inválido o menor/igual a cero." };
  }

  return { ok: true, cents: Math.round(num * 100) };
}

export function extractPackFromTitle(title: string): { packQty: number | null; packUnit: string | null } {
  const clean = String(title || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return { packQty: null, packUnit: null };

  // 1. Multipack con peso/volumen: "Pack 6 x 315 g" o "6x315g"
  const multiMatch = clean.match(
    /(?:pack\s*)?(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|onzas?\s*l[ií]quidas?|gramos?|grs?|g|kilos?|kilogramos?|kg|libras?|lbs?|lb|onzas?|oz|mililitros?|ml|litros?|lt|l|unidades?|uds?|unds?|piezas?)\b/i
  );
  if (multiMatch) {
    const mult = Number.parseFloat(multiMatch[1]);
    const qtyEach = Number.parseFloat(multiMatch[2].replace(",", "."));
    const unit = normalizeUnitAlias(multiMatch[3]);
    if (Number.isFinite(mult) && Number.isFinite(qtyEach) && mult > 0 && qtyEach > 0) {
      return { packQty: Number((mult * qtyEach).toFixed(4)), packUnit: unit };
    }
  }

  // 2. Cantidad + unidad simple: "5 lbs", "16 fl oz", "315g", "2.2 lb", "50 uds"
  const singleMatch = clean.match(
    /(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|onzas?\s*l[ií]quidas?|gramos?|grs?|g|kilos?|kilogramos?|kg|libras?|lbs?|lb|onzas?|oz|mililitros?|ml|litros?|lt|l|unidades?|uds?|unds?|piezas?|paquetes?|pack)\b/i
  );
  if (singleMatch) {
    const qty = Number.parseFloat(singleMatch[1].replace(",", "."));
    const unit = normalizeUnitAlias(singleMatch[2]);
    if (Number.isFinite(qty) && qty > 0) {
      return { packQty: qty, packUnit: unit };
    }
  }

  return { packQty: null, packUnit: null };
}

// ─── Parsers por Tipo de Portal ───────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function extractJsonLdProducts(html: string): any[] {
  const scripts: any[] = [];
  const rx = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : [parsed];
      for (const item of items) {
        if (item && (item["@type"] === "Product" || (Array.isArray(item["@type"]) && item["@type"].includes("Product")))) {
          scripts.push(item);
        }
      }
    } catch {
      // Ignorar bloques JSON-LD malformados
    }
  }
  return scripts;
}

export function parseHtmlProductPayload(html: string, evidenceUrl: string): PortalFetchResult {
  const products = extractJsonLdProducts(html);
  for (const prod of products) {
    const title = decodeHtmlEntities(String(prod.name || ""));
    const offersRaw = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
    if (offersRaw) {
      const low = offersRaw.lowPrice ?? offersRaw.price;
      const high = offersRaw.highPrice;
      if (high !== undefined && low !== undefined && Number(high) > Number(low)) {
        return {
          status: "ERROR",
          title,
          ambiguousPriceRange: true,
          evidenceUrl,
          error: "Producto con rango variable de precios; selecciona una URL con variante fija.",
        };
      }
      const parsedPrice = parseDopPriceToCents(low);
      if (parsedPrice.ok) {
        const avail = String(offersRaw.availability || "").toLowerCase();
        const inStock = !avail.includes("outofstock") && !avail.includes("soldout");
        const pack = extractPackFromTitle(title);
        return {
          status: "OK",
          title,
          priceCents: parsedPrice.cents,
          inStock,
          packQty: pack.packQty,
          packUnit: pack.packUnit,
          evidenceUrl,
        };
      }
    }
  }

  // Fallback meta tags (og:price:amount / product:price:amount / og:title)
  const priceMeta =
    html.match(/<meta[^>]+property=["'](?:product|og):price:amount["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:product|og):price:amount["']/i);
  const titleMeta =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);

  if (priceMeta) {
    const parsedPrice = parseDopPriceToCents(priceMeta[1]);
    if (parsedPrice.ok) {
      const title = decodeHtmlEntities(titleMeta ? titleMeta[1] : "Producto Portal");
      const pack = extractPackFromTitle(title);
      return {
        status: "OK",
        title,
        priceCents: parsedPrice.cents,
        inStock: !/agotado|out of stock/i.test(html),
        packQty: pack.packQty,
        packUnit: pack.packUnit,
        evidenceUrl,
      };
    }
  }

  return {
    status: "ERROR",
    evidenceUrl,
    error: "No se pudo extraer el precio del HTML del producto.",
  };
}

export function buildShopifyJsonUrl(externalUrl: string): string | null {
  try {
    const u = new URL(externalUrl);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const match = cleanPath.match(/\/products\/([^/]+)$/i);
    if (!match) return null;
    return `${u.origin}/products/${match[1]}.json`;
  } catch {
    return null;
  }
}

export function parseShopifyProductJson(
  jsonText: string,
  externalUrl: string,
  externalSku?: string | null
): PortalFetchResult {
  try {
    const parsed = JSON.parse(jsonText);
    const product = parsed?.product || parsed;
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
      return { status: "ERROR", evidenceUrl: externalUrl, error: "JSON de Shopify sin variantes válidas." };
    }

    const baseTitle = decodeHtmlEntities(String(product.title || ""));
    const urlObj = new URL(externalUrl);
    const urlVariantId = urlObj.searchParams.get("variant");

    const variants: DetectedVariantOption[] = product.variants
      .map((v: any) => {
        const p = parseDopPriceToCents(v.price);
        const fullTitle =
          v.title && v.title !== "Default Title" ? `${baseTitle} — ${v.title}` : baseTitle;
        const pack = extractPackFromTitle(fullTitle);
        return {
          id: String(v.id),
          sku: v.sku ? String(v.sku) : undefined,
          title: fullTitle,
          priceCents: p.ok ? p.cents : 0,
          inStock: v.available !== undefined ? Boolean(v.available) : (v.inventory_quantity ?? 1) > 0,
          packQty: pack.packQty,
          packUnit: pack.packUnit,
        };
      })
      .filter((v: DetectedVariantOption) => v.priceCents > 0);

    if (variants.length === 0) {
      return { status: "ERROR", evidenceUrl: externalUrl, error: "Sin precios positivos en variantes Shopify." };
    }

    let selected: DetectedVariantOption | undefined;
    if (urlVariantId) {
      selected = variants.find((v) => v.id === urlVariantId);
    }
    if (!selected && externalSku) {
      selected = variants.find((v) => v.id === externalSku || v.sku === externalSku);
    }
    if (!selected && variants.length === 1) {
      selected = variants[0];
    }

    if (!selected) {
      // Hay múltiples variantes y ningún selector unívoco -> no adivinar variants[0]
      return {
        status: "OK",
        title: variants[0].title,
        priceCents: variants[0].priceCents,
        inStock: variants[0].inStock,
        packQty: variants[0].packQty,
        packUnit: variants[0].packUnit,
        variants,
        ambiguousVariant: true,
        evidenceUrl: externalUrl,
      };
    }

    return {
      status: "OK",
      title: selected.title,
      priceCents: selected.priceCents,
      inStock: selected.inStock,
      packQty: selected.packQty,
      packUnit: selected.packUnit,
      variants,
      ambiguousVariant: false,
      evidenceUrl: externalUrl,
    };
  } catch {
    return { status: "ERROR", evidenceUrl: externalUrl, error: "Respuesta JSON de Shopify inválida." };
  }
}

export async function fetchPortalProduct(params: {
  adapterType: string;
  externalUrl: string;
  externalSku?: string | null;
  allowedBaseUrl?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<PortalFetchResult> {
  if (params.adapterType === "SHOPIFY_JSON") {
    const jsonUrl = buildShopifyJsonUrl(params.externalUrl);
    if (jsonUrl) {
      const res = await safeFetchPortal(jsonUrl, {
        allowedBaseUrl: params.allowedBaseUrl,
        timeoutMs: params.timeoutMs,
        accept: "application/json",
        fetchImpl: params.fetchImpl,
      });
      if (res.status === "OK") {
        return parseShopifyProductJson(res.body, params.externalUrl, params.externalSku);
      }
      if (res.status === "BLOCKED") return res;
    }
  }

  const htmlRes = await safeFetchPortal(params.externalUrl, {
    allowedBaseUrl: params.allowedBaseUrl,
    timeoutMs: params.timeoutMs,
    accept: "text/html,application/xhtml+xml",
    fetchImpl: params.fetchImpl,
  });

  if (htmlRes.status !== "OK") {
    return htmlRes;
  }

  return parseHtmlProductPayload(htmlRes.body, htmlRes.finalUrl);
}

// ─── ITBIS RD y Evaluación de Compatibilidad de Empaques (PRE-003, PRE-005) ────

export function applyTaxMode(priceCents: number, taxMode: string, taxRatePct: number): number {
  if (taxMode === "INCLUDED") return priceCents;
  if (taxMode === "PLUS_ITBIS" || taxMode === "PLUS_ITBIS_18") {
    const safeRate = Number.isFinite(taxRatePct) && taxRatePct >= 0 ? taxRatePct : 0;
    return Math.round(priceCents * (1 + safeRate / 100));
  }
  return priceCents;
}

export interface PackEvaluationResult {
  packCheckStatus: PackCheckStatus;
  proposedPriceCents: number;
  proposedCostPerBaseUnit: number;
  proposedPackageQty: number | null;
  proposedPackageUnit: string | null;
  proposedConversionFactor: number | null;
  diffPriceCents: number;
  diffPercent: number;
  alerts: string[];
}

export function evaluatePackCompatibility(params: {
  currentPackagePriceCents: number;
  currentPackageQty: number;
  currentPackageUnit: string;
  currentBaseUnit: string;
  currentConversionFactor: number;
  hasExplicitFactor: boolean;
  currentCostPerBaseUnit: number;
  density?: number | null;
  detectedPriceCents: number; // Ya con ITBIS aplicado
  detectedInStock: boolean;
  detectedPackQty?: number | null;
  detectedPackUnit?: string | null;
  packTolerancePct?: number;
  applyStrategy: ApplyStrategy;
  priceAlertThresholdPct?: number;
  ambiguousVariant?: boolean;
  ambiguousPriceRange?: boolean;
}): PackEvaluationResult {
  const tolerancePct = params.packTolerancePct ?? 5;
  const thresholdPct = params.priceAlertThresholdPct ?? 20;
  const alerts: string[] = [];

  if (!params.detectedInStock) alerts.push("OUT_OF_STOCK");
  if (params.ambiguousVariant) alerts.push("AMBIGUOUS_VARIANT");
  if (params.ambiguousPriceRange) alerts.push("AMBIGUOUS_PRICE_RANGE");

  const currentBaseCost = calculateIngredientBaseCost({
    packagePriceCents: params.currentPackagePriceCents,
    packageQty: params.currentPackageQty,
    packageUnit: params.currentPackageUnit,
    baseUnit: params.currentBaseUnit,
    conversionFactor: params.currentConversionFactor,
    hasExplicitFactor: params.hasExplicitFactor,
    density: params.density,
  });

  const currentEffectiveBaseQty = currentBaseCost.ok
    ? currentBaseCost.effectiveBaseQty
    : params.currentPackageQty * (params.currentConversionFactor || 1);

  let packCheckStatus: PackCheckStatus = "UNKNOWN";
  let detectedInBaseQty: number | null = null;
  let detectedFactorToBase: number | null = null;

  if (params.detectedPackQty && params.detectedPackQty > 0 && params.detectedPackUnit) {
    const normDetectedUnit = normalizeUnitAlias(params.detectedPackUnit);
    const normCurrentPkg = normalizeUnitAlias(params.currentPackageUnit);
    const normBase = normalizeUnitAlias(params.currentBaseUnit);

    if (normDetectedUnit === normCurrentPkg && Math.abs(params.detectedPackQty - params.currentPackageQty) / params.currentPackageQty <= tolerancePct / 100) {
      packCheckStatus = "MATCH";
      detectedInBaseQty = currentEffectiveBaseQty;
      detectedFactorToBase = params.currentConversionFactor;
    } else {
      const conv = convertUnit(
        params.detectedPackQty,
        normDetectedUnit,
        normBase,
        params.density ?? undefined
      );

      if (!conv.ok) {
        packCheckStatus = "UNIT_INCOMPATIBLE";
        alerts.push("UNIT_INCOMPATIBLE");
      } else {
        detectedInBaseQty = conv.value;
        detectedFactorToBase = conv.value / params.detectedPackQty;
        const deltaPct = Math.abs(conv.value - currentEffectiveBaseQty) / Math.max(currentEffectiveBaseQty, 0.0001) * 100;
        if (deltaPct <= tolerancePct) {
          packCheckStatus = "UNIT_CONVERTED";
        } else {
          packCheckStatus = "PACK_MISMATCH";
          alerts.push("PACK_MISMATCH");
        }
      }
    }
  } else {
    alerts.push("UNKNOWN_PACK");
  }

  let proposedPriceCents = params.detectedPriceCents;
  let proposedCostPerBaseUnit =
    currentEffectiveBaseQty > 0 ? params.detectedPriceCents / 100 / currentEffectiveBaseQty : params.currentCostPerBaseUnit;
  let proposedPackageQty: number | null = null;
  let proposedPackageUnit: string | null = null;
  let proposedConversionFactor: number | null = null;

  if (params.applyStrategy === "REBASE_UNIT_COST" && detectedInBaseQty && detectedInBaseQty > 0) {
    const newUnitCostRD = params.detectedPriceCents / 100 / detectedInBaseQty;
    proposedCostPerBaseUnit = newUnitCostRD;
    proposedPriceCents = Math.round(newUnitCostRD * currentEffectiveBaseQty * 100);
  } else if (
    params.applyStrategy === "ADOPT_SOURCE_PACK" &&
    detectedInBaseQty &&
    detectedInBaseQty > 0 &&
    params.detectedPackQty &&
    params.detectedPackUnit
  ) {
    const adoptUnit = normalizeUnitAlias(params.detectedPackUnit);
    const adoptFactor = detectedFactorToBase ?? 1;
    const adoptedCost = calculateIngredientBaseCost({
      packagePriceCents: params.detectedPriceCents,
      packageQty: params.detectedPackQty,
      packageUnit: adoptUnit,
      baseUnit: params.currentBaseUnit,
      conversionFactor: adoptFactor,
      hasExplicitFactor: false,
      density: params.density,
    });
    proposedPriceCents = params.detectedPriceCents;
    proposedPackageQty = params.detectedPackQty;
    proposedPackageUnit = adoptUnit;
    proposedConversionFactor = adoptFactor;
    proposedCostPerBaseUnit = adoptedCost.ok
      ? adoptedCost.costPerBaseUnit
      : params.detectedPriceCents / 100 / detectedInBaseQty;
  }

  const diffPriceCents = proposedPriceCents - params.currentPackagePriceCents;
  const diffPercent =
    params.currentPackagePriceCents > 0
      ? Number(((diffPriceCents / params.currentPackagePriceCents) * 100).toFixed(2))
      : 0;

  if (diffPercent >= thresholdPct) alerts.push("PRICE_SPIKE_GT_20");
  if (diffPercent <= -30) alerts.push("PRICE_DROP_GT_30");

  return {
    packCheckStatus,
    proposedPriceCents,
    proposedCostPerBaseUnit,
    proposedPackageQty,
    proposedPackageUnit,
    proposedConversionFactor,
    diffPriceCents,
    diffPercent,
    alerts,
  };
}

// ─── Parser Plan B: Texto WhatsApp / CSV / Tabla Excel ────────────────────────

export interface AssistedParsedLine {
  rawLine: string;
  matchedIngredientId: string | null;
  matchedIngredientCode: string | null;
  matchedIngredientName: string | null;
  matchConfidence: "EXACT_CODE" | "EXACT_NAME" | "FUZZY" | "UNMATCHED";
  detectedTitle: string;
  detectedPriceCents: number | null;
  detectedPackQty: number | null;
  detectedPackUnit: string | null;
}

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAssistedPriceLines(
  rawText: string,
  ingredients: Array<{ id: string; code: string | null; name: string }>
): AssistedParsedLine[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const byCode = new Map(
    ingredients.filter((i) => i.code).map((i) => [i.code!.toUpperCase(), i])
  );
  const byName = new Map(ingredients.map((i) => [normText(i.name), i]));

  return lines.map((line) => {
    // 1. Detectar código PROD-XXX explícito
    const codeMatch = line.match(/\b(PROD-\d+)\b/i);
    let matched: { id: string; code: string | null; name: string } | undefined;
    let matchConfidence: AssistedParsedLine["matchConfidence"] = "UNMATCHED";

    if (codeMatch) {
      matched = byCode.get(codeMatch[1].toUpperCase());
      if (matched) matchConfidence = "EXACT_CODE";
    }

    // 2. Separar CSV / Tab / WhatsApp
    let detectedTitle = line;
    let detectedPriceCents: number | null = null;
    let detectedPackQty: number | null = null;
    let detectedPackUnit: string | null = null;

    const lineNoNumericCommas = line.replace(/\d,\d{3}(?=\D|$)/g, "");
    const sep = line.includes("\t")
      ? "\t"
      : line.includes(";")
      ? ";"
      : lineNoNumericCommas.includes(",")
      ? ","
      : null;
    if (sep) {
      const cols = line.split(sep).map((c) => c.trim());
      // Buscar columna de precio desde el final
      for (let i = cols.length - 1; i >= 0; i--) {
        if (/^\d+(?:[.,]\d+)?$/.test(cols[i].replace(/[^\d.,]/g, "")) && (cols[i].includes("$") || i > 0)) {
          const p = parseDopPriceToCents(cols[i]);
          if (p.ok && detectedPriceCents === null) {
            detectedPriceCents = p.cents;
            cols.splice(i, 1);
            break;
          }
        }
      }
      const joinedRest = cols.filter((c) => !codeMatch || c.toUpperCase() !== codeMatch[1].toUpperCase()).join(" ").trim();
      if (joinedRest) detectedTitle = joinedRest;
    } else {
      // Formato WhatsApp libre: "Mantequilla Sosua 5 lb RD$ 525.00"
      const priceMatch = line.match(/(?:rd\$|dop|\$)\s*([\d.,]+)/i) || line.match(/(\d[\d.,]*)\s*$/);
      if (priceMatch) {
        const p = parseDopPriceToCents(priceMatch[1]);
        if (p.ok) {
          detectedPriceCents = p.cents;
          detectedTitle = line.slice(0, priceMatch.index).trim() || line;
        }
      }
    }

    const pack = extractPackFromTitle(line);
    detectedPackQty = pack.packQty;
    detectedPackUnit = pack.packUnit;

    if (!matched) {
      const cleanTitle = normText(
        detectedTitle
          .replace(/\bPROD-\d+\b/gi, "")
          .replace(/\d+(?:[.,]\d+)?\s*(?:fl\.?\s*oz|gramos?|gr|g|kg|libras?|lbs?|lb|oz|ml|lt|l|unidades?|uds?)\b/gi, "")
      );
      if (byName.has(cleanTitle)) {
        matched = byName.get(cleanTitle);
        matchConfidence = "EXACT_NAME";
      } else if (cleanTitle.length >= 3) {
        for (const [nName, ing] of byName.entries()) {
          if (nName.includes(cleanTitle) || cleanTitle.includes(nName)) {
            matched = ing;
            matchConfidence = "FUZZY";
            break;
          }
        }
      }
    }

    return {
      rawLine: line,
      matchedIngredientId: matched?.id || null,
      matchedIngredientCode: matched?.code || null,
      matchedIngredientName: matched?.name || null,
      matchConfidence,
      detectedTitle: detectedTitle || line,
      detectedPriceCents,
      detectedPackQty,
      detectedPackUnit,
    };
  });
}

import dns from "dns";
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  validateExternalUrlSyntax,
  validateExternalUrlSafe,
  safeFetchPortal,
  parseHtmlProductPayload,
  parseShopifyProductJson,
  applyTaxMode,
  evaluatePackCompatibility,
  parseAssistedPriceLines,
  extractPackFromTitle,
  parseDopPriceToCents,
} from "@/lib/services/price-adapters";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Validación SSRF (PRE-004)", () => {
  it("rechaza URLs inseguras HTTP, localhost, IPs privadas RFC1918, IPv6 literal y link-local", () => {
    expect(validateExternalUrlSyntax("http://www.sirena.do/product/azucar").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://localhost:3000/test").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://127.0.0.1/test").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://192.168.1.1/test").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://10.0.0.5/test").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://[::1]/test").ok).toBe(false);
    expect(validateExternalUrlSyntax("https://[fe80::1]/test").ok).toBe(false);
  });

  it("rechaza dominios fuera de allowedBaseUrl y acepta el dominio de la fuente", () => {
    const mismatch = validateExternalUrlSyntax(
      "https://otro-dominio.com/producto",
      "https://www.sirena.do"
    );
    expect(mismatch.ok).toBe(false);

    const exact = validateExternalUrlSyntax(
      "https://sirena.do/productos/azucar-5lb",
      "https://www.sirena.do"
    );
    expect(exact.ok).toBe(true);
  });

  it("bloquea resolución DNS a IP privada o mapeada IPv6 y permite IPs públicas", async () => {
    const privateDns = await validateExternalUrlSafe(
      "https://www.sirena.do/p/1",
      "https://www.sirena.do",
      async () => [{ address: "127.0.0.1" }]
    );
    expect(privateDns.ok).toBe(false);

    const mappedPrivateDns = await validateExternalUrlSafe(
      "https://www.sirena.do/p/1",
      "https://www.sirena.do",
      async () => [{ address: "::ffff:192.168.1.50" }]
    );
    expect(mappedPrivateDns.ok).toBe(false);

    const publicDns = await validateExternalUrlSafe(
      "https://www.sirena.do/p/1",
      "https://www.sirena.do",
      async () => [{ address: "104.18.10.20" }]
    );
    expect(publicDns.ok).toBe(true);
  });

  it("detecta Cloudflare/WAF en HTTP 403, 429 y HTML 200 devolviendo BLOCKED, y bloquea redirect SSRF", async () => {
    vi.spyOn(dns.promises, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);

    const r403 = await safeFetchPortal("https://www.sirena.do/p/azucar", {
      allowedBaseUrl: "https://www.sirena.do",
      fetchImpl: async () => new Response("Forbidden", { status: 403 }),
    });
    expect(r403.status).toBe("BLOCKED");

    const r429 = await safeFetchPortal("https://www.sirena.do/p/azucar", {
      allowedBaseUrl: "https://www.sirena.do",
      fetchImpl: async () => new Response("Too Many Requests", { status: 429 }),
    });
    expect(r429.status).toBe("BLOCKED");

    const rCf200 = await safeFetchPortal("https://www.sirena.do/p/azucar", {
      allowedBaseUrl: "https://www.sirena.do",
      fetchImpl: async () =>
        new Response("<html><title>Just a moment...</title><div id='cf-browser-verification'></div></html>", {
          status: 200,
        }),
    });
    expect(rCf200.status).toBe("BLOCKED");

    const rRedirectSsrf = await safeFetchPortal("https://www.sirena.do/p/azucar", {
      allowedBaseUrl: "https://www.sirena.do",
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://192.168.1.10/internal" },
        }),
    });
    expect(rRedirectSsrf.status).toBe("ERROR");
  });
});

describe("Guardrails de Empaque y Equivalencias de Unidades (PRE-003)", () => {
  it("detecta PACK_MISMATCH (16 oz vs 5 lb) y aplica correctamente STRICT, REBASE y ADOPT", () => {
    const fiveLbInG = 5 * 453.59237;
    const baseParams = {
      currentPackagePriceCents: 45000, // RD$ 450.00 por 5 lb
      currentPackageQty: 5,
      currentPackageUnit: "lb",
      currentBaseUnit: "g",
      currentConversionFactor: 453.59237,
      hasExplicitFactor: false,
      currentCostPerBaseUnit: 450 / fiveLbInG,
      detectedPriceCents: 12000, // RD$ 120.00 por 16 oz
      detectedInStock: true,
      detectedPackQty: 16,
      detectedPackUnit: "oz",
    };

    const strictRes = evaluatePackCompatibility({
      ...baseParams,
      applyStrategy: "STRICT_SAME_PACK",
    });
    expect(strictRes.packCheckStatus).toBe("PACK_MISMATCH");
    expect(strictRes.alerts).toContain("PACK_MISMATCH");

    const rebaseRes = evaluatePackCompatibility({
      ...baseParams,
      applyStrategy: "REBASE_UNIT_COST",
    });
    expect(rebaseRes.packCheckStatus).toBe("PACK_MISMATCH");
    const expectedCostPerG = 120 / (16 * 28.349523125);
    expect(rebaseRes.proposedCostPerBaseUnit).toBeCloseTo(expectedCostPerG, 5);
    expect(rebaseRes.proposedPriceCents).toBe(Math.round(expectedCostPerG * fiveLbInG * 100));
    expect(rebaseRes.proposedPackageQty).toBeNull();

    const adoptRes = evaluatePackCompatibility({
      ...baseParams,
      applyStrategy: "ADOPT_SOURCE_PACK",
    });
    expect(adoptRes.packCheckStatus).toBe("PACK_MISMATCH");
    expect(adoptRes.proposedPriceCents).toBe(12000);
    expect(adoptRes.proposedPackageQty).toBe(16);
    expect(adoptRes.proposedPackageUnit).toBe("oz");
    expect(adoptRes.proposedConversionFactor).toBeCloseTo(28.349523125, 4);
    expect(adoptRes.proposedCostPerBaseUnit).toBeCloseTo(expectedCostPerG, 5);
  });

  it("reconoce equivalencia de 1 lb vs 454 g dentro de tolerancia 5% (UNIT_CONVERTED)", () => {
    const oneLbInG = 453.59237;
    const res = evaluatePackCompatibility({
      currentPackagePriceCents: 10000,
      currentPackageQty: 1,
      currentPackageUnit: "lb",
      currentBaseUnit: "g",
      currentConversionFactor: oneLbInG,
      hasExplicitFactor: false,
      currentCostPerBaseUnit: 100 / oneLbInG,
      detectedPriceCents: 11000,
      detectedInStock: true,
      detectedPackQty: 454,
      detectedPackUnit: "g",
      packTolerancePct: 5,
      applyStrategy: "STRICT_SAME_PACK",
    });

    expect(res.packCheckStatus).toBe("UNIT_CONVERTED");
    expect(res.alerts).not.toContain("PACK_MISMATCH");
    expect(res.alerts).not.toContain("UNIT_INCOMPATIBLE");
  });

  it("bloquea 16 fl oz vs 500 g sin densidad (UNIT_INCOMPATIBLE) y permite conversión si tiene densidad", () => {
    const incompatible = evaluatePackCompatibility({
      currentPackagePriceCents: 20000,
      currentPackageQty: 500,
      currentPackageUnit: "g",
      currentBaseUnit: "g",
      currentConversionFactor: 1,
      hasExplicitFactor: false,
      currentCostPerBaseUnit: 200 / 500,
      density: null,
      detectedPriceCents: 21000,
      detectedInStock: true,
      detectedPackQty: 16,
      detectedPackUnit: "fl_oz",
      applyStrategy: "REBASE_UNIT_COST",
    });

    expect(incompatible.packCheckStatus).toBe("UNIT_INCOMPATIBLE");
    expect(incompatible.alerts).toContain("UNIT_INCOMPATIBLE");

    const withDensity = evaluatePackCompatibility({
      currentPackagePriceCents: 20000,
      currentPackageQty: 500,
      currentPackageUnit: "g",
      currentBaseUnit: "g",
      currentConversionFactor: 1,
      hasExplicitFactor: false,
      currentCostPerBaseUnit: 200 / 500,
      density: 1.05,
      detectedPriceCents: 21000,
      detectedInStock: true,
      detectedPackQty: 16,
      detectedPackUnit: "fl_oz",
      applyStrategy: "REBASE_UNIT_COST",
    });

    expect(withDensity.packCheckStatus).toBe("UNIT_CONVERTED");
    expect(withDensity.alerts).not.toContain("UNIT_INCOMPATIBLE");
  });

  it("preserva currentConversionFactor en MATCH con estrategia ADOPT_SOURCE_PACK", () => {
    const matchAdopt = evaluatePackCompatibility({
      currentPackagePriceCents: 24000,
      currentPackageQty: 1,
      currentPackageUnit: "paquete",
      currentBaseUnit: "ud",
      currentConversionFactor: 12,
      hasExplicitFactor: true,
      currentCostPerBaseUnit: 20,
      detectedPriceCents: 26400,
      detectedInStock: true,
      detectedPackQty: 1,
      detectedPackUnit: "paquete",
      applyStrategy: "ADOPT_SOURCE_PACK",
    });

    expect(matchAdopt.packCheckStatus).toBe("MATCH");
    expect(matchAdopt.proposedConversionFactor).toBe(12);
    expect(matchAdopt.proposedCostPerBaseUnit).toBeCloseTo(22, 6);
  });
});

describe("ITBIS RD y Parsers de Portales y Plan B (PRE-003, PRE-005)", () => {
  it("aplica ITBIS RD correctamente según taxMode (INCLUDED vs PLUS_ITBIS 0/16/18%)", () => {
    expect(applyTaxMode(10000, "INCLUDED", 18)).toBe(10000);
    expect(applyTaxMode(10000, "PLUS_ITBIS", 0)).toBe(10000);
    expect(applyTaxMode(10000, "PLUS_ITBIS", 16)).toBe(11600);
    expect(applyTaxMode(10000, "PLUS_ITBIS", 18)).toBe(11800);
  });

  it("extrae empaques simples, multipacks y fl oz, y parsea montos RD$", () => {
    expect(extractPackFromTitle("Leche Evaporada Pack 6 x 315 g")).toEqual({ packQty: 1890, packUnit: "g" });
    expect(extractPackFromTitle("Extracto Vainilla 16 fl oz")).toEqual({ packQty: 16, packUnit: "fl_oz" });
    expect(extractPackFromTitle("Azúcar Refinada 5 lbs")).toEqual({ packQty: 5, packUnit: "lb" });
    expect(parseDopPriceToCents("RD$ 1,250.50")).toEqual({ ok: true, cents: 125050 });
    expect(parseDopPriceToCents("RD$ 150 - RD$ 450").ok).toBe(false);
  });

  it("parsea HTML con JSON-LD Product y Shopify multi-variante (?variant= y AMBIGUOUS_VARIANT)", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Azúcar Crema 5 lb",
            "offers": {
              "@type": "Offer",
              "price": "325.50",
              "availability": "https://schema.org/InStock"
            }
          }
        </script>
      </head><body></body></html>
    `;
    const htmlRes = parseHtmlProductPayload(html, "https://www.sirena.do/azucar-5lb");
    expect(htmlRes.status).toBe("OK");
    expect(htmlRes.priceCents).toBe(32550);
    expect(htmlRes.inStock).toBe(true);
    expect(htmlRes.packQty).toBe(5);
    expect(htmlRes.packUnit).toBe("lb");

    const shopifyJson = JSON.stringify({
      product: {
        title: "Harina de Trigo Profesional",
        variants: [
          { id: 111, title: "16 oz", price: "120.00", available: true, sku: "HAR-16" },
          { id: 222, title: "5 lb", price: "480.00", available: true, sku: "HAR-5LB" },
        ],
      },
    });

    const explicitVariant = parseShopifyProductJson(
      shopifyJson,
      "https://ntdingredientes.com/products/harina?variant=222"
    );
    expect(explicitVariant.status).toBe("OK");
    expect(explicitVariant.ambiguousVariant).toBe(false);
    expect(explicitVariant.priceCents).toBe(48000);
    expect(explicitVariant.packQty).toBe(5);
    expect(explicitVariant.packUnit).toBe("lb");

    const ambiguous = parseShopifyProductJson(
      shopifyJson,
      "https://ntdingredientes.com/products/harina"
    );
    expect(ambiguous.status).toBe("OK");
    expect(ambiguous.ambiguousVariant).toBe(true);
    expect(ambiguous.variants?.length).toBe(2);
  });

  it("parsea líneas Plan B (WhatsApp libre con miles RD$, código PROD-XXX y CSV) con coincidencia correcta", () => {
    const ingredients = [
      { id: "ing-1", code: "PROD-010", name: "Mantequilla Sosua" },
      { id: "ing-2", code: "PROD-025", name: "Harina Blanquita" },
      { id: "ing-3", code: "PROD-030", name: "Azúcar Crema" },
    ];

    const text = [
      "Mantequilla Sosua 5 lb RD$ 525.00",
      "PROD-010, 540.00",
      "Harina Blanquita; 10 lb; 395.50",
      "Azúcar Crema 5 lb RD$ 1,250.00",
    ].join("\n");

    const parsed = parseAssistedPriceLines(text, ingredients);
    expect(parsed).toHaveLength(4);

    expect(parsed[0].matchedIngredientId).toBe("ing-1");
    expect(parsed[0].matchConfidence).toBe("EXACT_NAME");
    expect(parsed[0].detectedPriceCents).toBe(52500);
    expect(parsed[0].detectedPackQty).toBe(5);
    expect(parsed[0].detectedPackUnit).toBe("lb");

    expect(parsed[1].matchedIngredientId).toBe("ing-1");
    expect(parsed[1].matchConfidence).toBe("EXACT_CODE");
    expect(parsed[1].detectedPriceCents).toBe(54000);

    expect(parsed[2].matchedIngredientId).toBe("ing-2");
    expect(parsed[2].matchConfidence).toBe("EXACT_NAME");
    expect(parsed[2].detectedPriceCents).toBe(39550);
    expect(parsed[2].detectedPackQty).toBe(10);
    expect(parsed[2].detectedPackUnit).toBe("lb");

    expect(parsed[3].matchedIngredientId).toBe("ing-3");
    expect(parsed[3].matchConfidence).toBe("EXACT_NAME");
    expect(parsed[3].detectedPriceCents).toBe(125000);
    expect(parsed[3].detectedPackQty).toBe(5);
    expect(parsed[3].detectedPackUnit).toBe("lb");
  });
});

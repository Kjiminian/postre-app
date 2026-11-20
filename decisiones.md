# REGISTRO HISTÓRICO DE DECISIONES ARQUITECTÓNICAS (ADR) — POSTRES APP

Este archivo es la Fuente Canónica de Decisiones Técnicas y Arquitectónicas (`DEC-xxx`) bajo **GEM V3 (P-07)**.

---

## DEC-001: Adopción del Sistema GEM PROYECTOS SOFTWARE V3.0 y Gobernanza THEMIS

* **Estado:** APROBADA
* **Fecha:** 2026-11-11
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Se requiere un marco disciplinado de ingeniería de software para concebir, planificar, auditar y ejecutar la aplicación `postres-app`, evitando vicios comunes de desarrollo asistido por IA.

### Decisión
Adoptar formalmente **GEM PROYECTOS SOFTWARE V3.0** y el protocolo vinculante **THEMIS**:
1. Arquitectura bipolar estricta (Supervisor = Tomador de decisiones; Antigravity = Arquitecto + Fiscal Themis + Ejecutor).
2. Prohibición de "código primero" (Greenfield P-01).
3. Pre-auditoría obligatoria de planes con `themis_fiscal_planes` (P-11 / P-33).
4. Auditoría obligatoria e independiente de cierre de fase con `themis_fiscal_codigo` y `themis_auditor_antislop` (P-14 / P-33).
5. Triple Capa Cero AI-Slop (`05_CALIDAD/anti_slop.md`).

---

## DEC-002: Clasificación del Proyecto como Greenfield (Nuevo)

* **Estado:** APROBADA
* **Fecha:** 2026-11-11
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Determinar el punto de partida del repositorio para seleccionar el protocolo de inicio.

### Contexto
El directorio de trabajo se encontraba completamente vacío sin código previo ni dependencias instaladas.

### Decisión
Clasificar bajo **Protocolo P-01** como `PROYECTO NUEVO (Greenfield)`. Activar de inmediato la fase conceptual de Descubrimiento (`P-02`), prohibiendo la generación de código de aplicación antes de formalizar requisitos, modelo de datos y roadmap aprobado.

---

## DEC-003: Arquitectura Híbrida Web App Responsive y Stack Tecnológico

* **Estado:** APROBADA
* **Fecha:** 2026-11-11
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Seleccionar la arquitectura y el stack tecnológico que mejor cumpla con:
1. Una solución híbrida (catálogo público para clientes + panel administrativo para taller).
2. Experiencia táctil mobile-first impecable para clientes y panel fluido para administración.
3. Despacho estructurado de órdenes a WhatsApp con confirmación manual de pagos.
4. Cumplimiento de la Triple Capa Anti-Slop (estética refinada, 0 sobreingeniería, código limpio).

### Decisión
1. **Framework Principal:** **Next.js (App Router) + TypeScript**
   - Permite Server-Side Rendering (SSR) rápido para el catálogo y Server Actions para mutaciones transaccionales seguras sin necesidad de un backend separado.
2. **Estilizado y UI:** **Tailwind CSS**
   - Sistema de diseño intencional y cálido inspirado en repostería artesanal (tonos crema, miel, vainilla, cacao y frambuesa sutil; tipografía limpia Inter/Playfair Display).
   - Prohibido cualquier gradiente IA por defecto (`#6366f1` -> `#a855f7`).
   - Implementación obligatoria de los 4 estados de UI (Loading, Empty, Error, Success).
3. **Persistencia de Datos:** **SQLite con Prisma ORM** (desarrollo local ágil, migrable sin fricción a PostgreSQL para producción).
4. **Validación de Datos:** **Zod** para esquemas estrictos de pedidos, productos y formularios.
5. **Iconografía:** **Lucide React** (iconos semánticos, sin sobrecarga decorativa).
6. **Testing:** **Vitest** para tests unitarios y de lógica de negocio (máquina de estados de pedidos, cálculo de totales, formateador de WhatsApp).

### Consecuencias
* Monorepo / solución unificada donde la UI pública y el panel administrativo comparten tipos, esquemas de validación y base de datos.
* Cero latencia en llamadas internas y despliegue simple y económico.

---

## DEC-004: Módulo de Actualización de Precios desde Portales RD con Aprobación Previa

* **Estado:** APROBADA
* **Fecha:** 2026-11-20
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Los precios de ingredientes y empaques fluctúan en supermercados y suplidores locales de República Dominicana (`La Sirena`, `NTD Ingredientes`, `Empaketería RD`, `Dumé Papelería`, suplidores de Santiago), haciendo costoso mantener al día los costos de recetas madre, variantes y presentaciones agrupadas sin alterar registros históricos ni aceptar cambios de empaque silenciosos.

### Decisión
1. **Arquitectura Híbrida de Captura (Adaptadores + Plan B Asistido):**
   - Soportar fuentes configurables (`VTEX_IO`, `SHOPIFY_JSON`, `WOOCOMMERCE_HTML`, `GENERIC_HTML`, `MANUAL_ASSISTED`) y enlaces `ProductSourceLink` por producto/ingrediente.
   - Integrar **Carga Asistida (Plan B)** para cotizaciones por WhatsApp/CSV/facturas y suplidores sin catálogo público, con registro opcional de `OperationalExpense` (`isIngredientPurchase = true` en categoría `"Compra de Insumos"`) respetando el anti-doble conteo (`RF-020`).
2. **Seguridad SSRF y Política Anti-WAF/CAPTCHA:**
   - Validación estricta HTTPS, bloqueo de hosts locales, rangos IP privados/reservados (`RFC1918`, loopback, link-local) y verificación DNS antes de cada solicitud con redirecciones manuales verificadas (máx. 3 saltos) y tope de respuesta de 2 MB.
   - Prohibido cualquier intento de evasión ante Cloudflare/WAF/CAPTCHA (`403`/`429` o challenges HTML degradan a estado `BLOCKED` derivando al Plan B).
3. **Guardrails de Empaque e ITBIS RD:**
   - Verificación previa de compatibilidad de empaque (`MATCH`, `UNIT_CONVERTED`, `PACK_MISMATCH`, `UNIT_INCOMPATIBLE`, `UNKNOWN`) y soporte de estrategias explícitas (`STRICT_SAME_PACK`, `REBASE_UNIT_COST`, `ADOPT_SOURCE_PACK`), exigiendo confirmación ante alertas críticas y conversión con `fl_oz` / densidad.
   - Soporte fiscal por fuente (`INCLUDED` vs `PLUS_ITBIS` con tasas RD `0%`, `16%`, `18%`).
4. **Simulador Read-Only y Aprobación Transaccional Única:**
   - Previsualización de impacto (`ImpactSimulationReport`) sin mutar la base de datos antes de aprobar.
   - Aprobación atómica bajo `$transaction` con bloqueo optimista CAS (`PENDING -> APPROVED`), *drift check* contra `Ingredient.updatedAt`, expiración automática de propuestas competidoras, recálculo topológico de recetas y presentaciones y trazabilidad en `RecipePriceHistory` (`reason = "portal_price_approval"`).
   - Preservación absoluta de precios manuales (`finalPriceCents`, `currentPriceCents`) y ventas/cuadres históricos (`Sale`, `SaleItem`, `WeeklyClose`).

### Consecuencias
* Eliminación de sobrescrituras silenciosas de empaque o costo en recetas.
* Resiliencia operativa ante bloqueos anti-bot o suplidores locales no digitalizados mediante Plan B unificado en la misma bandeja de aprobación.

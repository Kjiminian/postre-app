# PLAN DE IMPLEMENTACIÓN Y CONTRATO DE FASE
# GEM PROYECTOS SOFTWARE V3.0

# [FASE 1]: Fundación Arquitectónica, Diseño Anti-Slop y Base de Datos

## 1. Contexto y Propósito
Esta fase establece los cimientos técnicos de `postres-app` tras la conclusión de la Fase 0 (Concepción, Requisitos y Arquitectura). Provee el entorno de ejecución Next.js App Router con TypeScript, configura el sistema de diseño visual con Tailwind CSS bajo el estándar Triple Capa Anti-Slop (tonos cálidos gastronómicos sin tropos de IA), define el esquema relacional en Prisma ORM con SQLite (modelando `Category`, `Product`, `Order`, `OrderItem`, `PaymentRecord`), incorpora los boundaries globales de interfaz (Loading, Error, Not-Found) y establece el arnés de pruebas automatizadas con Vitest.

---

## 2. User Review Required (Decisiones y Alertas del Supervisor)

> [!IMPORTANT]
> **Stack Base Aprobado:** Next.js (App Router) + TypeScript + Tailwind CSS + Prisma ORM (SQLite en desarrollo local, migrable a PostgreSQL) + Vitest + Lucide React.
> Cumple rigurosamente `DEC-003`, `RNF-001` (Anti-Slop), `RNF-004` (Persistencia relacional) y `RNF-006` (Clean Code).

> [!NOTE]
> **Moneda y Formateo:** Se configurará soporte configurable para moneda local con base en Pesos Dominicanos (`DOP / RD$`) o Dólares (`USD / $`) mediante variables en `src/lib/constants.ts`, permitiendo alternar fácilmente sin tocar código de vistas.

---

## 3. Las 6 Capas Modulares de Ingeniería

1. **Máquina de Estados y Ciclo de Vida:**
   * Enums de dominio tipados:
     * `OrderState`: `RECIBIDO` ➔ `CONFIRMADO` ➔ `EN_PREPARACION` ➔ `LISTO` ➔ `ENTREGADO` (o `CANCELADO`).
     * `PaymentState`: `PENDIENTE` ➔ `VERIFICADO` (o `RECHAZADO`) — alineado formalmente con `RN-008`.
   * Transición ilegal: Prohibido pasar a `EN_PREPARACION` sin orden/pago confirmado.

2. **Casos Borde y Defensa:**
   * Validación estricta de variables de entorno al iniciar.
   * Manejo robusto de errores y estados con boundaries globales (`error.tsx`, `not-found.tsx`, `loading.tsx`).
   * Retornos tipados con manejo de errores sin excepciones no capturadas.

3. **Persistencia e Integridad:**
   * Modelos Prisma (`prisma/schema.prisma`):
     * `Category`: `id`, `name`, `slug` (unique), `description`, `icon`, `order`, `createdAt`, `updatedAt`.
     * `Product`: `id`, `categoryId` (FK), `name`, `slug` (unique), `description`, `price` (Int, en centavos), `imageUrl`, `portions`, `allergens` (String/JSON), `isAvailable`, `prepTimeHours`, `createdAt`, `updatedAt`.
     * `Order`: `id`, `orderCode` (unique, `PED-YYYYMMDD-XXXX`), `customerName`, `customerPhone`, `deliveryType` (RETIRO / DELIVERY), `deliveryAddress`, `deliveryDate`, `notes`, `state`, `paymentMethod`, `paymentState`, `total` (Int), `createdAt`, `updatedAt`.
     * `OrderItem`: `id`, `orderId` (FK cascade), `productId` (FK), `quantity`, `unitPrice` (Int), `subtotal` (Int), `notes`.
     * `PaymentRecord`: `id`, `orderId` (FK cascade), `method` (String), `status` (PaymentState), `reference` (String?), `amount` (Int), `verifiedAt` (DateTime?), `notes` (String?), `createdAt`.
   * Integridad referencial habilitada con claves foráneas e índices en `orderCode`, `slug` y `orderId`.

4. **Seguridad y Permisos:**
   * Sanitización de inputs y validación de tipos con Zod en todas las entradas.
   * Sin exposición de credenciales ni secretos en variables públicas de cliente (`NEXT_PUBLIC_`).

5. **Observabilidad y Errores:**
   * Estructura de logs en consola con marca de tiempo y contexto.
   * Manejador centralizado de errores para endpoints y acciones.

6. **Estrategia de Testing:**
   * Vitest configurado con entorno Node/JSDOM.
   * Tests unitarios probando la integridad de constantes, enums, formateo monetario y cálculos de precios.

---

## 4. Alcance Delimitado

### INCLUYE
* [ ] Scaffolding limpio de Next.js con TypeScript y Tailwind CSS.
* [ ] Sistema de tokens visuales y tema gastronómico (colores vainilla, crema, caramelo, cacao; tipografía Inter/serif; 0 gradientes cliché violeta-azul).
* [ ] Dependencias clave: `next`, `react`, `react-dom`, `@prisma/client`, `zod`, `lucide-react`, `vitest`, `prisma`, `tsx`.
* [ ] Configuración de Prisma ORM con schema relacional completo (5 modelos: `Category`, `Product`, `Order`, `OrderItem`, `PaymentRecord`) y cliente tipado generado.
* [ ] Script de Seed (`prisma/seed.ts`) con categorías y postres iniciales para pruebas.
* [ ] Boundaries globales Triple Capa Anti-Slop: `loading.tsx` (skeleton), `error.tsx` (recuperable) y `not-found.tsx` (404 estilizado).
* [ ] Layout principal responsivo (`Navbar` con logo y badge de carrito, `Footer` con datos de contacto y horario).
* [ ] Configuración de Vitest y suite de pruebas unitarias inicial pasando en terminal.

### NO INCLUYE
* Catálogo interactivo con filtros dinámicos en cliente (Fase 2).
* Carrito de compras y checkout con WhatsApp (Fase 3).
* Panel administrativo protegido (Fase 4).

---

## 5. Cambios Físicos Propuestos (Proposed Changes)

### Configuración e Infraestructura
* [NEW] `package.json` — Dependencias de producción (`lucide-react`, `zod`, `@prisma/client`) y scripts de desarrollo (`dev`, `build`, `test`, `lint`, `db:push`, `db:seed`).
* [NEW] `tsconfig.json` — Configuración estricta de TypeScript con path alias `@/*`.
* [NEW] `next.config.mjs` — Configuración de Next.js optimizada para imágenes y Server Actions.
* [NEW] `tailwind.config.ts` — Sistema de diseño y paleta de repostería artesanal cálida.
* [NEW] `postcss.config.mjs` — PostCSS para procesamiento de Tailwind CSS.
* [NEW] `vitest.config.ts` — Arnés de pruebas automatizadas.

### Persistencia y Datos
* [NEW] `prisma/schema.prisma` — Modelado DDL relacional de `Category`, `Product`, `Order`, `OrderItem` y `PaymentRecord`.
* [NEW] `src/lib/prisma.ts` — Singleton del cliente Prisma para evitar fugas de conexión en Next.js hot-reload.
* [NEW] `prisma/seed.ts` — Datos iniciales de postres y categorías para verificación del sistema.

### Dominio y UI (Anti-Slop Boundaries y Layout)
* [NEW] `src/types/index.ts` — Tipos TypeScript del dominio, enums `OrderState`, `PaymentState` y DTOs.
* [NEW] `src/lib/constants.ts` — Configuración del negocio (moneda, horarios, estados, alérgenos).
* [NEW] `src/lib/utils.ts` — Formateadores monetarios y helpers de clases (`cn`).
* [NEW] `src/app/globals.css` — Estilos globales, variables CSS y tipografía.
* [NEW] `src/app/layout.tsx` — Root layout con Header, Footer y contenedor responsive.
* [NEW] `src/app/loading.tsx` — Skeleton gastronómico de carga global (Triple Capa Anti-Slop).
* [NEW] `src/app/error.tsx` — Error Boundary con botón accesible de recuperación (Triple Capa Anti-Slop).
* [NEW] `src/app/not-found.tsx` — Vista 404 estilizada con enlace de retorno al catálogo (Triple Capa Anti-Slop).
* [NEW] `src/app/page.tsx` — Página de bienvenida con presentación del obrador y acceso a las secciones.
* [NEW] `src/components/layout/Navbar.tsx` — Navegación accesible mobile-first con `lucide-react`.
* [NEW] `src/components/layout/Footer.tsx` — Pie de página con información del taller artesanal.

### Pruebas Automatizadas
* [NEW] `tests/unit/domain.test.ts` — Pruebas de invariantes de precios, estados de orden, formato monetario y código de pedido.

---

## 6. Plan de Verificación Empírica (Verification Plan)

### Automated Tests (Comandos de Terminal)
```bash
# 1. Verificación de dependencias y tipos
npm run typecheck

# 2. Generación y sincronización de base de datos Prisma
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# 3. Ejecución de tests automatizados
npm test

# 4. Build de producción de Next.js
npm run build
```

### Manual Verification
1. Levantar servidor local (`npm run dev`) y verificar en navegador:
   * La cabecera muestra la identidad de Postres App sin elementos desalineados.
   * La paleta cromática es cálida y acogedora (cremas, ocres, chocolate), libre de tropos de IA.
   * Los boundaries (loading skeleton, error, 404) responden de acuerdo a la estética del proyecto.
   * Responsive comprobado en emulador móvil (375px) y escritorio (1280px).

---

## 7. Criterios de Aceptación Innegociables (`CA-xxx`)

* [ ] `CA-F1-01`: `npm run build` completa con exit code 0 sin errores de tipos ni advertencias bloqueantes.
* [ ] `CA-F1-02`: La base de datos SQLite se genera correctamente con los 5 modelos (`Category`, `Product`, `Order`, `OrderItem`, `PaymentRecord`), claves foráneas e índices.
* [ ] `CA-F1-03`: El script de seed puebla las categorías y postres iniciales sin colisiones de slug.
* [ ] `CA-F1-04`: 100% de los tests en Vitest pasan con exit code 0 en terminal.
* [ ] `CA-F1-05`: Cumplimiento estricto del estándar Triple Capa Cero AI-Slop (diseño cromático con propósito, tipado estricto, 4 estados implementados, 0 librerías fantasma).

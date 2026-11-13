# PLAN DE IMPLEMENTACIÓN: K_SWEET V2.0 (ARQUITECTURA DE RECETAS MADRE Y PRESENTACIONES)
# GEM PROYECTOS SOFTWARE V3.0 — SISTEMA OPERATIVO DE REPOSTERÍA ARTESANAL RD

---

## 1. Contexto y Objetivos del Reajuste
Este plan aborda la reestructuración completa de **K_Sweet** para satisfacer los ejes requeridos por el usuario:
1. **Mantenimiento completo (CRUD)** en todos los módulos desde la interfaz con persistencia en base de datos SQLite/Prisma (Ingredientes, Suplidores, Unidades/Conversiones, Empaques/Materiales, Recetas Madre, Presentaciones, Clientes, Ventas/Abonos, Gastos Operativos y Cuadre Semanal).
2. **Modelo Bipolar de Recetas (Receta Madre y Presentaciones):**
   - **Receta Madre:** Rendimiento total del lote ($g$, $ml$, unidades), % mano de obra, % gastos indirectos, ingredientes y subrecetas. Costo total de producción y costo por unidad de rendimiento.
   - **Presentaciones:** Derivadas de una receta madre sin duplicar ingredientes. Tamaño/contenido, cantidad consumida de receta madre, complementos/subrecetas adicionales, empaques y materiales específicos (vaso, tapa, lazo, etiqueta, caja), rendimiento por lote, costo total unitario, margen deseado (%), precio sugerido ($P = C / (1 - M)$) o recargo ($P = C \times (1 + R)$), precio de venta final editable, ganancia y margen real. Soporte para presentaciones compuestas (ej. caja de 12 uds).
3. **Cálculos matemáticos rigurosos y recálculo en cascada:**
   - Separación estricta entre Margen sobre venta y Recargo sobre costo.
   - No usar precio de venta de receta madre como costo de presentación.
   - Cascada reactiva: al modificar insumos/receta madre se actualizan los costos de presentaciones dependientes manteniendo el precio de venta final fijado manualmente y recalculando la ganancia y margen real.
   - Congelación de costos y precios históricos en ventas pasadas.
4. **Auditoría Forense del Excel Original (`costos_postres_original.xlsx`):**
   - Incorporación de las tablas auxiliares de porciones (Brownies 15 porciones, Cajas San Valentín 1 y 2, Fresas Bañadas, Galletas Oreo Bañadas, Vasos de Shots, Cajas y Empaques).
   - Manejo de inconsistencias detectadas: unidades ambiguas ("mm" en grageas, "30mm" en Fresas), preservando coordenadas de celda y hoja de origen sin inventar datos.
5. **UI Gastronómica Anti-Slop (GEM V3):**
   - Tonos crema (`#FAF8F6`) y rosa ciruela (`#9C4266`), responsive, español, 4 estados obligatorios (Loading skeleton, Empty State con acción, Error con reintento, y Vista con datos).
6. **Integridad referencial y desactivación lógica (`isActive`):**
   - Eliminación segura con soft-delete para no romper históricos de ventas o recetas dependientes.

---

## 2. Decisiones de Arquitectura y Fórmulas Matemáticas

### 2.1. Fórmulas de Receta Madre
* **Costo Ingredientes:** $C_{\text{ing}} = \sum (Q_i \times \text{CostoUnitario}_i)$.
* **Gastos de Producción (Overhead):** $C_{\text{overhead}} = C_{\text{ing}} \times (\% \text{Overhead} / 100)$.
* **Mano de Obra:** $C_{\text{labor}} = C_{\text{ing}} \times (\% \text{ManoObra} / 100)$.
* **Costo Total del Lote:** $C_{\text{lote}} = C_{\text{ing}} + C_{\text{overhead}} + C_{\text{labor}} + C_{\text{empaque\_lote}}$.
* **Costo por Unidad de Rendimiento:** $C_{\text{unit\_rend}} = \frac{C_{\text{lote}}}{\text{RendimientoLote}}$ (expresado en centavos por $g$, $ml$ o unidad base).

### 2.2. Fórmulas de Presentación
* **Costo Preparación Consumida:** $C_{\text{base}} = C_{\text{unit\_rend}} \times Q_{\text{consumida\_madre}}$.
* **Costo Materiales/Empaques:** $C_{\text{empaques}} = \sum (Q_m \times \text{CostoMaterial}_m)$.
* **Costo Complementos/Toppings:** $C_{\text{toppings}} = \sum (Q_t \times \text{CostoTopping}_t)$.
* **Costo Total Unitario de Presentación:** $C_{\text{pres}} = C_{\text{base}} + C_{\text{empaques}} + C_{\text{toppings}}$.
* **Rendimiento de Presentación por Lote:** $R_{\text{pres}} = \frac{\text{RendimientoLoteMadre}}{Q_{\text{consumida\_madre}}}$.
* **Fijación de Precios y Validación de Fronteras (PRE-001):**
  * **Margen sobre Venta ($M \in [0, 100)$):**
    $$P_{\text{sugerido}} = \left\lceil \frac{C_{\text{pres}}}{1 - (M / 100)} \right\rceil$$
    *(Si $M \ge 100$ o $M < 0$, se rechaza por validación Zod para evitar asíntotas o precios negativos).*
  * **Recargo sobre Costo / Markup ($R \ge 0$):**
    $$P_{\text{recargo}} = \left\lceil C_{\text{pres}} \times (1 + (R / 100)) \right\rceil$$
  * **Precio Final:** $P_{\text{final}}$ (editable por el usuario; por defecto hereda $P_{\text{sugerido}}$).
  * **Ganancia Real:** $G = P_{\text{final}} - C_{\text{pres}}$.
  * **Margen Real Blindado contra División por Cero (PRE-001):**
    $$M_{\text{real}} = \begin{cases} \frac{P_{\text{final}} - C_{\text{pres}}}{P_{\text{final}}} \times 100 & \text{si } P_{\text{final}} > 0 \\ 0 & \text{si } P_{\text{final}} \le 0 \end{cases}$$

### 2.3. Presentaciones Compuestas (Ej. Cajas de Varias Unidades)
* Para una presentación que empaqueta $N$ unidades de otra presentación o subproducto (ej. Caja x 12 shots o Caja San Valentín con 2 o 6 brownies):
  $$C_{\text{compuesta}} = (N \times C_{\text{unidad}}) + C_{\text{caja}} + C_{\text{lazo}} + C_{\text{etiqueta}} + C_{\text{mensaje}}$$

### 2.4. Transaccionalidad y Cascada Reactiva (PRE-002)
* Toda actualización de costos se propaga en orden topológico estricto:
  $$\text{Insumo/Empaque} \longrightarrow \text{Subrecetas} \longrightarrow \text{Recetas Madre} \longrightarrow \text{Presentaciones}$$
* La propagación se ejecuta dentro de un `prisma.$transaction`, actualizando los costos unitarios de las presentaciones hijas, recalculando la ganancia y margen real, y **preservando de forma inmutable el $P_{\text{final}}$ fijado manualmente**.
* Las ventas pasadas (`SaleItem`) mantienen sus costos y precios históricos congelados de por vida.

---

## 3. Modelo de Datos Prisma (`prisma/schema.prisma`)

### 3.1. Entidades Modificadas y Nuevas
1. **`Ingredient` (Insumos, Empaques, Decoración):**
   * Agrega `category String @default("INGREDIENT")` (`INGREDIENT` | `PACKAGING` | `DECORATION` | `UTENSIL`).
   * Conserva `packagePriceCents`, `packageQty`, `packageUnit`, `baseUnit`, `costPerBaseUnit`, `density`, `isActive`, `supplierId`.
2. **`Supplier`:**
   * Agrega `isActive Boolean @default(true)`.
3. **`Recipe` (Receta Madre / Subreceta):**
   * `recipeType String @default("MOTHER")` (`MOTHER` | `SUBRECIPE`).
   * `batchYield Float` (rendimiento real en lote).
   * `yieldUnit String` (gramos, ml, unidades, porciones).
   * `laborPercent Float` (% mano de obra sobre costo insumos).
   * `overheadPercent Float` (% indirectos gas/agua/gastables).
   * `costPerYieldUnit Float` (costo por unidad de rendimiento).
   * Relación: `presentations RecipePresentation[]`.
4. **`RecipePresentation` (Nueva Entidad de Presentaciones):**
   * `id String @id @default(cuid())`
   * `recipeId String` (FK a Recipe)
   * `name String` (ej. "Shot 2 oz", "Caja San Valentín 2 uds", "Completo 8 pulg")
   * `sizeDescription String?` (ej. "2 oz", "6 unidades")
   * `motherRecipeQty Float` (cantidad consumida de receta madre)
   * `motherRecipeUnit String` (g, ml, unidad)
   * `presentationYield Float` (rendimiento por lote = `batchYield / motherRecipeQty`)
   * `packagingCostCents Int` (suma de empaques)
   * `additionalCostCents Int` (suma de toppings/subrecetas)
   * `totalCostCents Int` (costo total unitario)
   * `pricingMethod String @default("MARGIN")` (`MARGIN` | `MARKUP`)
   * `desiredMarginPercent Float @default(40)`
   * `suggestedPriceCents Int`
   * `finalPriceCents Int`
   * `realProfitCents Int`
   * `realMarginPercent Float`
   * `isActive Boolean @default(true)`
   * `notes String?`
   * Relaciones: `materials PresentationMaterial[]`, `subrecipes PresentationSubrecipe[]`, `saleItems SaleItem[]`.
5. **`PresentationMaterial`:**
   * `id`, `presentationId`, `ingredientId?`, `name`, `quantity`, `unit`, `unitCostCents`, `totalCostCents`.
6. **`PresentationSubrecipe`:**
   * `id`, `presentationId`, `subRecipeId`, `name`, `quantity`, `unit`, `costCents`.
7. **`SaleItem`:**
   * Agrega `presentationId String?` y `presentation RecipePresentation? @relation(...)`.
   * Conserva `unitPriceCents`, `unitCostCents`, `totalCents`, `totalCostCents` congelados en el momento de la venta.
8. **`Customer`, `ExpenseCategory`, `UnitConversionRef`:**
   * Soporte para `isActive: true` y edición completa.

---

## 4. Endpoints de API REST para Persistencia Real
Para garantizar persistencia al recargar o cambiar de dispositivo:
* `/api/ingredientes` (GET, POST, PUT, DELETE lógico)
* `/api/proveedores` (GET, POST, PUT, DELETE)
* `/api/recetas` (GET, POST, PUT, DELETE lógico)
* `/api/presentaciones` (GET, POST, PUT, DELETE lógico)
* `/api/clientes` (GET, POST, PUT, DELETE)
* `/api/ventas` (GET, POST, PUT, DELETE/CANCEL)
* `/api/abonos` (POST para registrar pagos a ventas)
* `/api/gastos` (GET, POST, PUT, DELETE)
* `/api/conversiones` (GET, POST, PUT, DELETE)
* `/api/cuadre` (GET resumen semanal, POST cierre de semana y arqueo de caja)

---

## 5. UI y Módulos de Mantenimiento (Triple Capa Anti-Slop)
Cada módulo incluye:
- Barra superior con búsqueda en vivo, filtros por estado (`Activo`, `Inactivo`, `Todos`) y categoría.
- Tabla clara con paginación/scroll y formateo en pesos dominicanos `RD$ X.XX`.
- Botones de acción: "Nuevo Registro" (abre modal responsivo), "Editar" (modal precargado), "Desactivar/Reactivar" (toggle seguro).
- 4 Estados UI: Skeleton loading, Empty state informativo con llamada a la acción, Error con botón de recarga, y contenido renderizado.
- Alertas de revisión de origen para datos importados del Excel que requerían validación.

---

## 6. Plan de Verificación y Pruebas (PRE-003 y PRE-004)
1. **Tests de Dominio Deterministas (`scripts/run_domain_tests.mjs` - PRE-004):**
   - Fórmulas de Receta Madre ($C_{\text{lote}}$, $C_{\text{unit\_rend}}$).
   - Fórmulas de Presentaciones ($P = C / (1 - M)$, $P = C \times (1 + R)$, ganancia y margen real).
   - Validación de fronteras: $0 \le M < 100$ y protección división por cero en $P_{\text{final}} \le 0$ (PRE-001).
   - Presentaciones compuestas (Caja x 12 con empaque sumado).
   - Recálculo en cascada al cambiar costo de insumo conservando $P_{\text{final}}$ e inmutabilidad de ventas pasadas.
   - Manejo de conversiones y prevención de conversión inválida sin densidad.
2. **Reconciliación Forense del Excel Real (5 Hojas - PRE-003):**
   - Importar y sembrar datos de las 5 hojas físicas confirmadas: `Producto precios`, `Brownies Cuadrados`, `Fresas`, `Corazón de Chocolate`, `Galletas Oreo en Chocolate`.
   - Marcar advertencias de revisión únicamente para unidades ambiguas ("mm" en grageas).
3. **Verificación de Base de Datos y Servidor:**
   - Ejecutar `prisma db push` y regenerar cliente Prisma.
   - Ejecutar script de seed con datos auditados.
   - Comprobar que el servidor Next.js responde adecuadamente en `http://localhost:3000`.

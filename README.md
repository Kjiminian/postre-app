# postre-app

## K_Sweet — Sistema Integral de Costeo y Operaciones de Repostería

Aplicación web full-stack diseñada y construida para **K_Sweet**, repostería artesanal en República Dominicana.

* **Moneda:** RD$ (DOP) con redondeo en centavos enteros sin errores de coma flotante.
* **Zona Horaria:** `America/Santo_Domingo` (AST).
* **Estándar de Ingeniería:** Metodología **GEM PROYECTOS SOFTWARE V3.0** con Escudo Anti-Slop y compuertas de auditoría independiente.

---

## 🎂 Módulos del Sistema

1. **Ventas & Cobranzas (`/ventas`):** Catálogo de postres reutilizable, registro de ventas con **costos históricos congelados** por ítem, abonos parciales y cálculo en tiempo real de saldos pendientes. Filtros por fecha y producto. *(Regla: no convierte cotizaciones en ventas automáticamente)*.
2. **Cuadre Semanal Lunes a Domingo (`/cuadre`):** Período semanal cerrado (L-D), facturado, cobrado real, costo de lo vendido (COGS), gastos y resultado operativo neto. Módulo de **Arqueo Físico de Efectivo** (fondo inicial + cobros EF - gastos EF = esperado vs contado físico y diferencia) con advertencia de modificaciones retroactivas post-cierre.
3. **Ingredientes & Insumos (`/ingredientes`):** Proveedores, precios de compra, cantidad de empaque y cálculo exacto de costo por unidad base (`g`, `ml`, `unidad`). Soporte de densidades. *(Regla: prohíbe fusionar variantes automáticamente sin revisión humana)*.
4. **Recetas & Subrecetas (`/recetas`):** Rendimiento porciones/unidades, costeo de subrecetas (ej. mermeladas), empaque, mano de obra y gastos indirectos. Duplicación atómica de recetas y recálculo en cascada sin alterar ventas pasadas.
5. **Costos y Precios (`/costos-precios`):** Simulador interactivo con la fórmula matemática:
   $$\text{Precio Sugerido} = \frac{\text{Costo Unitario}}{1 - \text{Margen Objetivo}}$$
   Diferenciación estricta entre **Margen sobre Venta** y **Recargo (Markup) sobre Costo**.
6. **Gastos Operativos (`/gastos`):** Categorías, fecha, concepto y medio de pago. Control anti-duplicidad para señalar compras de insumos y no descontarlas dos veces contra el COGS.
7. **Conversor de Unidades & Densidades (`/conversiones`):** Masa exacta ($1\text{ lb} = 453.59237\text{ g}$, $1\text{ oz} = 28.349523125\text{ g}$). Exigencia de densidad para cruce volumen $\leftrightarrow$ masa. Tabla editable de referencias aproximadas del Excel.
8. **Importación XLSX & Respaldos (`/importar`):** Inspección de hojas, detección de celdas `#REF!` y unidades ambiguas. Ingreso de datos incompletos como **Borradores por Revisar**. Exportador de respaldos en JSON y CSV.
9. **Panel Principal / Dashboard (`/`):** Métricas semanales L-D, ventas por día, postres más vendidos y alertas de recetas pendientes de auditoría.

---

## 🛠️ Stack Tecnológico

* **Framework:** Next.js 14 (App Router) + TypeScript
* **Base de Datos:** SQLite persistente (`prisma/ksweet.db`) gestionada con Prisma ORM
* **Estilos:** Tailwind CSS con paleta gastronómica artesanal Crema (`#FAF8F6`) y Rosa Ciruela (`#9C4266`)
* **Testing:** Vitest 3.x + Runner de Dominio nativo Node.js (15/15 pruebas unitarias en verde)
* **Iconografía:** Lucide React

---

## 🧪 Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias de Vitest:
```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm test
```

Para ejecutar el runner de dominio matemático:
```powershell
node scripts/run_domain_tests.mjs
```

---

## 🚀 Inicio en Desarrollo

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm run dev
```
Disponible en `http://localhost:3000`.

---

## 📂 Archivo de Origen Preservado
El archivo original `costos postres calciulos totales 2.xlsx` se encuentra resguardado íntegro en [`data/costos_postres_original.xlsx`](data/costos_postres_original.xlsx) preservando sus coordenadas y fórmulas originales para fines de auditoría forense.

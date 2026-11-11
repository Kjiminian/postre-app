# CONTEXTO DEL PROYECTO — K_SWEET (REPÚBLICA DOMINICANA)

## 1. IDENTIDAD DEL PROYECTO
* **Nombre:** K_Sweet (`ksweet-app`)
* **Ubicación:** Santiago, República Dominicana
* **Zona Horaria:** `America/Santo_Domingo`
* **Moneda Oficial:** Pesos Dominicanos (`RD$` / `DOP`)
* **Metodología:** GEM PROYECTOS SOFTWARE V3.0 + THEMIS
* **Tipología:** Greenfield con Migración e Inspección de Memoria Excel
* **Versión:** v1.0.0
* **Supervisor:** Katherine Jiminian
* **Antigravity Multi-Agente:** Arquitecto + Fiscal Themis + Ejecutor

---

## 2. RESUMEN EJECUTIVO

### ¿Qué es?
Una aplicación web integral de gestión técnica y comercial para **K_Sweet**, obrador de repostería artesanal en Santiago, República Dominicana. Integra en una única plataforma modular: control de ventas con cobros parciales, arqueo y cuadre semanal de caja (Lunes a Domingo), costeo riguroso de recetas y subrecetas, inventario de insumos/ingredientes con empaques y proveedores, fijación científica de precios con diferenciación entre margen sobre venta y markup sobre costo, registro de gastos operativos sin duplicar costos, calculadora y conversiones de unidades gastronómicas con densidad, e inspección/importación con trazabilidad del archivo histórico «costos postres calciulos totales 2.xlsx».

### ¿Qué problema resuelve?
Sustituye la gestión dispersa e insegura en hojas de cálculo propensas a errores de fórmulas (como referencias circulares, celdas `#REF!`, y mezclas de unidades de masa y volumen) por un sistema centralizado, persistente y transaccional que asegura la rentabilidad real de cada postre, evita la pérdida de cobros y garantiza que los costos históricos no se alteren retroactivamente.

### ¿Quién lo utiliza?
* **Katherine Jiminian / Administrador:** Propietaria y repostera jefa encargada de registrar recetas, verificar compras de insumos, registrar ventas y cuadrar la caja semanal.
* **Equipo de Operación / Taller:** Consulta de fichas técnicas de recetas, porciones y equivalencias.

### Sistema de Diseño y Estética Anti-Slop
* **Paleta Cromática:** Crema cálido (`#FAF8F6`, `#F8EAF0`), Ciruela/Bordeaux suave (`#9C4266`, `#831843`), Tinta oscura (`#302B32`) y Verde salvia para éxitos (`#3B7865`). Cero gradientes IA violeta-azul cliché.
* **Layout:** Navegación lateral estructurada (sidebar responsiva), cabecera con fecha y zona horaria local, y paneles limpios de tarjetas con contraste óptimo.

---

## 3. LOS 9 MÓDULOS DE INGENIERÍA

1. **Ventas:** Registro transaccional (fecha, producto, cliente, cantidad, precio, importe, costo histórico, medio de pago, monto cobrado, saldo pendiente). Agrupaciones y totales por fecha y producto. Catálogo de productos reutilizable. Prohibición expresa de convertir cotizaciones en ventas.
2. **Cuadre Semanal (Lunes a Domingo):** Facturado, cobrado, pendiente, costo de lo vendido, gastos operativos y resultado neto. Arqueo de efectivo con fondo inicial, efectivo esperado, contado y cálculo de descuadres con alerta de movimientos modificados.
3. **Ingredientes e Insumos:** Catálogo de insumos con proveedor, precio de empaque, contenido y unidad base. Prohibición de fusionar variantes sin revisión humana.
4. **Recetas y Costeo:** Rendimiento en porciones, ingredientes vinculados, subrecetas, empaque, mano de obra y costos indirectos. Recálculo automático al actualizar ingredientes con preservación inmutable del costo histórico en ventas.
5. **Costos y Precios:** Costo de lote, costo unitario, precio sugerido con fórmula matemática de margen sobre venta $P = \frac{C}{1 - M}$, utilidad y margen real vs markup sobre costo.
6. **Gastos Operativos:** Registro de egresos por fecha, categoría y medio de pago, garantizando no duplicar ingredientes ya cargados en el costo de recetas vendidas.
7. **Conversiones y Densidad:** Conversiones científicas exactas (g, kg, lb, oz, ml, l, tazas, cucharadas). Exigencia de densidad para pasar de volumen a masa. Catálogo editable de equivalencias del Excel (taza=150g, cda=15g).
8. **Importación XLSX/CSV e Inspección Excel:** Visualizador con coordenadas de las 34 hojas del Excel original («costos postres calciulos totales 2.xlsx»), conservación de fórmulas originales, mapeador por columnas, prevención de duplicados, exportación CSV y backup/restore JSON.
9. **Panel General (Dashboard):** Métricas semanales consolidadas, tendencias diarias en barra, productos más vendidos, y alertas de recetas en estado borrador/por revisar.

---

## 4. AUDITORÍA FORENSE DEL EXCEL ORIGINAL
El libro «costos postres calciulos totales 2.xlsx» cuenta con 34 hojas que han sido conservadas íntegramente con sus coordenadas, valores y fórmulas:
* **Inconsistencias Detectadas (Preservadas sin corrección silenciosa):**
  1. *Fórmulas rotas `#REF!`* en la hoja `Cheesecake` (filas 47 a 51 y 62) por eliminación de filas originales.
  2. *Error en cantidad de Harina:* En `Producto precios` fila 8, paquete dice 5 Libras pero en columna E se multiplicó por 453g en lugar de 2,267.96g, alterando el precio unitario en las fórmulas hijas.
  3. *Mezcla de criterios de margen:* Algunas recetas usan porcentaje como markup sobre ingredientes (`SUM * %`), mientras otras aplican porcentajes acumulados sobre subtotales.
  4. *Referencias a columnas vacías:* Celdas como `='Producto precios'!L66` o `='Producto precios'!G62`.
  5. *Unidades ambiguas:* "unidad según Excel", "palitos", "mm", "framos".
* **Política de Migración:** Todas las recetas importadas desde el Excel quedan marcadas con la bandera `review: true` (Borrador por revisar) y no como costos finales aprobados.

# CATÁLOGO DE REQUISITOS — POSTRES APP

Este archivo es la Fuente Canónica de Requisitos Funcionales (`RF-xxx`) y No Funcionales (`RNF-xxx`) bajo **GEM V3 (P-04)**.

---

## 1. REQUISITOS FUNCIONALES (RF)

| ID | Título | Prioridad | Estado | Descripción Breve |
| :--- | :--- | :--- | :--- | :--- |
| *RF-001* | Gestión de Catálogo de Postres | Alta | PROPUESTO | Registro, edición, baja lógica, categorías y precios de postres. |
| *RF-002* | Consulta y Búsqueda de Productos | Alta | PROPUESTO | Exploración del catálogo con filtros por categoría, alérgenos o tipo. |
| *RF-003* | Creación y Gestión de Pedidos | Alta | PROPUESTO | Proceso de orden de compra, selección de cantidades y personalización. |
| *RF-004* | Seguimiento de Estados del Pedido | Media | PROPUESTO | Estados: Recibido, En Preparación, Listo para Entrega, Entregado, Cancelado. |
| *RF-005* | Panel de Control Operativo | Media | PROPUESTO | Vista para repostero/administrador con pedidos activos y métricas del día. |

*(Detalle completo de precondiciones, flujos y criterios CA-xxx por calibrar en P-04).*

---

## 2. REQUISITOS NO FUNCIONALES (RNF)

| ID | Título | Tipo | Estado | Estándar / Restricción |
| :--- | :--- | :--- | :--- | :--- |
| *RNF-001* | Triple Capa Cero AI-Slop | Calidad / UX | APROBADO | Cumplimiento estricto de `05_CALIDAD/anti_slop.md`. 4 estados por vista, paleta con intención, cero código muerto. |
| *RNF-002* | Tiempos de Respuesta | Rendimiento | PROPUESTO | Cargas iniciales < 1.5s; transacciones de pedido < 500ms. |
| *RNF-003* | Integridad y Persistencia | Fiabilidad | PROPUESTO | Integridad referencial en base de datos; transacciones ACID para pedidos. |
| *RNF-004* | Accesibilidad y Responsividad | Usabilidad | PROPUESTO | Diseño responsive adaptado a móvil y escritorio (prioridad móvil para clientes). |

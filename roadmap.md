# ROADMAP DEL PROYECTO — POSTRES APP

Este documento define la descomposición del proyecto en fases y rebanadas verticales de extremo a extremo bajo **GEM V3 (P-09 / motor_descomposicion.md)**.

---

## 1. RESUMEN DE RUTA CRÍTICA

```text
[FASE 0] Concepción, Requisitos y Arquitectura (COMPLETADA)
   │
   ▼
[FASE 1] Fundación Arquitectónica, Diseño Anti-Slop y Base de Datos
   │
   ▼
[FASE 2] Rebanada Vertical 1: Catálogo de Postres y Experiencia de Producto
   │
   ▼
[FASE 3] Rebanada Vertical 2: Carrito, Solicitud de Pedido y Despacho WhatsApp
   │
   ▼
[FASE 4] Rebanada Vertical 3: Panel Administrativo y Máquina de Estados de Órdenes
   │
   ▼
[FASE 5] Rebanada Vertical 4: Gestión de Inventario y Catálogo por el Administrador
   │
   ▼
[FASE 6] Suite de Pruebas Integral, Auditoría Forense Themis y Handover
```

---

## 2. DESGLOSE DETALLADO DE FASES Y CRITERIOS DE ACEPTACIÓN

### FASE 0: Concepción, Requisitos y Arquitectura
* **Objetivo:** Descubrimiento multidimensional, formalización de requisitos (`RF-001`..`RF-012`), reglas (`RN-001`..`RN-008`), modelo de datos y decisiones (`DEC-001`..`DEC-003`).
* **Estado:** `COMPLETADA`
* **Entregables:** `AGENTS.md`, `context.md`, `requisitos.md`, `reglas_negocio.md`, `decisiones.md`, `roadmap.md`.
* **Criterios de Aceptación:** Alineación aprobada por el Supervisor sin dependencias bloqueantes.

---

### FASE 1: Fundación Arquitectónica, Diseño Anti-Slop y Base de Datos
* **Objetivo:** Inicializar el proyecto con Next.js + TypeScript + Tailwind CSS, configurar el sistema de diseño gastronómico cálido, modelar el esquema relacional en Prisma/SQLite y configurar Vitest.
* **Rebanada Vertical:** DDL + Configuración + Layout Base + Theme + Tests base.
* **Estado:** `LISTA PARA PLANIFICAR`
* **Criterios de Aceptación (CA):**
  * `CA-F1-01`: Proyecto compila limpiamente (`npm run build`) sin errores de TypeScript ni linter.
  * `CA-F1-02`: Sistema de diseño con paleta cálida gastronómica (vainilla `#FFFDF9`, crema `#F7F2EB`, caramelo `#D97706`, chocolate `#3D2619`, frambuesa `#BE185D`) y 0 gradientes cliché violeta-azul.
  * `CA-F1-03`: Esquema Prisma con modelos `Category`, `Product`, `Order`, `OrderItem`, `PaymentRecord` con claves foráneas e índices.
  * `CA-F1-04`: Suite de pruebas Vitest configurada y ejecutando al menos 1 prueba de sanidad exitosa en terminal.

---

### FASE 2: Rebanada Vertical 1 — Catálogo de Postres y Experiencia de Producto
* **Objetivo:** Interfaz pública mobile-first para explorar postres, filtrar por categoría, ver disponibilidad, porciones y alérgenos con estados de carga, vacío y error.
* **Rebanada Vertical:** Schema/Seed ➔ Service/Query ➔ UI Components ➔ Vitest.
* **Estado:** `PENDIENTE`
* **Criterios de Aceptación (CA):**
  * `CA-F2-01`: Listado de productos dinámico desde base de datos con filtros instantáneos por categoría.
  * `CA-F2-02`: Ficha de detalle con sellos visuales de alérgenos y cálculo de porciones.
  * `CA-F2-03`: Implementación estricta de los 4 estados: Loading (skeleton), Empty (sin productos en categoría), Error con retry, y Success.
  * `CA-F2-04`: Tests unitarios de filtrado y formateo de precios.

---

### FASE 3: Rebanada Vertical 2 — Carrito, Solicitud de Pedido y Despacho WhatsApp
* **Objetivo:** Armado del carrito en cliente, formulario de entrega/retiro validado con Zod, persistencia transaccional de orden en base de datos y generación del enlace de WhatsApp estructurado.
* **Rebanada Vertical:** Store local ➔ Zod Validation ➔ Server Action de Pedido ➔ Generador WhatsApp ➔ Vista de confirmación con tracking.
* **Estado:** `PENDIENTE`
* **Criterios de Aceptación (CA):**
  * `CA-F3-01`: Carrito persistente en sesión de cliente que permite modificar cantidades y agregar notas personalizadas.
  * `CA-F3-02`: Validación estricta con Zod de fecha/hora (respetando anticipación mínima RN-004), nombre y teléfono.
  * `CA-F3-03`: Generación de código unívoco `PED-YYYYMMDD-XXXX` y guardado atómico en base de datos.
  * `CA-F3-04`: Redirección/enlace automático a WhatsApp con el mensaje estructurado canónico (RN-006).
  * `CA-F3-05`: Página pública `/pedidos/[codigo]` donde el cliente puede consultar el estado en vivo de su orden.
  * `CA-F3-06`: Tests unitarios del generador de mensajes de WhatsApp y validadores Zod.

---

### FASE 4: Rebanada Vertical 3 — Panel Administrativo y Máquina de Estados
* **Objetivo:** Panel de control protegido para el repostero donde se listan las órdenes del día, se visualizan los detalles y se avanza la máquina de estados.
* **Rebanada Vertical:** Auth/Session ➔ Dashboard UI ➔ Transiciones de Estado ➔ Registro de Pagos ➔ Tests de Máquina de Estados.
* **Estado:** `PENDIENTE`
* **Criterios de Aceptación (CA):**
  * `CA-F4-01`: Acceso autenticado para el Administrador / Taller.
  * `CA-F4-02`: Tablero organizado por estados (`RECIBIDO`, `CONFIRMADO`, `EN_PREPARACION`, `LISTO`, `ENTREGADO`).
  * `CA-F4-03`: Transición segura de estados respetando las reglas de invariantes (RN-007).
  * `CA-F4-04`: Registro y verificación manual del estado de pago con comprobante (RN-008).
  * `CA-F4-05`: Tests automatizados de la máquina de estados del pedido probando transiciones válidas e inválidas.

---

### FASE 5: Rebanada Vertical 4 — Gestión de Inventario y Catálogo por el Administrador
* **Objetivo:** Permitir al repostero crear nuevos postres, editar precios, pausar productos temporalmente (agotado) y modificar información de alérgenos desde el panel.
* **Rebanada Vertical:** Server Actions de Catálogo ➔ Formulario Admin con previsualización ➔ Mutación en BD ➔ Revalidación de caché SSR.
* **Estado:** `PENDIENTE`
* **Criterios de Aceptación (CA):**
  * `CA-F5-01`: Formulario de creación y edición de productos con validación Zod.
  * `CA-F5-02`: Toggle inmediato para pausar disponibilidad / marcar producto como "Agotado".
  * `CA-F5-03`: Revalidación automática de rutas públicas tras modificar un producto (`revalidatePath`).

---

### FASE 6: Suite de Pruebas Integral, Auditoría Forense Themis y Handover
* **Objetivo:** Ejecución completa de pruebas de regresión, auditoría forense con `themis_fiscal_codigo` y `themis_auditor_antislop`, y entrega de documentación final.
* **Estado:** `PENDIENTE`
* **Criterios de Aceptación (CA):**
  * `CA-F6-01`: 100% de tests unitarios e integración pasando en terminal sin advertencias.
  * `CA-F6-02`: Dictamen favorable de `themis_fiscal_codigo` (sin código muerto, sin violaciones de tipos).
  * `CA-F6-03`: Dictamen favorable de `themis_auditor_antislop` (cero tropos de IA, UX coherente y pulida).
  * `CA-F6-04`: Guía operativa para despliegue y manual de usuario para el repostero.

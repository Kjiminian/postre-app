# CATÁLOGO DE REQUISITOS — POSTRES APP

Este archivo es la Fuente Canónica de Requisitos Funcionales (`RF-xxx`) y No Funcionales (`RNF-xxx`) bajo **GEM V3 (P-04)**.

---

## 1. REQUISITOS FUNCIONALES (RF)

| ID | Título | Prioridad | Estado | Actor | Descripción Breve |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-001** | Catálogo Público de Postres | Alta | APROBADO | Cliente | Listar postres por categoría con precio, descripción, alérgenos, fotos y disponibilidad. |
| **RF-002** | Filtrado y Búsqueda | Media | APROBADO | Cliente | Filtrar por categoría (Tortas, Postres de vaso, Galletas, Sin Gluten, etc.) y búsqueda por nombre. |
| **RF-003** | Ficha de Producto y Personalización | Alta | APROBADO | Cliente | Ver detalle, seleccionar porciones/tamaño y notas especiales (ej. mensaje para dedicatoria). |
| **RF-004** | Carrito de Compras Local | Alta | APROBADO | Cliente | Agregar/eliminar ítems, modificar cantidades y calcular subtotales dinámicamente en el cliente. |
| **RF-005** | Formulario y Creación de Pedido | Alta | APROBADO | Cliente | Capturar nombre, teléfono, fecha/hora de entrega, tipo de entrega (retiro/domicilio) y generar código `PED-xxxx`. |
| **RF-006** | Enlace y Despacho a WhatsApp | Alta | APROBADO | Cliente | Generar enlace de WhatsApp con mensaje estructurado pre-formateado con el detalle del pedido para enviar al negocio. |
| **RF-007** | Consulta Pública de Estado de Pedido | Media | APROBADO | Cliente | Consultar estado del pedido ingresando el código `PED-xxxx` o vía enlace directo. |
| **RF-008** | Autenticación del Administrador | Alta | APROBADO | Admin | Acceso seguro al panel de control con credenciales protegidas. |
| **RF-009** | Gestión de Catálogo e Inventario | Alta | APROBADO | Admin | Crear, editar, pausar/activar productos, cambiar precios y marcar como agotado. |
| **RF-010** | Tablero de Control de Pedidos | Alta | APROBADO | Admin | Visualizar pedidos recibidos ordenados por fecha de entrega y estado de preparación. |
| **RF-011** | Transición de Estados de Pedido | Alta | APROBADO | Admin | Avanzar estados del pedido: `RECIBIDO` ➔ `EN_PREPARACION` ➔ `LISTO` ➔ `ENTREGADO` (o `CANCELADO`). |
| **RF-012** | Validación y Registro de Pago Manual | Media | APROBADO | Admin | Registrar estado del pago (`PENDIENTE`, `VERIFICADO`, `RECHAZADO`) con método (Transferencia / Efectivo). |

---

## 2. REQUISITOS NO FUNCIONALES (RNF)

| ID | Título | Dimensión | Estado | Estándar / Restricción |
| :--- | :--- | :--- | :--- | :--- |
| **RNF-001** | Triple Capa Cero AI-Slop | Calidad / UX | APROBADO | Cumplimiento estricto de `05_CALIDAD/anti_slop.md`. Paleta gastronómica cálida (sin gradientes morados genéricos), 4 estados obligatorios (Loading, Empty, Error, Success). |
| **RNF-002** | Mobile-First & Responsividad | Usabilidad | APROBADO | Experiencia móvil impecable y fluida, optimizada para compras táctiles en smartphones y gestión cómoda en escritorio. |
| **RNF-003** | Rendimiento y Tiempos | Performance | APROBADO | First Contentful Paint < 1.2s en conexiones móviles; navegación instantánea con Next.js App Router. |
| **RNF-004** | Integridad y Persistencia | Fiabilidad | APROBADO | Base de datos relacional con claves foráneas e integridad referencial estricta. Transacciones atómicas al registrar pedidos. |
| **RNF-005** | Validación en Fronteras | Seguridad | APROBADO | Esquemas Zod estrictos en todas las entradas de formularios y endpoints Server Actions / API. |
| **RNF-006** | Mantenibilidad y Clean Code | Arquitectura | APROBADO | Código TypeScript estricto, sin any, con separación clara de capas (Dominio, Datos, UI). Cero modos de fallo LLM. |

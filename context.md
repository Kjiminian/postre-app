# CONTEXTO DEL PROYECTO — POSTRES APP

## 1. IDENTIDAD DEL PROYECTO
* **Nombre:** Postres App (`postres-app`)
* **Metodología:** GEM PROYECTOS SOFTWARE V3.0
* **Tipología:** Greenfield (Proyecto Nuevo)
* **Versión:** v0.1.0-alpha
* **Estado:** P-02 (Descubrimiento Aprobado) ➔ Avanzando a P-04/P-05/P-07
* **Fecha de Inicio:** 2026-11-11
* **Supervisor:** Katherine Jiminian
* **Antigravity Multi-Agente:** Arquitecto + Fiscal Themis + Ejecutor

---

## 2. RESUMEN EJECUTIVO

### ¿Qué es?
Una plataforma web responsive híbrida de repostería que integra:
1. Un **catálogo público interactivo** para que los clientes exploren postres, personalicen solicitudes y armen sus pedidos con despacho guiado a WhatsApp.
2. Un **panel administrativo interno** para que el repostero/administrador controle pedidos en tiempo real, gestione estados de producción, mantenga el inventario y actualice precios y disponibilidad.

### ¿Qué problema resuelve?
Elimina la fricción y desorganización de recibir pedidos dispersos por mensajes de texto sin detalle estructurado, evitando errores en pedidos, pérdida de información sobre alérgenos/fechas de entrega y falta de visibilidad del estado de producción diaria.

### ¿Quién lo utiliza?
* **Clientes:** Usuarios que buscan postres, tortas y dulces desde sus teléfonos móviles o computadoras.
* **Administrador / Repostero:** Dueño del negocio y personal de cocina que recibe, elabora y despacha los pedidos.

### ¿Cuál es el resultado esperado?
Aumentar las ventas facilitando la selección de productos y profesionalizar la operativa interna con un registro centralizado de órdenes, reduciendo tiempos de atención y confusiones en las órdenes.

---

## 3. ALCANCE DEL PROYECTO (V1.0)

### INCLUYE (Enfoque V1)
* **Catálogo Público de Productos:**
  * Categorización (Tortas, Postres individuales, Galletas, Bocadillos, Opciones especiales).
  * Ficha de producto con precio, descripción clara, fotos y declaración de alérgenos.
  * Indicador de disponibilidad inmediata vs. pedido con anticipación.
* **Carrito y Solicitud de Pedido:**
  * Armado de carrito con cantidades y notas de personalización (ej. dedicatoria, decoración).
  * Selección de fecha y hora requerida para la entrega o retiro.
  * Datos de contacto del cliente (Nombre, Teléfono, Dirección si aplica).
  * Generación de código único de orden (`PED-xxxx`).
  * Generación automática de mensaje estructurado para WhatsApp con el desglose del pedido y enlace de seguimiento.
* **Panel Administrativo / Taller:**
  * Acceso seguro para el repostero/administrador.
  * Tablero Kanban / Lista de pedidos activos con filtros por fecha y estado.
  * Transición de estados: `RECIBIDO` ➔ `EN_PREPARACION` ➔ `LISTO` ➔ `ENTREGADO` (o `CANCELADO`).
  * Gestión básica del catálogo: activar/pausar productos, modificar precios y stock.
* **Confirmación de Pago Flexible:**
  * Registro de método de pago acordado (Transferencia bancaria / Pago móvil / Contra entrega).
  * Marcar pago como confirmado manualmente en el panel tras validar comprobante.

### NO INCLUYE (Exclusiones Expresas V1)
* Pasarela de cobro bancario automatizado con tarjeta de crédito (Stripe / procesador directo).
* Geolocalización o tracking GPS de delivery en vivo.
* Multi-sucursal con inventario fragmentado geográficamente.
* Facturación electrónica fiscal regulatoria automática.

### FUTURO (V2+)
* Integración de pasarelas de pago online directas.
* Notificaciones automáticas de cambio de estado vía WhatsApp Business API / Webhooks.
* Programa de fidelización y cupones de descuento.

---

## 4. ACTORES Y ROLES

| Actor | Responsabilidad | Canal / Acceso |
| :--- | :--- | :--- |
| **Cliente** | Explorar catálogo, configurar postres, enviar pedido y consultar estado | Web App pública (prioridad móvil) |
| **Repostero / Admin** | Gestionar catálogo, revisar órdenes diarias, cambiar estados y confirmar pagos | Panel de administración protegido |

---

## 5. TABLERO DE COMPLETITUD (12 DIMENSIONES GEM V3)

| Dimensión | Estado | Observación |
| :--- | :--- | :--- |
| **1. Negocio** | CUBIERTA | Modelo híbrido catálogo + WhatsApp + panel interno validado |
| **2. Funcionalidad** | CUBIERTA | Flujo cliente y flujo taller delimitados |
| **3. Datos** | CUBIERTA | Entidades clave: Producto, Categoría, Pedido, ItemPedido, Estado |
| **4. Usuarios y Accesos** | CUBIERTA | Cliente (público sin login obligatorio) y Admin (autenticado) |
| **5. Integraciones** | CUBIERTA | WhatsApp click-to-chat con payload estructurado |
| **6. Seguridad** | PARCIAL | Protección de panel admin (JWT / Session) y validación de inputs con Zod |
| **7. Arquitectura** | CUBIERTA | Next.js (App Router) + SQLite / PostgreSQL con Prisma/Drizzle |
| **8. Operaciones** | PARCIAL | Despliegue en Node / Vercel con persistencia de base de datos |
| **9. Calidad** | CUBIERTA | Vitest para lógica de negocio/pedidos + tests de integración |
| **10. UX e Interfaz** | CUBIERTA | Triple Capa Anti-Slop (Tailwind con paleta cálida gastronómica, 4 estados) |
| **11. Evolución** | CUBIERTA | Puntos de desacoplamiento para pagos online en V2 |
| **12. Cierre / Handover**| PENDIENTE | Criterios de aceptación y guía de uso |

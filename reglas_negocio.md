# CATÁLOGO DE REGLAS DE NEGOCIO — POSTRES APP

Este archivo es la Fuente Canónica de Políticas, Fórmulas e Invariantes (`RN-xxx`) bajo **GEM V3 (P-05)**.

---

## 1. POLÍTICAS DE PRODUCTOS Y PRECIOS

* **RN-001 (Invariante de Precios):**
  * Todo postre debe tener un precio base estrictamente mayor a cero ($P > 0$).
  * Los precios se almacenan en centavos/enteros para evitar imprecisiones de coma flotante y se muestran con 2 decimales en la moneda configurada.
* **RN-002 (Disponibilidad y Stock):**
  * Un producto con disponibilidad desactivada o stock agotado no puede ser añadido al carrito.
  * Si un producto en un carrito abierto se agota antes del envío, el sistema debe alertar al cliente antes de generar la orden.
* **RN-003 (Alérgenos y Salud Alimentaria):**
  * La ficha de cada postre debe declarar de manera inequívoca si contiene gluten, lácteos, huevo, frutos secos o azúcar, o sus sellos correspondientes ("Sin Gluten / Celíaco", "Vegano", "Sin Azúcar Añadida").

---

## 2. POLÍTICAS DE PEDIDOS Y ENTREGAS

* **RN-004 (Anticipación Mínima de Pedido):**
  * Los pedidos de tortas completas o personalizadas requieren un mínimo de 24 horas de anticipación respecto a la fecha/hora seleccionada.
  * Los postres individuales o por porción disponibles para el mismo día solo pueden pedirse dentro del horario operativo de la tienda.
* **RN-005 (Código de Pedido Unívoco):**
  * Cada orden genera un código alfanumérico legible único con formato `PED-YYYYMMDD-XXXX` (ej. `PED-20261111-A8F2`) que sirve como identificador tanto para el cliente como para el taller.
* **RN-006 (Estructura del Mensaje de WhatsApp):**
  * El mensaje prellenado a WhatsApp debe contener obligatoriamente:
    1. Código de pedido.
    2. Nombre y teléfono del cliente.
    3. Lista detallada de productos, cantidades, variantes y notas de personalización.
    4. Total general a pagar.
    5. Fecha, hora y método de entrega (Retiro en local / Delivery con dirección).
    6. Enlace web único para que el cliente consulte el estado de su orden.

---

## 3. MÁQUINA DE ESTADOS DEL PEDIDO Y PAGOS

* **RN-007 (Máquina de Estados de la Orden):**
  * Estados válidos:
    * `RECIBIDO`: Orden registrada en el sistema y enviada por WhatsApp, esperando confirmación de pago.
    * `CONFIRMADO`: Pago validado por el repostero/admin; listo para planificar producción.
    * `EN_PREPARACION`: El postre está siendo elaborado en el taller.
    * `LISTO`: Elaboración terminada, listo para retiro o despacho.
    * `ENTREGADO`: Entregado al cliente (estado final exitoso).
    * `CANCELADO`: Anulado por el cliente o taller (estado final fallido).
  * Invariante de transición: No se puede pasar a `EN_PREPARACION` sin confirmación previa de pago/orden.
  * Una orden en estado `EN_PREPARACION` o posterior no puede ser cancelada automáticamente por el cliente.
* **RN-008 (Confirmación de Pagos Manuales):**
  * Los métodos aceptados son: Transferencia Bancaria, Pago Móvil o Efectivo al retirar.
  * El estado de pago es independiente del estado logístico: `PAGO_PENDIENTE` ➔ `PAGO_VERIFICADO` (o `PAGO_RECHAZADO`).
  * Solo el Administrador autenticado tiene potestad para cambiar el estado de pago a `PAGO_VERIFICADO`.

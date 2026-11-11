# CATÁLOGO DE REGLAS DE NEGOCIO — POSTRES APP

Este archivo es la Fuente Canónica de Políticas, Fórmulas e Invariantes (`RN-xxx`) bajo **GEM V3 (P-05)**.

---

## 1. INVARIANTES Y POLÍTICAS DEL NEGOCIO

| ID | Título | Estado | Descripción / Fórmula |
| :--- | :--- | :--- | :--- |
| *RN-001* | Precios y Moneda | PROPUESTO | Todo precio debe ser mayor a cero, expresado en moneda local con precisión de dos decimales. |
| *RN-002* | Disponibilidad e Inventario | PROPUESTO | No se pueden confirmar pedidos de productos marcados como "Agotado" o fuera de temporada. |
| *RN-003* | Anticipación Mínima de Pedidos | PROPUESTO | Postres personalizados / tortas especiales requieren un mínimo de X horas de anticipación. |
| *RN-004* | Transición de Estados de Pedido | PROPUESTO | Transición secuencial válida: `RECIBIDO` ➔ `EN_PREPARACION` ➔ `LISTO` ➔ `ENTREGADO`. Anulaciones solo permitidas antes de preparación. |
| *RN-005* | Alérgenos e Información Sanitaria | PROPUESTO | Todo producto debe declarar explícitamente alérgenos comunes (gluten, lácteos, frutos secos, huevo, azúcar o apto celíaco/vegano). |

*(Nuevas reglas por descubrir y validar con el Supervisor en P-02 y P-05).*

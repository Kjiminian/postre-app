# REGISTRO HISTÓRICO DE DECISIONES ARQUITECTÓNICAS (ADR) — POSTRES APP

Este archivo es la Fuente Canónica de Decisiones Técnicas y Arquitectónicas (`DEC-xxx`) bajo **GEM V3 (P-07)**.

---

## DEC-001: Adopción del Sistema GEM PROYECTOS SOFTWARE V3.0 y Gobernanza THEMIS

* **Estado:** APROBADA
* **Fecha:** 2026-11-11
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Se requiere un marco disciplinado de ingeniería de software para concebir, planificar, auditar y ejecutar la aplicación `postres-app`, evitando vicios comunes de desarrollo asistido por IA (código primero sin requisitos, falta de pruebas reales, interfaces genéricas y sobreingeniería).

### Decisión
Adoptar formalmente **GEM PROYECTOS SOFTWARE V3.0** y el protocolo vinculante **THEMIS**:
1. Arquitectura bipolar estricta (Supervisor = Tomador de decisiones; Antigravity = Arquitecto + Fiscal Themis + Ejecutor).
2. Prohibición de "código primero" (Greenfield P-01).
3. Pre-auditoría obligatoria de planes con `themis_fiscal_planes` (P-11 / P-33).
4. Auditoría obligatoria e independiente de cierre de fase con `themis_fiscal_codigo` y `themis_auditor_antislop` (P-14 / P-33).
5. Triple Capa Cero AI-Slop (`05_CALIDAD/anti_slop.md`).

### Consecuencias
* Se garantiza alta calidad arquitectónica, trazabilidad documental y software mantenible.
* Se elimina el sesgo de "juez y parte" mediante subagentes fiscales.

---

## DEC-002: Clasificación del Proyecto como Greenfield (Nuevo)

* **Estado:** APROBADA
* **Fecha:** 2026-11-11
* **Autor:** Antigravity (Arquitecto)
* **Aprobador:** Supervisor (Katherine Jiminian)

### Problema
Determinar el punto de partida del repositorio para seleccionar el protocolo de inicio.

### Contexto
El directorio de trabajo se encontraba completamente vacío sin código previo ni dependencias instaladas.

### Decisión
Clasificar bajo **Protocolo P-01** como `PROYECTO NUEVO (Greenfield)`. Activar de inmediato la fase conceptual de Descubrimiento (`P-02`), prohibiendo la generación de código de aplicación antes de formalizar requisitos, modelo de datos y roadmap aprobado.

---

*(Nuevas decisiones de stack, base de datos y UI se registrarán como DEC-003+ tras el descubrimiento P-02).*

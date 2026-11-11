# GOBERNANZA DEL PROYECTO — GEM V3.0

Este proyecto se concibe, diseña, planifica, ejecuta y audita bajo el sistema **GEM PROYECTOS SOFTWARE V3.0**.

## 1. MARCO METODOLÓGICO VINCULANTE
* **Metodología Canónica:** `Z:/Documents/K/GEM_PROYECTOS_SOFTWARE_V3_0/`
* **Modelo de Operación:** Arquitectura Bipolar (2 Roles):
  * **SUPERVISOR:** Autoridad humana final (aprueba alcance, reglas, arquitectura y fases).
  * **ANTIGRAVITY:** Sistema Autónomo Multi-Agente (Arquitecto + Fiscal Técnico + Ejecutor Físico).

## 2. REGLAS INNEGOCIABLES DE INGENIERÍA
1. **No Code First & Pre-Auditoría de Planes (P-11 / P-33 - Compuerta Preventiva):**
   - Prohibido escribir código sin plan aprobado por el Supervisor.
   - Al formular el borrador de un Plan de Implementación (`implementation_plan.md`):
     * PROHIBIDO solicitar la firma del Supervisor sin convocar al Fiscal de Planes.
     * De forma automática, Antigravity DEBE ejecutar:
       `invoke_subagent(Role: 'Fiscal de Planes y Arquitectura', TypeName: 'themis_fiscal_planes', Prompt: 'Auditar borrador de implementation_plan.md contra context.md, reglas_negocio.md y P-33...')`
     * Solo tras obtener dictamen de plan viable se presenta el plan al Supervisor para su aprobación formal.
2. **Rebanadas Verticales:** Toda fase compleja se divide en subfases verticales de extremo a extremo (DDL -> Dominio -> Integración -> Endpoints -> UI -> Tests).
3. **Escáner de 6 Capas:** Todo módulo debe detallar: máquina de estados, casos borde (concurrencia/idempotencia), persistencia DDL, seguridad (Zod/Pydantic), observabilidad y tests automatizados.
4. **Auditoría Imparcial Automática (Anti-Juez y Parte - Compuerta Obligatoria):** Al completar el código y los tests de cualquier fase o subfase:
   - PROHIBIDO responder al Supervisor dando por concluida la entrega sin ejecutar al subagente.
   - De forma automática, Antigravity DEBE ejecutar:
     `invoke_subagent(Role: 'Fiscal Técnico Independiente', TypeName: 'themis_fiscal_codigo', Prompt: 'Auditar la entrega contra el plan, git diff, tests, P-33 y anti_slop.md...')`
   - Si hubo cambios visuales o de UX, convocar también a `themis_auditor_antislop`.
   - Solo tras recibir el veredicto del Fiscal Técnico se presenta el reporte final y el walkthrough al Supervisor.
5. **Estándar Triple Capa Cero AI-Slop (`05_CALIDAD/anti_slop.md` + Plugin `gem-v3-themis`):**
   - **UI/UX (12 Tropos Prohibidos):** Prohibidos los gradientes violeta-azul por defecto (`#6366f1` -> `#a855f7`), abuso de `backdrop-blur`, bento grids sin jerarquía, imágenes placeholder rotas, botones sin estados. Obligatorios los 4 estados (Loading, Empty, Error con recuperación, Success/Datos reales).
   - **Código (15 Modos de Fallo LLM):** Cero sobre-ingeniería especulativa, cero `except Exception: pass` silencioso, cero funciones fantasma (`TODO`), cero N+1 queries, validación estricta en fronteras.
   - **Texto y Commits (Unslop):** Comentarios que explican el *PORQUÉ*, mensajes de commit atómicos y microcopy técnico sin muletillas robóticas.
6. **Protección de Ventana de Contexto (Catálogo de Skills):**
   - Máximo 5 skills complementarias activas por proyecto (`.agent/skills/`), seleccionadas quirúrgicamente con `buscar_skill`. Prohibida la instalación masiva (`--all`).

## 3. FUENTES DE VERDAD LOCALES (RAÍZ DEL REPOSITORIO)
* `context.md` → Visión y problema de negocio.
* `estado_actual.md` → Situación técnica y hito presente.
* `roadmap.md` → Desglose de fases y ruta crítica.
* `requisitos.md` → Catálogo de requisitos (`RF-xxx`, `RNF-xxx`).
* `reglas_negocio.md` → Políticas y fórmulas del negocio (`RN-xxx`).
* `decisiones.md` → Registro de decisiones arquitectónicas (`DEC-xxx`).
* `GEM_ESTADO.json` → Estado de gobernanza legible por máquina.

## 4. COMANDOS DE DESARROLLO Y VERIFICACIÓN
* Instalar: Pendiente de definición de stack en P-07
* Desarrollar: Pendiente
* Test: Pendiente
* Build: Pendiente

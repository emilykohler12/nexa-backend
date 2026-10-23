# Bitácora 3: configuración de Claude Code en nexa-backend

Registro de cada cambio hecho en la rama `chore/claude-config`. Cada entrada consigna los seis elementos de la Bitácora Individual de Proceso y Decisiones (Proyecto Final de Grado 2026, UCP, Comisión A).

---

## Entrada 1: rama de trabajo y verificación de hallazgos

**Fecha:** 2026-10-23, 16:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Trabajar en una rama nueva `chore/claude-config` (no en `main`) y verificar los hallazgos previos antes de editar. No se hizo ningún commit. |
| 2 | Alternativas y criterio de descarte | Trabajar directo en `main`: descartado porque un push a `main` redespliega el backend de Render que usa la clienta real. |
| 3 | Evidencia que la sostiene | `git status` solo mostraba `?? .claude/`; `.gitignore` no ignora `.claude/settings.local.json` (confirmado); `evolver.config.json` solo lo referencia el commit `a1ab21f` y ningún código lo usa (las dos coincidencias de "evolver" en `src/` y `tests/` son la palabra "devolver"). |
| 4 | Aporte personal | Definición de las reglas del trabajo (no tocar `.env`, no commit, rama nueva) en la consigna; registro en el repositorio: rama `chore/claude-config`. |
| 5 | Desacuerdo y resolución | Ninguno registrado. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), solo lectura del repositorio y creación de la rama. Alcance: el artefacto de configuración, sin tocar la documentación académica. |

## Entrada 2: creación de `CLAUDE.md`

**Fecha:** 2026-10-23, 16:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear `CLAUDE.md` en la raíz con estructura, comandos, reglas de arquitectura, seguridad, contrato con el frontend y criterio de "terminado". Se escribió solo lo confirmado en el código. |
| 2 | Alternativas y criterio de descarte | (a) Copiar la consigna tal cual: descartado porque dos supuestos no coincidían con el código (ver evidencia). (b) Un CLAUDE.md extenso con todo el README: descartado, se pidió corto. |
| 3 | Evidencia que la sostiene | **ADR-001** decide single-tenant por despliegue y `grep` no encuentra `tenantId`/`businessId`, por lo que no hay multi-tenancy en runtime. **ADR-003** describe JWT en `localStorage` con header `Bearer`, pero el código usa cookies `httpOnly` (`auth.controller.ts`, `auth.middleware.ts`) y CORS solo permite el header `Content-Type`. **R-01** figura en `README.md` y su mecanismo en ADR-002 (índice único parcial, 409 `PROFESSIONAL_SLOT_TAKEN`, 400 `OUT_OF_HOURS`). Webhook real: `POST /api/webhook/mercadopago`. `beforeSend` de Sentry solo descarta validaciones y 404, no redacta datos. |
| 4 | Aporte personal | Consigna y criterios del contenido; los ADR y el RUNBOOK que sirven de fuente son de su autoría. Archivo: `CLAUDE.md`. |
| 5 | Desacuerdo y resolución | La consigna hablaba de "multi-tenancy" y el ADR-001 dice lo contrario. Se resolvió siguiendo el código y el ADR vigente, y se deja avisado para que Emily decida si corrige el ADR-003. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción del archivo a partir de la lectura de README, package.json, tsconfig, vitest, `app.ts`, `routes.ts`, módulo appointments, auth, ADR 001 a 003, RUNBOOK y workflows. Revisión final por Emily pendiente. |

## Entrada 3: hooks de seguridad y calidad (`.claude/settings.json` y `.claude/hooks/*.mjs`)

**Fecha:** 2026-10-23, 16:28 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear cuatro hooks en Node (`block-protected-files`, `warn-secrets`, `guard-bash`, `typecheck-after-edit`) más `_lib.mjs`, y registrarlos en `.claude/settings.json`. Además se agregó `permissions.deny` para `Read(./.env)` y `Read(./.env.test)`, y el matcher de `guard-bash` incluye `PowerShell` además de `Bash`. |
| 2 | Alternativas y criterio de descarte | Scripts bash: descartados por pedido (Windows). Typecheck solo de `src/`: innecesario, `tsc -p tsconfig.test.json` cubre `src/` y `tests/` en unos 2 s. Bloquear del todo los secretos sospechosos: descartado, se usa confirmación (`ask`) porque puede haber falsos positivos. `migrate deploy` permitido si la base no es verificable: descartado, se bloquea porque Prisma lee `.env` (base real) y el hook no lo abre. |
| 3 | Evidencia que la sostiene | Prueba con JSON simulado de 43 casos, todos con el resultado esperado (bloqueo con exit 2, aviso con `permissionDecision: ask`, o paso libre). Ejemplos: `.env` y `.env.test` bloqueados, `.env.example` permitido, migración existente bloqueada y migración nueva permitida, `push origin main` bloqueado, `migrate deploy` bloqueado sin base de pruebas verificable y permitido con `DATABASE_URL` local de pruebas. El hook de `Bash` ya estaba activo y bloqueó un comando mío que contenía el texto del push con force. |
| 4 | Aporte personal | Consigna con las reglas a bloquear y los criterios (rama nueva, nada de producción, hooks en `.mjs`). Archivos: `.claude/settings.json`, `.claude/hooks/`. |
| 5 | Desacuerdo y resolución | Ninguno. Limitación aceptada y a conocer: los hooks de archivos no ven escrituras hechas desde un comando de shell (`sed -i`, redirecciones), y el hook de `Bash` analiza el texto del comando, por lo que puede dar falsos positivos con texto citado. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): escritura de los scripts y ejecución de las pruebas simuladas. Revisión de Emily pendiente. |

## Entrada 4: subagentes (`.claude/agents/`)

**Fecha:** 2026-10-23, 16:31 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear tres subagentes: `revisor-reservas` y `revisor-seguridad-api` (solo lectura: herramientas Read, Grep y Glob) y `escritor-tests` (Read, Grep, Glob, Write, Edit y Bash; solo escribe en `tests/`). Cada uno tiene en la descripción cuándo usarlo y cuándo no. |
| 2 | Alternativas y criterio de descarte | Un único revisor general: descartado porque mezcla dos criterios distintos (integridad de reservas y seguridad). Dar Bash a los revisores: descartado para garantizar que sean de solo lectura. Revisar "aislamiento por tenant": descartado porque el ADR-001 decide una instancia por cliente; el revisor de seguridad controla el aislamiento entre roles y entre usuarias de una misma instancia. |
| 3 | Evidencia que la sostiene | Los prompts citan hechos leídos en el código: R-01 como índice único parcial con `isSlotConflict`, 409 `PROFESSIONAL_SLOT_TAKEN` y 400 `OUT_OF_HOURS`; fechas como texto `YYYY-MM-DD` con `T00:00:00Z`; cron sin zona horaria en `scheduler.ts`; contrato del job de liberación en su cabecera; webhook con HMAC y sin control de frescura del `ts` visible; `beforeSend` de Sentry sin redacción; multer en memoria con 5 MB; convenciones de `tests/setup.ts` y `tests/helpers`. |
| 4 | Aporte personal | Consigna con la lista de qué revisa cada agente y reglas de seguridad (nada de `.env`, solo base de pruebas). Archivos: `.claude/agents/revisor-reservas.md`, `revisor-seguridad-api.md`, `escritor-tests.md`. |
| 5 | Desacuerdo y resolución | Ninguno. Pendiente: los agentes aún no se probaron sobre un cambio real; se verá su utilidad al usarlos. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción de los tres archivos a partir de la lectura de middlewares, webhook, uploads, jobs, scheduler y tests. Revisión de Emily pendiente. |

## Entrada 5: skills del proyecto (`.claude/skills/`)

**Fecha:** 2026-10-23, 16:40 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear tres skills: `nuevo-modulo`, `nueva-migracion` (con `disable-model-invocation`, solo se ejecuta si Emily la invoca) y `cambio-de-contrato`. Además se corrigió en `CLAUDE.md` y en dos subagentes el código de validación: `VALIDATION_ERROR` responde 400 en casi todos los módulos y 422 solo en auth. |
| 2 | Alternativas y criterio de descarte | Una plantilla de módulo fija: descartada porque los módulos reales no son uniformes (algunos con repository, model o dto); la skill manda copiar un módulo vecino. Permitir que `nueva-migracion` se dispare sola: descartado por el riesgo sobre datos reales. Que la skill de contrato edite el frontend: descartado por pedido (solo grep). |
| 3 | Evidencia que la sostiene | Lectura de `reviews` y `specialEvents` (estructura real), conteo con grep de los códigos de validación (40 casos con 400 y 1 con 422), formato de nombres y comentarios de las migraciones existentes (p. ej. `20261006123000_drop_whatsapp_bot_tables`), `prisma/schema.prisma` (generador `prisma-client-js`), `tests/setup.ts` (lista `TABLES`) y el frontend: `VITE_API_URL` sin `/api`, rutas completas `/api/...` en `src/features/*/api/*.ts`. Primera versión de la skill de contrato tenía mal el prefijo `/api` y se corrigió al verificarlo. |
| 4 | Aporte personal | Consigna con el contenido de cada skill y las reglas de migración segura. Archivos: `.claude/skills/nuevo-modulo/`, `nueva-migracion/`, `cambio-de-contrato/`. |
| 5 | Desacuerdo y resolución | Ninguno. Pendiente de confirmar con Emily el paso de registrar la migración en `_prisma_migrations` (cálculo del checksum), que la skill indica contrastar con migraciones anteriores antes de aplicarlo. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción de las skills y verificación contra el código. Las skills no se ejecutaron sobre una tarea real. Revisión de Emily pendiente. |

## Entrada 6: evaluación de servidores MCP (sin cambios en archivos)

**Fecha:** 2026-10-23, 16:44 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | No crear `.mcp.json` todavía. Se presentó una recomendación: Context7 sí (bajo riesgo); servidor PostgreSQL de solo lectura solo con un rol de base con permiso únicamente de lectura y apuntando a la base local de pruebas, con prioridad baja. Queda a la espera de la confirmación de Emily. |
| 2 | Alternativas y criterio de descarte | Conectar un MCP a Supabase de producción: descartado de plano (datos reales de una clienta). Postgres MCP con la cadena de conexión dentro de `.mcp.json`: descartado, la cadena debe venir de una variable de entorno local, no versionada. Basarse solo en "solo lectura" del servidor: descartado como única barrera, se exige un rol con `GRANT SELECT`. |
| 3 | Evidencia que la sostiene | La base de pruebas se trunca antes de cada test (`tests/setup.ts`), por lo que casi siempre está vacía y el valor de leerla es bajo; los tests ya verifican la base con Prisma. Las versiones del stack (Express 5, Prisma 6, zod 4, TypeScript 7) son recientes, lo que justifica documentación actualizada (Context7). |
| 4 | Aporte personal | La sospecha inicial de Emily (Context7 y PostgreSQL de solo lectura contra la base de pruebas) y la restricción de nunca apuntar a Supabase de producción. |
| 5 | Desacuerdo y resolución | Ninguno; falta su confirmación. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): solo análisis y recomendación, sin instalar nada. |

## Entrada 7: configuración de Context7 (`.mcp.json`)

**Fecha:** 2026-10-23, 16:47 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear `.mcp.json` con un único servidor, Context7, fijado en la versión 4.2.1 de `@upstash/context7-mcp`. No se configuró ningún servidor de PostgreSQL. |
| 2 | Alternativas y criterio de descarte | Usar la última versión (4.4.4, publicada el 2026-10-19, hace 4 días): descartada porque el paquete publica varias versiones por semana y se prefiere una con al menos 14 días de antigüedad (4.2.1, del 2026-10-09) para reducir el riesgo de una publicación comprometida. MCP de PostgreSQL: descartado por ahora, ver entrada 6. |
| 3 | Evidencia que la sostiene | `npm view @upstash/context7-mcp time` (fechas de publicación) y la decisión de Emily del 2026-10-23. El archivo es JSON válido y no contiene secretos. |
| 4 | Aporte personal | Decisión de configurar solo Context7. Archivo: `.mcp.json`. |
| 5 | Desacuerdo y resolución | Ninguno. Limitación: el comando usa `cmd /c npx`, que es la forma de Windows; en macOS o Linux habría que cambiarlo a `npx`. Claude Code pedirá aprobación la primera vez que se use el servidor del proyecto. Sin probar: el servidor no se ejecutó en esta sesión. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción del archivo y consulta de versiones en npm. No se instaló nada en el proyecto. |

## Entrada 8: cierre, `.gitignore` y verificaciones

**Fecha:** 2026-10-23, 16:51 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Agregar `.claude/settings.local.json` a `.gitignore` (con un comentario) y cerrar el trabajo sin hacer commit. |
| 2 | Alternativas y criterio de descarte | Ignorar toda la carpeta `.claude/`: descartado porque `settings.json`, `hooks/`, `agents/` y `skills/` deben versionarse para que el equipo (y el CI futuro) los tenga. |
| 3 | Evidencia que la sostiene | `git check-ignore` confirma que `settings.local.json`, `.env` y `.env.test` quedan ignorados y que `settings.json`, `.mcp.json` y `CLAUDE.md` no. `settings.json` y `.mcp.json` son JSON válido. `settings.local.json` (última modificación 2026-10-20) y `launch.json` (2026-09-25) no fueron modificados. `npm run typecheck:all` pasa sin errores. No se ejecutó `npm test` (necesita el PostgreSQL de pruebas) ni se probaron los subagentes, las skills ni Context7 sobre una tarea real. |
| 4 | Aporte personal | Definición del cierre y de la regla de no hacer commit. Archivos: `.gitignore`, `bitacora3.md`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): verificaciones y edición de `.gitignore`. Revisión final de Emily pendiente antes del commit. |

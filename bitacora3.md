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
| 3 | Evidencia que la sostiene | Prueba con JSON simulado de 39 casos (corregido el 2026-10-24: antes decía 43, el recuento real del script es 39), todos con el resultado esperado (bloqueo con exit 2, aviso con `permissionDecision: ask`, o paso libre). Ejemplos: `.env` y `.env.test` bloqueados, `.env.example` permitido, migración existente bloqueada y migración nueva permitida, `push origin main` bloqueado, `migrate deploy` bloqueado sin base de pruebas verificable y permitido con `DATABASE_URL` local de pruebas. El hook de `Bash` ya estaba activo y bloqueó un comando mío que contenía el texto del push con force. |
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

## Entrada 9: commit y push de la rama de configuración (registro retroactivo)

**Fecha:** 2026-10-23, 16:53 (commit) y 16:54 (push), hora de la máquina. Registrado el 2026-10-24, 05:30.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear en `chore/claude-config` los 16 archivos de la configuración (commit `a0aceac`) y pushear esa rama a `origin`. No se pusheó `main` ni se abrió pull request. |
| 2 | Alternativas y criterio de descarte | Commitear `.claude/launch.json`: descartado, es configuración de cada máquina. Agregar la línea de co-autor de Claude: descartado por la regla de Emily de commits con su nombre. Pushear a `main`: descartado, redespliega Render. |
| 3 | Evidencia que la sostiene | Revisión del diff (695 líneas agregadas) y escaneo sin secretos reales; `git log` y el reflog del remoto confirman el commit y el push. |
| 4 | Aporte personal | Pidió revisar y commitear, y después pushear la rama. Registro: commit `a0aceac` en el repositorio. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): preparó el commit y ejecutó el push a pedido explícito de Emily. |

## Entrada 10: `launch.json` ignorado en `.gitignore`

**Fecha:** 2026-10-24, 05:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Agregar `.claude/launch.json` a `.gitignore`. |
| 2 | Alternativas y criterio de descarte | Versionarlo: descartado, su entrada del frontend supone que `../nexa-frontend` existe y es configuración de la app de Claude de cada máquina. |
| 3 | Evidencia que la sostiene | `git check-ignore -v .claude/launch.json` lo reconoce como ignorado y `git status` dejó de listarlo. |
| 4 | Aporte personal | Decisión de Emily ("hacelo así"). Archivo: `.gitignore`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): edición de `.gitignore`. |

## Entrada 11: conector de Supabase apagado en la sesión

**Fecha:** 2026-10-24, 05:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Apagar el conector de Supabase de la cuenta en esta sesión (no es un cambio en el repositorio). La aplicación lo deja además apagado por defecto en sesiones nuevas. |
| 2 | Alternativas y criterio de descarte | Dejarlo encendido: descartado, sus herramientas (`execute_sql`, `apply_migration`) pueden alcanzar el proyecto de producción y los hooks del proyecto no las cubren. Regla de permisos que bloquee esas herramientas: descartada por ahora, depende de un identificador propio de la cuenta. |
| 3 | Evidencia que la sostiene | `session_connectors_status` lo listaba conectado con 29 herramientas; la respuesta de la aplicación confirmó que queda desactivado en la sesión y por defecto. |
| 4 | Aporte personal | Decisión de Emily ("apagalo en esta sesión"). |
| 5 | Desacuerdo y resolución | Ninguno. Si hace falta usarlo en otro proyecto, se vuelve a encender desde los conectores. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): llamó a la herramienta de conectores con la aprobación de Emily. |

## Entrada 12: borrado de `evolver.config.json`

**Fecha:** 2026-10-24, 05:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Borrar `evolver.config.json` del backend con `git rm` (queda preparado, sin commit) y quitar su mención de `CLAUDE.md`. |
| 2 | Alternativas y criterio de descarte | Dejarlo: descartado, nada lo usa. Borrar también el del frontend: no se hizo, es otro repositorio y no se pidió. |
| 3 | Evidencia que la sostiene | Búsqueda de "evolver" sin distinguir mayúsculas en todo el repo (menos `node_modules`, `dist` y `.git`), en `package.json`, workflows, scripts, configuraciones de TypeScript y Vitest y `.claude/`: no hay ninguna referencia al archivo. Las coincidencias en `src/` y `tests/` son la palabra "devolver". El paquete no está en las dependencias. Solo lo agregó el commit `a1ab21f`, y `05-entregas/` está vacía. Quedó una mención en texto dentro de `00-gestion/20261006_BitacoraIndividual_KohlerAE2_v5.docx` (es documentación, no se editó). Se puede recuperar con `git checkout a1ab21f -- evolver.config.json`. |
| 4 | Aporte personal | Pidió revisar que nada lo llame y borrarlo. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): búsqueda y borrado. |

## Entrada 13: reglas de Context7 y de bitácora en `CLAUDE.md` y en la memoria

**Fecha:** 2026-10-24, 05:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Agregar a `CLAUDE.md` la sección "Forma de trabajar": consultar Context7 siempre que se pueda antes de escribir código que use librerías del stack, y anotar todo cambio en `bitacora3.md`. Guardar ambas reglas como memorias de Claude Code. |
| 2 | Alternativas y criterio de descarte | Dejar las reglas solo en la conversación: descartado, se perderían en la próxima sesión. Obligar a usar Context7 incluso para lógica de negocio: descartado, no sirve para eso. |
| 3 | Evidencia que la sostiene | Pedido de Emily del 2026-10-24. El servidor `context7` del proyecto figura conectado con 2 herramientas (`resolve-library-id` y `query-docs`). Todavía no se usó en una consulta real. |
| 4 | Aporte personal | Las dos reglas son decisión de Emily. Archivos: `CLAUDE.md` y dos memorias en la carpeta de memoria del proyecto. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción de las reglas y de las memorias. |

## Entrada 14: hook de comandos más preciso (`.claude/hooks/guard-bash.mjs`)

**Fecha:** 2026-10-24, 05:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Reescribir el hook de comandos para (a) no bloquear texto que solo cita un comando (heredocs, here-strings de PowerShell, `echo`/`printf`, mensajes de `git commit`) y (b) bloquear desde la terminal la lectura o escritura de `.env`/`.env.*` y la escritura de `package-lock.json`, `dist/`, `src/generated/` y migraciones existentes (`sed -i`, redirecciones, `tee`, `rm`, `mv`, `cp`, `Set-Content`, etc.). El contenido de `bash -c "…"` sigue analizándose. Borrar `dist/` sigue permitido (limpieza de build). |
| 2 | Alternativas y criterio de descarte | Ignorar todo el texto entre comillas: descartado, dejaría pasar `bash -c "git push origin main"`. Reglas `deny` de permisos para `sed -i`: descartadas, no distinguen el archivo. Bloquear también `rm` de `dist/`: descartado, molestaría en el uso normal. |
| 3 | Evidencia que la sostiene | Script de 56 casos con JSON simulado (reglas anteriores, falsos positivos que ahora pasan, evasiones que ahora se bloquean y usos normales): primera corrida 2 fallos (el destino de `echo … > ".env.test"` y `sh -c '… --force'`), corregidos; segunda corrida todo en orden. Los otros tres hooks siguen sin fallos (39 casos). Limitación que sigue: un intérprete (`node -e`, `python -c`) puede escribir archivos sin pasar por estas reglas. |
| 4 | Aporte personal | Pidió resolver los puntos ciegos de los hooks. Archivo: `.claude/hooks/guard-bash.mjs`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): reescritura del hook y pruebas. Revisión de Emily pendiente. |

## Entrada 15: commit de la primera tanda de ajustes

**Fecha:** 2026-10-24, 05:34 (hora del commit `2b34aa7`), registrado el 2026-10-24, 05:40.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear en `chore/claude-config` el hook de comandos reescrito, `.gitignore` (con `launch.json`), `CLAUDE.md`, `bitacora3.md` y el borrado de `evolver.config.json`. No se pusheó. |
| 2 | Alternativas y criterio de descarte | Un commit por cambio: descartado, son ajustes chicos y relacionados. Pushear en el mismo paso: descartado, no se pidió. |
| 3 | Evidencia que la sostiene | `git log` muestra `2b34aa7` con el nombre de Emily y sin co-autor; `git status` quedó limpio salvo el trabajo posterior. |
| 4 | Aporte personal | Pidió "commit y seguir". Registro: commit `2b34aa7`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): armó y ejecutó el commit a pedido de Emily. |

## Entrada 16: Sentry deja de recibir datos sensibles (`src/sentry.ts`)

**Fecha:** 2026-10-24, 05:40 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Agregar `scrubSensitiveData` y llamarla desde `beforeSend`: borra cookies y cuerpo del pedido, filtra las cabeceras `authorization`, `cookie`, `set-cookie`, `x-signature` y similares, reemplaza el query string, recorta la URL sin query y elimina email, nombre de usuario e IP del usuario (se conserva el id). Se agregó `tests/integration/sentry.scrub.test.ts` (5 casos) y se actualizaron `CLAUDE.md` y el subagente `revisor-seguridad-api`. |
| 2 | Alternativas y criterio de descarte | Opciones de configuración propias del SDK (`dataCollection`): descartadas por ahora, dependen de la versión del SDK y la función propia es probable con un test. Desactivar Sentry: descartado, es el aviso de caídas en producción. |
| 3 | Evidencia que la sostiene | Documentación de Sentry (consultada con Context7): la integración de datos del pedido en servidor incluye cookies, cabeceras, query string, cuerpo y URL. El `verify-email` de esta API lleva un token en la query. Los 5 tests pasan y `typecheck:all` no da errores. Límite: no se limpia el texto de los mensajes de error ni de `console.error`. |
| 4 | Aporte personal | Pidió resolver el punto de Sentry como se explicó. Archivos: `src/sentry.ts`, `tests/integration/sentry.scrub.test.ts`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con consulta a Context7 para la documentación de Sentry. Revisión de Emily pendiente. |

## Entrada 17: webhook de Mercado Pago, idempotencia y frescura del `ts`

**Fecha:** 2026-10-24, 05:40 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) **No** rechazar avisos por antigüedad del `ts`. (b) Hacer idempotente la aplicación del pago con escrituras condicionales: `applyPaymentResult` (turno), `applyGroupPaymentResult` (combo) y `applyPaymentResult` (pedido, reclamando el pedido dentro de la transacción antes de descontar stock; un rechazo tardío ya no pisa un pedido pago). (c) Validar que `data.id` sea un texto único en el middleware y el controller. Archivos: `appointment.service.ts`, `order.service.ts`, `payment-signature.middleware.ts`, `payment.controller.ts` y `tests/integration/payments.webhook-idempotency.test.ts` (7 casos). |
| 2 | Alternativas y criterio de descarte | Ventana de 5 minutos sobre el `ts`: descartada, Mercado Pago reintenta cada 15 minutos y de forma cada vez más espaciada hasta recibir 200, y su documentación no dice que el `ts` se renueve; se perderían confirmaciones legítimas. Ventana amplia: no aporta, porque la idempotencia ya neutraliza una repetición. Quedan sin hacer, a decisión de Emily: validar monto y moneda antes de marcar pagado, responder 500 cuando falla el procesamiento para que Mercado Pago reintente, y no loguear el objeto de error completo del SDK. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-seguridad-api` con `archivo:línea`, verificado leyendo el código. El controller no usa el cuerpo y consulta el pago a Mercado Pago, por eso una repetición solo reaplica el estado real. Documentación de Mercado Pago (Context7): respuesta 200 o 201 en 22 segundos, reintentos cada 15 minutos. Los tests reprodujeron el defecto antes del arreglo (5 notificaciones y 5 logs en lugar de 1; stock en −5 en lugar de 7) y pasan después, 3 corridas seguidas. Suite completa: 20 archivos y 148 tests en verde; `typecheck:all` sin errores. |
| 4 | Aporte personal | Pidió resolver el punto del webhook como se explicó. Registro: archivos modificados del repositorio. |
| 5 | Desacuerdo y resolución | El plan inicial era rechazar avisos viejos si Mercado Pago lo permitía sin cortar sus reintentos. La documentación indica que no lo permite con seguridad, así que se resolvió con idempotencia, que es la protección real contra repeticiones. No cambia ninguna ruta ni forma de respuesta: no afecta al frontend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): usó el subagente `revisor-seguridad-api` (solo lectura) para revisar el flujo, Context7 para la documentación de Mercado Pago, y escribió el arreglo y los tests. Revisión de Emily pendiente. |

## Entrada 18: commit de Sentry y webhook

**Fecha:** 2026-10-24, 05:40 (hora del commit `6c2db39`), registrado el 2026-10-24, 14:43.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear en `chore/claude-config` los arreglos de las entradas 16 y 17 (Sentry y webhook idempotente) con sus tests y la actualización de `CLAUDE.md`. No se pusheó. |
| 2 | Alternativas y criterio de descarte | Esperar a terminar la zona horaria para hacer un solo commit: descartado, son cambios independientes y conviene poder revertirlos por separado. |
| 3 | Evidencia que la sostiene | Suite completa en verde antes del commit (20 archivos, 148 tests) y `typecheck:all` sin errores. `git log` confirma `6c2db39` con el nombre de Emily y sin co-autor. |
| 4 | Aporte personal | Pidió "commit y seguir". Registro: commit `6c2db39`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó el commit a pedido de Emily. |

## Entrada 19: `VITE_TENANT_SLUG` y aclaración en `CLAUDE.md`

**Fecha:** 2026-10-24, 14:43 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Documentar en `CLAUDE.md` que el "tenant" del frontend es solo la marca del negocio y que `VITE_TENANT_SLUG` no se usa. No se tocó el frontend. |
| 2 | Alternativas y criterio de descarte | Borrar la variable del frontend: no se hizo, es otro repositorio y no se pidió; sirve de marcador si se arma un día un servicio de configuración. |
| 3 | Evidencia que la sostiene | Lectura de `nexa-frontend`: `tenant.config.ts` arma el objeto `Business` (nombre, logo, colores, textos, servicios, productos) desde archivos fijos en `src/app/data/tenant/`; `TenantContext.tsx` lo aplica como variables CSS (`--tenant-primary`, `--tenant-accent`); `appConfig.tenantSlug` solo se define en `app.config.ts` y aparece en un comentario TODO. Es coherente con el ADR-001 y con el plan de Emily: para otro cliente se clona y se adaptan nombre, logo y colores. |
| 4 | Aporte personal | La idea de un sistema para Loren que se adapta a otro cliente. Archivo: `CLAUDE.md`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): lectura del frontend (solo lectura) y redacción de la aclaración. |

## Entrada 20: ADR-003 reescrito (`04-diseno/adr-003-jwt-auth.md`)

**Fecha:** 2026-10-24, 14:43 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Reescribir el ADR-003 para que describa el código real: JWT en cookies `httpOnly` (acceso 15 min y refresh 7 días con rotación), en lugar de `localStorage` con header `Bearer`. Se agregó una nota de revisión, las alternativas reales, las referencias a archivos y líneas existentes, los tests que hay y los que faltan, y las limitaciones conocidas. Se actualizó la línea de auth en `CLAUDE.md`. |
| 2 | Alternativas y criterio de descarte | Dejar el ADR como estaba y aclarar solo en `CLAUDE.md`: descartado, el ADR forma parte de la entrega y contradecía el código. Cambiar el código para que coincida con el ADR (pasar a `localStorage`): descartado, es menos seguro frente a XSS. Borrar el contenido anterior sin dejar rastro: descartado, la nota de revisión explica qué decía y por qué estaba mal, como en el ADR-002. |
| 3 | Evidencia que la sostiene | `auth.controller.ts` (cookies), `auth.middleware.ts`, `jwt.provider.ts`, `generateTokens.ts`, `auth.service.ts` y `auth.repository.ts` (refresh token guardado y rotado), `env.ts` (secretos de 32 caracteres), `auth.routes.ts` (límites de velocidad), `app.ts` (CORS y `express.urlencoded`), y el historial de git: las cookies existen desde el commit inicial `98c15ea` (2026-08-25), antes de la fecha del ADR. Se corrigieron dos afirmaciones propias al verificar: `guestOnly` no lo usa ninguna ruta, y `change-password` no pide la contraseña actual. |
| 4 | Aporte personal | Pidió rehacer el ADR-003; el ADR original era suyo. Archivo: `04-diseno/adr-003-jwt-auth.md`. |
| 5 | Desacuerdo y resolución | Ninguno. El ADR deja anotados, sin corregirlos en el código, seis riesgos: access token no revocable, refresh token en texto plano, una sola sesión renovable por usuario, posible CSRF por `SameSite=None` con el parser urlencoded activo, cambio de contraseña sin la contraseña actual y login sin email verificado. Quedan a decisión de Emily. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): redacción y verificación contra el código. Revisión de Emily pendiente, por tratarse de un documento de la entrega. |

## Entrada 21: zona horaria de Argentina (ART) en turnos, jobs y tests

**Fecha:** 2026-10-24, 14:54 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear `src/app/utils/argentinaTime.ts` (`todayArgentinaStr`, `appointmentInstant`, `argentinaParts`, `ARGENTINA_TIME_ZONE`) y usarlo en: el job de no-show (`autoNoShow.job.ts`), el corte de 12 horas de cancelación y reembolso (dos lugares de `appointment.service.ts`), el registro de llegada del día (`registerArrival`), la vigencia de promociones de turnos (`isPromoLive`), el "próximo turno" de la ficha de la clienta, las promociones de la tienda, los pedidos y los eventos especiales. Los cuatro cron de `scheduler.ts` pasan a `timezone: 'America/Argentina/Buenos_Aires'`. `vitest.config.mts` fija `TZ=UTC` y `tests/helpers/factories.ts` arma las fechas con el mismo helper. Test nuevo: `tests/integration/timezone-art.test.ts` (9 casos). `CLAUDE.md` documenta la regla. |
| 2 | Alternativas y criterio de descarte | Fijar `TZ=America/Argentina/Buenos_Aires` en Render: descartado, `toAdminView` y `normalizeAdminUpdateInput` dependen de que el proceso esté en UTC y se romperían. Agregar una librería de fechas (luxon, date-fns-tz): descartado, `Intl` alcanza y no hay horario de verano. Cambiar también `inactivityReminder`, `autoPromotions` y los dashboards: postergado, el impacto es bajo (solo cambian de día unas horas antes) y no se pidió ampliar el alcance. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-reservas`, verificado leyendo el código. **Corrección al informe:** el subagente describía el desfase con el signo cambiado; con el servidor en UTC, `new Date('2026-10-24T10:00:00')` es las 07:00 de Argentina, 3 horas **antes** del turno real, de modo que el no-show saltaría a las 07:20 para un turno de las 10:00 (antes de que empiece) y la regla de reembolso calcularía 3 horas de menos. Documentación de node-cron (Context7): `cron.schedule(expresión, función, { timezone })`. Los tests reprodujeron los errores antes del arreglo (6 de 9 fallaban con `TZ=UTC`) y pasan después. Con `TZ=UTC` la suite anterior pasaba entera (148), es decir, no los detectaba. Resultado final: 21 archivos y 157 tests en verde; `typecheck:all` sin errores. |
| 4 | Aporte personal | Pidió resolver la zona horaria como se explicó. Archivos: `src/app/utils/argentinaTime.ts`, `autoNoShow.job.ts`, `scheduler.ts`, `appointment.service.ts`, `order.service.ts`, `promotion.model.ts`, `specialEvent.model.ts`, `vitest.config.mts`, `tests/helpers/factories.ts`, `tests/integration/timezone-art.test.ts`. |
| 5 | Desacuerdo y resolución | Ninguno con Emily. Con el subagente: su informe tenía el signo del desfase invertido; se resolvió verificando con una ejecución (`TZ=UTC node -e …`). **Pendiente de verificar por Emily:** la zona real del servidor de Render. Si corre en UTC, el no-show automático de producción venía marcando turnos antes de su hora. Cómo comprobarlo: Render, Shell del servicio, `node -e "console.log(new Date().toString())"`; o en el panel de actividad buscar "Turno marcado como no show (automático)" y comparar con la hora del turno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): usó el subagente `revisor-reservas` (solo lectura), Context7 para node-cron, y escribió el arreglo y los tests. Revisión de Emily pendiente. Al desplegar cambia el comportamiento en producción: conviene revisar después los turnos marcados como no-show. |

## Entrada 22: commits de la zona horaria y de la documentación

**Fecha:** 2026-10-24, 14:55 (commit `4398d15`), registrado el 2026-10-24, 14:55. El segundo commit (documentación) se hizo inmediatamente después, con este mismo registro.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Dos commits en `chore/claude-config`: (1) `4398d15`, código y tests de la hora de Argentina (entrada 21); (2) documentación: ADR-003 reescrito (entrada 20), `CLAUDE.md` (entradas 19 y 21) y `bitacora3.md` (entradas 18 a 22). No se pusheó. |
| 2 | Alternativas y criterio de descarte | Un solo commit: descartado, el código se puede revertir sin perder la documentación y el ADR es un documento de la entrega con su propio historial. |
| 3 | Evidencia que la sostiene | Suite completa antes del commit: 21 archivos y 157 tests en verde; `typecheck:all` sin errores. `git log` muestra el nombre de Emily y ningún co-autor. |
| 4 | Aporte personal | Pidió "sí, commit". Registro: commit `4398d15` y el commit de documentación siguiente. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): preparó y ejecutó los commits a pedido de Emily. |

## Entrada 23: push de la rama y pull request #1

**Fecha:** 2026-10-24, 15:35 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Pushear `chore/claude-config` a `origin` (de `a0aceac` a `7e62d5c`) y abrir el pull request #1 contra `main`: https://github.com/emilykohler12/nexa-backend/pull/1. No se mergeó ni se activó el merge automático. |
| 2 | Alternativas y criterio de descarte | Mergear directo a `main`: descartado, un merge redespliega el backend en Render y conviene que el CI corra antes. Dividir en varios pull requests (configuración, Sentry y webhook, zona horaria): descartado por ahora, los commits están separados y se pueden revisar uno a uno. |
| 3 | Evidencia que la sostiene | La salida de `git push` y de `gh pr create`; la aplicación reporta el PR abierto, sin conflictos y con el seguimiento de CI activo. La descripción del PR detalla qué cambia en producción (no-show, reembolso, horarios de los mails) y que no hay migraciones ni cambios de rutas. Se agregó al final la línea "Generated with Claude Code" por la declaración de uso de IA del proyecto; se puede quitar editando la descripción. |
| 4 | Aporte personal | Pidió "push y abrir PR". Registro: pull request #1. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó el push y creó el PR con `gh` a pedido de Emily. La aplicación activó Auto-fix: ante fallos del CI o conflictos corrige, verifica, commitea y pushea en esta rama; ante comentarios de revisión no actúa sin que Emily lo confirme. |

## Entrada 24: checksum de migraciones verificado y script `migration-checksums.mjs`

**Fecha:** 2026-10-24, 15:43 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Verificar el cálculo del checksum de `_prisma_migrations` y crear `scripts/migration-checksums.mjs`, que no se conecta a ninguna base y solo imprime SQL: sin argumentos, un SELECT de solo lectura que compara la tabla con las 51 migraciones del repo (OK, FALTA APLICAR, CHECKSUM DISTINTO, INCOMPLETA, SOLO EN LA BASE); con `insert <nombre>`, el INSERT para registrar una migración aplicada a mano. Se actualizó la skill `nueva-migracion` con ese procedimiento. |
| 2 | Alternativas y criterio de descarte | Calcular el hash con un `node -e` suelto (como decía la skill): descartado, es fácil equivocarse y no verifica nada. `prisma migrate resolve --applied`: queda como alternativa oficial, pero según las notas de Emily la conexión desde su PC al pooler de Supabase da P1001. Conectarse a Supabase desde esta sesión: descartado por la regla del proyecto (no tocar producción) y porque el conector de Supabase está apagado. |
| 3 | Evidencia que la sostiene | Consulta a la base de pruebas con el código de la app: los 51 checksums guardados por Prisma coinciden con el SHA-256 de los bytes de cada `migration.sql`, tanto del archivo local como del de git (51 de 51). El SELECT generado devolvió `OK: 51`. El INSERT generado, probado dentro de una transacción deshecha, reprodujo el mismo checksum, `finished_at` y `applied_steps_count = 1` que escribió Prisma, y la tabla quedó con 51 filas. Documentación de Prisma (Context7): `migrate deploy` solo avisa cuando una migración ya aplicada fue modificada; `migrate resolve --applied` registra una migración como aplicada. |
| 4 | Aporte personal | Pidió resolver el punto del checksum. La notas previas de Emily ("checksum = sha256 del migration.sql tal como está en git") quedaron confirmadas. Archivos: `scripts/migration-checksums.mjs`, `.claude/skills/nueva-migracion/SKILL.md`. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily:** correr el SELECT en el SQL Editor de Supabase para confirmar el estado real de producción; este registro solo verifica la base de pruebas. `00-gestion/SOP.md` indica `migrate deploy` con la cadena de Supabase, lo que no coincide con lo que se pudo hacer desde su PC; no se editó. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): consulta de solo lectura a la base de pruebas, escritura del script y de la skill, y consulta a Context7. Revisión de Emily pendiente. |

## Entrada 25: commit y push del script de migraciones

**Fecha:** 2026-10-24, 15:43 (commit `13177c6`), registrado el 2026-10-24, 15:43.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear y pushear a `chore/claude-config` el script `migration-checksums.mjs`, la skill `nueva-migracion` actualizada y la entrada 24. El push actualiza el pull request #1. |
| 2 | Alternativas y criterio de descarte | Esperar a juntar más cambios en un solo commit: descartado, es una herramienta independiente que Emily necesita ya para verificar Supabase. |
| 3 | Evidencia que la sostiene | `git log` muestra `13177c6` con el nombre de Emily y sin co-autor. El pull request #1 figura sin conflictos, con 1 chequeo del CI en verde y ninguno fallando al momento del push. |
| 4 | Aporte personal | Pidió "commit y push". Registro: commit `13177c6`. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó el commit y el push a pedido de Emily. |

## Entrada 26: seguridad del login, primera tanda (CSRF, cierre de sesión y refresh token)

**Fecha:** 2026-10-24, 16:09 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Quitar `express.urlencoded` y agregar `src/app/middlewares/trustedOrigin.ts`, que rechaza con `403 FORBIDDEN_ORIGIN` los pedidos que cambian datos y traen un `Origin` distinto de `FRONTEND_URL`. (b) `POST /api/auth/logout` deja de exigir `authenticate`: identifica a la usuaria por la firma del access token aunque esté vencido (`verifyAccessEvenIfExpired`) y siempre limpia las cookies. (c) El refresh token se guarda como SHA-256, con una transición de 7 días que acepta el formato viejo. (d) Los tokens llevan `jwtid` (jti). Test nuevo: `tests/integration/auth.security.test.ts` (16 casos). Se actualizaron el ADR-003 y `CLAUDE.md`. |
| 2 | Alternativas y criterio de descarte | Token anti-CSRF por pedido: descartado, exige cambios en el frontend y el chequeo de `Origin` cubre el vector con una pieza chica. Exigir `Content-Type: application/json` en todos los POST: descartado, rompería los POST sin cuerpo del frontend (logout, refresh, pagos). Cambiar `SameSite` a `Lax`: descartado, con frontend y backend en dominios distintos el navegador no mandaría la sesión. Migrar ya todos los refresh tokens a hash borrando los viejos: descartado, desloguearía a todas; se prefirió la transición. Tabla de sesiones (varios dispositivos): descartada por ahora, es un cambio de diseño mayor. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-seguridad-api` (verificado por mí leyendo el código). Los tests reprodujeron los ataques antes del arreglo (12 de 16 fallaban): un formulario de otro sitio cambiaba la contraseña de una clienta (respuesta 200) y creaba una invitación de profesional desde una cuenta admin (201); `logout` con el access token vencido respondía 401 sin cerrar la sesión; el refresh token se guardaba tal cual; y dos tokens emitidos en el mismo segundo salían idénticos. Documentación (Context7): `req.body` queda `undefined` sin parser que coincida; `jwt.sign` admite `jwtid` y `jwt.verify` admite `ignoreExpiration`. Después del arreglo: 16 de 16, tres corridas seguidas; suite completa de 22 archivos y 173 tests en verde; `typecheck:all` sin errores. |
| 4 | Aporte personal | Aprobó la primera tanda ("OK") y fijó que el frontend no se toque sin su permiso. Archivos: `app.ts`, `trustedOrigin.ts`, `jwt.provider.ts`, `auth.repository.ts`, `auth.controller.ts`, `auth.routes.ts`, `auth.security.test.ts`, ADR-003, `CLAUDE.md`. |
| 5 | Desacuerdo y resolución | Ninguno. **Efectos al desplegar:** las sesiones abiertas siguen funcionando (transición); no hay migraciones ni cambios de rutas ni de formato de respuesta. **Verificar en producción:** que `FRONTEND_URL` en Render sea exactamente el origen que usan las usuarias (CORS ya lo exigía, pero ahora una diferencia también bloquearía los POST con 403). El pedido de pago y el webhook de Mercado Pago no traen `Origin` y pasan. **Pendiente (segunda tanda, con cambios en el frontend):** contraseña actual en `change-password` y email en `reset-password`. Después del 2026-10-31 quitar la aceptación del refresh token en texto plano. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): usó el subagente `revisor-seguridad-api` (solo lectura), Context7 para Express y jsonwebtoken, y escribió el arreglo y los tests. Revisión de Emily pendiente. |

## Entrada 27: commit y push de la primera tanda de seguridad del login

**Fecha:** 2026-10-24, 16:09 (hora de la máquina). El hash del commit figura en `git log` con el mensaje "Seguridad del login: CSRF, cierre de sesión y refresh token".

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear y pushear a `chore/claude-config` los cambios de la entrada 26 junto con las entradas 25 a 27 de la bitácora. El push actualiza el pull request #1. |
| 2 | Alternativas y criterio de descarte | Abrir un pull request aparte para la seguridad del login: descartado por ahora, Emily pidió seguir en el PR #1 y el commit queda separado para poder revertirlo. |
| 3 | Evidencia que la sostiene | Suite completa en verde antes del commit (22 archivos, 173 tests) y `typecheck:all` sin errores. |
| 4 | Aporte personal | Pidió "commit y push". |
| 5 | Desacuerdo y resolución | Ninguno. Antes de mergear a `main`: verificar `FRONTEND_URL` en Render (ver entrada 26). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó el commit y el push a pedido de Emily. |

## Entrada 28: el pull request #1 fue mergeado a `main`

**Fecha:** 2026-10-24, 16:03 (hora del merge, commit `81f06eb`), registrado el 2026-10-24, 16:10.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Emily mergeó el pull request #1 a `main` (la app lo informa como mergeado por `emilykohler12`). Entraron los commits hasta `13177c6`: configuración de Claude Code, Sentry sin datos sensibles, webhook idempotente, hora de Argentina, ADR-003 reescrito y el script de migraciones. El commit `c4b9fcc` (seguridad del login), pusheado a las 16:09, **quedó fuera** y está solo en `chore/claude-config`. |
| 2 | Alternativas y criterio de descarte | Esperar al commit de seguridad antes de mergear: Emily decidió mergear antes. Reabrir el PR #1: no es posible una vez mergeado; el commit pendiente necesita un pull request nuevo. |
| 3 | Evidencia que la sostiene | `gh pr view 1`: estado MERGED, mergeado a las 19:03 UTC (16:03 ART) por `emilykohler12`; `git log origin/main..HEAD` lista únicamente `c4b9fcc`. |
| 4 | Aporte personal | Decisión y ejecución del merge: Emily. Registro: commit de merge `81f06eb`. |
| 5 | Desacuerdo y resolución | Ninguno. **Consecuencia:** el merge redespliega el backend en Render con los cambios de hora de Argentina, Sentry y webhook. Quedan por verificar en producción: la zona horaria real del servidor, que el no-show y los mails de las 9:00 sigan comportándose bien, y el estado de las migraciones con el SELECT de `migration-checksums.mjs`. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): detectó el merge al consultar el estado del PR y lo registró. No intervino en el merge. |

## Entrada 29: pull request #2 (seguridad del login)

**Fecha:** 2026-10-24, 16:11 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Abrir el pull request #2 contra `main`, desde `chore/claude-config`: https://github.com/emilykohler12/nexa-backend/pull/2. Contiene `c4b9fcc` (seguridad del login) y `4a572e6` (bitácora, entrada 28), más este registro. No se mergeó. |
| 2 | Alternativas y criterio de descarte | Reutilizar el PR #1: imposible, ya estaba mergeado. Crear una rama nueva desde `main`: innecesario, `main` ya contiene todo lo anterior y la rama solo suma estos commits. |
| 3 | Evidencia que la sostiene | `gh pr create` devolvió la URL; `git log origin/main..HEAD` listaba solo `c4b9fcc` y `4a572e6`; la aplicación reporta el PR abierto con el seguimiento de CI y Auto-fix activos. La descripción detalla qué corrige, qué cambia, el control de `FRONTEND_URL` antes de mergear, los 16 tests nuevos y lo pendiente. |
| 4 | Aporte personal | Pidió abrir el PR nuevo. Registro: pull request #2. |
| 5 | Desacuerdo y resolución | Ninguno. El merge queda a decisión de Emily, después de verificar `FRONTEND_URL` en Render; al mergear se redespliega el backend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): creó el PR con `gh` a pedido de Emily. Auto-fix corrige y pushea ante fallos del CI o conflictos; ante comentarios de revisión no actúa sin confirmación. |

## Entrada 30: seguridad del login, segunda tanda (contraseña actual y código de recuperación)

**Fecha:** 2026-10-24, 16:26 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Backend:** (a) `POST /api/auth/change-password` exige `{ currentPassword, password }`; si la actual es incorrecta responde `400 INVALID_CURRENT_PASSWORD` y la ruta suma el límite de 10 intentos por IP. (b) `POST /api/auth/reset-password` exige `{ email, token, password }`, busca el código de esa cuenta y responde igual (`400 INVALID_TOKEN`) si el email no existe o el código no es suyo; limita a 5 intentos fallidos cada 15 minutos por email (`429 TOO_MANY_ATTEMPTS`); consume el código con una escritura condicional; y reintenta con otro código si coincide con el de otra usuaria (antes daba un 500). **Frontend** (repositorio `nexa-frontend`, rama nueva `feat/seguridad-login-contrasenas`, sin commitear): el formulario de recuperación manda el email; los formularios de cambio de contraseña del admin (`SecuritySection.tsx`) y de la profesional (`Settings.tsx`) piden y mandan la contraseña actual; `authApi.resetPassword` recibe el email. Tests nuevos: `auth.password.test.ts` (16, backend), `ForgotPasswordModal.test.tsx` (6) y `SecuritySection.test.tsx` (5, frontend). Se actualizaron el ADR-003 y `CLAUDE.md`. |
| 2 | Alternativas y criterio de descarte | Columna de intentos en `password_resets`: descartada, exige migración y el límite por email resuelve lo mismo sin tocar la base. Límite por IP solamente: descartado, rotando IPs se puede adivinar un código de 6 dígitos. Responder 401 ante la contraseña actual incorrecta: descartado, el cliente HTTP del frontend (`api.ts`) redirige a `/login` ante cualquier 401. Guardar el código de recuperación como hash: postergado, el código dura 15 minutos y los controles anteriores ya cierran la adivinación. Cambiar el nombre del campo `password` por `newPassword`: descartado, mantenerlo permite desplegar el frontend antes que el backend. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-seguridad-api` (verificado por mí). Los tests del backend reprodujeron los fallos antes del arreglo (8 de 16 fallaban: `change-password` sin la actual cambiaba la clave; `reset-password` aceptaba el pedido sin email y con el código de otra cuenta; dos pedidos simultáneos con el mismo código daban `[200, 200]`; la colisión de códigos daba 500) y pasan después, 3 corridas seguidas. Documentación de express-rate-limit (Context7): `skipSuccessfulRequests` no cuenta las respuestas menores a 400 y `ipKeyGenerator` evita el error de IPv6 al usar la IP como respaldo. Resultados: backend 23 archivos y 189 tests en verde con `typecheck:all` sin errores; frontend con la rama nueva: 13 archivos y 50 tests en verde, `typecheck:all` sin errores, build correcto, y los 7 de los 11 tests nuevos fallan contra el código viejo. El lint del frontend queda en 121 problemas, igual que `main` (los 4 errores que sumaron los tests nuevos se corrigieron). |
| 4 | Aporte personal | Pidió la segunda tanda y confirmó seguir con `nexa-frontend`. Archivos del backend: `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.routes.ts`, `resetPassword.dto.ts`, tests y documentación. Archivos del frontend: los cuatro indicados arriba y dos tests nuevos. |
| 5 | Desacuerdo y resolución | Ninguno. **Orden de despliegue obligatorio:** primero el frontend (manda los campos nuevos y el backend actual los ignora) y recién después el backend. Como el pull request #2 ya incluye la primera tanda, mergear el #2 despliega también esta tanda: hay que mergear y desplegar antes el PR del frontend. Hasta recargar la página, una pestaña con el frontend viejo verá errores al cambiar o recuperar la contraseña. Para un cambio de contraseña sin sesión, ahora el email es obligatorio. Pendiente: probar a mano ambos formularios en un entorno real. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): usó el subagente `revisor-seguridad-api` (solo lectura), Context7 para express-rate-limit, y escribió el arreglo y los tests en los dos repositorios. Se creó una rama en `nexa-frontend`; no se hizo ningún commit ni push allí. Revisión de Emily pendiente. |

## Entrada 31: commits y pull requests de la segunda tanda de seguridad del login

**Fecha:** 2026-10-24, 16:28 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) En `nexa-frontend`: commit `dffa1b6` en la rama `feat/seguridad-login-contrasenas`, push y pull request #1 contra `main`: https://github.com/emilykohler12/nexa-frontend/pull/1. (b) En `nexa-backend`: commit de la segunda tanda sobre `chore/claude-config` (hash en `git log`, mensaje "Seguridad del login, segunda tanda…") y push, que actualiza el pull request #2. (c) Se agregó a la descripción del pull request #2 un aviso del orden de despliegue (primero el frontend). No se mergeó nada. |
| 2 | Alternativas y criterio de descarte | Una rama y un PR aparte en el backend, apoyado sobre el #2: descartado por ahora para no multiplicar pull requests; el aviso en el #2 deja explícito el orden. Mergear el PR del frontend de inmediato: decisión de Emily, después de probar los formularios. |
| 3 | Evidencia que la sostiene | Las salidas de `git push` y `gh pr create`; `git log` con el nombre de Emily y sin co-autor; la descripción de cada PR detalla los cambios, las pruebas y el orden de despliegue. Antes del commit: backend 23 archivos y 189 tests en verde; frontend 13 archivos y 50 tests en verde, build correcto y lint igual que `main`. |
| 4 | Aporte personal | Pidió "commit y abrir PR". Registro: `dffa1b6` (frontend), pull request #1 del frontend y actualización del #2 del backend. |
| 5 | Desacuerdo y resolución | Ninguno. **Recordatorio:** orden de despliegue = (1) mergear y desplegar nexa-frontend#1, (2) probar los dos formularios y la recuperación con un código real, (3) mergear nexa-backend#2 con `FRONTEND_URL` verificado en Render. Después del 2026-10-31 quitar la aceptación del refresh token en texto plano. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó los commits, los push y la creación y edición de los pull requests con `gh` a pedido de Emily. Auto-fix queda activo solo para el pull request del backend. |

## Entrada 32: webhook de Mercado Pago, monto y moneda, respuesta 500 y logs

**Fecha:** 2026-10-24, 16:44 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Nuevo `payments/paidAmount.ts`: antes de marcar una seña, una seña de combo (suma de las patas) o un pedido como pagos, se compara el monto y la moneda que informa Mercado Pago con lo esperado; se acepta el monto esperado o uno mayor, en pesos; si no coincide o no se informa, no se registra y queda una entrada de error en la actividad ("Pago con monto distinto al esperado"). Solo se valida lo aprobado y lo que trae datos de Mercado Pago (la seña confirmada a mano por WhatsApp no). (b) `findPaymentByReference` devuelve monto y moneda, y la verificación a demanda (polling) los usa igual que el webhook. (c) El controller del webhook responde 200 **después** de procesar y 500 si falló algo transitorio, para que Mercado Pago reintente; envía el error a Sentry y ya no vuelca el error completo del SDK en los logs. Test nuevo: `payments.webhook-amount.test.ts` (19). |
| 2 | Alternativas y criterio de descarte | Rechazar también un monto mayor: descartado, si el monto esperado cambió entre el checkout y el pago, cobrar de más no deja a la clienta sin seña. Seguir respondiendo 200 antes de procesar: descartado, un fallo transitorio perdía la confirmación hasta que la clienta consultara. Responder 500 ante un monto distinto: descartado, reintentar no cambia el resultado y Mercado Pago seguiría reintentando. Cobrar la diferencia o reembolsar automáticamente: fuera de alcance, queda para revisión manual. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-seguridad-api` (puntos 3 y 5 y defecto B). Documentación de Mercado Pago (Context7): se espera 200 o 201 en 22 segundos y se reintenta cada 15 minutos hasta recibirlo. Los tests reprodujeron los fallos antes del arreglo (10 de 19: un pago por 1000 se registraba como seña de 5000, un pedido de 3000 quedaba pago con 1000, no había respuesta 500 y el log traía el error completo) y pasan después. |
| 4 | Aporte personal | Pidió terminar lo pendiente. Archivos: `paidAmount.ts`, `payment.controller.ts`, `payment.service.ts`, `appointment.service.ts`, `order.service.ts`, el test. |
| 5 | Desacuerdo y resolución | Ninguno. **Riesgo a conocer:** si un pago se cobra por un monto distinto, el dinero entra a Mercado Pago pero la seña no se registra; hay que mirar en la actividad las entradas con nivel de error. La tolerancia es de medio centavo. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): implementación y tests. Revisión de Emily pendiente. |

## Entrada 33: hora de Argentina en jobs de recordatorio y dashboards

**Fecha:** 2026-10-24, 16:44 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Completar la migración al helper de hora argentina: `inactivityReminder` (corte de 60 días desde la fecha de Argentina), `autoPromotions` (cumpleaños y año de la campaña) y los tres servicios de dashboard y estadísticas (`argentinaWallClock()` para los rangos de calendario; los límites contra `createdAt` ahora son instantes reales de Argentina). Se quitaron `pad`, `toDateStr` y `addDays` que quedaron sin uso. Tests: 7 casos nuevos en `timezone-art.test.ts` (ahora 16). |
| 2 | Alternativas y criterio de descarte | Convertir cada getter local de los dashboards uno por uno: descartado por riesgo; un único "reloj de pared de Argentina" como punto de partida da los mismos rangos sin tocar el cálculo. Tocar `availability.ts`, vacaciones y fechas de nacimiento: no, ya trabajan en UTC puro y son correctos en cualquier zona. |
| 3 | Evidencia que la sostiene | Informe del subagente `revisor-reservas` (puntos de impacto bajo) verificado leyendo el código. Los 6 tests nuevos de comportamiento fallaban antes (a las 22:30 de Argentina, que en UTC ya es el día siguiente: el dashboard no contaba el turno de "hoy", el aviso de cumpleaños salía un día antes y el recordatorio de inactividad cortaba un día antes) y pasan después. Efecto lateral corregido: los tests viejos de dashboard armaban "hoy" en hora de Argentina y el servicio en UTC, por lo que habrían fallado de 21:00 a 24:00. |
| 4 | Aporte personal | Pidió terminar lo pendiente de la hora de Argentina. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 34: menores del login, uso del subagente `escritor-tests` y logs sin emails

**Fecha:** 2026-10-24, 16:44 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Emails con `trim().toLowerCase()` en el alta del admin y en el turno manual, con búsqueda sin distinguir mayúsculas. (b) `toggleRole` solo alterna profesional y administradora (`400 INVALID_ROLE_CHANGE`). (c) Invitaciones: `409 ADMIN_ACCOUNT`, `409 ACCOUNT_INACTIVE` (antes 500), consumo atómico (`consume`) y las mismas dos cookies que el login sin `accessToken` en el cuerpo (nuevo `auth/utils/cookies.ts`). (d) Un refresh fallido limpia las cookies. (e) El login con un email inexistente ejecuta igual el bcrypt y `forgot-password` no espera el mail. (f) Validación con zod del perfil de la clienta (nombre hasta 100, teléfono hasta 20). (g) Nuevo `maskEmail` en los logs de mail, invitaciones y jobs. Tests: `auth.minor-fixes.test.ts` (33, escrito por el subagente) y `mask-email.test.ts` (3). |
| 2 | Alternativas y criterio de descarte | Exigir email verificado para iniciar sesión: **no se tocó**, es una decisión de producto de Emily (la bandera `emailVerified` hoy solo se escribe). Tabla de sesiones para varios dispositivos: postergada, cambio de diseño mayor. Hacer `forgot-password` totalmente asíncrono: descartado, los tests y el flujo necesitan que el código ya esté guardado al responder; solo el envío del mail dejó de esperarse. Registrar siempre 201 para ocultar `EMAIL_TAKEN`: descartado por usabilidad. |
| 3 | Evidencia que la sostiene | Uso del subagente: se le dio una especificación del comportamiento esperado (sin tocar `src/`) y escribió los tests primero. Verificó rutas y cuerpos reales y reportó 8 discrepancias con la descripción (por ejemplo, que un email repetido con otras mayúsculas hoy crea otra cuenta y que `findByEmail` filtra `active` y por eso el 500). Resultado inicial: 13 pasaban (comportamiento que se conserva) y 20 fallaban (lo nuevo). Tras la implementación pasan los 33. El frontend no usa el `accessToken` de la respuesta de invitaciones (búsqueda en `nexa-frontend`). Verificado: el `toggleRole` ya impedía cambiar el propio rol; el informe del revisor se equivocaba en ese punto. |
| 4 | Aporte personal | Pidió usar los agentes y terminar lo pendiente. |
| 5 | Desacuerdo y resolución | Ninguno. Contrato: `POST /api/invitations/register` ya no devuelve `accessToken`; `PATCH /api/client/profile` responde 400 si los valores no son válidos; las rutas de admin pueden responder los códigos nuevos (el frontend muestra el mensaje). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con el subagente `escritor-tests` (escribe y corre tests; no modifica `src/`). Revisión de Emily pendiente. |

## Entrada 35: commit, push y pull request #3 (pendientes del backend)

**Fecha:** 2026-10-24, 16:55 (commit `91d0996`), registrado el 2026-10-24, 16:55.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear en la rama nueva `fix/pendientes-webhook-hora-login` los cambios de las entradas 32 a 34, pushearla y abrir el pull request #3: https://github.com/emilykohler12/nexa-backend/pull/3. Su **base es `chore/claude-config`** (el PR #2, aún abierto), no `main`. No se mergeó nada. |
| 2 | Alternativas y criterio de descarte | Base `main`: descartado, mostraría también todos los commits del PR #2 y mezclaría las dos revisiones. Agregar los cambios al PR #2: descartado, ya lleva dos tandas de seguridad con orden de despliegue propio. Esperar a que se mergee el #2: no hace falta, GitHub reorienta el #3 a `main` cuando se mergee el #2. |
| 3 | Evidencia que la sostiene | `git log` con el nombre de Emily y sin co-autor; `gh pr view 2` informaba el #2 como abierto al crear el #3; antes del commit, suite de 26 archivos y 251 tests en verde y `typecheck:all` sin errores. |
| 4 | Aporte personal | Pidió "commit, push y PR". Registro: commit `91d0996` y pull request #3. |
| 5 | Desacuerdo y resolución | Ninguno. **Orden para publicar:** (1) nexa-frontend#1, (2) nexa-backend#2, (3) nexa-backend#3. Este último no cambia rutas ni exige cambios en el frontend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): ejecutó el commit, el push y la creación del PR con `gh` a pedido de Emily. |

## Entrada 36: corrección de la fecha de transición del refresh token

**Fecha:** 2026-10-24, 17:05 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Reemplazar "después del 2026-10-31" por "7 días desde el despliegue en producción" en `CLAUDE.md`, el ADR-003 y las descripciones de los PR #2 y #3 (editadas con `gh pr edit`). |
| 2 | Alternativas y criterio de descarte | Dejar la fecha fija: descartado, el plazo de 7 días (vida del refresh token) empieza cuando el PR #2 se despliega, y todavía no está mergeado. |
| 3 | Evidencia que la sostiene | El refresh token dura 7 días (`JWT_REFRESH_EXPIRES_IN`); el formato viejo solo existe en sesiones emitidas antes del despliegue. Búsqueda del texto en el repo y en ambos PR. Las entradas 26 a 31 conservan la fecha anterior como historial. |
| 4 | Aporte personal | Emily pidió que se le explicara ese punto; al explicarlo apareció el error. |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). |

## Entrada 37: revisión de seguridad general, dependencias, subida de imágenes y límite de login por cuenta

**Fecha:** 2026-10-27, 00:50 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) `npm audit fix` (sin cambios mayores): multer 2.5.0, zod 4.6.7, body-parser e ip-address. (b) Subida de imágenes: se comprueba la firma real del archivo (PNG, JPEG, WEBP) y no solo el tipo que declara el cliente (`400 INVALID_IMAGE_CONTENT`); el SVG queda solo para el admin (`403` para el resto) y se rechaza el que trae script, manejadores de eventos, `javascript:`, `foreignObject`, DOCTYPE o entidades. (c) Nuevo límite de 10 intentos de login fallidos cada 15 minutos por email (`429 TOO_MANY_ATTEMPTS`), además del límite por IP, con aviso en el log con el email enmascarado. Tests: `hardening.test.ts` (10 casos). |
| 2 | Alternativas y criterio de descarte | Quitar el SVG por completo: descartado, la pantalla de logo del admin lo ofrece (cambiaría el contrato con el frontend). Sanitizar el SVG con una librería: descartado por ahora, el admin es de confianza y la lista de rechazo es una segunda capa. Actualizar nodemailer a 10.x: **no se hizo**, es un salto de versión mayor y no se puede probar un envío real desde los tests (el mail está simulado). Actualizar prisma a 7: descartado, migración mayor del ORM que queda para otra tanda; las advertencias restantes son de su CLI. Bloquear la cuenta en la base tras N fallos: descartado, permite dejar afuera al admin de forma permanente; el límite temporal en memoria es menos riesgoso. |
| 3 | Evidencia que la sostiene | Auditoría de rutas: todas las rutas de admin, ajustes, inventario y servicios exigen `requireRole('admin')`; webhook con firma HMAC y comparación en tiempo constante; sin `$queryRaw` con datos del request (solo `SELECT 1` y un bloqueo con parámetros). `.env` y `.env.test` nunca estuvieron en el historial de git. `npm audit`: quedan 4 avisos altos (nodemailer y la cadena de prisma). `typecheck:all` sin errores y suite de 27 archivos y 261 tests en verde. |
| 4 | Aporte personal | Pidió una revisión de seguridad completa de la API. |
| 5 | Desacuerdo y resolución | Ninguno. Contrato: `POST /api/uploads/image` puede responder `400 INVALID_IMAGE_CONTENT` y `403` (SVG de no admin); `POST /api/auth/login` puede responder `429` con `code: TOO_MANY_ATTEMPTS`. El frontend ya envía solo PNG/JPG/WEBP salvo el logo del admin. Límite conocido: quien falle 10 veces con el email de otra persona la deja 15 minutos sin entrar; los contadores viven en memoria y se reinician con cada despliegue. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 38: sesiones por dispositivo (varios dispositivos a la vez)

**Fecha:** 2026-10-27, 01:00 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Reemplazar el token de renovación único por usuaria (`users.refresh_token`) por **una sesión por dispositivo**: tabla nueva `refresh_sessions` (migración `20261027120000_add_refresh_sessions`, solo agrega una tabla), con el id de la sesión (`sid`) dentro de los dos JWT y el SHA-256 del refresh token. Iniciar sesión en otro dispositivo ya no cierra los demás; `logout` cierra solo el dispositivo; cambiar o recuperar la contraseña, desactivar la cuenta y anonimizar a una clienta cierran todos. Máximo 10 dispositivos por usuaria (al abrir el undécimo se cierra el más antiguo). La rotación del refresh token es condicional (control optimista) y el token recién reemplazado se acepta 30 segundos, solo para renovar el access token, para que dos pestañas no se desloguen entre sí. Las sesiones del formato anterior se canjean una sola vez por una sesión nueva. Código: `auth.service.ts` (`startSession`, `refresh`, `logout`), `auth.repository.ts`, `jwt.provider.ts`, `generateTokens.ts`, `hashToken.ts`, `cookies.ts`, `invitation.service.ts`, `admin.service.ts`, `professional.service.ts`. Test nuevo: `auth.sessions.test.ts` (15); se actualizaron `auth.security.test.ts` y `auth.minor-fixes.test.ts` a la semántica nueva. |
| 2 | Alternativas y criterio de descarte | Cambiar el `path` de la cookie de refresh para que llegue a `/logout`: descartado, dejaría dos cookies con el mismo nombre durante la transición; el `sid` en el access token ya identifica el dispositivo aunque haya vencido. Rechazar y cerrar la sesión ante un token ya usado (detección de robo): descartado, dos pestañas legítimas que renuevan a la vez quedarían deslogueadas. Sin tope de dispositivos: descartado, la tabla crecería sin control. Un `logout` de todos los dispositivos como ruta aparte: postergado, el frontend no tiene dónde mostrarlo. Quitar ya `users.refresh_token`: descartado, desloguearía a todas las sesiones abiertas. |
| 3 | Evidencia que la sostiene | Los 15 tests nuevos se escribieron antes que el código: contra el código anterior fallan 9 (los otros 6 son comportamientos que se conservan) y con el nuevo pasan los 15. Suite completa: 28 archivos y 276 tests en verde; `typecheck:all` sin errores. El SQL de la migración se generó con `prisma migrate diff` entre el esquema anterior y el nuevo, se aplicó a la base de pruebas con `npm run test:migrate` y no modifica nada existente. |
| 4 | Aporte personal | Emily pidió poder ingresar desde varios dispositivos al mismo tiempo (límite de diseño anotado en el ADR-003). |
| 5 | Desacuerdo y resolución | Ninguno. **Antes de mergear: aplicar la migración en Supabase** (el código nuevo consulta la tabla `refresh_sessions`; sin ella, iniciar sesión da error). Pasos en la descripción del pull request. Durante los 7 días siguientes al despliegue las sesiones antiguas se siguen aceptando una vez; después se puede quitar `users.refresh_token`. **Nota:** mientras se hizo este cambio otra sesión trabajaba en el mismo directorio (entrada 37: límite de login por cuenta, SVG en `uploads/`, dependencias); no se tocaron sus archivos y este commit incluye solo los míos. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 39: configuración de Claude Code en el frontend y pull request nexa-frontend#2

**Fecha:** 2026-10-27, 01:00 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Configurar Claude Code en `nexa-frontend` (commit `ad3abcf`, rama `chore/claude-config`, pull request https://github.com/emilykohler12/nexa-frontend/pull/2, base `main`, sin mergear): `CLAUDE.md`; cuatro hooks en Node (protegen `.env*`, `package-lock.json` y `dist/`; piden confirmación ante posibles secretos; bloquean `git push --force` y el push a `main`; corren eslint sobre los `.ts/.tsx` editados); subagentes `revisor-ui`, `revisor-reserva` (solo lectura) y `escritor-tests`; skills `nueva-pagina`, `nuevo-feature` y `consumir-endpoint`; `.mcp.json` con Context7 fijado en `@upstash/context7-mcp@4.3.0`; `.claude/settings.local.json` en `.gitignore`. No se tocó `src/`, `package.json` ni `00-gestion/`. |
| 2 | Alternativas y criterio de descarte | Playwright MCP: **no se agregó**, ya hay navegador integrado y Claude in Chrome, y probar reserva y pago con `VITE_API_URL` en producción podría crear turnos o preferencias de Mercado Pago reales; si hace falta, mejor `@playwright/test` en el CI. Context7 `4.4.4` (la última): descartada, tiene 8 días y hubo 7 versiones en 6 días; se fijó la `4.3.0` (18 días). Bloquear solo el push a `main` si Vercel despliega solo: no se puede confirmar desde el repo (`vercel.json` solo tiene el rewrite y el CI no despliega), así que se bloquea siempre. Borrar la carpeta `@/` y `evolver.config.json`: **no se hizo**, la carpeta `@/` es un resto de la CLI de shadcn (`components.json` apunta a alias inexistentes) y el segundo es un perfil de Evolver que nada usa; decisión de Emily. |
| 3 | Evidencia que la sostiene | Los cuatro hooks se probaron con JSON simulado (`.env`, `package-lock.json`, `dist/`, `--force`, `-f` encadenado, push a `main` y a `HEAD:main`, JWT, URL con credenciales, DSN de Sentry con y sin secreto, eslint sobre `PaymentStep.tsx`); `.claude/settings.json` y `.mcp.json` son JSON válido; `CLAUDE.md`, `.claude/` y `.mcp.json` no están ignorados por git. Paquete de Context7 verificado en npm (repo `upstash/context7`, mantenedores de Upstash, MIT). Se corrigió una afirmación errónea del primer borrador (decía que no había ningún `useMutation`; `features/auth/hooks/useAuth.ts` lo usa). **Incidente de ramas:** a las 00:46 alguien cambió a `main`, hizo `pull` y creó `chore/lint-cero`; el commit cayó ahí y `chore/claude-config` quedó vacía. Se movió la etiqueta `chore/claude-config` al commit (`git branch -f`) sin tocar la rama activa; `chore/lint-cero` sigue conteniendo ese commit. No se probaron aún dentro de una sesión nueva los hooks, agentes, skills ni el servidor MCP. |
| 4 | Aporte personal | Pidió los seis bloques, uno por vez, y decidió: base `main`, mencionar la bitácora, Context7 sí y Playwright no, y el commit y el pull request. |
| 5 | Desacuerdo y resolución | Ninguno. Pendiente de Emily: qué hacer con `@/` y `evolver.config.json`; si se permite el push a `main` desde Claude Code; si las skills deben pedir `useQuery` (hoy casi todo usa `useEffect` + `api.get`). Observación para `revisor-reserva`: `PaymentStep.tsx` maneja el 409 `PROFESSIONAL_SLOT_TAKEN` pero no vi manejo explícito del 400 `OUT_OF_HOURS`. No cambia el contrato con el backend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): escribió la configuración, la probó, hizo el commit, subió la rama y abrió el pull request a pedido de Emily. Revisión de Emily pendiente. |

## Entrada 40: limpieza de ramas del frontend y estado de verificaciones (sin cambios de código)

**Fecha:** 2026-10-27, 01:07 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Borrar la rama remota y la local `feat/seguridad-login-contrasenas` de `nexa-frontend`: ya estaba dentro de `main` por el pull request nexa-frontend#1 (`git merge-base --is-ancestor`). (b) No borrar nada en las ramas de este repositorio: Emily indicó que en el backend solo se escribe en esta bitácora. (c) No arreglar el check de Vercel del pull request nexa-frontend#2: no se puede resolver con un cambio de código. (d) No tocar los 34 archivos de `src/` que otra sesión tiene modificados en el frontend (rama `chore/lint-cero`). Esta entrada **no registra ningún cambio de código ni de configuración**. |
| 2 | Alternativas y criterio de descarte | Borrar `origin/chore/claude-config` (ya mergeada) y revisar `origin/fix/pendientes-webhook-hora-login` (tiene un commit de documentación que `main` no tiene) en este repositorio: **no se hizo**, por pedido de Emily; quedan los comandos como alternativa manual. Forzar un nuevo commit para reintentar el check de Vercel: descartado, el bloqueo es de Vercel y no del build. Medir el lint sobre una copia limpia de `main`: descartado por ahora, requeriría instalar dependencias en otro directorio. |
| 3 | Evidencia que la sostiene | `gh pr checks 2` en `nexa-frontend`: `Vercel – nexa-frontend` falla con "Deployment was blocked" (el otro proyecto, `lorenestudiodebelleza`, despliega bien, y `build` de GitHub Actions pasa en 58 s). En el árbol de trabajo del frontend, con los cambios de la otra sesión puestos: `typecheck:all` sin errores, `npm test` 13 archivos y 50 tests en verde, `npm run build` correcto en la segunda corrida (la primera falló por un error de tipos en `PromotionsPage.tsx` que la otra sesión corrigió mientras tanto), y ESLint con 45 errores y 17 advertencias en 23 archivos (cifra provisoria: cambia mientras esa sesión edita). Se leyó este repositorio solo en modo lectura (`git fetch --prune`, `git branch -r`, `gh pr list`). Al registrar la entrada 39 había quedado repetido el número 38 con la entrada de sesiones por dispositivo; se renumeró la mía a 39 sin tocar la otra. |
| 4 | Aporte personal | Emily pidió trabajar solo en el frontend, anotar en esta bitácora todo lo que se haga y saber qué falta o hay que arreglar en el código. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendientes detectados (frontend):** (1) terminar el lint (`chore/lint-cero`, en curso por otra sesión) y revisar que el commit de configuración quede en `chore/claude-config` y no se mezcle; (2) autorizar o desbloquear el deploy de `nexa-frontend` en Vercel; (3) ningún archivo de `src/` maneja el `400 OUT_OF_HOURS` por su código (sí el `409 PROFESSIONAL_SLOT_TAKEN` en 4 flujos), cae al mensaje genérico; (4) la carpeta `@/` de la raíz y `evolver.config.json` siguen sin resolverse; (5) la dependencia `@sentry/tracing` (7.x) no se importa en ningún archivo de `src/` y convive con `@sentry/react` 11; (6) hay 13 archivos de test para 174 componentes. Sin impacto en el contrato con el backend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): borró las ramas, corrió las verificaciones y escribió esta entrada a pedido de Emily. Revisión de Emily pendiente. |

## Entrada 41: lint del frontend en cero (rama chore/lint-cero, sin commitear)

**Fecha:** 2026-10-27, 16:49 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Llevar ESLint del frontend de 40 problemas a 0 (de 121 al empezar el trabajo; los primeros 81 ya estaban en los commits `63400ec` y `bc0e6de`). **Componentes creados dentro del render** (`react-hooks/static-components`): `Header` y `SimultaneousNote` en `ComboBookingFlow`, `Header` en `SpecialServiceBookingFlow` y `Section`/`Row` en `ConfirmationStep` pasaron a funciones del módulo, con los valores que usaban (`primaryColor`, cantidad de servicios) como props. **setState síncrono en efectos** (`set-state-in-effect`): en `DashboardPage` y `Statistics` el "cargando" se deriva del período ya cargado (`loadedPeriod !== period`) y la respuesta de un período viejo se descarta; `DateTimeStep` junta los dos efectos en uno y deriva horarios y "cargando" de una clave (profesional, fecha, `refreshSignal`); `GeneralSection`, `PaymentsSection`, `ScheduleSection` y `Settings` dejan de reiniciar `loadError` (ya arrancaba en `null`); `ProfessionalsPage` separa la carga inicial de la recarga tras invitar; `ProfessionalRegisterPage` deriva `invalid` cuando falta el token; `AdminSidebar` toma `matchMedia` como estado inicial; `TenantContext` arranca con `tenantConfig` en el estado (`loading` queda en `false` fijo); `HomePage` ya no repite `setActiveSection('tienda')` (el estado inicial ya lo hacía); `PaymentStep` pasa directo a `success` si el POST no devolvió id, en vez de pasar por `details` y corregirlo con un efecto; `AuthContext` hace el `GET /api/auth/me` inicial dentro del efecto. **react-hook-form**: `ServiceFormModal` usa `useWatch` en lugar de `watch`. **Exports mezclados** (`react-refresh/only-export-components`): no se movieron los hooks; se declaran en `eslint.config.js` (`allowExportNames`: `useAuth`, `redirectByRole`, `isFirstVisit`, `useCart`, `useTenant`, `useToast`, `useThemeContext`, `buttonVariants`). |
| 2 | Alternativas y criterio de descarte | Mover cada hook a su propio archivo: descartado, `AuthContext` se importa desde 23 lugares y es riesgo sin ganancia funcional; el costo de dejarlos es solo que en desarrollo esos archivos recargan la página entera en vez de refrescar en caliente. Apagar `set-state-in-effect` en la configuración: descartado, esconde el problema. `// eslint-disable` caso por caso: descartado. Un `useQuery` para las cargas: descartado, el proyecto usa `useEffect` + `api.get` y cambiarlo sería otra tarea. |
| 3 | Evidencia que la sostiene | `npx eslint .` sin salida (0 errores, 0 advertencias); `tsc -p tsconfig.test.json --noEmit` y `tsc -b` sin errores; `vitest run`: 13 archivos, 50 tests en verde. **No se probó a mano en el navegador** el flujo de reserva ni los paneles: conviene probar reservar un turno (con "Cualquiera" y con una profesional), un combo, un servicio especial, cambiar el período del dashboard y la barra lateral en celular. |
| 4 | Aporte personal | Emily pidió arreglar los 121 problemas de lint del frontend. |
| 5 | Desacuerdo y resolución | Ninguno. Sin commitear ni subir: queda en el árbol de trabajo de `nexa-frontend` (rama `chore/lint-cero`). Sin impacto en el contrato con el backend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 42: SOP actualizado, commit del frontend, limpieza de ramas y subida de cambios del backend

**Fecha:** 2026-10-27, 16:56 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Reescribir `00-gestion/SOP.md`: el deploy pasa por rama + pull request + merge (antes decía `git push origin main`); las migraciones de producción se aplican pegando el SQL en el SQL Editor de Supabase y registrándolas con `scripts/migration-checksums.mjs` (antes decía `prisma migrate deploy` desde la PC, que da `P1001`); se agregan las secciones de sesiones por dispositivo y el control de migraciones en el chequeo semanal. (b) Commit `b05edd8` en `nexa-frontend` (rama `chore/lint-cero`, sin pushear): los cambios de la entrada 41. (c) Borrar las ramas ya mergeadas: en este repositorio `chore/claude-config`, `feat/sesiones-multiples` y `fix/pendientes-webhook-hora-login` (local y remota); en `nexa-frontend`, `chore/claude-config` (local y remota). (d) Subir en una rama nueva a partir de `origin/main` y abrir un pull request (sin mergear) los cambios del backend que estaban sin commitear: los de la entrada 37 (firma de imágenes, SVG solo admin, límite de login por email, `npm audit fix`), esta entrada y la 41 a 42 de la bitácora, y el SOP. |
| 2 | Alternativas y criterio de descarte | Pushear directo a `main`: descartado, dispara el deploy en Render sin que se hayan visto los checks y sin haber confirmado la migración en Supabase (CLAUDE.md). Borrar `chore/lint-cero` del frontend: no, tiene el commit sin subir. Dejar `fix/pendientes-webhook-hora-login`: su único commit (`3e3cb96`, cambio de redacción en docs) ya está en `main` con otro hash (`git cherry` lo marca como aplicado), por eso se puede borrar sin perder nada. |
| 3 | Evidencia que la sostiene | `gh pr list`: los PR #1 a #4 del backend y #1 y #2 del frontend figuran MERGED. `git rev-list --count origin/main..<rama>`: 0 commits propios en `chore/claude-config` y `feat/sesiones-multiples`. `git diff 4229ed1 origin/main` vacío: el árbol de trabajo parte del mismo código que `main`. El repositorio tiene 52 migraciones (la 52 es `20261027120000_add_refresh_sessions`), no 51. Con todos estos cambios: `typecheck:all` sin errores y la suite completa en verde (28 archivos, 276 tests). |
| 4 | Aporte personal | Emily pidió actualizar el SOP, explicar qué es, guiar el uso del SQL Editor, subir los cambios del backend, revisar y borrar las ramas innecesarias, y que toda modificación de código quede en esta bitácora con fecha. |
| 5 | Desacuerdo y resolución | Ninguno. Contrato con el frontend (viene de la entrada 37, todavía sin desplegar): `POST /api/auth/login` puede responder `429` con `code: TOO_MANY_ATTEMPTS`; `POST /api/uploads/image` puede responder `400 INVALID_IMAGE_CONTENT` y `403` si un no admin sube SVG. Antes de mergear, confirmar en Supabase que la migración 52 figura como `OK`. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 43: migración refresh_sessions aplicada en Supabase (hecho por Emily)

**Fecha:** 2026-10-28, 00:05 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aplicar en la base de producción (Supabase) la migración `20261027120000_add_refresh_sessions` pegando su SQL en el SQL Editor (paso 1) y registrándola en `_prisma_migrations` con el INSERT que genera `scripts/migration-checksums.mjs insert` (paso 2). Lo ejecutó Emily; Claude solo preparó los dos archivos SQL. No se modificó ningún archivo de migración ni de código. |
| 2 | Alternativas y criterio de descarte | `prisma migrate deploy` desde la PC: descartado, da `P1001` contra Supabase. Mergear antes de aplicar: descartado, el código nuevo consulta `refresh_sessions` y sin la tabla el login da error. |
| 3 | Evidencia que la sostiene | Antes: el control de migraciones dio `FALTA APLICAR` 1 (`20261027120000_add_refresh_sessions`) y `OK` 51. Emily informó que los dos pasos salieron bien. **La consulta de control posterior (esperado: `OK` 52) todavía no se vio**: queda pendiente que Emily la corra y pase el resultado. |
| 4 | Aporte personal | Emily ejecutó el SQL en Supabase y avisó el resultado. |
| 5 | Desacuerdo y resolución | Ninguno. Con la tabla creada ya se puede mergear el pull request #5 y desplegar sin romper el login. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 44: frontend subido (nexa-frontend#3), recordatorio de limpieza y diagnóstico del mail (sin cambios de código)

**Fecha:** 2026-10-28, 00:14 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) Subir la rama `chore/lint-cero` de `nexa-frontend` (commit `b05edd8`) y abrir el pull request https://github.com/emilykohler12/nexa-frontend/pull/3 (base `main`, sin mergear). (b) Programar un recordatorio único para el 2026-11-04 09:07 que le avisa a Emily la limpieza del refresh token en formato viejo (7 días desde el deploy del 2026-10-28). (c) Guardar en la memoria del proyecto el diagnóstico del mail y la fecha de la limpieza. (d) Armar las dos consultas de solo lectura para Supabase (no-show marcados antes de la hora del turno; clientas sin verificar). Esta entrada **no registra cambios de código del backend ni del frontend**. |
| 2 | Alternativas y criterio de descarte | Hacer la limpieza del refresh token ya: descartado, antes de los 7 días podría desloguear a quien conserve una sesión vieja. Cambiar el envío de mails ahora: descartado hasta confirmar la causa con los logs de Render y elegir proveedor (necesita una cuenta y una clave que solo Emily puede crear). |
| 3 | Evidencia que la sostiene | PR #5 del backend: MERGED el 2026-10-28 03:08 UTC; Emily informó que Render redesplegó. El código del envío (`mail.provider.ts`) y su uso en `forgotPassword` no cambiaron con las sesiones por dispositivo; usa SMTP (smtp.gmail.com:587 por defecto) y Render bloquea los puertos 25, 465 y 587 en los servicios gratuitos desde septiembre de 2025 (changelog de Render). **Es una hipótesis, falta confirmarla** con el log de Render ("[mail] ❌ Error enviando código"). El 401 de `/api/auth/me` en la consola es el comportamiento normal sin sesión. |
| 4 | Aporte personal | Emily pidió subir el frontend con todos sus cambios, que se la recuerde en 7 días, las instrucciones para las consultas y la explicación del mail, del 401 y de `@/` y `evolver.config.json`. Aclaró que si dice que algo salió bien no hace falta una captura. |
| 5 | Desacuerdo y resolución | Ninguno. Pendiente: confirmación del log de Render, elegir proveedor de mail, qué hacer con `@/` y `evolver.config.json`. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 45: borrado de `@/` y `evolver.config.json` del frontend, revisión de pendientes y resultados de Supabase

**Fecha:** 2026-10-28, 00:24 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | (a) En `nexa-frontend` (rama `chore/quitar-restos-shadcn-evolver`, pull request pendiente de merge): borrar la carpeta literal `@/` (`components/ui/button.tsx` y `lib/utils.ts`, restos de la CLI de shadcn) y `evolver.config.json`; actualizar `CLAUDE.md` del frontend (se quitó la línea que los declaraba restos y se reescribió la nota de shadcn) y quitar `buttonVariants` de `allowExportNames` en `eslint.config.js` porque ese archivo ya no existe. (b) Revisar los 7 pendientes del frontend de la entrada 40 (ver punto 3). (c) Registrar los resultados de las consultas en Supabase. |
| 2 | Alternativas y criterio de descarte | Arreglar antes los alias de `components.json`: descartado por ahora, hoy no hay componentes shadcn en uso; queda anotado en `CLAUDE.md` que hay que resolverlos antes de usar `npx shadcn add`. Quitar `@sentry/tracing`: **no se hizo**, toca `package.json` y es decisión de Emily. Mover la lógica de `OUT_OF_HOURS` a una pantalla propia como `slotTaken`: no se hizo (ver punto 3). |
| 3 | Evidencia que la sostiene | **Nada usaba lo borrado:** `grep` sin coincidencias de `evolver` fuera de su propio archivo y de `CLAUDE.md`; sin imports relativos a `@/`; el alias `@` apunta a `src/` (`vite.config.ts`, `tsconfig.app.json`); `tsconfig` solo incluye `src`, `tests` y `vite.config.ts`; no existen `src/components` ni `src/lib`. Con el cambio: `eslint .` sin salida, `tsc -p tsconfig.test.json` y `tsc -b` sin errores, 13 archivos y 50 tests en verde. **Estado de los 7 pendientes:** (1) lint: hecho, 0 problemas (nexa-frontend#3, mergeado el 2026-10-28 03:16 UTC). (2) commit de configuración mezclado en `chore/lint-cero`: ya no aplica, `chore/claude-config` (#2) y `chore/lint-cero` (#3) están mergeadas y borradas. (3) Vercel bloqueado: ya no, el check `Vercel` del PR #3 pasó ("Deployment has completed"). (4) `OUT_OF_HOURS`: la descripción estaba exagerada; el `400` pasa por `safeErrorMessage`, que muestra el texto en español del backend ("Ese horario está fuera de la disponibilidad de la profesional. Elegí otro horario."), no el genérico; lo que falta es que `PaymentStep` deja a la clienta en el paso de pago con el aviso en vez de llevarla a elegir otro horario como hace con `slotTaken`: mejora menor, pendiente. (5) `@/` y `evolver.config.json`: hecho en esta entrada. (6) `@sentry/tracing` 7.x: sigue en `package.json` sin ningún import; pendiente de decisión. (7) Tests: sigue habiendo 13 archivos de test; `PaymentStep` y `DateTimeStep` sin cobertura; pendiente. **Supabase (informado por Emily):** consulta de no-show: "Success. No rows returned", es decir que no hay ningún aviso de no-show automático en `activity_logs`, así que no hay datos para saber si el error de hora existió; consulta de emails: 1 clienta activa, 0 verificadas, 1 sin verificar. **Mail:** los logs de Render muestran `ETIMEDOUT` y `ENETUNREACH ...:587`, lo que confirma que Render bloquea el SMTP y por eso no llega el código de recuperación (ni el de verificación). Pendiente elegir un proveedor por API HTTPS. |
| 4 | Aporte personal | Emily pidió revisar si algo usaba `@/` y `evolver.config.json`, borrarlos, anotar todo en esta bitácora y subir los commits para hacer ella el merge; pegó los logs de Render y los resultados de Supabase. |
| 5 | Desacuerdo y resolución | Ninguno. Contrato con el backend: sin cambios. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 46: se quita el formato viejo del refresh token; frontend: `OUT_OF_HOURS`, sin `@sentry/tracing` y tests de pago y horarios

**Fecha:** 2026-10-28, 00:34 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Backend** (rama `chore/quitar-refresh-token-viejo`, apilada sobre `docs/bitacora-45-limpieza`): se quita el canje de las sesiones del formato anterior (`findByRefreshToken`, `clearRefreshToken`, `claimLegacyRefreshToken` en `auth.repository.ts`; la rama `!payload.sid` de `authService.refresh`, que ahora responde `401 INVALID_REFRESH_TOKEN`; `logout` de un token sin `sid` ya no hace nada porque no hay sesión que borrar); se deja de escribir `refreshToken` en `updatePassword` y en la anonimización (`admin.service.ts`); se borra el campo de `schema.prisma`; migración nueva `20261028120000_drop_users_refresh_token` (`ALTER TABLE "users" DROP COLUMN "refresh_token"`); se actualizan `CLAUDE.md` y el ADR-003. Tests: se reemplazaron los dos de transición por uno que verifica que un token sin `sid` da 401 y no crea sesión (`auth.security`, `auth.sessions`) y se quitaron las referencias a la columna (`admin.clients`, `auth.password`). **Frontend** (rama `feat/fuera-de-horario-tests-sentry`): (a) `PaymentStep` trata el `400 OUT_OF_HOURS` como el `409 PROFESSIONAL_SLOT_TAKEN`: pantalla "Ese horario no está disponible" con el botón "Elegir otro horario" (en los dos caminos de reserva, Mercado Pago y WhatsApp); (b) se quita `@sentry/tracing` de `package.json` y del `package-lock.json` con `npm uninstall` (nada lo importaba); (c) tests nuevos: `DateTimeStep.test.tsx` (11 casos) y `PaymentStep.test.tsx` (8 casos). |
| 2 | Alternativas y criterio de descarte | Esperar los 7 días (hasta el 2026-11-04): descartado por pedido de Emily, que confirmó que todavía nadie usa el sistema; el costo es que una sesión de prueba del formato anterior tendrá que volver a iniciar sesión. Dejar la columna y solo quitar el código: descartado, Emily pidió quitar el formato viejo y la columna sin uso es deuda. Cambiar `ComboBookingFlow`/`SpecialServiceBookingFlow`/`RescheduleModal` para `OUT_OF_HOURS`: no hizo falta, ahí el aviso del servidor ya se muestra en el mismo lugar y no hay una pantalla intermedia; el cambio se limitó a `PaymentStep`, que sí la tiene. Tocar `src/app/database/migrations.ts` (menciona `refresh_token` en un `CREATE TABLE` viejo): no se tocó, nada lo importa. |
| 3 | Evidencia que la sostiene | Backend: `prisma generate`, `npm run test:migrate` (aplicó la migración nueva a la base de pruebas), `typecheck:all` sin errores y suite completa: 28 archivos, 275 tests en verde (antes 276: dos tests de transición pasaron a ser uno). Frontend: `eslint .` sin salida, `tsc` y `tsc -b` sin errores, 15 archivos y 70 tests en verde (antes 13 y 50). Un primer intento del test de `PaymentStep` falló porque la pantalla de confirmación consulta `/api/professional/public` y el mock no la cubría; se corrigió el mock, no el componente. **Pendiente de prueba manual:** reservar con un horario fuera de franja y ver la pantalla nueva. **Salvedad:** el comentario de la migración `20261028120000_drop_users_refresh_token` dice por error que "pasaron los 7 días" desde el despliegue; no se pudo corregir porque el hook del repositorio impide editar una migración existente, aunque no esté aplicada. El SQL es correcto. |
| 4 | Aporte personal | Emily pidió quitar el formato viejo sin esperar, arreglar `OUT_OF_HOURS`, borrar `@sentry/tracing` y escribir los tests de `PaymentStep` y `DateTimeStep`, y que todo quede en esta bitácora con fecha. |
| 5 | Desacuerdo y resolución | Ninguno. **Orden para publicar (importante):** la migración que borra la columna se aplica en Supabase **después** de que Render termine de desplegar el código nuevo, y no antes: el código actualmente en producción todavía lee `users.refresh_token` en cada consulta a `users` y fallaría. Orden: (1) mergear el pull request del backend y esperar el deploy; (2) correr el SQL de la migración en Supabase; (3) registrarla con `scripts/migration-checksums.mjs insert`; (4) mergear el del frontend. Cambia el contrato: un refresh token sin `sid` da 401 (ya lo trata el frontend como cierre de sesión). Hay que cancelar el recordatorio del 2026-11-04. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 47: envío de mails por Brevo y revisión de todos los envíos

**Fecha:** 2026-10-28, 00:57 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rama `feat/mail-brevo`. `mail.provider.ts` envía por la API HTTPS de Brevo (`POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key`, `sender`, `to`, `subject`, `htmlContent`, timeout de 15 s) cuando existe `BREVO_API_KEY`; sin esa variable usa SMTP como antes (desarrollo local). El transporte SMTP ahora se crea recién al usarse, así que con Brevo no se intenta ninguna conexión SMTP en el arranque. `env.ts`: `BREVO_API_KEY` opcional (vacío = no configurada) y `MAIL_FROM` pasa a tener por defecto `kologic6@gmail.com` (antes `noreply@app.com`). Se documentan las variables en `.env.example` y una regla de mails en `CLAUDE.md`. Test nuevo `mail.provider.test.ts` (6 casos). **Revisión de envíos:** los 9 llamados a `mailProvider.send` (verificación de email y código de recuperación en `auth.service`; cuatro en `appointment.service`; `invitation.service`; `autoPromotions.job`; `inactivityReminder.job`) pasan todos por ese único proveedor; no hay otro `nodemailer`, otra API de correo ni otra dirección escrita en `src/`, `scripts/`, `tests/` ni en los workflows. |
| 2 | Alternativas y criterio de descarte | Resend: descartado, exige dominio propio para enviar a cualquier destinatario. Seguir con Gmail por SMTP: imposible, Render lo bloquea. Dejar `noreply@app.com` como valor por defecto: descartado, Emily pidió que se use solo `kologic6@gmail.com`. Validar `MAIL_FROM` con `.email()` en `env.ts`: descartado, si el valor guardado en Render tuviera otro formato el servidor no arrancaría. Editar `00-gestion/RUNBOOK.md` (lista de variables de entorno): no se hizo, es documentación de la entrega y no fue pedido. |
| 3 | Evidencia que la sostiene | Logs de Render pegados por Emily: `ETIMEDOUT` y `ENETUNREACH ...:587`. Forma de la API de Brevo verificada en su documentación (endpoint, cabecera `api-key`, campos, éxito 201 con `messageId`, error 400 con `code` y `message`). `typecheck:all` sin errores y suite completa: 29 archivos, 281 tests en verde. **No se envió ningún mail real** desde las pruebas (`fetch` y `nodemailer` simulados). Pendiente de prueba real tras el deploy: pedir un código de recuperación. |
| 4 | Aporte personal | Emily creó la cuenta de Brevo y pidió revisar todo el código de envío para que solo se use `kologic6@gmail.com`. Escribió la dirección sin la arroba (`kologic6gmail.com`); se interpretó como `kologic6@gmail.com`, que es la que ya figura en `tenant.data.ts` del frontend. |
| 5 | Desacuerdo y resolución | Ninguno. **Para que funcione, en Render (Environment):** `BREVO_API_KEY` = la clave de Brevo y `MAIL_FROM` = `kologic6@gmail.com`; la dirección tiene que figurar como remitente verificado en Brevo. **Advertencia:** Brevo avisa que los remitentes de dominios gratuitos (gmail.com) no se pueden autenticar con DKIM/DMARC propios y los mails pueden caer en spam; para uso real conviene un dominio propio. El resto de los mails que dependen de esto (verificación, turnos, recordatorios) también empezará a salir. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 48: error de Brevo "valid sender email required" y validación del remitente

**Fecha:** 2026-10-28, 01:10 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rama `fix/mail-from-valido`. (a) `env.ts`: `MAIL_FROM` y `BREVO_API_KEY` ya no conservan espacios ni comillas simples o dobles pegadas alrededor del valor. (b) `mail.provider.ts`: antes de llamar a Brevo se comprueba que `MAIL_FROM` tenga forma de email; si no, falla con `MAIL_FROM no es un email válido ("...")\: revisá la variable en Render` en lugar del genérico de Brevo. (c) Tests: 3 casos nuevos en `mail.provider.test.ts` (`kologic6gmail.com`, `kologic6@gmail`, con un espacio). |
| 2 | Alternativas y criterio de descarte | Cambiar el valor por defecto o fijar el remitente en el código para ignorar la variable de Render: descartado, el remitente tiene que poder cambiarse sin tocar código. Validar con `.email()` en `env.ts`: descartado otra vez, un valor inválido en Render impediría que el servidor arranque. |
| 3 | Evidencia que la sostiene | Log de Render pegado por Emily tras el merge de #8: `Brevo respondió 400 (invalid_parameter): valid sender email required`. Brevo devuelve eso cuando el `sender.email` no tiene forma de dirección. El valor por defecto del código (`kologic6@gmail.com`) sí la tiene, así que lo que llega es el de la variable `MAIL_FROM` de Render. **Causa exacta: no verificada**, no se puede leer Render desde acá; las hipótesis son que la variable se cargó sin la arroba (`kologic6gmail.com`, como se escribió en el pedido), con comillas o con un espacio. `typecheck:all` sin errores y suite completa: 29 archivos, 284 tests en verde. |
| 4 | Aporte personal | Emily cargó las variables en Render y pegó el log del error. |
| 5 | Desacuerdo y resolución | Ninguno. **Acción de Emily en Render (Environment):** revisar que `MAIL_FROM` valga exactamente `kologic6@gmail.com`; guardar. Con este cambio, si sigue mal, el log dirá qué valor llegó. El cambio del código solo mejora el diagnóstico y tolera comillas: no reemplaza corregir la variable. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

## Entrada 49: registro de lo ya arreglado, invitación con email repetido, nodemailer 10, versión de Node y alias de shadcn

**Fecha:** 2026-10-28, 01:30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(A) Ya arreglado, según el código y `gh pr list` (nada de esto se tocó en esta entrada):** (1) `PATCH /api/client/profile` valida con zod (400 `VALIDATION_ERROR`); el 500 por `name: ["x"]` del mail de Sentry del 24/10 venía del código anterior. (2) `forgot-password` reintenta hasta 5 veces ante `P2002` del código repetido (`auth.service.ts`, `forgotPassword`). (3) Formato viejo del refresh token y columna `users.refresh_token` quitados: backend #7 y frontend #5, mergeados el 2026-10-28 03:35 UTC. (4) Mails por la API de Brevo (#8) y validación de `MAIL_FROM` (#9), mergeados el 2026-10-28 03:57 y 04:10 UTC. (5) Frontend, ya en `main`: `PaymentStep` lleva a elegir otro horario ante `OUT_OF_HOURS`, sin `@sentry/tracing`, tests de `PaymentStep` (8) y `DateTimeStep` (11) (#5); carpeta `@/` y `evolver.config.json` borrados (#4); lint en cero (#3). (6) No hay cambios sin commitear en ninguno de los dos repositorios ni recordatorios programados pendientes. **(B) Cambios de esta entrada, sin commitear:** backend, rama `fix/invitacion-email-y-nodemailer-10`: (a) `invitation.service.ts`: si `createVerified` falla con `P2002`, se devuelve la invitación (`invitationRepository.release`, nuevo) y se responde `409 EMAIL_TAKEN`; antes daba 500 y la invitación quedaba gastada. (b) `nodemailer` 9.1.1 a 10.2.1 (`package.json`, `package-lock.json`). (c) `.node-version` con `24.22.1` y una línea en `CLAUDE.md`. Frontend, rama `chore/alias-components-json`: `components.json` apunta ahora a carpetas que existen (`@/shared/ui`, `@/shared/utils`, `@/shared/utils/utils`, `@/shared/hooks`) y se actualizó la nota de shadcn en su `CLAUDE.md`. **(C) Decisiones:** no exigir email verificado para iniciar sesión (lo decidió Emily); no agregar un servidor MCP de PostgreSQL; no se permite el push a `main` desde Claude Code; las skills del frontend piden React Query solo para código nuevo y no se migra lo existente (ya está así en el `CLAUDE.md` del frontend). |
| 2 | Alternativas y criterio de descarte | Dejar la invitación gastada y solo traducir el error: descartado, la persona quedaba sin poder registrarse con el mismo link. Reordenar para crear la cuenta antes de gastar la invitación: descartado, perdería la protección contra dos registros simultáneos. Servidor MCP de PostgreSQL: descartado, exige una cadena de conexión con credenciales y un rol de solo lectura que habría que crear en la base de pruebas; la suite ya consulta esa base y el beneficio es bajo frente al riesgo de que alguien lo apunte a Supabase. Permitir el push a `main`: descartado, redespliega Render y Vercel; ya lo bloquean los hooks de los dos repositorios y la regla de `CLAUDE.md`. Migrar los `useEffect` + `api.get` a `useQuery`: descartado, cambio amplio sin pedido. Fijar la versión de Node con `NODE_VERSION` en Render: se deja como alternativa (gana sobre el archivo); se eligió el archivo porque queda versionado y revisable. Crear `utils.ts` con `cn()` ahora: descartado, no hay componentes shadcn en uso. |
| 3 | Evidencia que la sostiene | Documentación consultada con Context7: nodemailer 10 solo sube el mínimo a Node 20 y quita la configuración vieja de SES; `createTransport` y `verify` (lo único que se usa, en `mail.provider.ts`) no cambian; shadcn lee los alias de `components.json` y los resuelve con `compilerOptions.paths`. Render (docs oficiales): la versión sale de `NODE_VERSION`, después `.node-version`, `.nvmrc` y `engines`; sin ninguno, un servicio creado antes del 2026-10-21 usa una versión anterior (24.21.0 para los de septiembre y octubre), no la 24.22.1. Por eso el aviso de seguridad de Render sí aplica a este servicio hasta que se redespliegue con la versión fijada. Backend: `typecheck:all` sin errores y suite completa en verde: 29 archivos, 285 tests (284 más el nuevo de `EMAIL_TAKEN`). `npm audit` sin avisos de nodemailer; quedan 3 altos de la CLI de Prisma (`deepmerge-ts`). **No se envió ningún mail real** y el frontend no se corrió (solo cambió un JSON y una nota que nada importa). `scripts/migration-checksums.mjs insert 20261028120000_drop_users_refresh_token` imprimió el INSERT de registro de esa migración. |
| 4 | Aporte personal | Emily pidió revisar de nuevo mail, refresh token y migraciones, y los pendientes del frontend; dijo que no quiere verificar el email; delegó nodemailer, el servidor MCP, el push a `main`, `useQuery` y los alias; pidió revisar cambios sin commitear y registrar todo lo arreglado; informó que Render no tiene `NODE_VERSION`. |
| 5 | Desacuerdo y resolución | Ninguno. **Contrato con el frontend:** solo se suma que `POST /api/invitations/register` puede responder `409 EMAIL_TAKEN` (`ProfessionalRegisterPage` muestra el error con `safeErrorMessage`, así que el texto del servidor llega a la pantalla; no se probó a mano). **Hecho por Emily después de escribir esto:** (1) corrigió `MAIL_FROM` en Render y probó un código de recuperación: el mail llega (lo informó ella; sin captura, como pidió). (2) Corrió el control de migraciones en Supabase y, si hacía falta, el SQL y el INSERT de `20261028120000_drop_users_refresh_token`; informó que lo hizo, pero el resultado del SELECT de control no se vio, así que el `OK 52` y `OK 53` siguen sin constar acá. **Pendiente de Emily:** (3) mergear esta rama para que Render use Node 24.22.1 y redesplegar; (4) mergear la del frontend si le parece bien. **Sin tocar:** Sentry en los tests (`initSentry()` no mira `NODE_ENV=test`, por eso llegaron a su mail los errores de `environment = test`); prueba manual de reservar fuera de franja. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con Context7 (nodemailer, shadcn) y la documentación de Render. Revisión de Emily pendiente. |

## Entrada 50: commits, push y pull requests de la entrada 49 (backend #10, frontend #6)

**Fecha:** 2026-10-28, 01:34 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Commitear y subir las dos ramas de la entrada 49 y abrir un pull request por repositorio, sin mergear: backend https://github.com/emilykohler12/nexa-backend/pull/10 (rama `fix/invitacion-email-y-nodemailer-10`, commit `9b7f2a3`) y frontend https://github.com/emilykohler12/nexa-frontend/pull/6 (rama `chore/alias-components-json`, commit `11f2707`). Ambos con base `main`. Esta entrada se suma en un commit aparte sobre la rama del backend. |
| 2 | Alternativas y criterio de descarte | Pushear a `main`: descartado, redespliega Render y Vercel y la regla del proyecto lo prohíbe sin pedido. Un solo pull request para los dos repositorios: imposible, son repositorios distintos. Agregar a los commits la línea de coautoría de Claude: descartado, Emily pidió commits solo con su nombre. |
| 3 | Evidencia que la sostiene | `git push -u origin <rama>` creó las dos ramas remotas; `gh pr create` devolvió las dos URL. Antes del commit: `typecheck:all` sin errores y 285 tests en verde (backend). Emily informó que el mail ya funciona (probó un código de recuperación) y que corrió el control de migraciones en Supabase; el resultado de ese SELECT no se vio. |
| 4 | Aporte personal | Emily pidió subir los commits después de confirmar el mail y las migraciones. |
| 5 | Desacuerdo y resolución | Ninguno. El merge de los dos pull requests queda a decisión de Emily. Al mergear el del backend, Render redespliega con Node 24.22.1 (`.node-version`). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |

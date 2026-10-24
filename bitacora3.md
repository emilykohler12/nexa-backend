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

# Bitácora individual de proceso y decisiones · AE3

**Proyecto:** «Nexa: sistema de gestión de turnos y clientes para un estudio de belleza» · **Autora:** Kohler, Emily Noralí, DNI 45.555.841 · **Docente titular:** PosDr. Darío Ezequiel Díaz · Comisión A · Sede Posadas.

**Período:** desde el 23/10/2026.

Esta bitácora **continúa la de la AE2** ([`20261006_BitacoraIndividual_KohlerAE2_v5.docx`](20261006_BitacoraIndividual_KohlerAE2_v5.docx)), que terminó el **06/10/2026**, y esa a su vez continúa la de la AE1 ([`BITACORA.md`](BITACORA.md)). Cada entrada consigna los seis elementos de la Bitácora Individual de Proceso y Decisiones (Proyecto Final de Grado 2026, UCP, Comisión A) y se agrega al final, en el mismo cambio que la motiva. Las entradas se numeran desde 1 en este archivo; la bitácora de la AE2 las identifica por fecha y tema.

Entre el 07/10 y el 22/10/2026 no hay entradas: el único cambio de ese período es el del correo de contacto del pie de página del frontend (commit `e3c4b52`, 17/10/2026), que no tiene entrada propia. Hasta la entrada 59 inclusive el archivo se llamaba `bitacora3.md` y estaba en la raíz de nexa-backend; el cambio de nombre y de lugar está en la entrada 60. En las entradas anteriores, «la bitácora 3» es este archivo.
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


## Entrada 51: correcciones de la revisión docente (AE2) en backend y frontend, rama `fix/ae2-correcciones`

**Fecha:** 2026-10-28, 16:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rama `fix/ae2-correcciones` en los dos repositorios, cortada desde `origin/main` (con los PR #10 y #6 ya mergeados); etiquetas `v1`, `v1.1` y `v1.2` sin tocar, sin push. **(A) README** (backend y frontend, son copias): paso 4.5 con 54 migraciones y la salida real de `migrate deploy`; sección 8 con una línea sobre el uso de Claude (chat) en documentos. **(B) RF-05:** el turno que no se presenta pasa a `cancelled_no_show` («cancelado por inasistencia») en lugar de `no_show`. Migración `20261028160000_rename_no_show_to_cancelled_no_show`: pasa las filas guardadas al valor nuevo y recrea el índice único parcial de R-01 excluyendo `cancelled`, `no_show` y `cancelled_no_show`. Backend (job, estados válidos, dashboard, historial, carga de profesionales, log de actividad) y frontend (tipos, etiquetas «Cancelado por inasistencia», botón del admin). **(C) RF-09:** `anonymizeClient` ahora también pone `lastName` en null (fallo real encontrado en la fase 1), y el panel admin tiene el botón «Anonimizar datos» con confirmación, mensaje de éxito y mensaje de error. **(D) Pruebas nuevas:** RF-07 (consentimiento), RF-10 (combo con una sola seña), RNF-03 (visibilidad por profesional), RNF-04 (esquema sin datos de tarjeta ni bancarios). |
| 2 | Alternativas y criterio de descarte | Cambiar solo la etiqueta y mantener `no_show`: descartado, el pedido era alinear el estado con el catálogo e incluir migración de datos. Dejar en el índice solo `cancelled` y `cancelled_no_show`: descartado, entre aplicar la migración y desplegar el código el código viejo puede escribir `no_show` y esos turnos bloquearían el horario; se conserva el valor viejo en la lista del índice (el comportamiento de RF-01 no cambia). Editar la migración original del índice: descartado, no se editan migraciones existentes. Renombrar el campo `noShowAppointments` de la API y el KPI «Turnos no asistidos»: descartado, no es un valor de estado y cambiaría el contrato sin necesidad. Mostrar un cartel de éxito dentro del modal en vez de un toast: descartado, el panel ya usa `ToastProvider`. Guardar el consentimiento de alergias también en el turno: no se hizo, fuera de alcance (hoy queda en `clients.consents`). |
| 3 | Evidencia que la sostiene | Salida real del paso 4.5 (log del CI de `main`, run 40631208000, base nueva): `53 migrations found in prisma/migrations`, 53 líneas `Applying migration`, `All migrations have been successfully applied.`; con la migración nueva son **54** (`npm run test:migrate` imprimió `54 migrations found`). Antes del arreglo, la prueba de anonimización con apellido falló con `expected 'Cliente eliminado Gómez' to be 'Cliente eliminado'`; con el arreglo pasa. Resultados: backend `typecheck:all` sin errores, `build` exit 0, **296 tests en 32 archivos en verde** (eran 285 en 29; +1 aserción en una prueba existente, +10 casos nuevos en 3 archivos nuevos); el backend no tiene script de lint. Frontend: `lint` sin errores, `typecheck:all` exit 0, `build` exit 0, **74 tests en 16 archivos en verde** (eran 70; +4 de `ClientDetail.test.tsx`). **No verificado:** la migración sobre filas reales con `no_show` (la base de pruebas se vacía entre tests; lo cubre la prueba del horario liberado con el estado nuevo, no el `UPDATE`), la pantalla de anonimizar en un navegador con el backend corriendo, y el cartel «Marcar cancelado por inasistencia» a ojo. Las pruebas de RF-07 y RNF-03 pasaron al primer intento: no revelaron fallos de código. |
| 4 | Aporte personal | Emily pidió las correcciones del docente, fijó las reglas (no tocar RF-01, no debilitar pruebas, no pushear ni etiquetar) y confirmó las decisiones de la fase 1: valor `cancelled_no_show`, ramas desde `origin/main`, arreglar `lastName`, dejar las alergias cargadas por el admin como pendiente. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente decidido por Emily:** el panel admin guarda `clinical.allergies` (`admin.service.ts`) sin pedir consentimiento (RF-07 solo se exige en la reserva de la clienta); no se tocó. **RNF-03:** hoy también ven la alergia el admin, la propia clienta y cualquier profesional que haya atendido alguna vez a esa clienta (alergia del perfil en `listClientsForProfessional`); el criterio del catálogo se prueba contra «una profesional distinta a la asignada». **RNF-01** sigue «Pendiente» en el catálogo: `scripts/load-test.yml` es una prueba de carga, no la medición 4G de 5 s. **Orden de despliegue:** aplicar la migración `20261028160000` en Supabase (SQL Editor + `node scripts/migration-checksums.mjs insert 20261028160000_rename_no_show_to_cancelled_no_show`) ANTES del push a `main`, y después volver a correr solo el `UPDATE` por si el código viejo marcó algún `no_show` en el medio. **Contrato con el frontend:** `status` de un turno puede ser `cancelled_no_show` (el frontend de esta rama ya lo entiende; el desplegado no); el endpoint `POST /api/admin/clients/:id/anonymize` ya existía y ahora también deja `lastName` en null. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con Context7 (Prisma, migraciones personalizadas). Revisión de Emily pendiente. |


## Entrada 52: push de `fix/ae2-correcciones` y pull requests (backend #11, frontend #7)

**Fecha:** 2026-10-28, 16:33 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Subir la rama `fix/ae2-correcciones` de los dos repositorios y abrir un pull request por repositorio, sin mergear: backend https://github.com/emilykohler12/nexa-backend/pull/11 y frontend https://github.com/emilykohler12/nexa-frontend/pull/7, ambos con base `main`. El merge lo hace Emily. Esta entrada se suma en un commit aparte sobre la rama del backend. |
| 2 | Alternativas y criterio de descarte | Pushear a `main`: descartado, redespliega Render y Vercel y la regla del proyecto lo prohíbe sin pedido. Crear etiquetas: descartado, las crea Emily. |
| 3 | Evidencia que la sostiene | `git push -u origin fix/ae2-correcciones` creó las dos ramas remotas y `gh pr create` devolvió las dos URL. Emily informó que corrió en Supabase la consulta previa, el script de la migración `20261028160000` y el `INSERT` en `_prisma_migrations`; los tres devolvieron «Success. No rows returned». **Esa respuesta es la esperada para el script y el `INSERT`, pero no confirma nada para las consultas `SELECT`: un `SELECT` que no devuelve filas indica una tabla `appointments` vacía o un control no ejecutado; no se vio el resultado del control completo (`migration-checksums.mjs`).** Antes de empujar, la prueba temporal de la migración sobre filas reales pasó en la base de pruebas. |
| 4 | Aporte personal | Emily pidió que se suban las ramas y dijo que hace el merge ella. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily:** confirmar en Supabase que `_prisma_migrations` tiene `20261028160000_rename_no_show_to_cancelled_no_show`; mergear primero el backend y enseguida el frontend; volver a correr el `UPDATE` de `no_show` después del despliegue; crear la etiqueta nueva. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 53: consentimiento de alergias en el panel admin, tests de RNF-03 y cifras del README (8.1)

**Fecha:** 2026-10-28, 16:47 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(A) RF-07 en el panel admin:** `POST /api/admin/clients` y `PUT /api/admin/clients/:id` (`admin.service.ts`) devuelven `400 VALIDATION_ERROR` si `clinical.allergies` cambia a un texto no vacío sin `consentAlertas: true` en el cuerpo; con el consentimiento se guarda la alergia y se suma a `clients.consents` la constancia `alertas_perfil:<id de la clienta>:<fecha ISO>`. No se pide al borrar las alergias ni al reenviar el mismo texto (el formulario del admin manda siempre todo el bloque `clinical`). La validación va antes de crear o tocar al usuario, para no dejar cuentas a medias. **(B) RNF-03:** sin cambio de código; los tests ahora dicen quién ve qué (asignada, admin, la propia clienta y la profesional que atendió antes a la clienta, esta última solo la alergia del perfil). **(C) README 8.1 (backend y frontend):** cifras recalculadas con `git log` al 28/10 (backend 111 commits, frontend 76; con línea de coautoría 36 y 36) y aviso en 8.2 de que los commits posteriores al 06/10 no se cruzaron con el registro de sesiones. **(D) RNF-01:** sin cambios, el catálogo `.xlsx` no se tocó y sigue «Pendiente». |
| 2 | Alternativas y criterio de descarte | Pedir consentimiento en cada `PUT` aunque la alergia no cambie: descartado, el formulario actual del admin reenvía todo el bloque y quedaría inutilizable para editar teléfono o preferencias. Restringir en el código la alergia del perfil a la profesional con turno asignado: descartado por Emily, se documenta y se prueba. Un script de Lighthouse para RNF-01: descartado por Emily por ahora; una prueba de carga no equivale a la medición móvil 4G de 5 s. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores; `npm test`: 32 archivos y 304 tests pasan, con 6 tests nuevos de consentimiento del admin y 2 de visibilidad en `tests/integration/allergies.consent-visibility.test.ts`. Cifras del README: `git rev-list --count HEAD` (111 y 76), `git log --format=%B \| grep "^Co-Authored-By: Claude"` (Sonnet 5: 24 y 29; Sonnet 5.5: 8 y 4; Haiku 4.5: 4 y 3; Opus 5.5: 0 y 0) y `git log --since=2026-09-25 --invert-grep` (69 y 35 sin línea). |
| 4 | Aporte personal | Emily eligió las tres opciones (exigir consentimiento en el admin, solo documentar RNF-03, no tocar el catálogo). |
| 5 | Desacuerdo y resolución | Ninguno. **Contrato con el frontend (corregido 2026-10-28, 16:50):** la primera redacción de esta fila decía que `InfoTab.tsx` daría `400` al cambiar alergias; revisado el código, **es falso**. El frontend no tiene ningún campo para cargar alergias en el panel admin: `InfoTab.tsx` (guardado desde `ClientsPage.tsx`, `PUT /api/admin/clients/:id`) solo edita nombre, teléfono, email, nacimiento y género, y reenvía el bloque `clinical` tal como lo recibió, sin cambios; con el mismo texto (o vacío) el backend no pide consentimiento. `CreateClientModal.tsx` tampoco manda alergias. Resultado: **no hay impacto en el frontend actual ni orden de despliegue que respetar**. Las alergias del admin solo se podrían cargar llamando a la API directamente; si algún día se agrega ese campo a la pantalla, tiene que traer un checkbox y mandar `consentAlertas: true`. **Pendiente:** las cifras de 8.1 vuelven a quedar atrasadas con el commit de esta entrada y con los siguientes; la tabla 8.2 sigue con el corte del 06/10. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 54: solo la clienta carga alergias (reemplaza la decisión A de la entrada 53), ramas nuevas tras el merge y limpieza de ramas locales

**Fecha:** 2026-10-28, 16:55 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(A) Alergias:** el admin y las profesionales no pueden cargar ni editar las alergias de una clienta; solo las carga la clienta al reservar, con consentimiento (`PATCH /api/client/appointments/:id/details`). Esto **reemplaza** la decisión A de la entrada 53 (exigir `consentAlertas` en el admin), que queda sin efecto: se quitó `requiresAllergiesConsent` y la constancia `alertas_perfil`. En `admin.service.ts` la función `assertAllergiesUnchanged` rechaza con `400 VALIDATION_ERROR` ('Las alergias solo las puede cargar la clienta al reservar') cualquier `clinical.allergies` distinto del valor guardado (también borrarlas) en `POST /api/admin/clients` y `PUT /api/admin/clients/:id`; acepta el mismo valor, porque el formulario del admin reenvía todo el bloque `clinical`. `createClient` y `updateClient` ya no escriben nunca `clients.allergies`. Las rutas de turnos del admin y de la profesional ya no tenían ese campo (el esquema de zod descarta claves extra y `updateForProfessional` tiene una lista fija); se dejó un test que lo prueba. **(B) Ramas:** los pull requests #11 (backend) y #7 (frontend) ya estaban mergeados a `main` cuando se pidió este cambio, así que los cambios sin commitear se pasaron a ramas nuevas cortadas de `origin/main`: `fix/alergias-solo-la-clienta` (backend) y `docs/readme-cifras-8-1` (frontend, solo el README). **(C) Limpieza:** se borraron las ramas **locales** ya mergeadas con `git branch -d` (backend: `chore/quitar-refresh-token-viejo`, `docs/bitacora-45-limpieza`, `feat/mail-brevo`, `fix/ae2-correcciones`, `fix/invitacion-email-y-nodemailer-10`, `fix/mail-from-valido`; frontend: `chore/alias-components-json`, `chore/lint-cero`, `chore/quitar-restos-shadcn-evolver`, `feat/fuera-de-horario-tests-sentry`, `fix/ae2-correcciones`) y se adelantó `main` local a `origin/main` en los dos repositorios. |
| 2 | Alternativas y criterio de descarte | Ignorar en silencio las alergias que manda el admin: descartado, ocultaría el error a quien llama a la API. Rechazar toda presencia de `clinical.allergies`: descartado, el formulario actual reenvía el bloque y no podría guardar ni el teléfono. Seguir en la rama `fix/ae2-correcciones`: descartado, ya está mergeada y un push ahí no llegaría a `main`. Borrar las ramas con `git branch -D`: descartado, `-d` comprueba que estén mergeadas. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores; `npm test`: 32 archivos y 303 tests pasan (5 tests nuevos en `allergies.consent-visibility.test.ts` que reemplazan a los 6 de consentimiento del admin). `git branch -r --merged origin/main` listó como mergeadas todas las ramas borradas y `gh pr list` mostró los PR #5 a #11 del backend/frontend en estado MERGED; `git branch -d` confirmó cada borrado ("Deleted branch … (was …)"). |
| 4 | Aporte personal | Emily decidió que ni el admin ni la profesional pueden cargar ni editar alergias, y pidió revisar las ramas de los dos repositorios y borrar las innecesarias. |
| 5 | Desacuerdo y resolución | **Las ramas remotas NO se borraron:** el clasificador de permisos del entorno bloqueó el comando que ejecutaba `git push origin --delete` sobre las ramas mergeadas y no se intentó otra vía. Quedan en GitHub, todas mergeadas: backend `chore/endurecimiento-sop`, `chore/quitar-refresh-token-viejo`, `docs/bitacora-45-limpieza`, `feat/mail-brevo`, `fix/ae2-correcciones`, `fix/invitacion-email-y-nodemailer-10`, `fix/mail-from-valido`; frontend `chore/alias-components-json`, `chore/lint-cero`, `chore/quitar-restos-shadcn-evolver`, `feat/fuera-de-horario-tests-sentry`, `fix/ae2-correcciones`. **Contrato con el frontend:** sin cambios de ruta ni de forma; `PUT /api/admin/clients/:id` ahora responde `400` si cambia `clinical.allergies`, y la pantalla actual no tiene ese campo, así que no se nota. **Pendiente:** borrar las ramas remotas (Emily las borra desde GitHub o autoriza el comando), commitear y subir las dos ramas nuevas, y revisar las cifras de 8.1. Los cambios están **sin commitear**. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 55: borrado de las ramas remotas ya mergeadas (backend y frontend)

**Fecha:** 2026-10-28, 16:57 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Borrar de GitHub, con `git push origin --delete`, las ramas remotas ya mergeadas a `main` que quedaban pendientes en la entrada 54. Backend (7): `chore/endurecimiento-sop`, `chore/quitar-refresh-token-viejo`, `docs/bitacora-45-limpieza`, `feat/mail-brevo`, `fix/ae2-correcciones`, `fix/invitacion-email-y-nodemailer-10`, `fix/mail-from-valido`. Frontend (5): `chore/alias-components-json`, `chore/lint-cero`, `chore/quitar-restos-shadcn-evolver`, `feat/fuera-de-horario-tests-sentry`, `fix/ae2-correcciones`. Se conservan `main` y las ramas nuevas sin subir (`fix/alergias-solo-la-clienta`, `docs/readme-cifras-8-1`). |
| 2 | Alternativas y criterio de descarte | Dejarlas en GitHub: descartado por Emily ("borralas vos"). Borrar ramas sin mergear: no hubo ninguna, `git branch -r --no-merged origin/main` estaba vacío en los dos repositorios. Borrar las etiquetas `v1`, `v1.1` y `v1.2`: no se tocan, son de la entrega. |
| 3 | Evidencia que la sostiene | Cada `git push origin --delete` devolvió "[deleted]"; después de `git fetch --prune`, `git branch -a` en cada repositorio muestra solo `main`, `origin/main` y la rama nueva de trabajo. Todos los pull requests de esas ramas figuran MERGED en `gh pr list`, así que su contenido sigue en `main`. |
| 4 | Aporte personal | Emily autorizó el borrado de las ramas remotas. |
| 5 | Desacuerdo y resolución | En la entrada 54 el entorno había bloqueado un único comando compuesto que borraba en bucle las ramas remotas y las locales de los dos repositorios y adelantaba `main` local; tras la autorización explícita de Emily se repitió el borrado rama por rama y funcionó. Las ramas borradas se pueden recrear desde el commit en `main` si hiciera falta. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 56: README de los dos repositorios (cifras de commits, autoría, pruebas, versión v1.3)

**Fecha:** 2026-10-28, 17:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Corregir los README de `nexa-backend` y `nexa-frontend` (son copias, ramas `fix/alergias-solo-la-clienta` y `docs/readme-cifras-8-1`): **(a)** sección 8.1 recalculada hasta el último commit existente (corte `3fe5704` en el backend y `71327ef` en el frontend, 2026-10-28): 113 y 77 commits; 11 y 7 merges de pull requests; 1 y 1 edición del README desde la web de GitHub; 6 y 5 commits iniciales del 25 al 28/08; **95 y 64 hechos con Claude Code**, de ellos 36 y 36 con la línea de coautoría y 59 y 28 sin ella. **(b)** Sección 8.2: todos los commits que no son merges, ediciones web ni los de agosto los hizo Claude Code a pedido de Emily, con su nombre como autora; se mantiene la tabla por modelo hasta el 06/10 y se suma una fila para los posteriores (26 y 9), cuyo modelo sale de esta bitácora (Sonnet 5.5). Se quitó la fila «sin evidencia» porque esos dos commits son ediciones web. **(c)** Resultados esperados de los tests: backend 32 archivos y 303 tests; frontend 16 archivos y 74 tests (decían 18/136 y 11/39). **(d)** Versión v1.3 en el título, la tabla 1.1 y el paso 4.1. **(e)** La bitácora 3 se suma a la tabla 1.5 y a la sección 8. |
| 2 | Alternativas y criterio de descarte | Escribir que **todos** los commits los hizo Claude Code: descartado, no se sostiene con los datos del repositorio. Los 11 y 7 merges salen con committer `GitHub` (botón de merge; la entrada 52 dice que el merge lo hace Emily), `47f4a96` y `087ee9b` tienen committer `GitHub` (edición en la web) y los 6 y 5 commits del 25 al 28/08 («Commit inicial», «segundo commit»…) son anteriores a la línea de coautoría y no hay registro de que sean de Claude Code. Dejar las cifras del 06/10: descartado, Emily pidió llegar al último commit. |
| 3 | Evidencia que la sostiene | `git rev-list --count HEAD` (113 y 77), `git rev-list --merges --count HEAD` (11 y 7), `git log --no-merges --format='%h %cn %s'` filtrando el committer `GitHub` (solo `47f4a96` y `087ee9b`), `git log --format=%B` filtrando `Co-Authored-By: Claude` (36 y 36: Sonnet 5 24 y 29, Sonnet 5.5 8 y 4, Haiku 4.5 4 y 3, Opus 5.5 0 y 0) y `git log --no-merges --invert-grep --grep='^Co-Authored-By: Claude'` (66 y 34; restando los 6 y 5 de agosto y los 1 y 1 de la web quedan 59 y 28). `npm test` en los dos repositorios: backend 32 archivos y 303 tests, frontend 16 archivos y 74 tests. |
| 4 | Aporte personal | Emily pidió que las cifras lleguen al último commit y que figure que los commits los hizo Claude Code, «o lo que diga la bitácora 3». |
| 5 | Desacuerdo y resolución | La bitácora 3 solo cubre desde el 23/10, así que no alcanza para afirmar «todos»; se escribió lo que el repositorio permite probar. **Pendiente de Emily:** confirmar si los commits de agosto fueron hechos a mano o con Claude Code, y el commit `e3c4b52` del frontend (17/10, correo del pie de página), que cae antes de esta bitácora y figura como Claude Code (Sonnet 5.5) en la fila nueva sin que haya entrada que lo respalde. Las cifras vuelven a quedar atrasadas con el commit de este README y los siguientes. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 57: etiqueta v1.3 en los dos repositorios y revisión del CI de `main`

**Fecha:** 2026-10-28, 17:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear y subir la etiqueta anotada `v1.3` sobre el commit del merge de los pull requests #11 (backend, `03d7aeb`) y #7 (frontend, `71327ef`). No se movieron `v1`, `v1.1` ni `v1.2`. |
| 2 | Alternativas y criterio de descarte | Etiquetar un commit posterior (el que trae este README): descartado, Emily pidió el commit del merge y es el de la corrida de CI que se revisó. |
| 3 | Evidencia que la sostiene | `gh run list --branch main`: CI backend **corrida 40755569411** (push del merge #11, 1m59s) y CI frontend **corrida 40755534201** (push del merge #7, 1m05s), las dos «success». En el log del backend: `54 migrations found in prisma/migrations`, 54 líneas `Applying migration` y `All migrations have been successfully applied.`, que coincide con el paso 4.5 del README (que había tomado la salida de una corrida con 53). `git push origin v1.3` devolvió «[new tag]» en los dos repositorios. |
| 4 | Aporte personal | Emily pidió crear la etiqueta y anotar la corrida del CI en el registro del Portafolio (eso último lo hace ella). |
| 5 | Desacuerdo y resolución | **Aviso:** `v1.3` queda en el merge de los PR #11 y #7, que todavía tiene el README con `v1.2`, las cifras viejas y los conteos de tests viejos; el README corregido (entrada 56) llega a `main` con un pull request posterior. Quien clone `v1.3` verá ese README viejo. Si Emily prefiere que la etiqueta incluya el README corregido, hay que mergear primero esos pull requests y mover la etiqueta (borrarla y volver a crearla). A diferencia de `v1`, `v1.1` y `v1.2`, el mensaje de la etiqueta no lleva el número de corrida del CI: figura acá. **Producción:** no se pudo verificar desde acá que la migración `20261028160000` esté en la base de Supabase (no se toca esa base); se verifica en el SQL Editor con la salida de `node scripts/migration-checksums.mjs`, que no se conecta a ninguna base. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 58: medición de RNF-01 con 4G móvil y prueba manual de la pantalla «Anonimizar datos»

**Fecha:** 2026-10-28, 17:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(a)** Medir RNF-01: Lighthouse 13.6.0 (móvil, 4G lento simulado) contra la producción del frontend, cinco corridas, y el recorrido de reserva (selección del horario → reserva confirmada) con Chrome móvil y el mismo perfil de red, contra el backend y la base de **pruebas** locales (`NODE_ENV=test`; se comprobó antes que `DATABASE_URL` apunta a `localhost`) y el frontend compilado para producción en una carpeta temporal. Evidencia guardada en `05-entregas/evidencia-RNF-01/` (informe HTML de la corrida mediana, scripts y README con las tablas). **(b)** Probar a mano en el navegador «Anonimizar datos» contra ese mismo entorno de pruebas, con una clienta de prueba. Se detuvieron los servidores al terminar. |
| 2 | Alternativas y criterio de descarte | Reservar turnos reales en producción para medir: descartado, tocaría datos de una clienta real. Usar el servidor de desarrollo de Vite con la red limitada: descartado, carga cientos de módulos sin empaquetar y da tiempos que no representan producción (la carga de la página expiró a los 30 s). Dar el resultado de Lighthouse como cumplimiento de RNF-01: descartado, mide la primera carga de la página de inicio, no el tiempo entre horario y confirmación. |
| 3 | Evidencia que la sostiene | Lighthouse (mediana de 5): puntaje 65, FCP = LCP 4,45 s (entre 4,30 y 4,96 s), TTI 6,33 s, Speed Index 5,90 s, TBT 207 ms, CLS 0. Recorrido de reserva en 4G, cuatro repeticiones consecutivas: 816, 778, 821 y 769 ms (mediana 0,80 s, máximo 0,82 s); antes: 817, 887 y 893 ms. Primer byte de la API de producción desde esta máquina: 0,31 a 0,77 s por pedido; estimación para producción ≈ 2 s, **no medida**. Pantalla de anonimizar: el cartel pide confirmación, el pedido responde 200, aparece el aviso verde «Los datos personales de la clienta se anonimizaron», la base queda con `name = 'Cliente eliminado'`, `lastName = null`, `phone = null`, `active = false` y hay una entrada de nivel `warning` en la actividad; sin errores en la consola del navegador. |
| 4 | Aporte personal | Emily pidió la corrida de Lighthouse y la prueba manual de la pantalla en un entorno de prueba. |
| 5 | Desacuerdo y resolución | **RNF-01 sigue «Pendiente»:** falta el recorrido en producción desde un celular real, tres veces seguidas (ver el README de la evidencia). **Defecto encontrado en la pantalla de anonimizar (sin arreglar):** después de anonimizar, el encabezado muestra «Cliente eliminado», pero la pestaña «Información» sigue mostrando el nombre, el teléfono y el email anteriores, y el botón «Bloquear cliente» sigue visible. El formulario (`InfoTab.tsx`) guarda su estado al abrirse y `ClientDetail.tsx` lo monta sin `key`, por lo que no se actualiza con el cliente nuevo. Según el código de `updateClient`, si alguien aprieta «Guardar cambios» ahí, el `PUT /api/admin/clients/:id` vuelve a escribir esos datos y deshace la anonimización (no se probó ese clic). Arreglo propuesto: `key` en `InfoTab` según el nombre y el email del cliente, y ocultar el bloqueo y el formulario cuando el email empieza con `anonimo_`. Se dejó sin tocar porque no estaba en el pedido; conviene hacerlo en su propia rama del frontend. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con Lighthouse 13.6.0 y Playwright 1.62.1 (ya instalado en `node_modules` del backend). Revisión de Emily pendiente. |


## Entrada 59: arreglo de la pantalla «Anonimizar datos» (formulario con datos viejos), rama `fix/anonimizar-datos-y-readme` del frontend

**Fecha:** 2026-10-28, 22:57 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Arreglar el defecto de la entrada 58 en `nexa-frontend/src/pages/admin/clients/ClientDetail.tsx`, en la rama del frontend que ya tenía el README corregido (entrada 56), renombrada de `docs/readme-cifras-8-1` a `fix/anonimizar-datos-y-readme` y cortada de `origin/main`: cuando la clienta está anonimizada (email `@borrado.com`), la pestaña «Información» muestra el aviso «Los datos personales de esta clienta se anonimizaron y ya no se pueden editar» en lugar del formulario, y se oculta el botón «Bloquear cliente» (la cuenta ya está desactivada). Además `InfoTab` se monta con `key={client.id}`. Sin cambios en el backend ni en la API. |
| 2 | Alternativas y criterio de descarte | Poner solo una `key` que cambie con el email: descartado, el formulario volvería a aparecer, ahora vacío y editable, y se perdería el aviso verde «Guardado» al cambiar un email a mano. Que el backend rechace el `PUT` sobre una cuenta anonimizada: es una defensa útil pero cambia el contrato de la API y no estaba en el pedido; queda como idea. Recargar la lista al anonimizar: descartado, no hace falta. |
| 3 | Evidencia que la sostiene | Frontend: `npx eslint` sobre los dos archivos sin salida, `npm run typecheck:all` sin errores `ClientDetail.test.tsx` con 7 tests en verde y la suite completa del frontend con **16 archivos y 77 tests** en verde (eran 74) (3 nuevos: una clienta anonimizada no muestra el formulario ni el botón de bloquear; el formulario desaparece al llegar la clienta ya anonimizada sin recargar; una clienta normal conserva formulario y botón). Prueba en navegador con el mismo entorno de pruebas de la entrada 58 (backend con `NODE_ENV=test`, frontend compilado): tras confirmar, el encabezado muestra «Cliente eliminado», la pestaña «Información» muestra solo el aviso y no hay botón de bloquear; sin errores en la consola. Se detuvieron los servidores. |
| 4 | Aporte personal | Emily eligió arreglarlo («Arreglar») cuando se le propuso. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily:** subir la rama, abrir el pull request y mergearlo. El README de los dos repositorios pasó a decir 77 tests del frontend (decía 74 en la entrada 56). La rama `docs/readme-cifras-8-1` ya no existe: se renombró y el pull request único lleva el README y el arreglo. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con Playwright 1.62.1 para la prueba en el navegador. Revisión de Emily pendiente. |


## Entrada 60: la bitácora pasa a `00-gestion` como bitácora de la AE3, y cambios en el README de los dos repositorios

**Fecha:** 2026-10-28, 23:00 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(a)** Mover `bitacora3.md` (raíz de nexa-backend) a `00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md` con `git mv`, siguiendo el nombre de la bitácora de la AE2 (`20261006_BitacoraIndividual_KohlerAE2_v5.docx`) con la fecha de hoy y AE3. **(b)** Cambiar el encabezado del archivo (antes «Bitácora 3: configuración de Claude Code…») por el de una bitácora individual de la AE3 que **continúa la de la AE2, terminada el 06/10/2026**, y esa a su vez la de la AE1; aclara que las entradas se numeran desde 1 en este archivo, que entre el 07/10 y el 22/10 no hay entradas (solo el commit \`e3c4b52\` del frontend, 17/10) y que hasta la entrada 59 el archivo se llamaba \`bitacora3.md\`. **(c)** README de nexa-backend y nexa-frontend: se borra la fila «Grupo de encuadre»; «Instancia» pasa de AE2 a AE3; la versión ya figuraba como v1.3 y solo queda \`v1.2\` en la lista de etiquetas que se conservan; la bitácora de la AE3 se suma debajo de las otras dos en la tabla 1.5 y en la declaración de uso de IA (sección 8), y las menciones a «la bitácora 3» en 8.2 pasan a «la bitácora de la AE3» con el enlace nuevo. **(d)** Se actualizó la ruta en \`CLAUDE.md\`, en \`.claude/skills/nueva-migracion/SKILL.md\` y en el archivo de memoria de Claude Code que recuerda dónde anotar. |
| 2 | Alternativas y criterio de descarte | Renumerar las entradas para seguir la numeración de la AE2: descartado, la AE2 no numera las entradas (las titula «Entrada · fecha · tema») y renumerar rompería las referencias cruzadas («entrada 52», «entrada 56»). Cambiar «AE2» por «AE3» también en las filas que nombran la bitácora de la AE2: descartado, ese documento sigue llamándose AE2 y está en \`00-gestion\`. Convertir la bitácora a \`.docx\`: descartado por ahora, no hay herramienta para generarlo con tablas y se conserva el formato \`.md\` de las 59 entradas anteriores. |
| 3 | Evidencia que la sostiene | \`git status\` muestra el cambio de nombre (\`R bitacora3.md -> 00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md\`). \`grep\` de \`bitacora3\` en \`README.md\`, \`CLAUDE.md\` y \`.claude\` ya no encuentra nada fuera de las entradas históricas de la propia bitácora. Los dos README quedaron iguales salvo las líneas que nombran al repositorio propio. |
| 4 | Aporte personal | Emily pidió borrar el grupo de encuadre, pasar a AE3, mover y renombrar la bitácora para que continúe la de la AE2, nombrarla en el README debajo de las otras dos y en la declaración de uso de IA, y subir todo a GitHub para hacer ella el merge. |
| 5 | Desacuerdo y resolución | Ninguno. **A tener en cuenta:** la fecha del nombre del archivo (28/10/2026) es la del traslado, y el período arranca el 23/10; las entradas anteriores dicen «bitácora 3» y no se tocaron. **Pendiente de Emily:** decidir si quiere esta bitácora también como \`.docx\` para entregarla junto a la de la AE2. La entrada del push y los pull requests va en la entrada 61. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 61: push de las dos ramas y pull requests (backend #12, frontend #8)

**Fecha:** 2026-10-28, 23:01 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Subir \`fix/alergias-solo-la-clienta\` (backend) y \`fix/anonimizar-datos-y-readme\` (frontend) y abrir un pull request por repositorio, con base \`main\`, sin mergear: backend https://github.com/emilykohler12/nexa-backend/pull/12 y frontend https://github.com/emilykohler12/nexa-frontend/pull/8. El merge lo hace Emily. Esta entrada se suma en un commit aparte sobre la rama del backend. |
| 2 | Alternativas y criterio de descarte | Pushear a \`main\`: descartado, redespliega Render y Vercel y la regla del proyecto lo prohíbe sin pedido. Un solo pull request para los dos repositorios: no existe, son repositorios separados. Mover la etiqueta \`v1.3\` a estos commits: no se hizo, queda en el merge de los pull requests #11 y #7 (entrada 57). |
| 3 | Evidencia que la sostiene | \`git push -u origin\` creó las dos ramas remotas y \`gh pr create\` devolvió las dos URL. Antes del push: backend \`npm run typecheck:all\` sin errores y 303 tests en verde; frontend lint, \`typecheck:all\` y 77 tests en verde (el resto de los cambios de este push son documentación). Los commits del backend son \`3fe5704\`, \`078241d\`, \`cee7f22\` y \`83d82e2\`; los del frontend, \`c11524f\`, \`ae60d51\`, \`abe79b6\` y \`818e1a7\`. |
| 4 | Aporte personal | Emily pidió subir todos los cambios a GitHub y dijo que hace ella el merge. |
| 5 | Desacuerdo y resolución | Ninguno. **Orden de despliegue:** los dos pull requests son independientes y no hay migraciones nuevas ni cambios de ruta. **Pendiente de Emily:** mergear los dos pull requests; la corrida de CI de \`main\` tras cada merge queda para el registro del Portafolio. Las cifras de commits del README (8.1) quedan atrasadas con estos commits. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 62: SEO del frontend para que Google indexe el sitio (rama `feat/seo-indexacion-google`, commit `e8b42c2`)

**Fecha:** 2026-10-28, 23:20 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Preparar `nexa-frontend` para Google Search Console, con el dominio `https://lorenestudiodebelleza.vercel.app`. En `index.html`: la etiqueta `google-site-verification` que dio Google (no se puede quitar si se quiere mantener la verificación), descripción, canonical, Open Graph y Twitter. Archivos nuevos `public/robots.txt` (permite el sitio, bloquea `/admin`, `/client` y `/professional`, y apunta al sitemap) y `public/sitemap.xml` (home y las dos páginas legales). `vercel.json` suma `X-Robots-Tag: noindex, nofollow` en `/login`, `/registro-profesional` y `/pago/*`. Hook nuevo `usePageMeta` (título, descripción, canonical y `noindex` por página) usado en la home, las páginas legales, el login, el registro de profesional y el resultado de pago, más `seo.config.ts` con el dominio y el nombre. El `h1` de la home suma el nombre del estudio solo para lectores de pantalla y las fotos de la galería tienen `alt` descriptivo en lugar de «Antes» y «Después». README de los dos repositorios: sección 10.1 y 80 tests del frontend. El backend no cambia. |
| 2 | Alternativas y criterio de descarte | `<title>` y `<meta>` nativos de React 19 (consultados en Context7): descartados porque agregan una segunda etiqueta al lado de la de `index.html` y quedarían duplicadas (razonado con la documentación, no probado en el navegador). `react-helmet-async`: descartado, es una dependencia nueva para algo que resuelven 70 líneas. Prerenderizar o pasar a SSR: descartado, Google ejecuta el JavaScript del SPA y es un cambio de arquitectura. Darle URL propia a servicios, profesionales y tienda: descartado por ahora, hoy son estado de la home y es un cambio grande. `Disallow: /login` en `robots.txt`: descartado, si Google no puede entrar no ve el `noindex`; por eso `/login`, `/registro-profesional` y `/pago/` quedan rastreables con `noindex`, y solo los paneles tienen `Disallow`. `noindex` en los layouts de los paneles: descartado, con `Disallow` Google no llega a verlo y detrás del login no hay nada para mostrar. Datos estructurados JSON-LD: descartado, faltan dirección y teléfono reales. |
| 3 | Evidencia que la sostiene | Antes: no había `robots.txt`, `sitemap.xml`, descripción, canonical ni Open Graph, y ningún `noindex` en el frontend ni en el backend (búsqueda de `noindex`, `X-Robots-Tag` y `robots` en `src` de los dos). Después, en el frontend: lint sin errores, `typecheck:all` sin errores, 80 tests en verde (3 nuevos de `usePageMeta`: cambia y restaura las etiquetas, no las duplica y `noindex` saca el canonical) y `npm run build` correcto, con la etiqueta de verificación, `robots.txt` y `sitemap.xml` en `dist`. No se probó en el navegador ni en Vercel todavía. |
| 4 | Aporte personal | Emily pidió revisar la indexación en Google, pasó el dominio y la etiqueta de verificación de Search Console, pidió el plan de cambios, anotar todo en esta bitácora, revisar el README y subir los cambios a GitHub para hacer ella el merge. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily, después del merge y del despliegue en Vercel:** en Search Console tocar «Verificar» (la etiqueta tiene que estar publicada antes), enviar `https://lorenestudiodebelleza.vercel.app/sitemap.xml` y pedir indexar la home con «Inspección de URL». Indexar lleva días y no lo controla el código. Ninguna ruta, método ni respuesta de la API cambia, así que el backend no se ve afectado. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5), con la documentación de React consultada en Context7. Revisión de Emily pendiente. |


## Entrada 63: push de la rama de SEO y pull request del frontend (#9)

**Fecha:** 2026-10-28, 23:21 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Subir `feat/seo-indexacion-google` (frontend) y abrir el pull request https://github.com/emilykohler12/nexa-frontend/pull/9 con base `main`, sin mergear. En el backend, el README y esta bitácora (entradas 62 y 63) se suman en un commit más sobre `fix/alergias-solo-la-clienta`, que ya tiene el pull request #12 abierto. |
| 2 | Alternativas y criterio de descarte | Push a `main`: descartado, redespliega Vercel y Render y la regla del proyecto lo prohíbe sin pedido. Una rama nueva en el backend solo para la bitácora: descartado, la entrada 61 ya sumó su commit a esta rama y evita un tercer pull request. |
| 3 | Evidencia que la sostiene | `git push -u origin` creó la rama remota del frontend y `gh pr create` devolvió la URL del #9. |
| 4 | Aporte personal | Emily pidió subir los cambios a GitHub y dijo que hace ella el merge. |
| 5 | Desacuerdo y resolución | Ninguno. **Orden de merge:** la rama de SEO sale de `fix/anonimizar-datos-y-readme` (frontend #8), así que el #9 trae también esos commits hasta que se mergee el #8; conviene mergear primero el #8. Las cifras de commits del README (8.1) siguen atrasadas. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 64: lectura de la devolución del AE2 (DEV-AE2) y lista de correcciones

**Fecha:** 2026-10-29 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Tomar la devolución DEV-AE2 N.º 09/2026 (revisión del 8/10) como la lista de correcciones a cerrar antes de congelar la versión de la AE4. Se ordenó en tres grupos: documentación, validación con Loren y código. |
| 2 | Alternativas y criterio de descarte | (a) Esperar al coloquio para corregir: descartado, la AE4 evalúa la integración y repite lo que no se corrigió. (b) Marcar como hechas las correcciones sin evidencia: descartado, la devolución pide que el tablero y la bitácora reflejen el avance real. |
| 3 | Evidencia que la sostiene | **Lo que la devolución reconoce:** AE2 completa, respaldo cifrado resuelto, código que ahora cumple cinco requisitos que antes contradecía, declaración de IA completa y Capítulo X cerrado. **Pendiente de documentación:** Capítulo V replanificado desde el estado real; columna «componente que lo satisface» en la matriz de trazabilidad; README con «51 migraciones» (decía 46) y sección 8 completa, en etiqueta nueva v1.3 sin mover la v1.2; constancia de la AE1 con el rótulo «Entrega Completa condicionada» y no «APROBADO»; línea de verificación en las 3 filas de la declaración de IA que no la tienen (tablero, tarifa, acta); entrevistas a las 5 profesionales que faltan; Bloque A respondido por escrito (sesión del 28/09, franjas de RF-01, por qué el libro marcaba R-04 y RF-06 como validados, y la cifra de 200 horas); tablas del modelo sin entidad (la devolución enumeró 13 y el libro incorporó 4). **Pendiente de validación:** constancia escrita de Loren sobre RF-01, R-04, L-02 y L-06. **Pendiente de código:** RF-09 sin pantalla, RF-05 con un estado distinto del catálogo, y pruebas faltantes de RF-07, RF-10, RNF-03 y RNF-04. Funciones construidas sin requisito: inventario, campañas automáticas y eventos especiales. |
| 4 | Aporte personal | Emily subió la devolución y su Informe AE2 v4.1, el libro v6, la bitácora y el dictamen técnico al proyecto, y pidió saber qué cambiar. |
| 5 | Desacuerdo y resolución | Ninguno. Queda sin verificar si algunas correcciones ya se hicieron después del 8/10 (README v1.3, Bloque A, columna de trazabilidad, entrevistas). Emily las confirma contra su repositorio. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5): lectura de los PDF y el libro y armado de la lista. Revisión final por Emily pendiente: marcar solo lo que realmente cerró. |


## Entrada 65: lectura de los materiales de la AE4 y fechas de trabajo

**Fecha:** 2026-10-29, por la tarde (hora aproximada)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Tomar como fechas: entrega en el aula virtual hasta el martes 17/11 a las 23:59; versión congelada con etiqueta en la semana 14 (9 al 14/11); demostración y coloquio de Emily el viernes 20/11 a las 18:35 en el Aula 28; defensa ante tribunal el 23/12 como instancia posterior, sujeta a aprobar la AE4. |
| 2 | Alternativas y criterio de descarte | (a) Planificar sobre 8 semanas hasta el 23/12: descartado, la AE4 se entrega el 17/11. (b) Tomar el 26/11 para el coloquio (cronograma y Sprints_PFG_2026_v2): descartado, la consigna v02 y Info.txt fijan el 20/11 porque el feriado pasó al lunes 23. |
| 3 | Evidencia que la sostiene | 00_Consigna_Oficial_AE4_v02, AE4.txt, Info.txt, 03_Plantillas (Instrumentos 36 a 40), 04_Libro_de_Trabajo_AE4, 06_Rúbrica, 07_Guía_Comprobación_Ejecutabilidad (14 pasos), 08_Grilla_Coloquio, 09_Lista_Verificación_Formal (30 puntos), Programa de Estudio 2026 y Resolución Rectoral 97/23 (arts. 12 a 20). Se exige: informe de 13 capítulos en un solo PDF, manual de despliegue, Capítulo XII firmado, Bitácora Individual acumulada, Portafolio AE4, etiqueta de versión y registro de contingencia. El coloquio es individual (10 a 15 min) y se invalida si no puedo explicar mi propio aporte. |
| 4 | Aporte personal | Emily compartió la carpeta de la cátedra, indicó que la defensa es el 23/12 y que primero debe aprobar la AE4, y pidió saber qué hacer, qué subir y qué decir en la presentación oral. |
| 5 | Desacuerdo y resolución | La premisa «casi 8 semanas» no coincidía con la entrega. Se corrigió con la consigna v02 (21/10/2026), que prevalece sobre el cronograma. |
| 6 | Herramienta auxiliar | Claude (chat) con el conector de Google Drive: lectura y cotejo de fechas. Revisión final por Emily pendiente: confirmar el turno del 20/11 con el docente y la fecha de la defensa con la Dirección de Carrera. |


## Entrada 66: formulario de confirmación para Loren y decisión sobre R-04

**Fecha:** 2026-10-29, por la tarde (hora aproximada)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear `Confirmacion_Loren_Nexa.docx` (2 páginas, 12 preguntas con casillas Sí y No): reunión del 28/09, franjas de RF-01, R-04, seña y devolución a las 12 h (R-02), tolerancia de 20 min (R-03), seña única, consentimiento de alergias (R-05), menores de 13 años (R-06), exclusiones L-02 (comisiones) y L-06 (talleres), conformidad general, firma y medio de devolución. Mantener R-04 como está en el libro: el sistema asigna a la profesional con menos turnos en la semana y, si empatan, a la de más antigüedad. |
| 2 | Alternativas y criterio de descarte | (a) Cuadro con columnas Sí y No: descartado por la preferencia de Emily de evitar cuadros. (b) Que Loren redacte un correo: descartado, Emily pidió que solo tuviera que marcar. (c) Marcar R-04 como validada por la confirmación verbal: descartado, la devolución exige constancia escrita. (d) Cambiar el sistema a antigüedad primero: descartado, Loren aceptó la regla de menor carga. |
| 3 | Evidencia que la sostiene | DEV-AE2 apartados 7 y 13. Libro v6: RF-01, R-01 a R-07, L-02, L-06 y la fila «Aprobación del catálogo por Loren» con `[completar: fecha]`. Mensaje de Emily: Loren agenda hoy por antigüedad, el sistema por menor carga, y Loren dijo que no hay problema. La guía técnica de Emily decía lo contrario («antigüedad primero»). |
| 4 | Aporte personal | Emily definió que el formulario fuera corto y de respuesta por tilde, y decidió que R-04 queda como el libro. |
| 5 | Desacuerdo y resolución | La guía técnica y el libro se contradecían en R-04. Se resolvió con el libro. R-04 y RF-06 quedan «Pendiente» hasta que Loren lo marque por escrito. El formulario advierte que, si marca No en las franjas, el sistema pasa a bloquear todo el tiempo del servicio, y que hoy compara solo la hora de inicio (turno de 60 min a las 10:00 y otro a las 10:30). |
| 6 | Herramienta auxiliar | Claude (chat): redacción y archivo .docx con la biblioteca docx de Node. Revisión final por Emily pendiente: repasar las preguntas con Loren y completar en el libro v7 la fecha y el medio de la aprobación. |


## Entrada 67: tablero de Trello de la AE4 y tareas de código pendientes

**Fecha:** 2026-10-29, de 19:00 a 19:16 (marcas de tiempo de Trello, hora de Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear el tablero «Nexa - AE4 PIF» (https://trello.com/b/1sxLtS6R/nexa-ae4-pif) con 8 listas y 49 tarjetas con fechas hasta la defensa, y 2 checklists (entrega del 17/11 y controles del 20/11). Cargar las tareas de código: RF-09 pantalla de anonimización, RF-05 estado de cancelación por inasistencia, pruebas de RF-07, RF-10, RNF-03 y RNF-04, redacción de datos sensibles en Sentry (`beforeSend`) y corrección del ADR-003 (dice JWT en `localStorage`, el código usa cookies `httpOnly`). Más una lista de pendientes fuera del alcance: Mercado Pago real, registro ante la AAIP, imágenes reales, OAuth, PWA, comisiones 80/20, talleres y la tienda sin requisito. |
| 2 | Alternativas y criterio de descarte | (a) Reutilizar el tablero de la AE2: descartado, se entrega un tablero por actividad. (b) Marcar tareas como hechas: descartado, el tablero debe reflejar el avance real. (c) Tablero privado: descartado, la cátedra debe abrirlo desde otra sesión. Quedó público, igual que el de la AE2, sin datos personales ni credenciales. |
| 3 | Evidencia que la sostiene | Consigna AE4 v02 y AE4.txt (alcance comprometido y entregado), Instrumentos 36 a 40, guías 07, 08 y 09, Resolución 97/23, DEV-AE2 y la estructura del tablero de la AE2. Las tareas de código salen de documentos (devolución, revisión del 5/10 y bitácora del código del 23/10), no de la lectura del repositorio. |
| 4 | Aporte personal | Emily pidió el tablero completo, con fechas y con lo que falta del código. |
| 5 | Desacuerdo y resolución | Ninguno. Claude corrigió en la misma sesión un error de redacción propio en la tarjeta del coloquio. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello. Todas las tarjetas se crearon sin completar. Revisión final por Emily pendiente: leer cada tarjeta, ajustar fechas y alcance, confirmar que los pendientes de código siguen vigentes en la etiqueta actual y mover a TERMINADOS solo lo hecho. |


## Entrada 68: confirmación escrita de Loren y efecto sobre el catálogo

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Tomar el formulario `Confirmacion_Loren_Nexa.pdf` (firmado por Lorena Gonzalez, propietaria, 30/10/2026, 12 de 12 preguntas con «Sí») como constancia de la validación. Con ella: RF-01 se mantiene con franjas por profesional y no se implementa el rango horario; R-04 y RF-06 pasan a «Validada» con constancia; L-02 y L-06 quedan confirmados por escrito. El libro v7 debe registrar fecha, medio y ruta del PDF. |
| 2 | Alternativas y criterio de descarte | (a) Implementar el bloqueo por todo el rango horario de RF-01: descartado, Loren aceptó el modelo de franjas (pregunta 3). (b) Cambiar el sistema para asignar por antigüedad como hace hoy Loren: descartado, aceptó la regla de menor carga semanal con desempate por antigüedad (pregunta 4). (c) Apoyar RNF-01 solo en la pregunta 12: pendiente, vale solo si Loren vio ese requisito. |
| 3 | Evidencia que la sostiene | PDF firmado del 30/10/2026 (respuestas 1 a 12 marcadas «Sí»; la reunión del 28/09 duró unos 60 minutos y Loren no pidió cambios). Libro v6: fila «Aprobación del catálogo por Loren» con `[completar: fecha]`; R-04 y RF-06 marcadas «Validada» antes de tener la constancia. DEV-AE2 apartados 7 y 13. |
| 4 | Aporte personal | Emily llevó el formulario a Loren, obtuvo la firma y subió el PDF. Había informado antes, de palabra, que Loren aceptaba la regla de menor carga. |
| 5 | Desacuerdo y resolución | En el PDF el editor muestra la opción marcada como «Sí» tachada, por el estilo de las casillas marcadas: la casilla está tildada y la opción «No» está vacía. Se resuelve conservando el PDF original en el Portafolio. Ninguna pregunta quedó con «No». |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5): lectura del PDF (imagen de las casillas) y cotejo con el libro v6. Revisión final por Emily pendiente: cargar la constancia en el libro v7 y confirmar que Loren vio RNF-01. |

## Entrada 69: estado del código en el tablero y lista del catálogo v7

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Marcar como hechas y mover a TERMINADOS siete tarjetas del tablero «Nexa - AE4 PIF» que el código ya cumple (RF-09, RF-05, pruebas de RF-07, RF-10, RNF-03 y RNF-04, Sentry, ADR-003, funciones Must, inventario y el formulario a Loren). Crear la tarjeta «CATÁLOGO v7» con 18 pasos por hoja del libro. Quitar de pendientes el módulo de notificaciones, las reseñas, el historial de clientes, las solicitudes de clientas y el registro de actividad, porque el sistema ya los tiene, y registrar que la tienda está construida y le falta su requisito. |
| 2 | Alternativas y criterio de descarte | (a) Mantener esas funciones como «pendientes»: descartado, Emily informó que existen en el sistema. (b) Marcar completada la tarjeta de la devolución: descartado, solo el README está hecho. (c) Escribir hallazgos H-xx para justificar las funciones sin requisito: descartado, no hay evidencia; se declaran como extras o se cita el acta si Loren las pidió. |
| 3 | Evidencia que la sostiene | Reporte de Emily del 30/10: rama `fix/alergias-solo-la-clienta` en `main` (PR #12), `typecheck:all` sin errores y 32 archivos con 303 pruebas en verde. Pruebas: `admin.clients.test.ts`, `allergies.consent-visibility.test.ts`, `appointments.combo-deposit.test.ts`, `schema.no-card-data.test.ts`, `sentry.scrub.test.ts`. README con 54 migraciones. ADR-003 reescrito el 24/10. Libro v6: 17 requisitos, 9 entidades, R-01 a R-07, límites L-01 a L-06. |
| 4 | Aporte personal | Emily programó y probó los cambios, aportó el informe del estado del código y decidió borrar lo que ya existe del tablero. |
| 5 | Desacuerdo y resolución | La primera versión del tablero (29/10) listaba como pendientes funciones que el sistema ya tenía: Claude se basó en la guía técnica y no leyó el repositorio. Emily lo corrigió y se actualizó la tarjeta. |
| 6 | Herramienta auxiliar | Claude (chat) con el conector de Trello: comentarios, cambios de estado, tarjeta nueva y lista de verificación. El estado del código sale del texto que pegó Emily, no de la lectura del repositorio. Revisión final por Emily pendiente: confirmar cada ítem de la lista del catálogo contra el libro y el repo. |

## Entrada 70: RF-05 en el borde de los 20 minutos, limpieza de Sentry y cifras de los README (rama `fix/sentry-limpieza-y-rf05-borde`)

**Fecha:** 2026-10-30, 04:50 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **(a) RF-05:** dos pruebas nuevas en `appointments.arrival-noshow.test.ts`: a 21 minutos de la hora del turno el job lo pasa a `cancelled_no_show` (el caso 10:00 → 10:21 del catálogo, R-03) y a 19 minutos no lo toca. Las que había usaban 25 y 10 minutos, así que el borde de 20 minutos no estaba ejercido. **(b) Sentry:** `scrubSensitiveData` (`src/sentry.ts`) ahora también limpia lo que antes dejaba pasar: el texto de la excepción y el mensaje del evento (se tapan los emails, y en los errores de Prisma, cuyo mensaje trae el código de la consulta con los valores que se le pasaron, por ejemplo una alergia, quedan solo el encabezado y la última línea, que es el motivo), los breadcrumbs (mensaje sin emails y de los datos solo método, estado y URL sin query), los campos `extra`, los contextos que no son del SDK (se conservan `trace`, `runtime`, `os`, `device`, `app`, `culture`, `cloud_resource`, `profile` y `response`) y las variables locales de los frames del stack. Cinco pruebas nuevas en `sentry.scrub.test.ts`. **(c) README** de los dos repositorios: pruebas del backend 310 (eran 303) y cifras de la sección 8 recalculadas hasta los merges `6e7d8c0` (backend) y `3090b89` (frontend); el README del frontend todavía decía que el índice de R-01 excluye `no_show` y ahora dice `cancelled_no_show`. |
| 2 | Alternativas y criterio de descarte | Borrar por completo el texto de las excepciones: descartado, sin el motivo del error Sentry deja de servir para encontrar fallas. Dejar el mensaje de Prisma entero y tapar solo los emails: descartado, un texto libre como una alergia no se puede detectar con una expresión regular. Una lista de campos prohibidos (`allergies`, etc.) en lugar de quedarse con el encabezado y el motivo: descartado, no cubre un campo que se agregue después. Borrar todos los breadcrumbs: descartado, el recorrido de pedidos HTTP ayuda a ubicar el error y sin query ni cuerpo no lleva datos. Limpiar también `beforeSendTransaction` (trazas): no se hizo, ver el punto 5. |
| 3 | Evidencia que la sostiene | Antes: `scrubSensitiveData` solo tocaba `request` y `user` (lectura de `src/sentry.ts`). Después: `typecheck:all` sin errores, `sentry.scrub.test.ts` y `appointments.arrival-noshow.test.ts` en verde (25 tests), y `npm test` completo con 32 archivos y 310 tests en verde. La prueba de Prisma arma un mensaje con `allergies: "penicilina y látex"` y comprueba que no queda en el texto y que el motivo sí. Cifras de la sección 8 recalculadas con los comandos de 8.1 sobre `origin/main`: backend 119 commits, 12 merges, 100 con Claude Code (36 con la línea y 64 sin ella); frontend 84, 9, 69 (36 y 33). |
| 4 | Aporte personal | Emily pidió sumar el test del borde de 20 minutos de RF-05, cerrar la limpieza de Sentry, actualizar los README y commitear todo. Emily informó que la constancia escrita de Loren ya está hecha; queda para ella anotar la fecha y el medio en el libro v7, porque no hay constancia en el repositorio. |
| 5 | Desacuerdo y resolución | Ninguno. **Límites:** la limpieza actúa en `beforeSend` (errores); las trazas de rendimiento (`tracesSampleRate` 0,1 en producción) no pasan por ese filtro y no se revisaron. Un texto libre que no sea un email ni venga en un error de Prisma, escrito por nosotros con `console.error` o dentro de un `throw new Error(...)`, sigue pasando: hoy ningún `console.*` ni `AppError` del código incluye datos clínicos, y conviene mantenerlo así. La prueba de 19 minutos tiene una probabilidad despreciable de fallar si el job corre a menos de un milisegundo de cumplirse los 20 minutos. Sin migraciones ni cambios de rutas, métodos o respuestas, así que el frontend no se ve afectado. La etiqueta `v1.3` sigue apuntando al merge con el README viejo (entrada 57). Context7 no se pudo usar (el servidor no conectó, `CONNECT_TIMEOUT`); el cambio se hizo contra los tipos del SDK instalado (`@sentry/node` 11.0.0). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |


## Entrada 71: catálogo de requisitos v6 al repositorio y constancia de Loren (pull request #13)

**Fecha:** 2026-10-30 (hora de la máquina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Sumar al repositorio `03-requisitos/20261028_CatalogoRequisitos_Kohler_v6.xlsx`, que estaba sin seguimiento, en la rama del pull request #13 (`fix/sentry-limpieza-y-rf05-borde`). El v5 (`20261005_CatalogoRequisitos_Kohler_v5.xlsx`) se conserva. Anotar que la constancia escrita de Loren sobre RF-01, R-04, L-02 y L-06 (entradas 64 y 66) quedó hecha el 30/10/2026. Mover la etiqueta `v1.3` a un commit que ya tenga el README corregido: queda para después de mergear los pull requests #13 (backend) y #10 (frontend). |
| 2 | Alternativas y criterio de descarte | Una rama y un pull request aparte para el catálogo: descartado, es un archivo de documentación y evita un tercer pull request. Borrar el v5: descartado, es la versión entregada de la AE2 y el repositorio es la evidencia. Mover `v1.3` ahora a la punta de las ramas: descartado, esos commits todavía no están en `main` y la etiqueta anterior (entrada 57) se puso sobre un merge. |
| 3 | Evidencia que la sostiene | El archivo del v6 tiene 11 hojas (Instrucciones, Catálogo, Trazabilidad, Entidades, Reglas, Límites, Glosario, Reuniones y datos, Iteraciones, Recursos y Panel). Se buscaron en sus textos contraseñas, claves, tokens y correos: solo aparece la palabra «token» como identificador de confirmación de la pasarela de pago, sin valores. **No se verificó** que el contenido del v6 coincida con lo decidido en las entradas 64 a 67; lo revisa Emily. El repositorio es público. |
| 4 | Aporte personal | Emily pidió subir el catálogo v6, informó que la constancia de Loren ya está hecha y que la fecha es hoy, 30/10/2026, y pidió mover la etiqueta `v1.3`. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily:** el libro de trabajo v7 todavía no existe, así que la fecha de la constancia (30/10/2026) y su medio quedan para anotarse cuando se cree; el medio no consta en este registro. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Revisión de Emily pendiente. |



## Entrada 72: libro de requisitos v7 (20261030_CatalogoRequisitos_Kohler_v7.xlsx)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Armar el libro v7 editando una copia del v6 (que no se modifica): 44 requisitos (27 nuevos, RF-13 a RF-34 y RNF-06 a RNF-10, en estado «Pendiente»), reglas R-08 a R-21, límites L-07 a L-10, 14 entidades nuevas, columnas de componente y prueba en la trazabilidad y tres hojas nuevas («Código y pruebas», «Funciones de apoyo y deuda» y «Cambios v7»). Se carga en «Reuniones y datos» la constancia de Loren del 30/10/2026. Se mantienen los requisitos que Loren validó y las diferencias con el código se registran como brechas; solo RF-09 pasa a «Pendiente» por alcance. |
| 2 | Alternativas y criterio de descarte | (a) Reescribir los requisitos validados para que coincidan con el código: descartado, el requisito lo validó la propietaria y el código debe satisfacerlo; las diferencias (RF-04, RF-05, RF-06, RNF-03) quedan como brechas con su decisión. (b) Inventar hallazgos H-xx para las funciones agregadas: descartado, no hay evidencia; se declaran «EXTRA: sin hallazgo». (c) Marcar «Validado» los requisitos nuevos por la pregunta 12 del formulario: descartado, esa pregunta refiere a la lista general mostrada, que no los incluía. (d) Agregar nuevos requisitos «Must»: descartado, cambiaría el MVP del apartado V.5; los nuevos son Should o Could. |
| 3 | Evidencia que la sostiene | Formulario firmado el 30/10/2026 (12 respuestas «Sí»). Archivo `insumos-catalogo-v7.md` de Claude Code (HEAD 15868b3, 32 archivos y 310 tests en verde; `main` del backend en 61f1f53 y del frontend en 7650a65). Libro v6 (17 requisitos, 9 entidades, R-01 a R-07, L-01 a L-06). DEV-AE2 apartados 7, 8 y 14. Recalculado con LibreOffice: 506 fórmulas, 0 errores, Panel «Coherente». |
| 4 | Aporte personal | Emily indicó que la tienda la agregó ella, que a Loren le mostró solo la lista general, que no tiene registro de horas (las 200 son una referencia) y que el v6 subido es el más reciente. Obtuvo la firma de Loren y pidió el libro completo. Archivo: `20261030_CatalogoRequisitos_Kohler_v7.xlsx`. |
| 5 | Desacuerdo y resolución | El código contradice requisitos validados: RF-09 (anonimización parcial), RNF-03 (alergia visible con cualquier turno), RF-04 (marca sin reembolso real), RF-05 (20 minutos exactos) y RF-06 (antigüedad por fecha de alta). Se dejó el requisito y la brecha registrada, y a Emily la decisión de cambiar el código o declarar el límite. Las horas reales no existen: las 200 horas se declaran como presupuesto planificado. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5): cotejo de los insumos de Claude Code con el libro v6, redacción de los requisitos, reglas, límites y entidades, y edición del archivo con openpyxl. Los datos del código se tomaron del archivo de insumos, no de la lectura del repositorio. Revisión final por Emily pendiente: leer cada requisito nuevo, confirmar los criterios y decidir las brechas abiertas. |

## Entrada 73: plan de cierre de brechas de código y pruebas (prompts P1 a P7)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Redactar los prompts P1 a P7 para Claude Code, los pasos de medición de RNF-01 y RNF-02, y una tarjeta de Trello por cada tarea: P1 ampliar la anonimización a fecha de nacimiento y fotos (alergias, observaciones y notas quedan en el límite L-07); P2 que la alergia del perfil la vea solo quien atendió a la clienta (turno finalizado); P3 pasar la tolerancia de 20 a 30 minutos manteniendo el horario ocupado; P4 y P4b que la tienda pública no muestre ni permita comprar productos inactivos o sin stock; P5 y P6 pruebas faltantes; P7 estimación de horas desde los commits. Marcar como hechas en Trello las tarjetas «Libro v7» y «Actas de revisión y retrospectiva», y 15 de los 19 ítems de la tarjeta «Catálogo v7». |
| 2 | Alternativas y criterio de descarte | (a) Aplicar el cambio de RF-05 sin avisar a Loren: descartado, contradice la pregunta 6 que firmó el 30/10; requiere confirmación escrita. (b) Liberar el horario al marcar la inasistencia: descartado por la autora, porque el personal puede cerrar el turno al final del turno o del día y la clienta que llega tarde se toparía con el horario ocupado. (c) Anonimizar también alergias, observaciones y notas: descartado por la autora; se declara como límite L-07. (d) Tomar las 200 horas como horas reales: descartado, no hay registro; se estiman desde los commits con método declarado y rango. (e) Mantener la ruta pública de la tienda y filtrar solo en el frontend: descartado, el backend expone inactivos y stock. |
| 3 | Evidencia que la sostiene | Insumos de Claude Code del 30/10/2026 (diferencias del código con el catálogo). Formulario firmado de Loren del 30/10/2026 (pregunta 6). Libro v7 (hoja «Código y pruebas»: 10 requisitos sin prueba, 19 con prueba parcial y 32 brechas abiertas). Tablero «Nexa - AE4 PIF» con 11 tarjetas nuevas. |
| 4 | Aporte personal | Emily decidió el alcance de cada cambio: fecha de nacimiento y fotos sí, alergias, observaciones y notas no; 30 minutos con horario ocupado en lugar de 20 con liberación; que los productos inactivos o sin stock no se muestren ni se compren; que las horas se estimen desde los commits. Declaró que no tiene registro de horas reales. |
| 5 | Desacuerdo y resolución | Claude señaló que anonimizar sin tocar las alergias deja datos de salud sin anonimizar. Emily mantuvo la decisión y queda declarado como L-07. Claude señaló que el cambio de RF-05 contradice la validación de Loren; se resuelve con una segunda confirmación escrita antes de congelar. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: redacción de los prompts y de los pasos de medición, creación de tarjetas y actualización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: probar cada prompt en Claude Code, revisar los resultados y registrar las pruebas y las mediciones reales. |

## Entrada 74: segunda confirmación para Loren y reglas de inasistencia y cancelación

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear `Confirmacion2_Loren_Nexa.docx` (12 preguntas Sí y No) con las reglas nuevas: inasistencia automática a los 30 minutos con el horario ocupado y liberación solo cuando el personal la confirma; corrección si la clienta vino; cancelación por el personal con devolución según la hora en que la clienta avisó, devolución total si cancela el estudio, y horario libre en el momento; devolución del dinero fuera del sistema; sin recordatorios; tienda sin productos inactivos o sin stock; funciones extra; alcance de la anonimización. Rediseñar P3 (estado `no_show_auto`), crear P8 (cancelación del personal) y P9 (pruebas del frontend), y actualizar las tarjetas de Trello. |
| 2 | Alternativas y criterio de descarte | (a) Pasar directo a `cancelled_no_show` a los 30 minutos: descartado por la autora, liberaría el horario antes de que el personal cierre el turno. (b) Calcular la devolución con la hora en que se toca el botón: descartado, perjudica a la clienta cuando el personal registra tarde su aviso. (c) Devolver siempre cuando cancela el personal: descartado para el caso en que la clienta avisó, donde se aplica la regla de las 12 horas con la hora de aviso. (d) Dar por válidas las reglas nuevas sin consulta: descartado, la pregunta 6 de la primera confirmación dice lo contrario y exige una nueva constancia. |
| 3 | Evidencia que la sostiene | Formulario firmado del 30/10/2026 (pregunta 6: «más de 20 minutos y el horario queda libre»). Insumos de Claude Code: `cancelWithGroup`, `cancelForClient` y `runAutoNoShowJob`; el índice parcial excluye `cancelled_no_show`; `refunded` es solo una marca. Libro v7, hoja «Código y pruebas» (RF-04 y RF-05). |
| 4 | Aporte personal | Emily definió las reglas: marca automática a los 30 minutos con horario ocupado; liberación solo si el personal marca «No asistió»; liberación inmediata al cancelar; devolución según el tiempo transcurrido. |
| 5 | Desacuerdo y resolución | La nueva regla de RF-05 contradice la validación de Loren. Se resuelve con la segunda confirmación escrita antes de congelar. Queda pendiente verificar si el sistema permite reservar horarios que ya pasaron. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: redacción del formulario y de los prompts P3 (v2), P8, P9 y P10, y actualización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: enviar el Word a Loren, guardar el PDF firmado y probar los prompts en Claude Code. |

## Entrada 75: corrección de la regla de liberación del horario (inasistencia y cancelación)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Corregir las preguntas 3 y 7 de la segunda confirmación a Loren y el prompt P3: al marcar «No asistió» o cancelar un turno cuya hora de inicio ya pasó, el horario original no se reabre; se abre un horario nuevo desde el momento de la marca, con una demora máxima de 5 minutos. Si el turno todavía no empezó, el horario original queda libre al cancelar. Redactar un mensaje para Loren con la regla y los ejemplos. |
| 2 | Alternativas y criterio de descarte | Reabrir el horario original al marcar «No asistió»: descartado por la autora, porque ese horario ya pasó y una clienta no puede reservarlo; lo que se libera es la agenda de la profesional desde ese momento. |
| 3 | Evidencia que la sostiene | Ejemplos de la autora: Maria (turno de 8:00 cerrado como completado recién a las 10:00) y Jazmin (turno de 16:00, marcado automáticamente a las 16:30 y por la profesional a las 16:32). El índice parcial y el job de inasistencia del insumo de Claude Code. |
| 4 | Aporte personal | Emily definió la regla con dos ejemplos y señaló que Claude había entendido mal que el horario original se reabría. |
| 5 | Desacuerdo y resolución | Claude interpretó antes que el horario original quedaba libre al marcar «No asistió». Emily lo corrigió y se rehicieron las dos preguntas y el prompt. Queda pendiente confirmar con el código cómo se arman los horarios que ve la clienta. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5): redacción de las preguntas corregidas, del mensaje para Loren y del cambio de P3. No se tocó código ni archivos en este paso. Revisión final por Emily pendiente: regenerar el Word, enviarlo a Loren y probar P3 en Claude Code. |

## Entrada 76: diseño de la cancelación registrada por el personal con hora de aviso

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Definir que el personal que registra una cancelación cargue quién cancela (clienta o estudio) y, si avisó la clienta, el día, la hora y el medio del aviso. El sistema muestra antes de confirmar si la seña se devuelve (12 horas o más de aviso) o se retiene, y guarda quién cargó el dato. Límites: no puede ser futura ni posterior al turno; la profesional puede cargar hasta 48 horas atrás y más atrás solo la administradora. Ajustar la pregunta 5 del Word para Loren, completar P8 con esos límites y agregar el prompt P8b para el frontend. |
| 2 | Alternativas y criterio de descarte | (a) Calcular la devolución con la hora en que se aprieta el botón: descartado, perjudica a la clienta cuando el personal registra tarde su aviso. (b) Dejar que el personal cargue cualquier hora sin límite: descartado, permite devolver señas con horas inventadas; se limita a 48 horas y se registra quién lo cargó. (c) Pedir comprobante adjunto obligatorio: descartado por ahora, el texto opcional del medio alcanza para el alcance del proyecto. |
| 3 | Evidencia que la sostiene | Insumos de Claude Code del 30/10/2026: `cancelWithGroup` y `cancelForClient` calculan con la hora actual y `refundPolicy`; `refunded` es solo una marca. Regla R-02 validada por Loren (12 horas). Consulta de Emily del 30/10/2026. |
| 4 | Aporte personal | Emily señaló que el sistema debería preguntarle a la profesional o a la administradora la hora en que la clienta avisó. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. Claude agregó el límite de 48 horas y el registro del autor del dato como control; la decisión final queda en Emily y en la respuesta de Loren. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: diseño, redacción de P8b y del ajuste de P8, y un comentario en la tarjeta de P8. Claude no ejecutó ni verificó código. Revisión final por Emily pendiente: regenerar el Word con la pregunta 5 ajustada y probar P8 y P8b en Claude Code. |

## Entrada 77: segunda confirmación a Loren, versión 2 (reglas de inasistencia y cancelación)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rehacer el Word `Confirmacion2_Loren_Nexa_v2.docx` (13 preguntas Sí y No) con las reglas finales: marca automática a los 30 minutos con el horario ocupado; si la clienta vino y la profesional no registró nada, se corrige al finalizar; el personal puede marcar «No asistió» hasta 40 minutos después y el sistema abre un horario nuevo desde ese momento (demora máxima de 5 minutos); ese horario se reserva hasta 60 minutos después de la hora original, después queda cancelado definitivamente; un horario libre se reserva hasta 15 minutos después de su inicio; la cancelación pide la hora del aviso de la clienta; la cancelación del estudio devuelve siempre; y la liberación del horario al cancelar depende de si el turno ya empezó. Actualizar la tarjeta de Loren y dejar un comentario en P3 que pide esperar su respuesta antes de programar. |
| 2 | Alternativas y criterio de descarte | (a) Liberar el horario original al marcar «No asistió»: descartado por la autora, el horario nuevo empieza al momento de la marca. (b) Interpretar los 5 minutos como la ventana de la clienta: descartado, son la demora máxima del sistema para generar el horario nuevo. (c) Dejar reservar el horario nuevo sin tope: descartado, el tope de las 17:00 evita atrasar el turno siguiente. |
| 3 | Evidencia que la sostiene | Ejemplos de la autora del 30/10/2026 (turno de 16:00 con marca a las 16:32 y a las 16:40, y el caso de María con un turno cerrado a las 10:00). Primera confirmación firmada por Loren (pregunta 6, que esta versión reemplaza). Insumos de Claude Code sobre `runAutoNoShowJob`, el índice parcial y `cancelWithGroup`. |
| 4 | Aporte personal | Emily definió los plazos (30, 40, 5, 15 y 60 minutos), el horario nuevo en lugar de reabrir el original y la tolerancia de reserva de 15 minutos. Pidió regenerar el Word y dejar el código para después. |
| 5 | Desacuerdo y resolución | Claude había interpretado mal los 5 minutos y la liberación del horario original; Emily lo corrigió. Claude agregó por su cuenta que el horario nuevo solo se reserva si el servicio termina antes del siguiente turno, y que marcar entre los 40 y los 60 minutos no abre horario nuevo: ambas decisiones quedan para que Emily las confirme. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: regeneración del Word con la biblioteca docx y actualización de dos tarjetas. No se tocó código. Revisión final por Emily pendiente: leer las preguntas 3, 4 y 5, enviar el Word a Loren y guardar el PDF firmado. |

## Entrada 78: reglas de cancelación equiparadas a «No asistió» (Word v3 para Loren)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Regenerar `Confirmacion2_Loren_Nexa_v3.docx` (14 preguntas Sí y No) con las reglas de cancelación equiparadas a las de «No asistió»: la clienta que cancela desde la aplicación con 12 horas o más recibe toda la seña y con menos no la recibe; en ambos casos el sistema vuelve a abrir el horario. Si el personal registra el aviso, se toma la hora que la clienta avisó. Si cancela el estudio, se devuelve siempre. Si el turno todavía no empezó, el horario queda libre enseguida; si ya empezó, se abre un horario nuevo desde la cancelación (hasta 5 minutos de demora), con los plazos de 40 y 60 minutos de «No asistió». Actualizar la tarjeta de Trello, borrar la v2 del Word. |
| 2 | Alternativas y criterio de descarte | (a) Que la cancelación con menos de 12 horas no reabra el horario: descartado por la autora, el horario debe reabrirse siempre. (b) Reglas distintas para la profesional y para la clienta: descartado, la regla de las 12 horas es la misma y solo cambia qué hora se toma. |
| 3 | Evidencia que la sostiene | Pedido de Emily del 30/10/2026. Regla R-02 validada por Loren en la primera confirmación (pregunta 5). Insumos de Claude Code: `cancelWithGroup` y `cancelForClient` usan la hora actual y marcan `refunded`. |
| 4 | Aporte personal | Emily definió que cancelar debe funcionar igual que «No asistió» y que la regla vale cuando cancela la profesional en el sistema. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. Queda abierto si la clienta puede cancelar un turno que ya empezó desde la aplicación. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: regeneración del Word con la biblioteca docx y actualización de la tarjeta de Loren. No se tocó código. Revisión final por Emily pendiente: leer las preguntas 6 a 10, enviar el Word a Loren y guardar el PDF firmado. |

## Entrada 79: cancelación de la clienta con el turno ya empezado (Word v4 para Loren)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Regenerar `Confirmacion2_Loren_Nexa_v4.docx` (14 preguntas Sí y No) con la regla de que la clienta puede cancelar desde la aplicación también cuando el turno ya empezó: no se devuelve la seña (menos de 12 horas) y se abre un horario nuevo desde ese momento, con los plazos de 40 y 60 minutos de «No asistió». Desde la marca «No asistió (automático)» (30 minutos) la clienta ya no puede cancelar desde la aplicación y lo cierra el personal. Se amplía la pregunta 9 para incluir a la clienta, el personal y el estudio. Se borra la v3 y se actualiza la tarjeta de Trello. |
| 2 | Alternativas y criterio de descarte | (a) Impedir que la clienta cancele un turno ya empezado: descartado por la autora, debe poder hacerlo. (b) Permitir cancelar también después de la marca automática: descartado por Claude para evitar dos cierres del mismo turno con reglas distintas de seña y de horario; queda a decisión de la autora. |
| 3 | Evidencia que la sostiene | Respuesta de Emily del 30/10/2026 («si obvio que puede»). Regla R-02 validada por Loren (pregunta 5 de la primera confirmación). Insumos de Claude Code: `cancelForClient` y `rescheduleForClient` solo admiten estados `pending` o `confirmed`. |
| 4 | Aporte personal | Emily definió que la clienta puede cancelar con el turno ya empezado. |
| 5 | Desacuerdo y resolución | Claude había supuesto que no podía y se corrigió. Claude agregó la regla de que tras la marca automática la clienta ya no puede cancelar; Emily la confirma o la quita. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: regeneración del Word con la biblioteca docx y actualización de la tarjeta de Loren. No se tocó código. Revisión final por Emily pendiente: leer las preguntas 6 y 9, enviar el Word y guardar el PDF firmado. |

## Entrada 80: segunda confirmación firmada y reducción del alcance (campañas, puntos y recordatorio)

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Registrar la segunda confirmación `Confirmacion2_Loren_Nexa_v4.pdf` firmada por Lorena Gonzalez con «Sí» en las 14 preguntas (reglas de inasistencia, cancelación, devolución, tienda, funciones extra y anonimización). Detectar que la fecha del PDF dice 30/11/2026 y pedir a Loren que la corrija. Sacar del sistema las campañas automáticas por mail, los puntos de fidelización con sus beneficios y el recordatorio de inactividad, manteniendo las promociones que carga el administrador y los mails por cancelación o reprogramación del personal. Crear la tarjeta P11 (backend y frontend), recortar P6, ajustar P1 y dejar el aviso para el libro v8. |
| 2 | Alternativas y criterio de descarte | (a) Cargar en el libro la fecha del PDF tal como figura: descartado, es posterior a hoy y debilita la constancia. (b) Corregir a mano el PDF: descartado, no se edita un documento firmado. (c) Mantener campañas y puntos: descartado por la autora, que decidió sacarlos del sistema. (d) Anonimizar la fecha de nacimiento aunque ya no se use: pendiente; si solo servía a la campaña de cumpleaños, se prefiere dejar de pedirla por minimización de datos. |
| 3 | Evidencia que la sostiene | PDF firmado de la segunda confirmación (preguntas 1 a 14 marcadas «Sí», con la frase de campañas eliminada de la pregunta 13). Insumos de Claude Code: campañas, fidelización y recordatorio de inactividad (`runAutoPromotionsJob`, `computeLoyalty`, `runInactivityReminderJob`) y la lista de mails (sección 4). Mensaje de Emily del 30/10/2026. |
| 4 | Aporte personal | Emily decidió sacar campañas, puntos y beneficios, mantener las promociones que carga el administrador y que los mails a clientas se limiten a cancelaciones y reprogramaciones del personal. Editó el Word para quitar la frase de campañas antes de enviarlo. |
| 5 | Desacuerdo y resolución | Claude agregó por su cuenta que el recordatorio de inactividad también queda fuera y que los mails de verificación de correo y de recuperación de contraseña se mantienen. Emily los confirma. La fecha equivocada de Loren se resuelve con una copia corregida. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: lectura del PDF firmado, redacción de los prompts P11 y P11b y actualización de cuatro tarjetas. No se tocó código ni se cambió el libro v7 en este paso. Revisión final por Emily: pedir la fecha corregida a Loren, guardar ambas copias del PDF y probar P11 en Claude Code. |

## Entrada 81: constancia final de Loren y prompt maestro para Claude Code

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Dar por válida la segunda confirmación `Confirmacion2_Loren_Nexa_v4` (copia corregida): 14 respuestas «Sí», fecha 30/10/2026, firma de Lorena Gonzalez. Consolidar en un prompt maestro para el backend (fases 0 a 9) y otro para el frontend todo lo decidido: eliminar campañas automáticas, puntos de fidelización, recordatorio de inactividad y fecha de nacimiento; mantener promociones del administrador, reseñas y los mails de cuenta y de cancelación o reprogramación del personal; reglas de «No asistió (automático)», horario reabierto, reserva tardía y cancelación con hora de aviso; tienda sin productos inactivos o sin stock; anonimización ampliada; brechas, pruebas y deuda técnica del libro v7; y los informes de cobertura, cambios y horas. Cerrar la tarjeta de Loren y crear la tarjeta maestra. |
| 2 | Alternativas y criterio de descarte | (a) Enviar los prompts P1 a P11 por separado: descartado, se superponían y generaban confusión; ninguno se había enviado. (b) Pedir a Claude Code que implemente todo de una vez: descartado, se exige una Fase 0 de solo lectura y una rama por fase para poder revisar. (c) Anonimizar la fecha de nacimiento: descartado por la autora, se deja de pedir (minimización de datos). (d) Mantener alergias, observaciones y notas al anonimizar: se mantiene como límite declarado y confirmado por la propietaria en la pregunta 14. |
| 3 | Evidencia que la sostiene | PDF firmado del 30/10/2026 (copia corregida) y libro v7 (hoja «Código y pruebas»: 10 requisitos sin prueba, 19 con prueba parcial, 32 brechas abiertas, hoja «Funciones de apoyo y deuda»). Insumos de Claude Code del 30/10/2026. Decisiones de Emily del mismo día. |
| 4 | Aporte personal | Emily decidió mantener las reseñas, los mails de verificación y de recuperación de contraseña, dejar de pedir la fecha de nacimiento, pidió un único prompt completo y señaló que no había enviado ningún prompt anterior. |
| 5 | Desacuerdo y resolución | Claude agregó por su cuenta al prompt: vaciar los datos de contacto de los pedidos y el texto de las reseñas al anonimizar, registrar una salida de inventario en cada pedido pagado y restringir refundPolicy a full o none. Emily los confirma o los quita antes de ejecutar la Fase 0. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: redacción de los prompts maestros, lectura del PDF firmado y actualización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: ejecutar la Fase 0 en Claude Code, aprobar el plan y revisar cada rama antes de mergear. |

## Entrada 82: revisión de la Fase 0 de Claude Code y respuestas a sus preguntas

**Fecha:** 2026-10-30 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aprobar la Fase 0 con ajustes. Mergear primero el PR #13 en `main`, crear en cada repositorio la rama `integracion-ae4` y cortar las fases desde ahí, para no desplegar cambios parciales a la clienta real. Responder las 11 preguntas del informe: no imponer la grilla de 120 minutos; el caso María es una corrección manual; la liberación por falta de pago genera horario reabierto como cualquier vía; no se puede marcar «No asistió» antes de la hora de inicio; valen las dos condiciones de las 17:00 y la tolerancia de 15 minutos aplica al horario reabierto; el servicio no debe pisarse con ningún turno ni salir de la franja; `cancelledBy` es obligatorio; se usa `cancellationHours` de la configuración; el personal también queda bloqueado en el horario original; las visitas cuentan solo turnos finalizados; la tienda pública devuelve `available` y un tope de cantidad. Excluir de esta ronda todo lo de Mercado Pago. Pedir las consultas previas de solo lectura y prohibir a Claude Code tocar la base de producción. |
| 2 | Alternativas y criterio de descarte | (a) Cortar las fases desde `main`: descartado, `main` despliega a la clienta real. (b) Cortar desde la rama del PR #13: descartado, mezcla trabajos y genera conflictos de numeración en la bitácora. (c) Imponer en el backend la grilla de 120 minutos: descartado, rompe pruebas y turnos manuales y no es necesaria. (d) Un valor por defecto «el estudio cancela» en `cancelledBy`: descartado, devolvería la seña por error. (e) Incluir en esta ronda las pruebas de la firma del webhook y la cuenta real de Mercado Pago: descartado por la autora, se hace después de la AE4. |
| 3 | Evidencia que la sostiene | Informe de la Fase 0 de Claude Code del 30/10/2026: cada 120 minutos genera los horarios el frontend; el backend no rechaza horarios pasados; `cancelForClient` solo rechaza turnos ya cancelados; el reembolso se marca sin mirar si la seña estaba paga; `GET /store/products` también lo usa el panel; ningún endpoint escribe `Client.allergies`. Confirmación firmada de Loren del 30/10/2026. |
| 4 | Aporte personal | Emily decidió terminar primero el código y las confirmaciones de Loren, excluir lo de Mercado Pago y dar el OK con las respuestas de este registro. |
| 5 | Desacuerdo y resolución | Claude agregó por su cuenta al mensaje: la columna `appointment_id` en el registro de actividad, tratar `no_show_auto` como inasistencia en las estadísticas, validación con zod del PATCH de la profesional y de la configuración de pagos, y la rama de integración. Emily los confirma al enviar el mensaje. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión del informe de la Fase 0, redacción de las respuestas y actualización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: mergear el PR #13, tomar el respaldo, mandar el mensaje y revisar cada rama de fase. |

## Entrada 83: AE4, fase 1 — se eliminan campañas automáticas, puntos, recordatorio de inactividad y fecha de nacimiento (rama `refactor/quitar-campanas-puntos-recordatorio-nacimiento`)

**Fecha:** 2026-10-30, de 23:15 a 23:50 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. (a) Emily mergeó el pull request #13 en `main` (`61f1f53`); desde ahí se creó la rama de integración `integracion-ae4` y de ella la rama de la fase 1. `main` no se tocó. (b) Se eliminaron, por la decisión A confirmada por escrito por la propietaria el 30/10/2026: los jobs `autoPromotions.job.ts` e `inactivityReminder.job.ts` con sus plantillas, `promotions/autoPromotion.{model,controller}.ts`, las rutas `/api/admin/auto-promotions` y `/api/admin/clients/:id/auto-promotions`, `Client.loyaltyPoints`, `Client.birthDate`, `Client.lastInactivityReminderAt` y las tablas `auto_promotions` y `auto_promotion_sends`. Migración nueva `20261030150000_quitar_campanas_puntos_recordatorio_nacimiento` (no se tocó ninguna migración vieja). (c) `scheduler.ts` queda con dos jobs, liberación por falta de pago y no asistido, ambos cada 5 minutos. (d) El resumen de visitas de la ficha de la clienta se conserva: `computeLoyalty` pasó a `computeVisits` y la respuesta del panel lleva `visits { totalVisits, totalSpent, lastVisit }` en lugar de `loyalty`; por decisión de Emily cuenta solo turnos `finished` (antes contaba todo lo que no fuera `cancelled`). (e) Se dejaron intactos los avisos dentro de la aplicación de servicio, producto y promoción nuevos. (f) Se escribió `docs/consultas-previas-produccion.sql` (solo lectura). (g) Se actualizaron README (318 pruebas, mensaje del scheduler), `CLAUDE.md` y `.claude/agents/revisor-reservas.md`. Commits: `b30e849` (consultas SQL) y `8955406` (eliminaciones, migración y pruebas). |
| 2 | Alternativas y criterio de descarte | (a) Dejar las columnas en la base y solo dejar de usarlas: descartado, Emily pidió una migración que las borre y la fecha de nacimiento es un dato personal sin uso. (b) Conservar el objeto `loyalty` sin los puntos: descartado, el nombre sugeriría que sigue habiendo fidelización; se renombró `visits`. (c) Contar como visita todo turno no cancelado, como hasta ahora: descartado por Emily (solo `finished`). (d) **Orden de despliegue:** la regla general del repositorio es migrar Supabase antes del push, pero esta migración borra columnas que el código viejo todavía lee en cada consulta a `clients`; por eso en esta se despliega primero el código y después se aplica el SQL. Está explicado en el encabezado del archivo `migration.sql`. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. `npm test`: 34 archivos y 318 pruebas en verde (antes 32 y 310: se sacaron 4 casos de cumpleaños e inactividad de `timezone-art.test.ts` y se sumaron 12 en `scheduler.test.ts` y `admin.clients.visits.test.ts`; el test del cron de `timezone-art` pasó de 4 a 2 trabajos). La migración se aplicó **solo** a la base de pruebas (`npm run test:migrate`). Las consultas del SQL se ejecutaron contra esa base para comprobar la sintaxis, salvo la sección 4 (las columnas ya no existen allí). **No se ejecutó nada contra producción ni se hizo push.** El MCP `context7` estaba desconectado en esta sesión, así que no se consultó; el cambio no introduce código nuevo que dependa de una librería, salvo SQL escrito a mano. |
| 4 | Aporte personal | Emily decidió eliminar las cuatro funciones, que el despliegue lo haga ella con respaldo previo, que las visitas cuenten solo `finished`, el esquema de ramas (`integracion-ae4`) y pidió las consultas de verificación. Emily mergeó el pull request #13 antes de empezar. |
| 5 | Desacuerdo y resolución | Ninguno. **Pendiente de Emily:** correr `docs/consultas-previas-produccion.sql` en Supabase y guardar la salida (cuántas clientas pierden fecha de nacimiento o puntos); respaldo; aplicar la migración **después** de desplegar. **Frontend a adaptar en el mismo despliegue** (nexa-frontend, no se editó): `src/pages/admin/clients/` (`types.ts`, `ClientDetail.tsx`, `ClientDetail.test.tsx`, `ClientList.tsx`, `CreateClientModal.tsx`, `tabs/InfoTab.tsx`, `tabs/LoyaltyTab.tsx` — se va, la ficha pasa a leer `visits`), `src/pages/admin/promotions/AutoPromotionsSection.tsx` y `PromotionsPage.tsx`, y `src/app/data/admin/promotions/autoPromotionTypes.ts`. Mientras el frontend no se adapte, el panel pedirá rutas que ahora devuelven 404. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): todo el cambio de código, las pruebas, el SQL y esta entrada. Revisión de Emily pendiente. |


## Entrada 84: revisión de la Fase 1 del backend (eliminaciones)

**Fecha:** 2026-10-30 (hora aproximada, Argentina; cerca de las 23:50, después de los commits de la fase)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aceptar la Fase 1 del backend (rama `refactor/quitar-campanas-puntos-recordatorio-nacimiento`, commits `b30e849`, `8955406`, `308bb0a` y `9cf57f0`; 34 archivos y 318 tests en verde): eliminación de campañas automáticas, puntos de fidelización, recordatorio de inactividad y fecha de nacimiento, con el contador de visitas renombrado a `visits` y contando solo turnos finalizados. Integrar la rama en `integracion-ae4` tras revisarla. Ajustar el plan de despliegue: las migraciones que agregan columnas o tablas (fases 2, 3 y 5) se aplican antes de desplegar el código y la que borra (Fase 1) después, con una fecha de migración posterior a todas las demás. Pedir el plan de despliegue completo al terminar la Fase 5. Crear el prompt del frontend de la Fase 1. |
| 2 | Alternativas y criterio de descarte | (a) Aplicar la migración de la Fase 1 antes del despliegue: descartado, el código viejo falla en cada consulta a clientas mientras Render redespliega. (b) Mantener la fecha original de la migración de la Fase 1: descartado, Prisma las aplica por orden de fecha y la que borra debe ir última. (c) Calcular el porcentaje de trabajo con IA con la línea de coautoría: descartado, los commits van sin esa línea; se usa la lista de la sección 8.3 del README y de la bitácora. |
| 3 | Evidencia que la sostiene | Informe de Fase 1 de Claude Code del 30/10/2026: `typecheck:all` sin errores; 34 archivos y 318 tests en verde (antes 32 y 310); migración `20261030150000_quitar_campanas_puntos_recordatorio_nacimiento` aplicada solo a la base de pruebas; scheduler con `release-unpaid` y `auto-no-show`; `docs/consultas-previas-produccion.sql` de solo lectura. |
| 4 | Aporte personal | Emily aprobó la Fase 0 el mismo día, decidió mergear la rama a `integracion-ae4` y le corresponde correr las consultas previas en Supabase y tomar el respaldo antes de aplicar la migración. |
| 5 | Desacuerdo y resolución | Claude advirtió que el orden de despliegue invertido de la Fase 1 choca con la regla general de aplicar migraciones primero y propuso separar migraciones que agregan de las que borran y reordenar por fecha. Queda pendiente confirmar cómo se aplican las migraciones hoy en producción (`prisma migrate deploy` o SQL manual). |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión del informe de la Fase 1, redacción del prompt del frontend y del mensaje a Claude Code, y actualización del tablero. Claude no ejecutó ni verificó el código. Revisión final por Emily pendiente: revisar el PR de la Fase 1, correr las consultas previas, tomar el respaldo y probar el frontend de la Fase 1. |

## Entrada 85: AE4, fase 1 — el test de llegada fallaba en CI entre las 23:50 y las 00:00 de Argentina (rama `refactor/quitar-campanas-puntos-recordatorio-nacimiento`)

**Fecha:** 2026-10-31, 00:00 a 00:08 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. En el pull request de la fase 1, la prueba de GitHub Actions falló en `appointments.arrival-noshow.test.ts:26` (esperaba 200 y recibió 400). Causa: la prueba «la clienta registra su propia llegada en un turno confirmado de hoy» armaba el turno con `minutesAgo(-10)` («ahora + 10 minutos»). CI corrió a las 02:57 UTC, es decir 23:57 en Argentina, y +10 minutos cae en el día siguiente, así que `registerArrival` respondió `400 NOT_TODAY`. No viene de los cambios de la fase 1: es una prueba que fallaba en esa franja horaria desde antes. Se corrigió la prueba (turno de hoy a las 12:00) y se sumó una prueba con el reloj fijo en las 23:57 de Argentina. No se tocó código de `src/`. |
| 2 | Alternativas y criterio de descarte | (a) Cambiar `registerArrival` para tolerar el cambio de día: descartado, la regla «solo el día del turno» es correcta y el error estaba en la prueba. (b) Volver a correr CI hasta que pase: descartado, ocultaría una falla real de la prueba. (c) Fijar el reloj en la prueba original: descartado, una fecha y hora fijas del turno son más simples y no dependen del reloj. |
| 3 | Evidencia que la sostiene | Con el reloj fijo en 2026-10-31T02:57:00Z, una prueba temporal (ya borrada) mostró que el patrón viejo da 400 y el nuevo da 200. Después del cambio: `typecheck:all` sin errores y `npm test` con 34 archivos y 319 pruebas en verde (318 + la nueva). Se revisaron las demás pruebas con `minutesAgo(-N)`: no hay otra. |
| 4 | Aporte personal | Emily detectó la falla en GitHub Actions, no hizo el merge y pidió revisarla. |
| 5 | Desacuerdo y resolución | Ninguno. Límite: las pruebas con `minutesAgo(N)` positivo y `hoursFromNow` también dependen del reloj, pero no se rompen al cruzar la medianoche porque comparan fechas calculadas en hora de Argentina; no se encontró ninguna otra con el mismo problema. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): diagnóstico, corrección, pruebas y esta entrada. Revisión de Emily pendiente. |



## Entrada 86: revisión de la Fase 1 del frontend y decisión sobre la fecha de nacimiento de profesionales

**Fecha:** 2026-10-31 (hora aproximada, Argentina; de madrugada, después de los commits del frontend de las 00:17)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aceptar la Fase 1 del frontend (rama `refactor/quitar-campanas-puntos-nacimiento`, cortada de `integracion-ae4`, commits `dd1b050`, `55fa408`, `1f54677` y `52397c8`; lint y tipos sin errores, 17 archivos y 80 tests en verde, build correcto). Mantener el commit `1f54677`, que quita la fecha de nacimiento del alta de profesionales. Pedir una línea final en la sección 8.3 del README que explique que el último commit de cada fase se identifica en la bitácora. Dejar el commit `52397c8` declarado en esta entrada, porque no puede figurar en 8.3. Subir las dos ramas, abrir el pull request con base `integracion-ae4` y mergearlo. Probar a mano un alta de profesional con invitación de prueba al desplegar. |
| 2 | Alternativas y criterio de descarte | (a) Revertir `1f54677`: descartado, el backend no tiene ningún campo de fecha de nacimiento (ni de clientas ni de profesionales), así que el formulario pedía un dato que no se guardaba, contrario a la minimización de datos de la Ley N.º 25.326. (b) Citar `52397c8` dentro de 8.3: imposible, un commit no puede citar su propio hash. |
| 3 | Evidencia que la sostiene | Informe de Claude Code del 31/10/2026: lectura del backend en solo lectura sin ningún campo de nacimiento en el esquema ni en `src`; `npm run lint` sin errores, `typecheck:all` sin errores, 80 tests en verde, build correcto; el resumen de visitas tiene un valor por defecto en cero por si llega `loyalty`. Informe de Fase 1 del backend del 30/10/2026. |
| 4 | Aporte personal | Emily decidió dejar el commit de las profesionales y le toca subir las ramas, abrir y mergear el PR, y probar el alta de profesionales al desplegar. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. Claude Code fue más allá de lo pedido al quitar la fecha de nacimiento del alta de profesionales y lo informó con un commit independiente; Emily lo aprobó. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: evaluación del informe, redacción del mensaje para Claude Code y un comentario en la tarjeta «FRONTEND Fase 1». Claude no ejecutó ni verificó el código. Revisión final por Emily pendiente: subir y mergear las ramas del frontend y probar el alta de profesionales. |

## Entrada 87: AE4, fase 2 — inasistencia automática, horario original bloqueado, horario reabierto y reserva tardía (rama `feat/inasistencia-horario-reabierto`)

**Fecha:** 2026-10-31, de 00:20 a 04:55 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily, con las reglas de la fase 2 confirmadas por escrito por la propietaria el 30/10/2026. (a) **Estado `no_show_auto`** («No asistió (automático)»): el job pasa un turno `confirmed` sin llegada registrada a ese estado con más de 30 minutos de su hora de inicio (30 exactos no; antes eran 20 y pasaba a `cancelled_no_show`); sigue ocupando el horario, no suma a la carga semanal de R-04, la clienta no lo cancela ni lo reprograma, la seña no cambia y deja una entrada de actividad por turno. (b) **Horario original bloqueado:** columna `appointments.slot_locked` y el índice único parcial recreado con `OR slot_locked`; se escribe en la misma sentencia que cambia el estado (en `cancelled_no_show` y en `cancelled` hecha después de la hora de inicio, incluida la liberación por falta de pago). (c) **Marca del personal** (`changeStatusByStaff`): `cancelled_no_show` solo desde `confirmed` o `no_show_auto` y desde la hora de inicio (`400 NO_SHOW_BEFORE_START`); hasta 40 minutos después se abre un horario reabierto (tabla `reopened_slots`) con inicios cada 5 minutos desde el siguiente múltiplo de 5 a la marca hasta 60 minutos después de la hora original; la seña queda retenida. (d) **Reservas en el horario reabierto:** el servicio tiene que terminar dentro de la franja y no pisar ningún turno activo (antes ni después), con `pg_advisory_xact_lock` por profesional y día; pasada la hora límite, `409 REOPENED_SLOT_CLOSED`. (e) **Reserva tardía:** la clienta reserva o reprograma (simple, combo, evento especial) hasta 15 minutos después de la hora de inicio; después `400 START_TIME_PASSED`; el personal queda exento. (f) **Corrección (2.7):** de `no_show_auto` o `cancelled_no_show` a `finished` siempre y a `confirmed` solo sin superposición (`409 APPOINTMENT_OVERLAP`); cierra el horario reabierto y registra quién, de qué estado a cuál y el id del turno. (g) De lo agregado por Emily: `cancelForClient` solo para `pending` y `confirmed` (`400 NOT_CANCELLABLE`), zod en el PATCH de la profesional, `activity_logs.appointment_id` (nullable, sin clave foránea, con índice) usada en todas las entradas que tocan un turno, `no_show_auto` contado como inasistencia en el panel del administrador y en el historial de la clienta, y `GET /api/professional/:id/availability` con `reopenedStarts` y `earliestStart`. (h) Se actualizaron ADR-002 (revisión fechada, sin borrar el texto anterior), README, `CLAUDE.md` y `.claude/agents/revisor-reservas.md`. Migraciones nuevas: `20261031120000_turno_horario_original_bloqueado`, `20261031121000_crear_horarios_reabiertos`, `20261031122000_actividad_con_turno`. Commits: `1bfdf67` (base de datos), `76fe8a3` (reglas) y `3ccdf53` (pruebas). |
| 2 | Alternativas y criterio de descarte | (a) Dejar `cancelled_no_show` fuera del índice y cubrir el original solo con la regla de los 15 minutos de reserva tardía: descartado, una cancelación a las 16:10 de un turno de las 16:00 dejaba el original reservable hasta las 16:15. (b) Extender el índice a todos los `cancelled_no_show` viejos: descartado, podrían chocar con turnos posteriores y la migración fallaría; con la columna nueva las filas viejas quedan en `false`. (c) Una exclusión `EXCLUDE USING gist` por intervalo para todo turno: descartado, contradice que la duración sea informativa y rompería datos existentes; la verificación por duración queda solo para los inicios del horario reabierto. (d) Guardar el estado del horario reabierto como «reservado» o «vencido»: descartado, la vigencia se calcula (`closes_at`) y `closed_at` solo marca la corrección del personal. (e) Imponer la grilla de 120 minutos en el backend: descartado por decisión de Emily; el backend sigue aceptando cualquier hora dentro de la franja. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. `npm test`: 35 archivos y 367 pruebas en verde (antes 34 y 319). Pruebas nuevas en `appointments.reopened-slots.test.ts` (42) y reescritas en `appointments.arrival-noshow.test.ts` y `timezone-art.test.ts`: job con 29 y 30 minutos que no marcan y 31 que sí; `no_show_auto` ocupa el horario (409); marca del personal a los 32, 40 y 41 minutos; original no reservable por la clienta, por el personal ni con un INSERT directo; reserva en el horario reabierto hasta las 17:00 y rechazo a las 17:05; servicio de 2 horas que no entra; dos reservas simultáneas (entra una sola); reserva tardía a los 15 y 16 minutos; correcciones con y sin superposición; seña sin cambios en cada paso; caso María (8:00, job a las 8:35, cierre como `finished` a las 10:00). La prueba que decía «libera el horario» se reemplazó por la regla nueva. Las migraciones se aplicaron **solo** a la base de pruebas. **No se ejecutó nada contra producción ni se hizo push.** El MCP `context7` no estaba conectado en esta sesión. |
| 4 | Aporte personal | Emily definió las reglas y las respuestas a las preguntas de la fase 0: no imponer la grilla de 120 minutos, el caso María como corrección manual sin job de cierre, la liberación por falta de pago como cancelación, marcar antes de la hora con 400, las dos condiciones de las 17:00, la verificación por duración en ambos sentidos y dentro de la franja, y el bloqueo del original también para el personal. |
| 5 | Desacuerdo y resolución | **Decisiones mías a confirmar por Emily (no estaban en el prompt):** (1) al corregir a `confirmed` se registra `arrivedAt = ahora`; si no, el job lo volvía a marcar en la corrida siguiente. (2) Un turno marcado como no asistido no se cancela ni se reprograma por el PATCH: se corrige primero. (3) Códigos nuevos: `INVALID_STATUS_TRANSITION`, `APPOINTMENT_OVERLAP`, `SERVICE_DOES_NOT_FIT`, `REOPENED_SLOT_CLOSED`, `REOPENED_SLOT_UNAVAILABLE`, `NO_SHOW_BEFORE_START`, `NOT_CANCELLABLE`. (4) Cancelar un combo o liberar impagos ya no toca patas finalizadas o no asistidas (antes pisaba cualquier estado distinto de `cancelled`). (5) Un PATCH del personal a un horario ocupado responde 409 en vez de 500. (6) **Contradicción del prompt:** el ajuste (b) pide no tratar `no_show_auto` como `cancelled_no_show` «en la carga semanal ni en la ocupación», pero la regla 2.2 dice que no suma a la carga. Se siguió 2.2 (no suma a la carga) y se mantuvo que ocupa el horario. **Límites:** (a) una hora fuera del rango del horario reabierto y dentro de la franja sigue aceptándose, como antes (no hay grilla en el backend), así que un cliente que arme la solicitud a mano podría reservar, por ejemplo, 17:05 como un turno normal; la oferta del servidor no lo incluye. (b) Los combos y los eventos especiales aplican la reserva tardía, pero no tienen pruebas propias de ese caso. (c) Los horarios reabiertos no cruzan la medianoche. **Pendiente de Emily:** aplicar las 3 migraciones en Supabase **antes** de desplegar (agregan columnas y una tabla), con respaldo; correr las consultas 2 y 3 de `docs/consultas-previas-produccion.sql`. **Frontend a adaptar** (nexa-frontend, no se editó): `DateTimeStep.tsx`, `ComboBookingFlow.tsx` y `RescheduleModal.tsx` (usar `earliestStart` y `reopenedStarts`, dejar de filtrar con el reloj del navegador, mostrar los códigos nuevos), `shared/utils/errorMessage.ts`, los mapas de etiquetas y colores de estado de la agenda de la profesional y del administrador y de «Mis turnos» (usar `statusLabel` y el estado `no_show_auto`), y el modal de estado del administrador y de la profesional (corrección y marca de «No asistió»). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): todo el cambio de código, las pruebas, la documentación y esta entrada. Revisión de Emily pendiente. |



## Entrada 88: AE4, push de la fase 2, pull request 15 y borrado de ramas ya mergeadas

**Fecha:** 2026-10-31, 04:50 a 04:57 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. (a) Push de `feat/inasistencia-horario-reabierto` y pull request https://github.com/emilykohler12/nexa-backend/pull/15 con base `integracion-ae4`; el merge lo hace Emily. (b) Borrado, local y en GitHub, de las ramas `fix/alergias-solo-la-clienta`, `fix/sentry-limpieza-y-rf05-borde` y `refactor/quitar-campanas-puntos-recordatorio-nacimiento`, que ya estaban mergeadas. (c) Flujo de trabajo para las fases que siguen: cada rama sale de `integracion-ae4`, Claude Code hace el push y abre el pull request, Emily solo mergea, no se empieza la fase siguiente hasta ese merge y se borran las ramas que queden sin uso. (d) Se suma a la fase 7 probar la reserva tardía en combos y en eventos especiales, y a la fase 9 declarar como límite conocido en `docs/cambios-y-decisiones.md` que una solicitud directa con una hora fuera del horario reabierto pero dentro de la franja se acepta como turno normal. La fase 3b (recordatorio de turno por mail) va después de la fase 3. |
| 2 | Alternativas y criterio de descarte | Borrar también `main` o `integracion-ae4`: descartado, son las ramas de trabajo. Borrar las ramas antes de confirmar que estaban mergeadas: descartado, se verificó con `git branch -r --merged origin/integracion-ae4` y el borrado local con `git branch -d`, que se niega si no están integradas. |
| 3 | Evidencia que la sostiene | `git branch -a` después del borrado: solo quedan `main`, `integracion-ae4` y la rama de la fase 2. `gh pr create` devolvió el pull request 15; su estado quedó abierto, mergeable y con la prueba de GitHub Actions pendiente. No se tocó `main` ni se ejecutó nada contra producción. |
| 4 | Aporte personal | Emily pidió que los commits se suban siempre con base en `integracion-ae4`, que ella solo haga el merge al terminar cada fase, que se borren las ramas innecesarias y aprobó la fase 2 con las seis decisiones. |
| 5 | Desacuerdo y resolución | Ninguno. El pie de «Generado con Claude Code» no se agregó al pull request, igual que los commits, que van sin la línea de coautoría por pedido de Emily. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y la CLI `gh`. Revisión de Emily pendiente. |



## Entrada 89: revisión de la Fase 2 del backend, reorganización del tablero y recordatorio por mail

**Fecha:** 2026-10-31 (hora aproximada, Argentina; después del commit de la Fase 2 de las 04:47)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aprobar la Fase 2 del backend (rama `feat/inasistencia-horario-reabierto`, commits `1bfdf67`, `76fe8a3`, `3ccdf53` y `b064453`; 367 tests en verde) con sus seis decisiones: registrar la llegada al corregir a confirmado, no cancelar ni reprogramar un turno marcado sin corregirlo, siete códigos de error nuevos, no pisar patas finalizadas al cancelar combos o liberar impagos, 409 en lugar de 500 y etiqueta de estado en las vistas. Declarar como límite que una solicitud directa con una hora fuera del horario reabierto pero dentro de la franja se acepta como turno normal. Reorganizar el tablero de Trello por temas (libro, código, informe, instrumentos y bitácora, demo y entrega, después de la AE4) y crear las tarjetas del frontend de la Fase 2, de la Fase 3b y de la tercera confirmación. Incorporar el recordatorio de turno por mail 5 horas antes (RF-35), con enlaces que llevan a la web y piden iniciar sesión, y exigir una constancia escrita nueva de la propietaria. |
| 2 | Alternativas y criterio de descarte | (a) Botones del mail que cancelan directamente: descartado, los antivirus de los correos abren los enlaces y cancelarían turnos solos. (b) Implementar el recordatorio sin nueva constancia: descartado, la pregunta 11 firmada dice que no se envían recordatorios y dos documentos contradictorios debilitan la evidencia; se implementa pero no se despliega sin la firma. (c) Aplicar ahora las migraciones de la Fase 2 en producción: descartado, se aplican juntas en el despliegue final con el plan de despliegue. (d) Crear listas nuevas en Trello: descartado, se renombraron las existentes para no duplicar tarjetas. |
| 3 | Evidencia que la sostiene | Informe de Fase 2 de Claude Code del 31/10/2026 (typecheck limpio, 367 tests en verde, tres migraciones solo aplicadas a la base de pruebas). Segunda confirmación firmada de la propietaria del 30/10/2026 (preguntas 1 a 14, entre ellas la 11 sobre recordatorios). Tablero reorganizado con 17 tarjetas movidas, 6 listas renombradas y 4 tarjetas nuevas. |
| 4 | Aporte personal | Emily pidió el recordatorio por mail con los datos del turno, botones de cancelar y reprogramar y envío 5 horas antes, afirmó que la propietaria lo aprobó y pidió reorganizar el tablero por temas, conservando las listas de lo posterior a la presentación, del código fuera de alcance y de terminados. |
| 5 | Desacuerdo y resolución | Claude señaló que el recordatorio contradice la pregunta 11 firmada y que cancelar desde el recordatorio ya cae dentro de las 12 horas sin devolución de la seña; se resuelve con una tercera confirmación escrita y el aviso en el mail. La aprobación verbal de la propietaria no se considera constancia. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión del informe de la Fase 2, redacción de los prompts del frontend de la Fase 2 y de la Fase 3b, y reorganización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: subir y mergear la Fase 2, correr las consultas 2 y 3 en Supabase y pedir a Loren la firma de la tercera confirmación. |

## Entrada 90: AE4, fase 3 — cancelación y devolución de la seña con hora de aviso (rama `feat/cancelacion-devolucion-hora-de-aviso`)

**Fecha:** 2026-10-31, de 15:05 a 16:05 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily, con las reglas de la fase 3 confirmadas por escrito por la propietaria el 30/10/2026. El sistema solo **marca** la seña como devuelta (`refunded`); no ejecuta ninguna devolución en Mercado Pago. (a) **Una sola regla** en `cancellationRules.ts` para la clienta, el personal y los combos: con la seña paga (`partial` o `paid`) y `cancellationHours` (12 por defecto) o más de aviso, `paymentStatus` pasa a `refunded`; con menos, queda retenida; si no estaba paga, no se marca nada. (b) **Clienta desde la app:** solo turnos `pending` o `confirmed`, también ya empezados; las horas son de ahora al inicio. (c) **Personal:** el PATCH con `status: 'cancelled'` exige `cancelledBy` (`client` o `studio`, 400 si falta) y admite `clientNoticeAt` (ISO, por defecto ahora), `noticeChannel` (`whatsapp`, `call`, `in_person`, `other`) y `noticeNote` (hasta 200). `studio` devuelve la seña paga sin mirar la hora. `client` cuenta inicio menos `clientNoticeAt`; un aviso futuro se rechaza (`400 INVALID_NOTICE_TIME`); uno posterior al inicio se acepta y no devuelve; la profesional puede cargar un aviso de hasta 48 horas atrás (más antiguo: `403 NOTICE_TOO_OLD`) y el administrador cualquiera. Migración nueva con `cancelled_by`, `client_notice_at`, `notice_channel`, `notice_note`, `notice_loaded_by_id` y `notice_loaded_at`; el detalle del turno (`cancellation`) y el registro de actividad muestran quién, cuándo, hora, medio y nota. (d) **Horario liberado al cancelar, por cualquier vía:** si el turno no empezó, el original queda libre (reservable hasta 15 minutos después de su hora); si ya empezó, el original queda bloqueado y se abre un horario reabierto solo si la cancelación ocurre hasta 40 minutos después del inicio; esto incluye la liberación por falta de pago, que ahora queda con `cancelledBy = 'system'`. (e) **Política de devolución:** solo `full` o `none`, validada con zod en `PATCH /settings/payments` (también horas, monto y porcentaje de la seña); migración de datos que pasa los `partial` a `full`. (f) **Combos:** el personal cancela todo el grupo, la clienta solo su pata, y la devolución se decide una sola vez (en el grupo, con la hora del primer turno, o en la última pata activa). (g) El mail a la clienta sale cuando cancela el personal y no en su propia cancelación; no hay otras novedades de mails. Migraciones nuevas: `20261031130000_cancelacion_con_hora_de_aviso` y `20261031131000_politica_de_devolucion_full_o_none`. Commits: `7e8a16e` (base de datos), `60e56b1` (reglas) y `d41644e` (pruebas). |
| 2 | Alternativas y criterio de descarte | (a) Dejar la devolución calculada en tres lugares (clienta, personal, combos) como estaba: descartado, ya divergían (marcaba `refunded` aunque la seña no estuviera paga). (b) Tolerar unos minutos de diferencia de reloj en una hora de aviso «futura»: descartado, la regla dice que no puede ser futura; sin hora cargada se usa la del servidor. (c) Guardar el aviso en una tabla aparte: descartado, hay un aviso por cancelación y las columnas nullable alcanzan. (d) Guardar el aviso también cuando cancela la clienta desde la app: descartado, ahí las horas son las de ahora y `cancelled_by = client` alcanza. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. `npm test`: 36 archivos y 404 pruebas en verde (antes 35 y 367). `appointments.cancellation-refund.test.ts` (37 casos): aviso con 13 horas, 12 exactas y 11; cancelación del estudio con 2 horas de anticipación; aviso cargado tarde con hora anterior; aviso futuro rechazado; aviso posterior al turno sin devolución; la profesional con 47 horas (sí) y 49 (403) y el administrador con 49 (sí); seña impaga sin `refunded`; cancelación de la clienta con el turno empezado (sin devolución y con horario reabierto); a los 40 minutos abre y a los 41 no; el original no es reservable (409 y INSERT directo); combos; mail a la clienta solo cuando cancela el personal; liberación por falta de pago ya empezada; política `full`/`none`, rechazo de `partial`, permisos (403 y 401) y la sentencia de la migración ejecutada sobre una fila `partial`. Las migraciones se aplicaron **solo** a la base de pruebas. **No se ejecutó nada contra producción.** Push de la rama y pull request https://github.com/emilykohler12/nexa-backend/pull/16 con base `integracion-ae4` (el merge lo hace Emily); antes se borró la rama de la fase 2, ya mergeada. El MCP `context7` no estaba conectado. |
| 4 | Aporte personal | Emily definió las reglas de la fase 3, el cuerpo nuevo del PATCH, que `cancelledBy` sea obligatorio, que se use `cancellationHours` de la configuración, que `cancelForClient` acepte solo `pending` y `confirmed` y que la liberación por falta de pago cuente como cancelación para el horario reabierto. |
| 5 | Desacuerdo y resolución | **«Cuántos `partial` había»:** no se puede determinar desde el código ni sin leer producción; `payment_settings` tiene una sola fila, así que son 0 o 1. La consulta 1 de `docs/consultas-previas-produccion.sql` lo muestra. **Decisiones mías a confirmar por Emily:** (1) con política `none`, una cancelación del **estudio** igual marca la seña como devuelta, porque la regla 3.2.a dice «sin mirar la hora» y la política rige para la clienta. (2) Un turno **finalizado** ya no se puede cancelar por el PATCH del personal (`400 INVALID_STATUS_TRANSITION`): antes se podía y podía marcar una devolución. (3) En un combo cancelado por el personal, solo las patas con seña paga pasan a `refunded`. (4) La clienta, al cancelar la última pata de un combo, marca devueltas todas las patas con seña paga (antes marcaba todas). (5) `paymentStatus = 'paid'` (todo cobrado) también se marca `refunded` cuando corresponde, como pide la regla 3.1. (6) Validaciones nuevas de `PATCH /settings/payments`: horas enteras de 0 a 720, monto de 0 a 999999 y porcentaje de la seña hasta 100. **Pendiente de Emily:** aplicar en Supabase `20261031130000` (agrega columnas: **antes** de desplegar) y `20261031131000` (solo datos), con respaldo. **Frontend a adaptar** (nexa-frontend, no se editó): los modales de cancelación del administrador y de la profesional (enviar `cancelledBy` y, si cancela la clienta, `clientNoticeAt`, `noticeChannel` y `noticeNote`; mostrar `INVALID_NOTICE_TIME` y `NOTICE_TOO_OLD`), la pantalla de configuración de pagos (quitar la opción «parcial» de la política de devolución), el detalle del turno (leer `cancellation`) y el listado de actividad (`appointmentId`). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): todo el cambio de código, las pruebas, la documentación y esta entrada. Revisión de Emily pendiente. |



## Entrada 91: fase 3 del backend aprobada y decisión sobre las confirmaciones de Loren

**Fecha:** 2026-10-31 (hora aproximada, Argentina; después del pull request 16 de la Fase 3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aprobar la Fase 3 del backend (PR #16 hacia `integracion-ae4`; 36 archivos y 404 tests en verde): regla única de devolución de la seña para la clienta, el personal y los combos; cancelación del personal con `cancelledBy`, hora de aviso, medio y nota, con límite de 48 horas para la profesional; horario reabierto al cancelar un turno ya empezado dentro de los 40 minutos; política de devolución limitada a `full` o `none`. Aceptar las tres decisiones de Claude Code (el estudio devuelve siempre, un turno finalizado no se cancela por el PATCH del personal y validaciones de la configuración de pagos). Registrar los resultados de las consultas previas en producción: 0 clientas con fecha de nacimiento, puntos o recordatorio, 0 campañas y 0 turnos. Decidir que los cambios nuevos los aprueba Emily como autora del sistema, sin constancias adicionales de la propietaria; se archiva la tarjeta de la tercera confirmación y el recordatorio por mail (RF-35) entra en la entrega como decisión de la autora. |
| 2 | Alternativas y criterio de descarte | (a) Pedir una tercera confirmación escrita a la propietaria por los recordatorios: descartado por Emily, que decide los cambios desde ahora. (b) Mantener la condición «no se despliega sin constancia» en la Fase 3b: descartado por la misma razón. (c) Aplicar las migraciones de la Fase 3 en producción ahora: descartado, se aplican juntas en el despliegue final. |
| 3 | Evidencia que la sostiene | Informe de Fase 3 de Claude Code del 31/10/2026 (typecheck sin errores, 36 archivos y 404 tests, migraciones `20261031130000` que agrega columnas y `20261031131000` solo de datos). Resultados de Supabase del 31/10/2026: consultas de turnos por estado y de duplicados sin filas; consultas 4 a 7 en cero. Segunda confirmación firmada del 30/10/2026. |
| 4 | Aporte personal | Emily aprobó las decisiones de la Fase 3, dio la instrucción de que los cambios desde ahora se aprueban por ella y no por la propietaria, y corrió las consultas de producción. |
| 5 | Desacuerdo y resolución | Claude había recomendado una constancia escrita nueva por el recordatorio, porque la pregunta 11 firmada decía lo contrario. Emily resolvió que no se pide: la decisión es de la autora y en el libro v8 el recordatorio figura como decisión de la autora, sin marca de validación de la propietaria. Queda pendiente confirmar que la base de Supabase consultada es la de producción (la tabla de turnos está vacía). |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión del informe de la Fase 3, redacción del mensaje para Claude Code y del prompt de frontend de la Fase 3, y actualización del tablero. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: mergear el PR #16, confirmar el proyecto de Supabase y ejecutar los frontends de las fases 2 y 3. |

## Entrada 92: AE4, fase 3b — recordatorio de turno por mail (rama `feat/recordatorio-turno-mail`)

**Fecha:** 2026-10-31, de 16:10 a 23:00 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. **Decisión de la autora:** la propietaria confirmó la regla del recordatorio pero no va a firmar una constancia escrita nueva; las decisiones las toma Emily como autora del sistema, así que se implementó sin la condición «no se despliega sin constancia» y la fase entra en la entrega. (a) **Job nuevo** `appointmentReminder.job.ts`, cada 5 minutos, en hora de Argentina y con `noOverlap`: el scheduler queda con tres trabajos. Manda UN mail por turno (o por grupo de combo, con todos los servicios) cuando faltan 5 horas o menos para el inicio, y hasta 1 hora antes. (b) **Columna nueva** `appointments.reminder_sent_at` (migración `20261031140000_recordatorio_de_turno_enviado`, solo agrega, nullable): se marca ANTES de enviar con `updateMany` condicional y se deshace si el envío falla; nunca se reenvía. (c) **Quién recibe:** solo `confirmed` con seña paga (`partial` o `paid`) o sin seña requerida. No se manda si la reserva se creó con menos de 5 horas de anticipación (5 exactas sí), si el correo no está verificado, si la cuenta está desactivada o anonimizada, ni si la clienta está bloqueada. (d) **Contenido** (plantilla `appointmentReminder.html`, mismo estilo que los otros mails): saludo con el nombre, fecha y hora, profesional, servicios con duración y precio, seña ya paga y saldo, dirección del estudio si está en la configuración, aviso «Si cancelás ahora (con menos de 12 horas), la seña no se devuelve» y tres botones. (e) **Botones:** son enlaces a `FRONTEND_URL/mis-turnos?turno=<id>&accion=ver`, `reprogramar` o `cancelar`; no ejecutan nada (la web exige iniciar sesión y confirmar) y solo llevan el id del turno. (f) **Actividad:** cada envío deja una entrada con `appointment_id`; un fallo deja UNA entrada de error por turno, no corta el job y se reintenta en cada corrida hasta 1 hora antes. (g) **Documentación:** README (log de arranque), `CLAUDE.md` (jobs, hora de Argentina, regla nueva), `docs/plan-de-despliegue.md` (nuevo: la migración agrega, va antes del despliegue) y `docs/cambios-y-decisiones.md` (nuevo: resultado de las consultas previas en producción, decisión de la autora y límites conocidos). (h) **Resultado de las consultas previas en producción** (informado por Emily): 0 clientas con fecha de nacimiento, 0 con puntos, 0 con recordatorio de inactividad, 0 campañas y 0 turnos en la base. (i) **Política de privacidad:** `00-gestion/POLITICA_PRIVACIDAD.md` (versión `2026-09`) nombra el email como dato, dice que se usan para «avisarte cambios» y que se comparten con el proveedor de envío de emails, pero no dice que el sistema manda un recordatorio por su cuenta. No se tocó el texto ni `PRIVACY_POLICY_VERSION`: queda a la espera de la decisión de Emily. (j) **Frontend, sin tocar:** la lista de lo que falta está en el elemento 5. |
| 2 | Alternativas y criterio de descarte | (a) Enviar y recién después marcar `reminder_sent_at`: descartado, dos corridas que se pisen mandan dos mails y la regla dice «nunca». Se marca antes con escritura condicional y se deshace si falla; el costo es que, si el proceso se cae justo entre la marca y el envío, ese recordatorio se pierde, y se eligió eso antes que duplicarlo. (b) Un registro de actividad por cada reintento fallido: descartado, con el mail caído serían unas 48 entradas por turno; queda una. (c) Mostrar siempre el aviso de la seña: descartado, en un turno sin seña pagada la frase no tiene sentido; solo sale si hay seña paga. (d) Fijar el «12» en el texto: descartado, se toma `cancellationHours` de la configuración, y con `refundPolicy = none` o una ventana más corta que el tiempo que falta el texto dice lo que realmente pasaría. (e) Que el botón cancele o reprograme directo desde el mail: descartado por la regla (cualquiera con el correo podría cancelar); el enlace solo abre la web. (f) Un mail por pata de combo: descartado por la regla; sale uno con todos los servicios y el enlace lleva el id de la primera pata. (g) Una tabla aparte de recordatorios: descartado, una columna nullable alcanza y no pide tabla nueva ni cambiar `TABLES` de los tests. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. Migración aplicada a la base de pruebas con `npm run test:migrate`. `npm test`: 37 archivos y 438 pruebas en verde (antes 36 y 404); el archivo nuevo aporta 33 casos y se sumó uno a `scheduler.test.ts`. `appointments.reminder.test.ts` con reloj inyectable (el job recibe `now`): manda a las 5 horas exactas; no manda a las 5 horas y 1 minuto; no manda dos veces (corridas seguidas y simultáneas); manda a 1 hora y no a menos de 1 hora; no manda con el turno ya empezado; turno de madrugada con la ventana cruzando la medianoche de Argentina; casos excluidos (pendiente de seña, `pending`, cancelado, `no_show_auto`, `cancelled_no_show`, `finished`, reserva creada con menos de 5 horas, correo sin verificar, bloqueada, anonimizada, cuenta desactivada); reserva con exactamente 5 horas de anticipación sí manda; combo en un solo mail con totales sumados y todas las patas marcadas; combo con una pata cancelada; reintento tras un fallo, un fallo que no frena a las demás clientas, tope de reintentos a 1 hora y una sola entrada de error; contenido (saludo, fecha, hora, profesional, servicio, duración, precio, seña, saldo, aviso de la seña con 12 y con 24 horas y con devolución desactivada, sin aviso si no hay seña, dirección solo si está configurada, escape de HTML, y los tres enlaces con el id del turno y sin datos de la clienta). Se actualizaron `scheduler.test.ts` y `timezone-art.test.ts`, que fijaban «dos trabajos», para que esperen tres: en la primera corrida de la suite completa fallaron justo esos dos casos. |
| 4 | Aporte personal | Emily definió la regla completa del recordatorio (umbral de 5 horas, exclusiones, contenido, botones como enlaces sin acción, un mail por combo, reintentos hasta 1 hora antes), pidió que se implemente igual sin la constancia, que se anote como decisión de la autora, que no se toque el frontend sino que se liste lo que falta, y que se la consulte antes de cambiar la versión de la política de privacidad. También informó los resultados de las consultas previas en producción. |
| 5 | Desacuerdo y resolución | **Frontend:** la ruta `/mis-turnos` que pide el enlace no existe; hoy la pantalla de turnos de la clienta es `/client/appointments` (`ROUTES.CLIENT_APPOINTMENTS`). Se siguió la ruta del pedido y queda en la lista del frontend. **Decisiones mías a confirmar por Emily (no estaban en el prompt):** (1) el tope de 1 hora antes vale también para el primer intento, no solo para los reintentos. (2) `reminder_sent_at` no se limpia al reprogramar: un turno ya recordado y movido de día no recibe un segundo recordatorio; el criterio de las 5 horas de anticipación mira la fecha de creación, no la de la última reprogramación. (3) Se considera «anonimizada» o dada de baja a toda cuenta con `users.active = false` (la anonimización la deja así). (4) El aviso de la seña se omite si no hay seña paga y se adapta a la configuración. (5) Se crearon `docs/plan-de-despliegue.md` y `docs/cambios-y-decisiones.md` porque no existían en el repositorio; si Emily los lleva en otro lado, hay que unirlos. (6) La política de privacidad no lista este mail: hace falta decidir si se agrega una línea y se sube la versión (cambia `PRIVACY_POLICY_VERSION` en backend y frontend y vuelve a pedir la aceptación). **Lista para el frontend (no se hizo):** (a) crear la ruta `/mis-turnos` (alias de `/client/appointments`) que conserve los parámetros `turno` y `accion`; (b) sin sesión, mandar al login y volver a `/mis-turnos?turno=…&accion=…` después de entrar; (c) en `ClientAppointmentsPage`, leer `turno` y `accion`, buscar el turno entre los de la clienta (si es de un combo, abrir el grupo) y abrir el detalle con `ver`, el flujo de reprogramación con `reprogramar` o el diálogo de cancelación con `cancelar`, mostrando la política de devolución; (d) nunca ejecutar una acción al cargar la página: siempre pedir confirmación; (e) turno inexistente, ajeno, ya cancelado o ya empezado: mensaje claro y la lista normal; (f) quitar los parámetros de la URL después de abrir; (g) si entra con una sesión de profesional o administrador, no abrir el turno. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): todo el cambio de código, las pruebas, la documentación y esta entrada. Documentación de `node-cron` 4.6 (opción `noOverlap`) consultada con Context7. Revisión de Emily pendiente. |



## Entrada 93: AE4, push de la fase 3b y pull request 17

**Fecha:** 2026-10-31, de 23:00 a 23:10 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. (a) Confirmado que el pull request 16 (fase 3) está mergeado en `integracion-ae4` (commit `13aa400`); se actualizó `integracion-ae4`, se cortó `feat/recordatorio-turno-mail` y se borró la rama de la fase 3, local y en GitHub. (b) Push de `feat/recordatorio-turno-mail` y pull request https://github.com/emilykohler12/nexa-backend/pull/17 con base `integracion-ae4`; el merge lo hace Emily. (c) Fila de la fase 3b en la tabla 8.3 del README. (d) No se empieza la fase 4 hasta el merge. |
| 2 | Alternativas y criterio de descarte | Seguir con la fase 4 sin esperar el merge: descartado, es el flujo acordado (una fase por rama, Emily solo mergea). Pushear a `main`: descartado, redesplegaría Render y la migración de esta fase todavía no se aplicó en Supabase. |
| 3 | Evidencia que la sostiene | `gh pr view 16` devolvió estado `MERGED` y `mergeCommit` `13aa400`. `git push` creó la rama remota y `gh pr create` devolvió el pull request 17. No se tocó `main` ni se aplicó ninguna migración en producción. |
| 4 | Aporte personal | Emily pidió subir los commits a `integracion-ae4` (por pull request), que ella solo haga el merge, que se anote todo cambio en la bitácora de la AE3 y que se confirme el merge del pull request 16. |
| 5 | Desacuerdo y resolución | Ninguno. Los commits van con el nombre de Emily y sin la línea de coautoría, y el pull request sin el pie de «Generado con Claude Code», como en las fases anteriores. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y la CLI `gh`. Revisión de Emily pendiente. |



## Entrada 94: revisión de las fases 2 y 3 del frontend y de la Fase 3b del backend

**Fecha:** 2026-10-31 (hora aproximada, Argentina; noche, después de abrir el pull request 17 y antes de la entrada 95). La entrada original decía 2026-11-01; se corrigió con la fecha de los pull requests (ver la entrada 144).

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aceptar la Fase 2 del frontend (PR #13; 156 tests en 23 archivos; horarios del servidor, mensajes de error, estados y acciones «Marcar No asistió» y «Corregir: la clienta vino»), la Fase 3 del frontend (PR #14; 200 tests en 25 archivos; diálogo de cancelación del personal con hora de aviso y resultado de la seña, política de devolución sin la opción «parcial») y la Fase 3b del backend (PR #17; 37 archivos y 438 tests; recordatorio de turno por mail 5 horas antes con tope de 1 hora, un mail por combo y marca `reminder_sent_at`). Pedir a Claude Code que limpie `reminder_sent_at` al reprogramar y que agregue a la política de privacidad la línea del recordatorio subiendo su versión. Crear la Fase 3b del frontend (alias `/mis-turnos`, fechas en hora de Argentina y confirmación al cancelar un servicio de un combo). Registrar que la base de producción tiene 2 usuarias, 0 clientas y 0 turnos. Marcar como terminada la tarjeta de la Fase 2 del backend. |
| 2 | Alternativas y criterio de descarte | (a) Mantener `reminder_sent_at` al reprogramar: descartado, la clienta no recibiría recordatorio del nuevo horario. (b) No tocar la política de privacidad: descartado, el sistema pasa a enviar un mail por su cuenta y conviene declararlo; con 0 clientas no hay costo de volver a pedir aceptación. (c) Dejar las fechas con `toISOString()` sin corregir: descartado, fallan pasadas las 21:00 de Argentina. |
| 3 | Evidencia que la sostiene | Informes de Claude Code del 31/10/2026 y 1/11/2026 (PR #13, #14 y #17; lint, tipos, pruebas y build en verde). Resultados de Supabase: 2 usuarias, 0 clientas y 0 turnos. |
| 4 | Aporte personal | Emily aprobó las decisiones, corrió las consultas de producción y debe mergear los pull requests y hacer la prueba manual contra una base de pruebas. |
| 5 | Desacuerdo y resolución | Claude Code subió las ramas y abrió los pull requests por su cuenta aunque el prompt decía «sin push ni merge»; lo hizo siguiendo la indicación anterior de Emily de abrir siempre el PR con base `integracion-ae4`, y no hizo merge. Claude Code borró ramas ya mergeadas, comprobadas con `git branch --merged`. Las fases 2 y 3 del frontend no se probaron a mano: la prueba manual queda a cargo de Emily. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión de los informes, redacción del mensaje para Claude Code y del prompt del frontend de la Fase 3b, y actualización de cinco tarjetas. Claude no ejecutó ni verificó ningún cambio de código. Revisión final por Emily pendiente: mergear los PR #13, #14 y #17, y probar a mano el flujo de cancelación y de recordatorio. |

## Entrada 95: AE4, fase 3b, correcciones pedidas por Emily (reprogramación y política de privacidad)

**Fecha:** 2026-10-31, de 23:10 a 23:40 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily al aprobar la fase 3b. (a) Reprogramar un turno vuelve `appointments.reminder_sent_at` a `null` en los tres caminos: `rescheduleForClient` (la clienta) y `updateForProfessional`/`updateForAdmin` (solo cuando cambia la fecha o la hora, la misma condición `rescheduling` que ya activa el aviso de reprogramación). (b) Cuatro pruebas nuevas en `tests/integration/appointments.reminder.test.ts` (clienta, profesional, administrador, y una que verifica que un cambio de notas sin mover el horario NO limpia la marca) más una que verifica que el nuevo horario sigue sujeto a la ventana de 5 horas. (c) `PRIVACY_POLICY_VERSION` pasa de `2026-09` a `2026-11` en el backend. (d) `CLAUDE.md` y `docs/cambios-y-decisiones.md` actualizados. (e) Va en el mismo pull request 17, en la rama `feat/recordatorio-turno-mail`: es la misma fase y ya estaba abierto. **Frontend (no se tocó, queda para Emily):** `nexa-frontend/src/app/config/legal.ts` (`PRIVACY_POLICY_VERSION = '2026-09'` a `'2026-11'`) y `nexa-frontend/src/pages/public/PrivacyPolicyPage.tsx` (agregar «Te enviamos por correo un recordatorio de tus turnos», por ejemplo en la sección 2 «Propósitos»). La prueba `PrivacyPolicyPage.test.tsx` lee la constante, no hace falta cambiarla. El frontend no pide volver a aceptar: nadie lee `termsVersion` ni `termsAcceptedAt` para bloquear nada, solo se graban al registrarse y al confirmar una reserva. |
| 2 | Alternativas y criterio de descarte | Limpiar la marca solo en el camino de la clienta: descartado, Emily pidió ambos. Limpiarla ante cualquier PATCH del personal: descartado, reenviaría el mail por cambiar una nota. Un commit aparte en la rama de la fase 4: descartado, esa rama no existe todavía y mezclaría la fase 4 con una corrección de la 3b. Exigir volver a aceptar la política: no hace falta, hay 0 clientas y la aceptación se regraba en cada reserva. |
| 3 | Evidencia que la sostiene | Sin el cambio en el servicio, las cuatro pruebas de reprogramación fallan; con el cambio pasan (se probó quitando y devolviendo el cambio). `terms-version.test.ts` compara con la constante, sigue verde. `npm run typecheck:all` sin errores. |
| 4 | Aporte personal | Emily decidió limpiar la marca al reprogramar (que era la decisión pendiente del límite conocido de la entrada 92), pidió la prueba, y decidió agregar la línea a la política y subir la versión. |
| 5 | Desacuerdo y resolución | Observación de Claude Code: `createdAt` no cambia al reprogramar, así que la regla de las 5 horas se mide desde la reserva original hasta el nuevo inicio. Un turno reservado hace días y movido para dentro de pocas horas recibe el recordatorio apenas corre el job, aunque la clienta acaba de reprogramar. Se dejó así porque es lo que Emily describió («más de 5 horas desde la reserva»); queda anotado en `docs/cambios-y-decisiones.md`. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5): el cambio, las pruebas y esta entrada. Sin librerías nuevas, no hizo falta Context7. Revisión de Emily pendiente. |



## Entrada 96: AE4, fase 4 — tienda: lista pública solo con disponibles, lista del administrador y libro de inventario (rama `fix/tienda-publica-solo-disponibles`)

**Fecha:** 2026-11-01 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. (a) `GET /api/store/products` (pública) devuelve solo productos `active` con `stock > 0`, con `select` explícito (`id`, `name`, `brand`, `category`, `description`, `imageUrl`, `price`) y `available: true`; ya no salen `stock`, `minStock` ni `status`. (b) Ruta nueva `GET /api/admin/store/products` (solo administrador) con todos los productos; el alta, la edición y la baja no cambiaron. (c) `createForClient` ya rechazaba producto inexistente, inactivo o «sin stock» (`PRODUCT_NOT_FOUND`) y cantidad mayor al stock sumando líneas (`INSUFFICIENT_STOCK`): no se cambió el código, se agregaron las pruebas que lo fijan. (d) `applyPaymentResult` crea un `InventoryMovement` de salida por producto (nota `Venta — pedido <id>`, fecha de Argentina) en la misma transacción que reclama el pedido y descuenta el stock. Sin migración. (e) Se actualizaron `CLAUDE.md`, `docs/cambios-y-decisiones.md` y el README (457 pruebas en 38 archivos, fila de la fase 4). |
| 2 | Alternativas y criterio de descarte | **Devolver `stock` en la lista pública:** descartado, el frontend solo lo usa para esconder agotados (`StoreSection`, `PromotionsPage`), no para limitar el carrito. **Reservar el stock al crear el pedido:** descartado, un checkout abandonado dejaría productos bloqueados; queda como límite conocido. **Columna `orderId` en `inventory_movements`:** descartada, exige una migración en Supabase y no la pidió la fase; la relación queda en la nota. **Ruta de administrador con otro nombre o dentro de `/store`:** descartado, `/admin/store/products` aprovecha el `requireRole('admin')` del router de `admin/`. |
| 3 | Evidencia que la sostiene | `tests/integration/store.availability.test.ts` (19 casos). Sin el cambio en `src`, fallan los 8 casos de lista pública, lista del administrador y libro de inventario; los de rechazo del pedido pasan igual, porque esa regla ya existía. `npm run typecheck:all` limpio y `npm test` con 38 archivos y 457 pruebas verdes. |
| 4 | Aporte personal | Emily definió el alcance de la fase (qué ve el público, la ruta del administrador, la validación del pedido y la salida de inventario) y la rama. |
| 5 | Desacuerdo y resolución | Ninguno. Hallazgo: la corrección de la fase 3b (`reminder_sent_at` al reprogramar y versión de la política de privacidad, commit `031e319` en `origin/feat/recordatorio-turno-mail`, entrada 95) se subió después del merge del pull request 17 y **no está en `integracion-ae4`**; esta rama sale de `integracion-ae4` y no la incluye. Hace falta un pull request propio para esa corrección. Por eso esta entrada es la 78 y no la 77. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). La documentación de Prisma consultada con Context7 correspondía a otra versión mayor que la del proyecto (6); se siguió el patrón de `$transaction` ya usado en `applyPaymentResult`. Revisión de Emily pendiente. |

**Impacto en el frontend (no se hizo, lista de archivos de `../nexa-frontend/src`):**
- `features/home/components/StoreSection.tsx`: quitar el filtro `p.status === 'active' && p.stock > 0` (hoy ocultaría todo, porque ya no llegan `stock` ni `status`); la interfaz `Product` pasa a tener `available: true`.
- `pages/admin/promotions/PromotionsPage.tsx` (línea ~230): para productos, pedir `/api/admin/store/products` en vez de `/api/store/products` (o quitar el filtro de stock).
- `pages/admin/store/StorePage.tsx` (línea ~27): pedir `/api/admin/store/products`; si no, el administrador deja de ver inactivos, agotados y el stock mínimo.
- `pages/admin/store/ProductsTab.tsx` e `InventoryTab.tsx`: sin cambio de código, pero el libro de movimientos ahora incluye salidas por ventas pagadas (nota `Venta — pedido <id>`).
- Backend y frontend tienen que salir juntos.



## Entrada 97: AE4, fase 3b, texto de la política de privacidad en `00-gestion` (versión 2026-11)

**Fecha:** 2026-11-01, de 03:35 a 03:55 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. `00-gestion/POLITICA_PRIVACIDAD.md` suma, en la sección 3, el párrafo que ya muestra la web: «Usamos tu correo electrónico para enviarte recordatorios de tus turnos (unas 5 horas antes), avisos cuando tu turno se cancela o se reprograma, y los mensajes de tu cuenta (verificación de correo y recuperación de contraseña). No lo usamos para campañas ni publicidad.» La fecha pasa a «1 de noviembre de 2026 (versión 2026-11)». Así el documento de la entrega coincide con la página del frontend y con `PRIVACY_POLICY_VERSION = '2026-11'` del backend, que ya había subido la entrada 95. El commit va en la rama `fix/recordatorio-reprogramacion-politica-privacidad`, de la entrada 95, que no estaba pusheada. |
| 2 | Alternativas y criterio de descarte | Una rama aparte desde `integracion-ae4`: descartado, tocaría el mismo tramo de la bitácora y de `docs/` que la entrada 95 y habría conflicto entre los dos pull requests. Cambiar el texto de la web o la versión: no hizo falta, ya estaban en `2026-11`. Copiar la redacción del frontend palabra por palabra en vez de reescribirla: elegido, para que las dos versiones no diverjan. |
| 3 | Evidencia que la sostiene | El texto agregado coincide con la constante `EMAIL_USE` de `nexa-frontend/src/pages/public/PrivacyPolicyPage.tsx`. La versión del backend (`src/app/constants/legal.ts`) y la del frontend (`src/app/config/legal.ts`) son ambas `2026-11`. Resultados de `typecheck:all` y `npm test` en la entrada 98. |
| 4 | Aporte personal | Emily eligió agregar la línea a la política y subir la versión, y pidió sumar el texto a la rama que ya tenía la subida de versión. |
| 5 | Desacuerdo y resolución | Ninguno. Aclaración de la entrada 92, punto 5 (6): subir la versión no vuelve a pedir la aceptación; `termsVersion` y `termsAcceptedAt` solo se regraban al registrarse y al confirmar una reserva. El documento no menciona la sección 5 de WhatsApp: se dejó como estaba. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). Sin librerías nuevas, no hizo falta Context7. Revisión de Emily pendiente. |



## Entrada 98: AE4, push de las correcciones de la fase 3b (reprogramación y política de privacidad) y pull request

**Fecha:** 2026-11-01, de 03:55 a 04:10 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. Push de `fix/recordatorio-reprogramacion-politica-privacidad` y pull request con base `integracion-ae4`; el merge lo hace Emily. La rama junta el commit de la entrada 95 (limpiar `reminder_sent_at` al reprogramar y subir `PRIVACY_POLICY_VERSION` a `2026-11`), el de la entrada 97 (texto de la política en `00-gestion`) y un merge de `integracion-ae4` (fase 4) para que el pull request no tenga conflictos. Esas correcciones de la entrada 95 estaban hechas por otra sesión de Claude Code y sin pushear; el pull request 17 ya se había mergeado antes, por eso van en un pull request nuevo. Se esperó a que la suite pasara limpia antes de pushear, como pidió Emily. |
| 2 | Alternativas y criterio de descarte | Pushear sin la suite en verde: descartado, la primera corrida dio 125 fallas por una causa ajena al código (ver elemento 3) y Emily pidió esperar. Rehacer las entradas 95 y 97 en una rama nueva desde `integracion-ae4`: descartado, habría duplicado el trabajo de la otra sesión. Resolver el conflicto de la bitácora con el orden 77, 78, 79 (por número) en vez de dejar la de la fase 4 antes de la 77. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. `npm test` (corrida limpia, sin otra sesión usando la base de pruebas): 38 archivos y 462 pruebas en verde (antes 37 y 443 en la rama, 38 y 457 en `integracion-ae4`). La corrida anterior dio 125 fallas en 24 archivos con `findUniqueOrThrow` sin filas y un deadlock `40P01`, porque otra sesión corría `vitest` al mismo tiempo contra la misma base de pruebas, que se trunca antes de cada caso; no tenía relación con los cambios. Lección: no correr `npm test` mientras otra sesión lo corre. |
| 4 | Aporte personal | Emily eligió sumar el texto de la política a esa rama, y después pidió pushear y abrir el pull request cuando la suite pasara. |
| 5 | Desacuerdo y resolución | Ninguno. El conteo de tests del README se dejó en 462, el de la corrida limpia. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y la CLI `gh`. Revisión de Emily pendiente. |



## Entrada 99: AE4, fase 5, anonimización completa y alergias (RNF-03)

**Fecha:** 2026-11-01, de 04:00 a 04:25 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily, en la rama `fix/anonimizacion-y-alergias`. (1) `anonymizeClient` conserva lo que hacía y suma: borrar las fotos de la galería (filas y archivos, con el nuevo `uploadProvider.deleteImages`, que nunca lanza), vaciar teléfono, dirección y notas de los pedidos y el texto de las reseñas (se conserva el puntaje). Los cambios en la base van en una transacción y los archivos se borran después; si alguno falla, entrada de actividad de nivel `error` con la lista. (2) La entrada de actividad enumera los campos tocados con cantidades (sesiones, fotos, pedidos, reseñas) y quién la ejecutó. (3) `listClientsForProfessional` devuelve la alergia del perfil solo si la profesional tiene un turno `finished` con esa clienta. (4) Informe sin tocar código: ningún endpoint escribe `Client.allergies`. `toProfessionalView` devuelve `client.allergies` sin pedir turno finalizado; `getHistoryForProfessional` no devuelve alergias. Esos dos puntos se informaron a Emily antes de tocarlos. Emily pidió quitar la alergia del perfil de `toProfessionalView` (agenda y respuestas de crear, editar y registrar llegada): ahora usa la misma regla del turno finalizado (`hasAttended`; la lista de la agenda lo calcula con sus propias filas). |
| 2 | Alternativas y criterio de descarte | Borrar los archivos antes que las filas: descartado, un fallo de la base dejaría fotos borradas de un cliente que sigue con su galería. Cortar la anonimización si falla un archivo: descartado, lo pidió Emily. Pasar `status` de las reseñas con texto vaciado a `approved`: no se hizo, no estaba pedido. Contar en el aviso todos los pedidos de la clienta: se cuentan solo los que tenían algún dato por vaciar. |
| 3 | Evidencia que la sostiene | Supabase `remove` devuelve en `data` solo lo que borró (consulta a Context7 sobre supabase-js), así que un bucket sin permiso de borrado no da error: se cuenta como fallido lo que no vuelve en `data`. Pruebas nuevas: `admin.anonymize-personal-data.test.ts` (9), `uploads.delete-images.test.ts` (5) y 10 casos en `allergies.consent-visibility.test.ts` (agenda y respuesta del PATCH incluidas; finalizado sí; cancelado, no asistió, no asistió automático, confirmado futuro y pendiente no; finalizado con otra profesional no; alergia del turno propio sí; sin `RefreshSession` tras anonimizar). `npm run typecheck:all` sin errores. `npm test`: 40 archivos y 486 pruebas en verde. |
| 4 | Aporte personal | Emily definió qué se borra, qué se conserva y la regla de visibilidad de la alergia, y pidió informar antes de tocar `toProfessionalView`. |
| 5 | Desacuerdo y resolución | La rama se cortó del tip de `fix/recordatorio-reprogramacion-politica-privacidad` (el pull request 19 todavía estaba abierto) y no de `integracion-ae4`, para no pisar las entradas 95 a 98 de esta bitácora. Emily mergeó el pull request 19 el 2026-11-01 a las 07:10 UTC, antes del push, así que el pull request de esta fase contra `integracion-ae4` trae solo los commits de la fase 5. Push y pull request hechos a pedido de Emily; el merge lo hace ella. Pendiente de Emily: que el bucket `images` permita borrar con la clave anónima. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) y Context7 (supabase-js, `storage.remove`). Revisión de Emily pendiente. |



## Entrada 100: AE4, fase 6, brechas de requisitos y revisión de las alertas de Sentry y UptimeRobot

**Fecha:** 2026-11-01, de 04:23 a 04:55 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily, en `fix/brechas-requisitos` (backend y frontend, cortadas de `integracion-ae4` ya con el pull request 20 mergeado). **RF-02:** un validador de celular argentino (`src/app/validators/phone.ts`) aplicado a registro, perfil de la clienta, invitación de profesional, ediciones del administrador, perfil y onboarding de la profesional y turnos manuales. La expresión se mostró a Emily antes de implementarla y la aprobó: `/^(?:\+?54)?9?0?[1-3]\d{1,3}(?:15)?\d{6,8}$/` sobre el valor sin separadores, más 10 dígitos sin prefijos. **RF-03 y RF-17:** el servicio especial nace con `paymentStatus = 'pending'` y el frontend cobra la seña con Mercado Pago; toda cancelación (job de impagos, clienta, personal) devuelve el horario del día. **RF-06:** `professionals.joined_at` (migración nueva), editable por el administrador, con `createdAt` por defecto, y desempate por antigüedad en `resolveProfessionalId`. **RF-11:** uñas, cabello, cuerpo y rostro, y `combo` solo para servicios simultáneos. **RF-14 y RNF-05:** una entrada de actividad por turno liberado por seña impaga. **RF-24:** se quitan los seis tipos de aviso sin emisor (ninguno tenía emisor ni lector fuera de las definiciones de tipo y del mapa de íconos del frontend). **RNF-07:** se borran `social.provider.ts`, `socialLogin.dto.ts`, `GOOGLE_CLIENT_ID`, el mock del test y el script de Google de `index.html`. **Alertas (se revisaron a pedido de Emily):** los 4 avisos de Sentry y 50 eventos en 14 días eran todos `environment: test` y `server_name: EmilyPC`, o sea de las corridas de `npm test`; `initSentry` ya no inicia con `NODE_ENV=test`. La caída 503 de UptimeRobot del 31/10 a las 19:59 UTC: **causa no determinada** (ver elemento 5). |
| 2 | Alternativas y criterio de descarte | **Teléfono más permisivo (8 a 15 dígitos):** descartado, dejaría pasar números que no son celulares. **Normalizar el teléfono al guardarlo:** descartado, exige migrar datos y no se pidió; se guarda como lo escribió la persona. **Servicio especial: dejarlo nacer `partial` y solo agregar el cobro:** descartado, la seña figuraría paga sin estarlo. **Cambiar solo el estado y no liberar el horario:** descartado por Emily; sin liberar, el único lugar del día quedaría tomado por un turno cancelado. **Restringir la categoría a las cuatro sin `combo`:** descartado por Emily, los servicios simultáneos ya usan la categoría `combo` en el panel. **Validar la categoría en cada edición:** descartado, trababa guardar cualquier otro campo de un servicio viejo; se revisa solo si el pedido trae `categoryId` o `isCombo` (se mira el cuerpo crudo porque zod completa `isCombo` con su valor por defecto). **Fecha de ingreso con valor por defecto `now()`:** descartado, usar `NULL` y caer en `createdAt` no cambia el orden de las profesionales existentes. **Apagar Sentry también en desarrollo:** descartado, Emily lo configuró a propósito el 04/10; se filtra por entorno. |
| 3 | Evidencia que la sostiene | Consulta a Sentry (organización `kologic`, proyecto `lorenestudiodebelleza`, 14 días): todos los eventos con `environment: test`; el único error con causa en el código era del 24/10, `PATCH /api/client/profile` con `phone` como objeto o arreglo, que daba 500 y ahora da 400. Pruebas nuevas: `phone.validation.test.ts`, `special-service.payment.test.ts` (5), `professional.joined-at.test.ts` (6), `services.category.test.ts`, `sentry.init.test.ts` (2), `google-remnants.test.ts` (2) y 3 en `jobs.release-unpaid.test.ts`; en el frontend `phone.test.ts` y `SpecialServiceBookingFlow.test.tsx` (4). Se corrigió una prueba existente (`auth.minor-fixes`, teléfono de 20 caracteres: veinte unos ya no es un celular válido). Backend: `npm run typecheck:all` limpio y `npm test` con 46 archivos y 546 pruebas en verde (antes 40 y 486). Frontend: `typecheck:all` limpio, 36 archivos y 326 pruebas, `npm run build` correcto, lint sin errores en los archivos tocados. README: 546 y 326 pruebas, fila de la fase 5 y de la fase 6 en 8.3. El índice parcial de R-01 y el scheduler no cambiaron (el log de arranque sigue igual), por eso esos tramos del README quedaron como estaban. |
| 4 | Aporte personal | Emily definió el alcance de la fase (las siete brechas), pidió mostrarle la expresión del teléfono antes de implementarla, eligió «4 + combo» para las categorías y «liberar también el horario» para el servicio especial, y pidió revisar las alertas de Sentry y de UptimeRobot en la misma rama. |
| 5 | Desacuerdo y resolución | Los puntos «a consultar» del prompt (grilla de horarios y bloqueo del horario original) ya se resolvieron en la fase 2 y no aplicaban acá; el tercero, requisitos que choquen con el código, se consultó: el choque fue RF-03 (el frontend no cobraba) y la falta de liberación del horario especial, ambos resueltos con la aprobación de Emily. **No determinado:** la causa de la caída 503 del 31/10 19:59 UTC. `/api/health` solo responde 503 si la base no contesta, pero un redespliegue o un arranque en frío del plan gratis de Render también devuelven 503 desde el proxy, y desde acá no se ven los eventos de Render de esa hora. Para cerrarlo hay que mirar los eventos y el log de Render de esa franja. Pendiente de Emily: aplicar la migración `20261101120000_fecha_ingreso_profesional` en Supabase antes del push; correr las consultas 5, 6 y 8 de `docs/consultas-previas-produccion.sql`; quitar `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` de Render y Vercel y las líneas de Google y Facebook de su `.env.test`; filtrar la regla de alerta de Sentry por `environment:production`. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) y el conector de Sentry para consultar los eventos. **No se usó Context7** para zod 4, Vitest ni Prisma: se siguieron patrones ya presentes en el repositorio (`z.string('mensaje')`, `vi.mock`, el `$queryRaw ... FOR UPDATE` de `createSpecialForClient`); queda como pendiente de revisión. Revisión de Emily pendiente. |

**Impacto en el frontend (hecho en `nexa-frontend`, rama `fix/brechas-requisitos`):**
- `src/shared/utils/phone.ts` (nuevo) y su uso en `features/auth/model/schemas.ts`, `pages/public/ProfessionalRegisterPage.tsx`, `pages/client/ProfilePage.tsx`, `pages/admin/clients/CreateClientModal.tsx`, `pages/admin/clients/tabs/InfoTab.tsx` y `pages/admin/professionals/tabs/ProfileTab.tsx`. El registro responde `422 VALIDATION_ERROR` y los demás `400 VALIDATION_ERROR` con el texto «Ingresá un celular argentino válido…».
- `features/client/booking/SpecialServiceBookingFlow.tsx`: ahora pide `POST /api/client/appointments/:id/payment`, abre Mercado Pago y espera `verify-payment`. **Backend y frontend tienen que salir juntos:** con el backend nuevo y el frontend viejo, el turno especial queda `pending` y se libera a los 20 minutos sin que la clienta pueda pagar.
- `pages/admin/professionals/tabs/ProfileTab.tsx` y `types.ts`: campo de fecha de ingreso (`joinedAt`, `joinedAtIsDefault`; el `PATCH` acepta `joinedAt` o `null`).
- `pages/admin/services/ServiceFormModal.tsx` y `SpecialServiceFormModal.tsx`: «Combo» solo en servicios simultáneos (el backend responde `400 VALIDATION_ERROR` si no).
- `features/client/notifications` y `features/professional/notifications`: sin los tipos que no se emiten, con ícono genérico para filas viejas. `index.html`: sin el script de Google ni `fb-root`.
- La actividad de la liberación por seña impaga ya no trae la entrada con el total (`Turnos liberados por falta de pago: N`) sino una por turno (`Turno liberado por falta de pago`, módulo `appointments`, con `appointmentId`); ningún archivo del frontend dependía del texto anterior.


## Entrada 101: AE4, fase 7, pruebas faltantes por requisito (rama `test/cobertura-completa`)

**Fecha:** 2026-11-01, de 04:55 a 05:02 (consultas a Emily), 04:57 (rama cortada de `integracion-ae4` con el pull request 21 mergeado) y de 14:20 a 14:45 (pruebas, documentación y commits; entre medio la sesión se cortó por el límite de uso). Hora de la máquina, UTC-3.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (modelo Opus 5.5)**, a pedido de Emily, sin tocar `src/`. Diez archivos de prueba nuevos, uno por tema, que ejercitan el criterio de aceptación de cada requisito: `payments.webhook-signature` (RNF-09, 4), `settings.deposit-and-refund` (RF-03, RF-32 y RF-04, 7), `services.catalog` (RF-11 y RF-17, 9), `promotions-and-special-events` (RF-20 y RF-23, 10), `store.blocking-and-movements` (RF-18 y RF-21, 10), `notifications.inbox-and-client-mail` (RF-24, 10), `reviews` (RF-25, 7), `history-activity-dashboard` (RF-26, RF-27 y RF-34, 8), `gallery-and-professional-profile` (RF-28 y RF-29, 12) y `client-details-job-interest-late-booking` (RF-31, RF-33 y reserva tardía en combos y servicios especiales, 9). RF-34: la definición de cada indicador del panel quedó por escrito en `docs/cambios-y-decisiones.md` («Fase 7»). RNF-10: la salida de `npm run typecheck:all` quedó en `docs/evidencias/fase-7-typecheck.txt`. Se borraron las ramas ya mergeadas `fix/anonimizacion-y-alergias`, `fix/brechas-requisitos`, `fix/recordatorio-reprogramacion-politica-privacidad` y `fix/tienda-publica-solo-disponibles` (locales y remotas, verificadas con `git merge-base --is-ancestor`). |
| 2 | Alternativas y criterio de descarte | **Dejar RNF-09 afuera, como se había acordado el 31/10:** descartado por Emily, que eligió incluirlo con una clave de prueba puesta en el test (sin llamar a Mercado Pago) y sumar la reserva tardía en combos y servicios especiales. **RF-24 literal (ningún otro mail a la clienta):** descartado por Emily; habría fallado por el recordatorio del turno. Se prueba la regla con las excepciones escritas (recordatorio, verificación del correo y recuperación de la contraseña) y una revisión del código que lista cada envío permitido. **Corregir RF-33 en esta rama:** descartado por Emily; se prueba el comportamiento actual y se reporta. **Escribir pruebas que fallen para los errores encontrados:** descartado, rompería el CI; los errores quedan reportados (elemento 5) para que Emily decida. **Usar el subagente `escritor-tests`:** descartado, Emily no lo pidió y el contexto ya estaba relevado. |
| 3 | Evidencia que la sostiene | Backend: `npm run typecheck:all` limpio (código de salida 0, en `docs/evidencias/fase-7-typecheck.txt`) y `npm test` con **56 archivos y 631 pruebas en verde** (antes 46 archivos; el README decía 546 pruebas). Cada hallazgo se reprodujo con una prueba descartable antes de escribirlo: el `PUT` parcial de una promoción inactiva la dejó `active` con `kind: discount` y la descripción vacía; un evento inactivo pasó a activo; `active: "false"` se leyó como `true`; un id inexistente dio `500` en servicios, promociones y eventos; borrar una entrada con el stock ya vendido dejó el stock en −4; una franja `20:00`–`08:00` y otra `"nada"`–`"x"` se guardaron; la categoría `cualquiera` se aceptó al editar una foto; un `PATCH /professional/profile` con solo `specialty` borró la `bio`. En el frontend se verificó que hoy siempre se manda el formulario completo (`PromotionsPage.tsx`, `SpecialEventsSection.tsx`, `ServicesPage.tsx`), por eso las ediciones parciales no se disparan desde la interfaz. Context7 (Vitest 5.0.3) para `vi.waitFor`: reintenta la función asíncrona hasta que pasa, con 1 segundo por defecto. README: 631 pruebas y 56 archivos, dos archivos más en la sección 1.4 y la fila de la fase 7 en 8.3; el índice parcial de R-01 y el scheduler no cambiaron. |
| 4 | Aporte personal | Emily definió la lista de requisitos a cubrir y, consultada antes de implementar, eligió esperar el merge de la fase 6, incluir RNF-09 y la reserva tardía, las excepciones explícitas de RF-24 y probar y reportar RF-33 sin corregirlo. |
| 5 | Desacuerdo y resolución | Los puntos «a consultar» 1 y 2 (grilla de horarios y bloqueo del horario original) ya se resolvieron en la fase 2. El 3 (choques con el código) se consultó: RF-24 contra el recordatorio y RF-33. **Errores encontrados, sin corregir (decide Emily):** (a) borrar una entrada del libro deja el stock negativo; (b) `PUT` parciales de servicios, promociones y eventos pisan campos con los valores por defecto de zod (latente: la interfaz no lo dispara); (c) id inexistente da `500` en vez de `404` en esos tres; (d) `z.coerce.boolean` lee `"false"` como `true` en eventos; (e) perfil, franjas y onboarding de la profesional sin esquema zod; (f) la categoría de una foto no se valida al editar, y borrar una foto no borra el archivo del bucket; (g) RF-33 sin validación, sin limitador propio y con datos personales en la actividad que la anonimización no toca. **No determinado:** si `pendingBalance` del panel tiene que descontar el saldo ya cobrado en el local (hoy no lo descuenta). |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y Context7 para la documentación de Vitest 5. Commits sin la línea de coautoría, como pidió Emily. Revisión de Emily pendiente. |

**Impacto en el frontend:** ninguno. No cambió ninguna ruta, método, código de error ni forma de respuesta.


## Entrada 102: AE4, push de la fase 7 y pull request

**Fecha:** 2026-11-01, 14:46 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Opus 5.5)**: `git push -u origin test/cobertura-completa` y pull request 22 con base `integracion-ae4` (https://github.com/emilykohler12/nexa-backend/pull/22), con la lista de pruebas por requisito y los siete hallazgos sin corregir. Sin merge. |
| 2 | Alternativas y criterio de descarte | Merge directo o push a `main`: descartados, el flujo de la AE4 es que Emily revise y mergee cada fase en `integracion-ae4`, y `main` redespliega a la clienta real. |
| 3 | Evidencia que la sostiene | Commits `a34749a`, `f5c2390`, `a4aa471`, `77fd1b8`, `6cc47d7`, `aa86b17`, `718e8e6` (pruebas) y `45d8401` (documentación, entrada 101); `npm test` con 631 pruebas en verde antes del push. |
| 4 | Aporte personal | Emily definió el flujo (push y pull request por fase, ella mergea). |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y `gh`. |


## Entrada 103: AE4, fase 8, deuda técnica (rama `chore/deuda-tecnica`)

**Fecha:** 2026-11-01, de 14:42 a 14:46 (relevamiento, consultas a Emily y rama cortada de `integracion-ae4` con el pull request 22 mergeado) y de 14:47 a 14:57 (cambios, pruebas, documentación y commits). Hora de la máquina, UTC-3.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (modelo Opus 5.5)**, a pedido de Emily. (a) **Identificadores:** RF-06.01 → RF-08, RF-06.02 → RF-07 y RF-06.03 → RF-09 en 9 comentarios y títulos de pruebas de `src/`, `tests/` y `prisma/schema.prisma` (`a687dfb`); RF-06 sin punto (antigüedad, fase 6) no se tocó, y tampoco `00-gestion/BITACORA.md`, que es histórica. (b) **Seed de demostración** (`a4812d7`): `scripts/seed-demo.ts` exporta `seedDemo(now)` y carga, con datos inventados (cuentas `@nexa.local`), una profesional con horario, un servicio, una clienta de demo con un turno `confirmed` (seña paga, dentro de 2 días hábiles o más), uno `no_show_auto` (día hábil anterior, sin llegada, seña retenida) y uno `cancelled` por la clienta con más de 12 horas de aviso (seña `refunded`, `slot_locked` en false), y una promoción vigente desde hoy por 30 días. Las fechas salen de `todayArgentinaStr()` y saltan el domingo. Cada corrida borra y vuelve a crear solo los turnos de la clienta de demo. La profesional de demo pasó de «Loren (demo)» a «Valeria (demo)», para no usar el nombre de una persona real. Prueba nueva `tests/integration/seed-demo.test.ts` (7 casos). (c) **`.env.example`** (`fc9df24`): suma `NODE_ENV`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `MERCADOPAGO_WEBHOOK_SECRET` y `BACKEND_PUBLIC_URL`, y avisa que no hay que definir `TZ`. (d) **Manual de despliegue:** sección «Qué cambia en el manual de despliegue con la fase 8» en `docs/plan-de-despliegue.md`. (e) README: 638 pruebas en 57 archivos, 62 migraciones, salida y descripción de `seed:demo`, variables de entorno y fila de la fase 8 en 8.3. |
| 2 | Alternativas y criterio de descarte | **Corregir el comentario de `Appointment` en `schema.prisma`:** no hizo falta, ya estaba corregido desde `1bfdf67` (fase 2): no nombra `add_no_double_booking` y cita `20260826153839`, `20261028160000` y `20261031120000`, que son las tres migraciones que crean o recrean `appointments_professional_date_time_active_key` (verificado con `grep` en `prisma/migrations`). **Editar `00-gestion/RUNBOOK.md`:** descartado por Emily, que eligió anotar los cambios en `docs/plan-de-despliegue.md`. **Seed que no borre turnos (solo «si no existe»):** descartado, las fechas quedarían viejas y el `no_show_auto` o el confirmado dejarían de ser coherentes con el día en que se corre. **Agregarle al seed un freno contra producción:** no se agregó porque no estaba en el pedido; queda escrito en el seed, el README y el plan de despliegue que nunca se corre contra producción. **Pedir el libro v7 recién en la fase 9:** se consultó ahora; Emily lo va a agregar a `03-requisitos/`. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores (código de salida 0) y `npm test` con **57 archivos y 638 pruebas en verde** (antes 56 y 631). `npm run seed:demo` corrido dos veces contra la base de pruebas (se verificó antes que `DATABASE_URL` apuntara a `nexa_db_test`), sin duplicados. La prueba nueva comprueba que el `no_show_auto` sigue ocupando el horario (otro turno igual da `P2002`), que el cancelado lo libera, que la promoción sale en `GET /api/promotions/public`, que el job de inasistencia no marca nada y el salto del domingo un lunes y un viernes. Context7 (Vitest) para `vi.useFakeTimers({ toFake: ['Date'] })` con `vi.setSystemTime`. |
| 4 | Aporte personal | Emily definió el alcance de la fase y, consultada antes de implementar, confirmó el merge de la fase 7, eligió `docs/plan-de-despliegue.md` para el manual, va a agregar el libro v7 y dejó la estimación de horas (fase 9.3) para después de integrar todo en `main`. |
| 5 | Desacuerdo y resolución | Choques del prompt con el código (consulta 3): el comentario del schema ya estaba corregido; el libro v7 no estaba en el repositorio; `main` todavía no tiene ninguna rama de la AE4, así que la estimación de horas espera; y el porcentaje «con Claude Code según las marcas Co-authored-by» va a contar de menos, porque los commits de la AE4 van sin la línea (37 de 145 commits de `integracion-ae4` la tienen). Las consultas 1 y 2 ya se resolvieron en la fase 2. **No determinado:** qué variables están cargadas hoy en Render. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y Context7 para la documentación de Vitest. Commits sin la línea de coautoría, como pidió Emily. Revisión de Emily pendiente. |

**Impacto en el frontend:** ninguno. No cambió ninguna ruta, método, código de error ni forma de respuesta.


## Entrada 104: AE4, push de la fase 8 y pull request

**Fecha:** 2026-11-01, 14:58 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Opus 5.5)**: `git push -u origin chore/deuda-tecnica` y pull request 23 con base `integracion-ae4` (https://github.com/emilykohler12/nexa-backend/pull/23). Sin merge. Antes se borró la rama `test/cobertura-completa`, local y remota, verificada como mergeada con `git merge-base --is-ancestor`. Las ramas locales `feat/fase-4-tienda` y `feat/recordatorio-turno-mail` no se borraron: tienen commits que no están en `integracion-ae4` con el mismo contenido (`ac0ba11`, y `41cd6c0`/`031e319` con un equivalente ya integrado según `git cherry`); decide Emily. |
| 2 | Alternativas y criterio de descarte | Merge directo o push a `main`: descartados, el flujo de la AE4 es que Emily revise y mergee cada fase en `integracion-ae4`, y `main` redespliega a la clienta real. |
| 3 | Evidencia que la sostiene | Commits `a687dfb`, `a4812d7`, `fc9df24` y `8443f1f` (documentación, entrada 103); `npm run typecheck:all` limpio y `npm test` con 638 pruebas en verde antes del push. |
| 4 | Aporte personal | Emily definió el flujo (push y pull request por fase, ella mergea). |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y `gh`. |


## Entrada 105: AE4, fase 9, informes de cobertura y de cambios (rama `docs/informes-v8`)

**Fecha:** 2026-11-01, 15:06 (pull request 23 mergeado, rama `chore/deuda-tecnica` borrada y rama cortada de `integracion-ae4`), de 15:07 a 15:11 (corrida de la suite con el reporte JSON y lectura del libro v7) y de 15:11 a 15:18 (informes, README y commits). Hora de la máquina, UTC-3.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (modelo Opus 5.5)**, a pedido de Emily, sin tocar `src/` ni `tests/`. (a) `docs/cobertura-por-requisito.md` (`8974ed1`): los 42 requisitos del libro v7 (RF-01 a RF-34 y RNF-01 a RNF-10, sin RF-22, RF-30 ni la fidelización de RF-28), cada uno con su enunciado y criterio, el archivo y el nombre completo de cada prueba, el resultado de la última corrida y la cobertura: **29 completos, 11 parciales y 2 sin prueba** (RNF-01 y RNF-02). (b) `docs/cambios-y-decisiones.md` (`d484c3e`): tabla por fase (0 a 9) con qué cambió, por qué y qué pruebas lo verifican; límites conocidos generales, entre ellos el que pidió Emily (una hora fuera del horario reabierto pero dentro de la franja se acepta como turno normal); secciones de las fases 8 y 9; se quitó una línea vieja de la fase 3b que decía que la política de privacidad todavía no mencionaba el recordatorio. (c) README: catálogo vigente v7 y los tres documentos de `docs/` en la sección 1.5, fila de la fase 9 en 8.3 (cantidad de pruebas, índice parcial y scheduler sin cambios). (d) La estimación de horas (9.3) queda para después de que Emily integre todo en `main`. |
| 2 | Alternativas y criterio de descarte | **Clasificar con el criterio «en espíritu»:** descartado; se clasificó contra el texto del criterio del v7, y cuando el criterio choca con una regla vigente se marca parcial y se dice por qué (RF-05, RF-20, RF-28). **Corregir esos criterios en el libro:** descartado, el libro es documentación académica de Emily; quedan listados para que ella decida. **Agregar las pruebas que faltan (invitación vencida, `HttpOnly` de `access_token`, turno manual confirmado y sin seña, moneda en pedidos, mail a la profesional):** descartado, la fase 9 es solo de informes; quedan anotadas en cada requisito. **Contar como cubierto lo que prueba el frontend:** descartado, no se revisó `nexa-frontend` (queda como no determinado). |
| 3 | Evidencia que la sostiene | Corrida de `npm test` con `--reporter=json` el 01/11/2026 a las 15:07 sobre `d04ad34` (igual a `integracion-ae4`): **57 archivos y 638 pruebas, 638 pasaron y 0 fallaron**; el informe toma de ese reporte el resultado de cada prueba. El libro v7 se leyó descomprimiendo el `.xlsx` en el directorio temporal (hojas «Catálogo» y «Cambios v7»), sin modificarlo. Cada clasificación parcial se apoyó en una lectura del código o de la prueba: no hay prueba del monto de la preferencia de Mercado Pago (simulada en `tests/setup.ts`), la única marca `HttpOnly` comprobada es la de `refresh_token` (`auth.minor-fixes`), ninguna prueba de invitación vencida, el mail `Nuevo turno agendado — Nexa` solo aparece en la lista de envíos de `notifications.inbox-and-client-mail`, `rechaza una promoción vencida` en `appointments.booking`, y las visitas cuentan solo `finished` desde la fase 1. Al final, `npm run typecheck:all` y `npm test` otra vez (resultado en la entrada 106). |
| 4 | Aporte personal | Emily pidió los informes, eligió usar el libro v7 (lo agregó a `03-requisitos/`), dejó la estimación de horas para después de integrar todo en `main` y había pedido declarar el límite del horario reabierto. |
| 5 | Desacuerdo y resolución | **Error de Claude Code en la fase 8:** el libro v7 entró al repositorio dentro del commit `a687dfb` («renombrar RF-06.01…»), porque ese commit se hizo con `git add -A` cuando Emily ya había puesto el archivo en la carpeta, y la entrada 103 dice que el libro «se va a agregar». El commit ya está mergeado en `integracion-ae4` (pull request 23); no se reescribió la historia. El archivo es el que Emily quería en el repositorio, pero su commit no lo nombra. Desde ahora los commits agregan los archivos por nombre. **Criterios del v7 que no coinciden con el código:** RF-05, RF-20, RF-28 y RNF-10 en el criterio, y RF-01, RF-21 y RNF-08 en el enunciado; RF-17 y RNF-09 figuran sin prueba y ya la tienen. **No determinado:** qué cubren las pruebas del frontend. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) con un script descartable de Node para leer el `.xlsx` y armar el informe desde el reporte JSON de Vitest (no queda en el repositorio). Context7 no se usó: no se escribió código que dependa de una librería del proyecto. Commits sin la línea de coautoría, como pidió Emily. Revisión de Emily pendiente. |

**Impacto en el frontend:** ninguno.


## Entrada 106: AE4, verificación final de la fase 9, push y pull request

**Fecha:** 2026-11-01, de 15:16 a 15:22 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Opus 5.5)**: `git push -u origin docs/informes-v8` y pull request 24 con base `integracion-ae4` (https://github.com/emilykohler12/nexa-backend/pull/24). Sin merge. |
| 2 | Alternativas y criterio de descarte | Merge directo o push a `main`: descartados, el flujo de la AE4 es que Emily revise y mergee cada fase en `integracion-ae4`, y `main` redespliega a la clienta real. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores (salida 0) y `npm test` con **57 archivos y 638 pruebas en verde** (15:20), después de los commits `8974ed1`, `d484c3e` y `4051bba` (documentación, entrada 105). |
| 4 | Aporte personal | Emily definió el flujo (push y pull request por fase, ella mergea). |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y `gh`. |

---

**Nota de la entrada 107 a la 93.** Estas cinco entradas son las del frontend de la AE4 (fases 1, 2, 3, 3b y la sincronización con `main`). Estaban en `00-gestion/BITACORA.md` de `nexa-frontend`; el 05/11/2026 se pasaron acá con el texto tal cual (solo se les dio el formato de tabla de esta bitácora y se escaparon las barras verticales) y ese archivo se quitó del frontend: las bitácoras viven solo en `nexa-backend`. Las referencias a `00-gestion/BITACORA.md` o a «esta bitácora» que quedan dentro del texto son de entonces.


## Entrada 107: AE4, frontend, fase 1 — se eliminan campañas, puntos y fecha de nacimiento (rama `refactor/quitar-campanas-puntos-nacimiento`)

**Fecha:** 2026-10-31 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Acompañar en el frontend la baja que hizo el backend (Fase 1) de las campañas automáticas, los puntos de fidelización, el recordatorio de inactividad y la fecha de nacimiento. La ficha de la clienta pasa a leer `visits { totalVisits, totalSpent, lastVisit }` (solo turnos finalizados) en lugar de `loyalty`. Lo hizo Claude Code (Claude Sonnet 5.5), no yo, por una instrucción mía. |
| 2 | Alternativas y criterio de descarte | Claude Code dejó el resumen de visitas siempre visible arriba de las pestañas en vez de convertirlo en una pestaña nueva, para no volver a tener una pantalla de "fidelización" con casi nada adentro. Descartó dejar el campo "Fecha de nacimiento" del alta de profesionales: el backend no la guarda en ningún modelo, así que el campo se mandaba y se perdía. |
| 3 | Evidencia que la sostiene | `mapAdminClient` en `nexa-backend/src/modules/admin/admin.service.ts` (rama `refactor/quitar-campanas-puntos-recordatorio-nacimiento`, leída sin editar) devuelve `visits` y ya no `loyalty` ni `birthDate`; el schema de Prisma no tiene ningún campo de nacimiento. Resultado de las pruebas en la rama: lint sin errores, `typecheck:all` sin errores, 80 tests en 17 archivos y `build` correcto. Commits en README 8.3: `dd1b050`, `55fa408` y `1f54677`. |
| 4 | Aporte personal | Di la instrucción y el contexto del cambio de contrato. El código, las pruebas, el README (sección 8.3) y esta entrada los hizo Claude Code, en la rama `refactor/quitar-campanas-puntos-nacimiento`, cortada de `integracion-ae4`. Sin push ni merge: la revisión y la integración quedan de mi lado. |
| 5 | Desacuerdo y resolución | No hubo. Un punto para que lo revise: la instrucción hablaba de la fecha de nacimiento de la clienta, y Claude Code también la quitó del alta de profesionales (`1f54677`) porque el backend tampoco la guarda; si quisiera conservarla ahí, ese commit es independiente y se puede revertir solo. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5). Los commits llevan la línea `Co-Authored-By: Claude Sonnet 5.5`. |

**Impacto en el backend:** ninguno. Se leyó sin editar.


## Entrada 108: AE4, frontend, fase 2 — horarios reabiertos, reserva tardía y estados de inasistencia (rama `feat/horarios-reabiertos-y-estados`)

**Fecha:** 2026-10-31 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Acompañar en el frontend la Fase 2 del backend (inasistencia automática, horarios reabiertos y reserva tardía): que los horarios los calcule el servidor y no el reloj del navegador, que los horarios reabiertos se ofrezcan como «Horario de último momento», que el personal pueda marcar «No asistió» y corregirlo, y que en «Mis turnos» un turno en «No asistió (automático)» no se pueda cancelar ni reprogramar. Lo hizo Claude Code (Claude Sonnet 5.5), no yo, por una instrucción mía. |
| 2 | Alternativas y criterio de descarte | Claude Code descartó seguir filtrando horarios en el navegador (usaba la fecha en UTC y fallaba pasadas las 21:00 de Argentina) y calcular los reabiertos en el frontend: el backend ya los devuelve y el navegador no puede conocer los demás turnos de la profesional. Para la confirmación de «Marcar No asistió» usó un panel dentro del propio modal y no el `ConfirmModal` general, que queda por detrás del modal del administrador. En el modal del administrador, «Confirmar» y «Marcar finalizado» llamaban al guardado de datos, que no manda el estado: ahora cambian el estado por la ruta de estado. |
| 3 | Evidencia que la sostiene | Contrato leído sin editar en el backend (`src/modules/appointments/reopenedSlots.ts`, `appointment.service.ts` y `professional.service.ts`, Fase 2, PR 15 ya integrado en `integracion-ae4`): la disponibilidad devuelve `earliestStart` y `reopenedStarts`, las vistas devuelven `statusLabel`, y el servidor rechaza con `NO_SHOW_BEFORE_START`, `APPOINTMENT_OVERLAP`, `SERVICE_DOES_NOT_FIT`, `REOPENED_SLOT_CLOSED` y los demás códigos. Resultado en la rama: lint sin errores, `typecheck:all` sin errores, 156 tests en 23 archivos y `build` correcto. Commits en README 8.3: `d40a458`, `77e6b0c`, `e67053b` y `56d4dd6`. |
| 4 | Aporte personal | Di la instrucción y las reglas de la propietaria (30 minutos para la inasistencia automática, 40 para reabrir el horario, 15 de reserva tardía). El código, las pruebas de componente, el README (sección 8.3) y esta entrada los hizo Claude Code, en la rama `feat/horarios-reabiertos-y-estados`, cortada de `integracion-ae4`. La revisión y el merge quedan de mi lado. |
| 5 | Desacuerdo y resolución | No hubo. Puntos para que revise: (a) el texto «se abrirá un horario nuevo desde ahora» / «pasaron más de 40 minutos» se decide con la hora de Argentina que muestra la pantalla; el que manda es el servidor, y lo que efectivamente pasó queda en Actividad; (b) pendiente fuera de esta fase: hay otras fechas calculadas con `toISOString()` (inicio de la agenda de la profesional, rango de eventos especiales, «Mis turnos») que tienen el mismo problema del UTC y no se tocaron. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5). Los commits llevan la línea `Co-Authored-By: Claude Sonnet 5.5`. Último commit de la Fase 1 (README y bitácora): `52397c8`. Último commit de esta fase (README y bitácora): el de esta misma entrada, que no puede citar su propio hash; se ve con `git log -1 -- 00-gestion/BITACORA.md` en la rama de la Fase 2. |

**Impacto en el backend:** ninguno. Se leyó sin editar.


## Entrada 109: AE4, frontend, fase 3 — cancelación con hora de aviso y devolución de la seña (rama `feat/cancelacion-con-hora-de-aviso`)

**Fecha:** 2026-10-31 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Acompañar en el frontend la Fase 3 del backend (cancelación y devolución de la seña con hora de aviso): que el personal cancele diciendo quién cancela y, si avisó la clienta, cuándo y por qué medio; que se vea el resultado de la seña antes de confirmar; que la clienta vea lo mismo antes de cancelar y pueda hacerlo con el turno ya empezado; y que la política de devolución sea solo «total» o «ninguna». Lo hizo Claude Code (Claude Sonnet 5.5), no yo, por una instrucción mía. |
| 2 | Alternativas y criterio de descarte | Claude Code usó un solo diálogo para el administrador y la profesional (la única diferencia es el límite de 48 horas) en lugar de dos. La hora de aviso se lee y se manda en hora de Argentina, no en la del navegador, igual que los turnos. Para el plazo y la política de devolución usó el endpoint público de pagos (`/api/business/payments/public`), porque `/api/settings/payments` es solo del administrador y la profesional y la clienta no podrían leerlo. Si no se puede leer la política, el diálogo no adivina el resultado y deja que lo calcule el servidor. |
| 3 | Evidencia que la sostiene | Contrato leído sin editar en el backend (`src/modules/appointments/cancellationRules.ts`, `appointment.controller.ts`, `appointment.service.ts` y `settings`, Fase 3, PR 16 ya integrado en `integracion-ae4`): el PATCH de cancelación del personal exige `cancelledBy`, acepta `clientNoticeAt`, `noticeChannel` y `noticeNote`, y rechaza con `INVALID_NOTICE_TIME` y `NOTICE_TOO_OLD`; el detalle trae `cancellation`; la actividad trae `appointmentId`. Resultado en la rama: lint sin errores, `typecheck:all` sin errores, 200 tests en 25 archivos y `build` correcto. Commits en README 8.3: `09c8df8`, `94b4f50`, `f247359` y `8891e19`. |
| 4 | Aporte personal | Di la instrucción y las reglas de la propietaria (corte de 12 horas, aviso de hasta 48 horas para la profesional, devolución solo marcada en el sistema). El código, las pruebas, el README (sección 8.3) y esta entrada los hizo Claude Code, en la rama `feat/cancelacion-con-hora-de-aviso`, cortada de la rama de la Fase 2 porque su pull request todavía no estaba integrado. La revisión y el merge quedan de mi lado. |
| 5 | Desacuerdo y resolución | No hubo. Puntos para que revise: (a) la profesional ya no puede elegir «Cancelado» en el selector de estado: cancela con el botón «Cancelar turno», porque el backend ahora rechaza una cancelación sin `cancelledBy`; (b) en un combo, el resultado que se muestra usa el inicio de este turno (la clienta, el del primer servicio); el que manda es el servidor, que evalúa la seña una sola vez para todo el combo; (c) cancelar un servicio suelto de un combo desde el detalle de «Mis turnos» sigue sin pantalla de confirmación, como antes. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5). Los commits llevan la línea `Co-Authored-By: Claude Sonnet 5.5`. Último commit de la Fase 2 (README y bitácora): `546f4d9`. Último commit de esta fase (README y bitácora): el de esta misma entrada, que no puede citar su propio hash; se ve con `git log -1 -- 00-gestion/BITACORA.md` en la rama de la Fase 3. |

**Impacto en el backend:** ninguno. Se leyó sin editar.


## Entrada 110: AE4, frontend, fase 3b — enlaces del recordatorio de turno, fechas en hora de Argentina y política de privacidad (rama `feat/enlaces-recordatorio-y-fechas`)

**Fecha:** 2026-11-01 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Acompañar en el frontend la Fase 3b del backend (recordatorio de turno por mail, pull request 17): que los botones del mail, que apuntan a `/mis-turnos?turno=<id>&accion=ver|reprogramar|cancelar`, abran el turno en «Mis turnos» sin ejecutar nada por sí solos; que las fechas de «hoy» se calculen en hora de Argentina; que cancelar un servicio suelto de un combo pida confirmación, y que la política de privacidad diga para qué se usa el correo (recordatorios, avisos de turno y mensajes de la cuenta, sin campañas) con la versión `2026-11`. **Lo hizo Claude Code (Claude Sonnet 5.5), no yo**, por una instrucción mía. |
| 2 | Alternativas y criterio de descarte | (a) El enlace lleva a una ruta alias `/mis-turnos` que redirige a `/client/appointments` y no a una segunda pantalla de turnos, para no duplicar lógica. (b) Para volver tras el login se guarda el enlace en `sessionStorage` (como el carrito y la preselección de reserva) y no en el estado del router, porque el ingreso puede recargar la página; la marca vence a la hora y se borra siempre al entrar, incluso si entra una profesional o un administrador (a ellos no se les abre el turno). (c) «Turno inexistente» y «turno de otra clienta» dicen lo mismo: el servidor solo devuelve los turnos propios y distinguirlos revelaría si un id existe. (d) El enlace espera a que se cierren los avisos que ya salen al entrar (turno reprogramado, reseña pendiente) para no apilar diálogos. (e) Se resuelve durante el render y no en un efecto, porque la regla de lint `react-hooks/set-state-in-effect` lo rechaza. (f) Las fechas usan `Intl` con `America/Argentina/Buenos_Aires` y no una resta fija de 3 horas. |
| 3 | Evidencia que la sostiene | Pull request 17 del backend leído sin editar (`src/modules/appointments/reminder.ts`, entrada 92 de su bitácora): el enlace es `FRONTEND_URL/mis-turnos?turno=<id>&accion=ver|reprogramar|cancelar`, el id es el de la primera pata del combo, y la lista que el backend dejó para el frontend (alias, login y vuelta, abrir con confirmación, mensajes, quitar los parámetros, no abrir para personal). `GET /api/client/appointments` devuelve solo los turnos de la clienta, sin límite. Pruebas: lint sin errores, `typecheck:all` sin errores, 296 tests en 34 archivos y `build` correcto; las pruebas de fecha fallan con el código anterior (`toISOString`) y pasan con el nuevo. Además se comprobó en el navegador, en ancho de celular, que sin sesión `/mis-turnos?...` lleva a `/login` y deja el enlace guardado. Commits (README 8.3): `0aeb530` (fechas), `b05d8d0` (servicio suelto de un combo), `aeaac72` (enlaces del recordatorio) y `f78f8aa` (política de privacidad). |
| 4 | Aporte personal | Di la instrucción y las reglas (alias que conserva `turno` y `accion`, login y vuelta, confirmación siempre, mensajes para los casos de borde, fechas en hora de Argentina). El código, las pruebas, el README (sección 8.3) y esta entrada los hizo Claude Code, en la rama `feat/enlaces-recordatorio-y-fechas`, cortada de `integracion-ae4` con las fases 2 y 3 ya integradas. Se sube con pull request a `integracion-ae4`; la revisión y el merge quedan de mi lado. |
| 5 | Desacuerdo y resolución | No hubo. Puntos para que revise: (a) la instrucción pide un mensaje si el turno «ya empezó», y se aplicó a las tres acciones; como la Fase 3 permite cancelar un turno ya empezado desde la lista, el enlace `cancelar` de un turno empezado dice «ya empezó» pero la clienta todavía puede cancelarlo desde «Historial»; (b) fechas calculadas con `toISOString()` que **no se tocaron** por estar fuera del pedido: `PromotionsPage.tsx` (`todayISO`, vigencia de promociones), `shared/utils/promotionWindow.ts` (`isPromotionLive`, con su prueba), `InviteModal.tsx` (fecha mínima), `InventoryTab.tsx` (fecha por defecto) y `AppointmentModal.tsx` del administrador (`editDate`, que toma la fecha de un instante en UTC); `Agenda.tsx` de la profesional usa la fecha del dispositivo, no `toISOString()`: es correcta en un dispositivo en Argentina y no se cambió; (c) en el flujo de reprogramación, por lo que se lee en el código, el botón de guardar queda habilitado con el mismo horario ya elegido; no se verificó en pantalla y no se cambió; (d) `PRIVACY_POLICY_VERSION` del frontend (`src/app/config/legal.ts`) pasó de `2026-09` a `2026-11` y tiene que coincidir con la del backend (`nexa-backend/src/app/constants/legal.ts`), que sigue en `2026-09`: hasta que se cambie allá, la página muestra una versión y al aceptar se graba otra, y subirla allá vuelve a pedir la aceptación a las clientas; (e) del lado del backend siguen a tu decisión los puntos que dejó su entrada 92 (tope de 1 hora, `reminder_sent_at` al reprogramar, política de privacidad); (f) fuera de la comprobación del login en el navegador, el resto se verificó con pruebas de componente y no contra el backend real. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5). Los commits llevan la línea `Co-Authored-By: Claude Sonnet 5.5`. Último commit de la Fase 3 (README y bitácora): `7811400`. Último commit de esta fase (README y bitácora): el de esta misma entrada, que no puede citar su propio hash; se ve con `git log -1 -- 00-gestion/BITACORA.md` en la rama de la Fase 3b. |

**Impacto en el backend:** ninguno. Se leyó sin editar.


## Entrada 111: cierre de las fases 0 a 9 y plan de la última tanda de código

**Fecha:** 2026-11-01 (hora aproximada, Argentina; después del pull request 26 de las 15:38)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Dar por terminadas las fases 0 a 9 del backend (fases 4 a 9 con sus PR #18 a #26: tienda con lista pública solo de productos disponibles y salida de inventario al pagar; anonimización ampliada y alergia del perfil solo para quien atendió; brechas de requisitos con validador de celular argentino, categorías de servicio acotadas, servicio especial con pago pendiente, fecha de ingreso de la profesional y limpieza de avisos y de restos de Google; 86 pruebas nuevas de cobertura; deuda técnica y seed de demostración; informes de cobertura y estimación de horas) y la Fase 6 del frontend (PR #16). Marcar como terminadas y mover a TERMINADOS once tarjetas de Trello de la lista de código. Definir la última tanda de código: backend Fase 10 (validación del perfil y las franjas, 404 en lugar de 500, PUT parcial, stock negativo, postulaciones, galería, clave de servicio para borrar archivos, indicador pendingBalance, limpieza de ramas y plan de despliegue) y frontend Fase 7 (tienda, alergias, fechas en hora de Argentina, reprogramación, enlace de cancelar y PR final hacia `main`). Escribir el procedimiento para Supabase, Render y Vercel y la etiqueta v2.0.0 de la versión congelada. |
| 2 | Alternativas y criterio de descarte | (a) Abrir la política del bucket de Supabase para que la clave anónima pueda borrar: descartado, permitiría borrar archivos a cualquiera con esa clave; se usa la clave de servicio solo en el backend. (b) Aplicar las migraciones a producción fase por fase: descartado, se aplican juntas una sola vez, con respaldo, y la que borra columnas va última. (c) Fusionar `integracion-ae4` con `main` sin migrar antes la base: descartado, el redespliegue del backend fallaría. (d) Dejar sin corregir los hallazgos de la Fase 7: descartado para los que afectan datos (franjas inválidas, stock negativo, datos personales en el registro de actividad); los demás se declaran. (e) Dar RNF-01 por cumplido con la evidencia del 28/10: descartado, midió una base de pruebas local con red simulada; el criterio exige un celular real contra producción. |
| 3 | Evidencia que la sostiene | Informes de Claude Code de las fases 4 a 9 (typecheck sin errores; backend 638 pruebas en las fases 8 y 9; frontend 326 pruebas en la Fase 6). Cobertura: 29 requisitos completos, 11 parciales y 2 sin prueba (RNF-01 y RNF-02). Estimación de horas: 266 commits, 43,3 a 45,5 horas de desarrollo, 21,6 a 22,8 % de las 200 planificadas (cifra reemplazada el 10/11/2026 por la de 424 horas, ver la entrada 144). Evidencia parcial de RNF-01 del 28/10/2026 (Lighthouse y recorrido medido en base local). |
| 4 | Aporte personal | Emily eligió las opciones de las consultas de Claude Code (validador de celular, categorías 4 más combo, liberar el horario del servicio especial al cancelar, pruebas de firma y de reserva tardía, excepciones de mails en RF-24, prueba del caso de postulaciones), mergeó los PR de las fases, hizo la medición de RNF-01 en local y debe aplicar migraciones, variables y la prueba manual. |
| 5 | Desacuerdo y resolución | La Fase 7 incluyó pruebas de la firma del webhook de Mercado Pago aunque Emily había dejado Mercado Pago para después de la AE4: se aceptó porque no toca `src/` ni llama a Mercado Pago. Claude Code incluyó por error un archivo en un commit de la Fase 8 (`git add -A`) y lo registró en la entrada 105. Las fases 2, 3 y 3b del frontend no se probaron a mano contra el backend real. Queda abierto el dato de qué variables hay hoy en Render. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: revisión de los informes de las fases 4 a 9, redacción de los prompts de la Fase 10 del backend y de la Fase 7 del frontend y del procedimiento de despliegue, y actualización del tablero (once tarjetas terminadas, tres tarjetas nuevas y comentarios en las abiertas). Claude no ejecutó ni verificó ningún cambio de código ni de base de datos. Revisión final por Emily pendiente: mergear los PR abiertos, aplicar migraciones, cargar las variables, probar a mano y etiquetar la versión. |

## Entrada 112: corrección del procedimiento de despliegue y limpieza del tablero de código

**Fecha:** 2026-11-02 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Corregir el procedimiento de despliegue según `docs/plan-de-despliegue.md` de Claude Code: las migraciones se aplican a mano en el SQL Editor de Supabase y se registran con `scripts/migration-checksums.mjs`, no con `prisma migrate deploy`. Aplicar primero las siete migraciones que agregan columnas y tablas, reiniciar el backend con las variables de entorno y dejar para el final la migración que borra columnas (`20261030150000`). Marcar como urgente la migración de la base: según el documento de horas, el PR 25 del backend (`integracion-ae4` hacia `main`) ya está mergeado, por lo que el backend nuevo puede estar desplegado en Render sobre una base sin migrar y con el frontend viejo. Cerrar cinco tarjetas de Trello (código maestro, P4, P9, Fase 3b y el paraguas de las fases), mover a la lista de instrumentos el plan de implantación y dejar ocho tarjetas de código abiertas con motivo. Posponer el libro v8 hasta terminar las fases 10 (backend) y 7 (frontend). |
| 2 | Alternativas y criterio de descarte | (a) Usar `prisma migrate deploy` como indicó Claude por error: descartado, no registra los checksums que verifica el plan del proyecto. (b) Aplicar la migración que borra columnas primero, como figura en el plan: descartado por Claude para esta ejecución, porque el backend nuevo ya no usa esas columnas y el orden agrega, despliega y borra es el más seguro; con 0 clientas el riesgo es bajo en ambos casos. (c) Dar por cerradas las fases solo porque los PR están mergeados: descartado, quedan la prueba manual, el frontend de la tienda y de las alergias, y la etiqueta de versión. |
| 3 | Evidencia que la sostiene | `docs/plan-de-despliegue.md`, `docs/cobertura-por-requisito.md` (42 requisitos: 29 completos, 11 parciales, 2 sin prueba; 638 pruebas en verde), `docs/cambios-y-decisiones.md`, `docs/estimacion-horas.md` (266 commits; el backend se estima a partir de `main` en `4aa87d1`, después del PR 25), `docs/consultas-previas-produccion.sql` con la consulta 8 nueva y `docs/evidencias/fase-7-typecheck.txt`. |
| 4 | Aporte personal | Emily subió los documentos generados por Claude Code, detectó que faltaba el libro v8 y pidió una lista por pasos de lo que debe hacer en Supabase, Vercel y en el código. Debe verificar el estado de Render y de la base, aplicar las migraciones, cargar las variables, publicar el frontend, correr las fases 10 y 7 y hacer la prueba manual. |
| 5 | Desacuerdo y resolución | El procedimiento de despliegue que Claude indicó en la entrada anterior contradecía el plan del repositorio; se corrige en esta entrada. Claude tampoco había advertido que el PR 25 podía estar mergeado: lo advirtió al leer el documento de horas. Queda por confirmar en Render y Supabase si el despliegue ya ocurrió. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: lectura de los documentos de Claude Code, redacción de los pasos de despliegue y de los prompts de la Fase 10 y de la Fase 7, y actualización del tablero (cinco tarjetas cerradas, una movida, una actualizada con el procedimiento real y un comentario). Claude no ejecutó ni verificó ningún cambio de código ni de base de datos. Revisión final por Emily pendiente: verificar Render y Supabase hoy, aplicar las migraciones y cargar las variables. |

## Entrada 113: base migrada y frontend con conflictos para integrar

**Fecha:** 2026-11-02 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Registrar que la base de Supabase quedó migrada: las siete migraciones que agregan columnas y tablas y la que borra campañas, puntos, recordatorio de inactividad y fecha de nacimiento (`20261030150000`) se aplicaron a mano en el SQL Editor y el control de migraciones da OK en 62 de 62. Confirmar que el backend nuevo (PR 25, commit `4aa87d1`) está desplegado en Render con las variables en orden. Resolver la integración del frontend con un PR de sincronización: `integracion-ae4` hacia `main` da «Can't automatically merge» (33 commits, 108 archivos) por conflictos con `main`. Después de integrarlo, quitar `VITE_GOOGLE_CLIENT_ID` de Vercel, probar en producción y etiquetar la versión. |
| 2 | Alternativas y criterio de descarte | (a) Resolver los conflictos a mano en la pantalla de GitHub: descartado, el riesgo de perder cambios de la AE4 en README y bitácora es alto. (b) Forzar el merge: descartado, pisaría cambios de `main`. (c) Esperar a terminar la Fase 7 del frontend para integrar: descartado, producción tiene backend nuevo y frontend viejo; se integra primero y la tienda se completa después. |
| 3 | Evidencia que la sostiene | Captura del SQL Editor con la última migración registrada del 28/10 (antes de aplicar). Resultado del control de checksums: 62 de 62 en OK después de la parte 3. Respaldo diario del 2/11 a las 11:00. Captura de GitHub: comparación `main` contra `integracion-ae4`, «Can't automatically merge», 33 commits, 108 archivos. `docs/plan-de-despliegue.md`. |
| 4 | Aporte personal | Emily aplicó las migraciones en Supabase siguiendo el procedimiento, comprobó Render y mergeó en `integracion-ae4` los PR 15 y 16 del frontend. Le toca mergear el PR de sincronización, el PR final a `main`, ajustar Vercel y probar. |
| 5 | Desacuerdo y resolución | Claude había indicado antes `prisma migrate deploy`, que no coincide con el plan del repositorio; se corrigió el 2/11 y se aplicó el procedimiento correcto del plan. Queda abierto que la tienda puede verse vacía en producción hasta la Fase 7 del frontend. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: procedimiento paso a paso para copiar y pegar en PowerShell y Supabase, prompt de sincronización para Claude Code y comentario en la tarjeta de despliegue. Claude no ejecutó ni verificó nada en la base ni en el repositorio. Revisión final por Emily pendiente: PR de sincronización, merge final a `main`, Vercel y prueba en producción. |

## Entrada 114: AE4, frontend — sincronización de `main` en `integracion-ae4` (rama `chore/sincronizar-main-en-integracion`)

**Fecha:** 2026-11-05 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Que `integracion-ae4` se pueda mergear en `main` sin conflictos (GitHub decía «Can't automatically merge»), trayendo `main` a una rama cortada de `integracion-ae4` y no al revés, y que al resolver mande el comportamiento de la AE4. De `main` se conserva lo que es independiente y la AE4 no tenía: la indexación para Google (pull request 9) y el arreglo de la clienta anonimizada (pull request 8). **Lo hizo Claude Code (Claude Opus 5.5), no yo**, por una instrucción mía. |
| 2 | Alternativas y criterio de descarte | (a) Resolver en GitHub o mergear `integracion-ae4` directo en `main`: descartado, un push a `main` puede desplegar en Vercel; se resuelve en la rama `chore/sincronizar-main-en-integracion` con pull request a `integracion-ae4`. (b) En `ClientDetail.test.tsx`, `main` mockeaba `InfoTab` y la AE4 necesita el formulario real para comprobar que no pide la fecha de nacimiento; en vez de quedarse con una sola de las dos, se sacó el mock y las tres pruebas de `main` buscan la sección «Datos personales» del formulario real en lugar del texto del mock (`formulario-info`). (c) En el README, las cifras de pruebas de `main` (303 del backend y 80 del frontend) eran anteriores a la AE4: quedan las de la AE4 y la del frontend pasa a 332 en 37 archivos, la que da ahora. |
| 3 | Evidencia que la sostiene | `git merge origin/main` dio conflicto en tres archivos: `README.md` (cifras de pruebas y párrafo de la sección 8), `src/pages/public/ProfessionalRegisterPage.tsx` (imports) y `src/pages/admin/clients/ClientDetail.test.tsx` (mock de `InfoTab` y pruebas nuevas de cada lado). Los demás cambios de `main` entraron sin conflicto, y se revisó que `index.html` no vuelva a traer el script de Google (`gsi/client`) que quitó la Fase 6 (`6d46fbb`). Resultado en la rama: lint sin errores, `typecheck:all` sin errores, 332 tests en 37 archivos y `build` correcto. Commit del merge (README 8.3): `88896ee`. |
| 4 | Aporte personal | Di la instrucción y el criterio (mantener la AE4; de `main`, solo lo independiente; no borrar entradas del README ni de la bitácora; pull request a `integracion-ae4`, no a `main`, y sin merge). La resolución, las pruebas, el README (secciones 7.2, 8 y 8.3) y esta entrada los hizo Claude Code, en la rama `chore/sincronizar-main-en-integracion`, cortada de `integracion-ae4` con los pull requests 15 y 16 ya integrados. La revisión y el merge quedan de mi lado. |
| 5 | Desacuerdo y resolución | No hubo. Puntos para que revise: (a) de `main` se quitó una sola línea, el mock de `InfoTab` en `ClientDetail.test.tsx`; sus pruebas siguen y pasan contra el formulario real; (b) se quitó una línea en blanco que partía la tabla de la Fase 3b del README (la fila `f78f8aa` quedaba fuera de la tabla); (c) la ruta `/mis-turnos` de la Fase 3b es nueva y no está en `robots.txt` ni tiene `noindex`; no se agregó porque no estaba en el pedido y solo se llega desde el mail; (d) la Fase 6 (pull request 16) no tiene fila en README 8.3 ni entrada en esta bitácora, y no se agregó por la misma razón; (e) la sección 8 nombra `00-gestion/20261028_BitacoraIndividual_KohlerAE3_v1.md`, que viene de `main` y no está en este repositorio. |
| 6 | Herramienta auxiliar | Claude Code (Claude Opus 5.5). Los commits llevan la línea `Co-Authored-By: Claude Opus 5.5`. Último commit anterior de la bitácora: `ce43e50` (Fase 3b). Último commit de esta tarea (README y bitácora): el de esta misma entrada, que no puede citar su propio hash; se ve con `git log -1 -- 00-gestion/BITACORA.md` en la rama `chore/sincronizar-main-en-integracion`. |

**Impacto en el backend:** ninguno. Se leyó sin editar.


## Entrada 115: AE4, frontend — `/mis-turnos` con `noindex`, la fase 6 en el README del frontend y las bitácoras solo en el backend (rama `docs/bitacora-en-backend-y-noindex-mis-turnos`)

**Fecha:** 2026-11-05 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5)**, a pedido de Emily, en una rama cortada de `chore/sincronizar-main-en-integracion`. **(a)** La ruta `/mis-turnos` (fase 3b) no se indexa: `X-Robots-Tag: noindex, nofollow` en `vercel.json`, `usePageMeta({ title: 'Mis turnos', noindex: true })` en `MyAppointmentsLinkPage` y una prueba que comprueba la etiqueta `robots`. **(b)** El README del frontend suma la **fase 6** a la tabla 8.3 (rama `fix/brechas-requisitos`, commits `2f15ec1`, `88cfa58`, `6cd805d`, `a1f092b` y `6d46fbb`) con su párrafo, y aclara que esos commits no llevan la línea `Co-Authored-By`. **(c)** Las bitácoras viven solo en `nexa-backend` (`BITACORA.md` hasta el 03/09/2026, `20261006_BitacoraIndividual_KohlerAE2_v5.docx` del 10/09 al 06/10/2026 y este archivo desde el 23/10/2026, con lo que se haga en noviembre y diciembre de 2026): las entradas 107 a 110 y 114 son las del frontend, pasadas desde `00-gestion/BITACORA.md` de `nexa-frontend`, y se quitaron del frontend ese archivo y la copia del `.docx` de la AE2. El README y `CLAUDE.md` del frontend se actualizaron. |
| 2 | Alternativas y criterio de descarte | **`Disallow: /mis-turnos` en `robots.txt`:** descartado, si el rastreador no puede entrar nunca ve el `noindex`; es el mismo criterio que ya explica el comentario de `robots.txt` para `/login`, `/registro-profesional` y `/pago/`. **Agregarla al `sitemap.xml`:** no, es una ruta personal. **Corregir con `--amend` o reescribir los commits de la fase 6 para sumarles la línea de coautoría:** descartado, ya están mergeados; se declaró la excepción en el README. **Dejar las bitácoras duplicadas en el frontend:** descartado por Emily. **Cambiar el texto de las entradas 107 a 110 y 114 al pasarlas:** no, solo formato. |
| 3 | Evidencia que la sostiene | `00-gestion/BITACORA.md` del frontend, hasta la línea 485, era igual a la `BITACORA.md` del backend salvo el separador final, y el `.docx` de la AE2 tiene el mismo SHA-256 en los dos repositorios (`d8a05dd2…`); por eso no se perdió nada al quitarlos, y ambos siguen en el historial de git del frontend. El archivo `20261028_BitacoraIndividual_KohlerAE3_v1.md` de la tabla 1.5 del README siempre estuvo en `nexa-backend` (la tabla dice que esa documentación vive allá), no faltaba. Resultado en la rama: `npm run lint` sin errores, `typecheck:all` sin errores, **333 tests en 37 archivos** y `build` correcto. |
| 4 | Aporte personal | Emily detectó los tres huecos (noindex de `/mis-turnos`, fase 6 sin documentar, referencia a la bitácora de la AE3) y definió el criterio: todo cambio desde el 23/10/2026 va en la bitácora de la AE3 del backend y el frontend no lleva archivos de bitácora. |
| 5 | Desacuerdo y resolución | Los tres puntos de la entrada 114 (c, d, e) quedan resueltos con esta entrada. **Hallazgo, sin resolver:** la entrada 96 (fase 4, tienda) deja la adaptación del frontend como «no se hizo» y el código sigue igual: `StoreSection.tsx` filtra `p.status === 'active' && p.stock > 0` sobre `/api/store/products`, `PromotionsPage.tsx` (línea 230) y `StorePage.tsx` (línea 27) piden `/api/store/products` en vez de `/api/admin/store/products`. Con el backend de la fase 4 desplegado, la tienda pública quedaría vacía y el administrador dejaría de ver inactivos y agotados (la entrada 96 pide que backend y frontend salgan juntos). No se tocó porque no estaba en el pedido. Los commits de la fase 6 quedaron a nombre de Emily y sin la línea de coautoría, aunque la entrada 100 dice que los hizo Claude Code: figura en el README. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con un script descartable de Node para convertir las entradas al formato de tabla (no queda en el repositorio). Context7 no se usó: no se escribió código que dependa de una librería del proyecto. Revisión de Emily pendiente. Sin commits todavía: se hacen cuando Emily lo pida. |

**Impacto en el backend:** ninguno. Se leyó sin editar, salvo esta bitácora, que Emily pidió que reciba estas entradas.

---


## Entrada 116: merges del frontend y del backend registrados, quedan dos fases de código

**Fecha:** 2026-11-05 (hora aproximada, Argentina; después de los merges de las 17:26 y las 17:28)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Registrar que Emily mergeó en GitHub el PR #19 del frontend (noindex en /mis-turnos, Fase 6 en el README, bitácoras fuera del frontend) y el PR #27 del backend (entradas 107 a 110 y 114 y 115 en la bitácora de la AE3). Dejar un comentario de avance en las tarjetas «URGENTE: migrar la base…» y «FRONTEND Fase 7». No marcar ninguna tarjeta como completada: ninguna terminó. Lo que queda de código, sin Mercado Pago, son la Fase 7 del frontend y la Fase 10 del backend. |
| 2 | Alternativas y criterio de descarte | (a) Marcar como completada la tarjeta URGENTE: descartado, faltan la prueba en producción, la etiqueta v2.0.0 y la regla de Sentry. (b) Marcar completada «Subir al código»: descartado, el libro v8 todavía no existe y la bitácora de Claude (chat) de la entrada 68 en adelante no consta como subida. (c) Dejar la tienda para después de la entrega: descartado, con el backend de la Fase 4 desplegado la tienda pública se ve vacía hoy. |
| 3 | Evidencia que la sostiene | Mensajes de Claude Code con los PR #19 y #27 y el aviso de la tienda sin adaptar (entrada 96 del backend). Lectura del tablero Nexa AE4 PIF del 5/11. Comentarios agregados en las tarjetas 77 y 76. |
| 4 | Aporte personal | Emily mergeó los dos PR y confirmó que VITE_GOOGLE_CLIENT_ID no estaba en Vercel. Le toca revisar que Vercel publicó, probar en producción, etiquetar y correr los dos prompts de abajo. |
| 5 | Desacuerdo y resolución | Claude no puede ver GitHub ni Vercel: supone que main del frontend ya contiene todo integracion-ae4, porque el PR #19 salió de la rama de sincronización. El primer paso del prompt del frontend lo comprueba con un comando. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: lectura del tablero y dos comentarios. No ejecutó ni verificó nada en el código, la base ni los despliegues. Revisión final por Emily pendiente. |

## Entrada 117: AE4, fase 10 — corrección de los hallazgos de la fase 7 y cierre del código (rama `fix/fase-10-cierre-codigo`)

**Fecha:** 2026-11-05 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de Emily, en una rama cortada de `origin/main` (`2c2141f`), sin merge. Emily aprobó el plan antes de tocar código. Nueve puntos, un commit por punto salvo los puntos 2 y 3, que comparten archivos y van juntos: **(1)** `6b68383`: zod en el perfil, las franjas y el onboarding de la profesional (`professionals/dto/professional.dto.ts`); una franja con inicio mayor o igual al fin, o con valores que no son `HH:mm`, da `400 VALIDATION_ERROR`; el perfil solo escribe las claves que vienen, así que un PATCH de un campo ya no borra la bio. **(2 y 3)** `c598c08`: `orNotFound` traduce P2025 a `404 NOT_FOUND` en servicios, promociones y eventos (antes 500); `pickPresent` deja solo las claves del cuerpo, porque en zod 4 `.partial()` igual completa los `.default()` y un PUT parcial pisaba `status`, `isCombo` o `active`; `looseBoolean` lee `"false"` como falso (`z.coerce.boolean()` lo leía como verdadero). **(4)** `3a29f03`: borrar una entrada de stock ya vendida da `400 INSUFFICIENT_STOCK`. **(5)** `9ac960a`: RF-33 con zod (al menos un dato, correo válido, celular argentino, mensaje de hasta 2000), limitador propio de 5 envíos por hora y por IP, y la actividad ya no guarda nombre, correo ni teléfono (solo qué datos llegaron y el mensaje). **(6)** `d32b129`: la categoría de la foto se valida al crear y al editar, y al borrar la foto se borra el archivo del bucket; si no se puede, queda una entrada de actividad de error con la URL. **(7)** `b0300fe`: `deleteImages` usa `SUPABASE_SERVICE_ROLE_KEY` (opcional en `env.ts`, sin valor en `.env.example`). **(8)** `ed42315`: `pendingBalance` descuenta también `balancePaidAmount`, sin bajar de cero. **Pruebas** `e95e36a`. **(9)** limpieza y documentos: commit de esta entrada (su hash no puede figurar en ella; ver `git log`). |
| 2 | Alternativas y criterio de descarte | **404 genérico para todo P2025 en el `errorHandler`:** descartado, cambiaría respuestas de módulos que no se pidieron. **Rehacer los esquemas sin `.default()` para el PUT parcial:** descartado, duplica cada esquema; `pickPresent` mira el cuerpo crudo. **Guardar la postulación en una tabla nueva:** descartado en esta fase, requiere migración y Emily pidió avisar antes. **Seguir con la clave anónima en `deleteImages` como respaldo:** descartado, no tiene permiso de borrado en el bucket y ocultaría la falta de la clave. **Borrar las ramas `docs/informes-v8`, `feat/fase-4-tienda`, `feat/recordatorio-turno-mail` e `integracion-ae4`:** descartado, ver el elemento 5. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores. Suite completa **650 tests en 58 archivos, todos pasan** (antes 638 en 57; las pruebas nuevas están en `tests/integration/fase-10-cierre-codigo.test.ts`, una por corrección, y se actualizaron las de RF-33 y las de `deleteImages`). Rama local `docs/bitacora-ae3-entradas-frontend` borrada: estaba mergeada (PR 27). Consultas de solo lectura nuevas (sección 9) en `docs/consultas-previas-produccion.sql`, con tablas y columnas verificadas contra `schema.prisma`; **no se corrieron contra Supabase**. |
| 4 | Aporte personal | Emily definió los nueve puntos, las reglas (no tocar Mercado Pago, no editar migraciones, una prueba por corrección) y aprobó el plan. |
| 5 | Desacuerdo y resolución | **Sin resolver, para Emily:** (a) las postulaciones de RF-33 ya no guardan datos de contacto, y no hay otro lugar donde lo hagan: a quien se postula no se la puede contactar. Opciones: tabla nueva (migración que solo agrega) o mail al estudio por `mailProvider`. (b) Las fases 9.3 (`docs/estimacion-horas.*`, PR 26) están en `integracion-ae4` pero **no en `main`**: el PR 25 se mergeó antes. (c) Las ramas locales `feat/fase-4-tienda` y `feat/recordatorio-turno-mail` tienen commits que no están en `main` con el mismo hash; no se pudo probar que sean equivalentes a lo mergeado, así que no se borraron. (d) El frontend debe adaptarse a los códigos nuevos (ver abajo). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con scripts descartables de Node para editar archivos con saltos CRLF (no quedan en el repositorio). Context7 no estuvo disponible en la sesión (servidor desconectado); los cambios usan solo APIs que el proyecto ya usaba de zod, express-rate-limit y Prisma. Revisión de Emily pendiente. |

**Impacto en el frontend (contrato):** `POST /api/contact/job-interest` ahora responde `400` con cuerpo vacío o inválido y `429` al pasar el límite (`JoinUsSection.tsx` ya muestra el mensaje de error, pero hoy permite enviar con un solo campo cualquiera y un teléfono mal escrito ahora se rechaza); `PATCH /api/professional/profile`, `PATCH /api/professional/schedule` y `POST /api/professional/onboarding` responden `400` con franjas invertidas u horas inválidas; `PUT|PATCH|DELETE` de servicios, promociones y eventos especiales con id inexistente responden `404 NOT_FOUND` en vez de 500; `DELETE /api/store/movements/:id` puede responder `400 INSUFFICIENT_STOCK`; `GET /api/admin/dashboard` devuelve un `pendingBalance` menor. Sin migraciones y sin tocar Mercado Pago.


## Entrada 118: fase 7 del frontend y Fase 10 del backend abiertas en PR, sin merge

**Fecha:** 2026-11-05 (hora aproximada, Argentina; entre la apertura del PR 28 de las 22:38 y el merge del PR #20 de las 22:49)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Registrar el PR #20 del frontend (Fase 7, commits b234004, 4b14174, ad28510) y el PR 28 del backend (Fase 10, nueve commits, 650 pruebas en verde) con un comentario en las tarjetas 76 y 75. No marcar ninguna como completada: los dos PR siguen sin merge y quedan pendientes el contacto de postulaciones (RF-33), el PR de la Fase 9.3 y la adaptación del frontend a los cambios de respuesta. Cerrar todo con dos prompts para Claude Code. |
| 2 | Alternativas y criterio de descarte | (a) Marcar 75 y 76 como completadas ahora: descartado, la propia tarjeta 5 dice que solo va a TERMINADOS lo que de verdad terminé, y un PR abierto no es código integrado. (b) Guardar las postulaciones en una tabla nueva: descartado como opción recomendada, exige otra migración a mano en Supabase y guarda datos personales más tiempo. (c) Dejar el frontend sin adaptar y confiar en el backend: descartado, el frontend recibiría 400, 404 y 429 donde antes recibía 500 o 201. |
| 3 | Evidencia que la sostiene | Informes de Claude Code con los resultados de lint, typecheck, pruebas y build de cada PR. Comentarios agregados en las tarjetas 76 y 75. |
| 4 | Aporte personal | Emily aprobó el plan de la Fase 10 (incluida la definición de pendingBalance) y decide ahora la opción de postulaciones. Le toca cargar variables en Render, correr las consultas en Supabase y mergear. |
| 5 | Desacuerdo y resolución | Claude propone avisar por mail al estudio en vez de guardar la postulación; es una recomendación, no una decisión de Claude, y Emily puede elegir la tabla. Además, el texto del frontend declara «Claude Code (Sonnet 5.5)» y la entrada de la sincronización decía «Opus 5.5»: hay que confirmar qué modelo se usó en cada sesión antes de dejar la declaración de IA. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: dos comentarios y los prompts. No ejecutó ni verificó nada en el código, la base ni los despliegues. Revisión final por Emily pendiente. |

## Entrada 119: Frontend, fase 7 — tienda, alergias, fechas en hora de Argentina y anonimización (rama `fix/fase-7-tienda-alergias-fechas` de `nexa-frontend`, PR nexa-frontend#20)

**Fecha:** 2026-11-05, 22:55 (hora de la máquina, UTC-3). Se copia acá el texto que Emily pasó del frontend; no es un cambio de este repositorio.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Hecho por Claude Code (Sonnet 5.5) a pedido de Emily, en `fix/fase-7-tienda-alergias-fechas`, PR nexa-frontend#20, commits `b234004`, `4b14174` y `ad28510`. `StoreSection` usa `available`; `PromotionsPage` y `StorePage` piden `/api/admin/store/products`; el carrito saca y avisa lo no disponible; el libro marca las ventas. La agenda y la ficha de la profesional aceptan `allergies` vacío, `null` o ausente, y el diálogo de anonimizar detalla qué se borra y qué se conserva. Las fechas de `PromotionsPage`, `promotionWindow`, `InviteModal`, `InventoryTab` y `AppointmentModal` van en hora de Argentina. Guardar queda deshabilitado si el horario no cambió. El enlace de cancelar abre el diálogo con el turno iniciado. `VITE_GOOGLE_CLIENT_ID` no figuraba en código ni documentación. |
| 2 | Alternativas y criterio de descarte | Re-consultar la disponibilidad al abrir el carrito: descartado, alcanza con la carga de página y el backend valida el pedido. Reconocer ventas por `orderId`: descartado, el backend no lo tiene y se usa la nota. |
| 3 | Evidencia que la sostiene | Lint y typecheck sin errores, 343 pruebas en verde, build correcto. |
| 4 | Aporte personal | Emily definió el alcance y las reglas de la fase. |
| 5 | Desacuerdo y resolución | Resuelve el hallazgo sin resolver de la entrada 96. Revisión de Emily pendiente. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5). |

**Impacto en el frontend:** es el propio cambio del frontend; no toca este repositorio.


## Entrada 120: AE4, RF-33 — las postulaciones se avisan por mail al estudio; fase 9.3 a `main`; ramas locales (ramas `feat/postulaciones-por-mail` y `docs/fase-9-3-a-main`)

**Fecha:** 2026-11-05, 22:30 a 23:05 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de ella, sin merge. (a) **RF-33 por mail** (decisión de Emily: avisar al estudio por mail y no guardar nada en la base): `contact.service.ts` manda nombre, correo, teléfono y mensaje por `mailProvider`, con todo el texto escapado; el destino es `BusinessSettings.email` y, si está vacío o no es un correo válido, `ADMIN_EMAIL`. No se creó ninguna variable de entorno ni migración. Si el mail falla responde `500 JOB_INTEREST_MAIL_FAILED` («No pudimos enviar tu postulación…») y deja una entrada de actividad de nivel `error` con solo los campos que llegaron. La actividad ya no guarda tampoco el mensaje (antes sí). Commit `905f149`, más el commit `bdb0896`, que suma el aviso a la lista cerrada de envíos permitidos de la prueba de RF-24 (asunto «Nueva postulación — Nexa»; sin eso fallaba la suite completa). (b) **Fase 9.3 a `main`:** `git log origin/main..origin/integracion-ae4` traía solo los 4 commits de la 9.3 (`5cffa20`, `fe8198f`, `6db83e8` y el merge `13e5270` del PR 26). El merge de `integracion-ae4` a `main` choca en esta bitácora (allá las entradas 107 y 108 son de la 9.3; en `main` esos números ya son del frontend), así que se armó `docs/fase-9-3-a-main` desde `origin/main` con los cuatro archivos de la 9.3 y esas dos entradas renumeradas 98 y 99: commit `a78cc8b`, PR 29. (c) **Ramas locales:** se borró `feat/recordatorio-turno-mail` (era `031e319`); `feat/fase-4-tienda`, `docs/informes-v8` e `integracion-ae4` se conservan. |
| 2 | Alternativas y criterio de descarte | **Variable nueva para el correo del estudio:** descartada, ya existe `BusinessSettings.email` (la carga el administrador en Configuración) y `ADMIN_EMAIL` (obligatoria en `env.ts`). **PR directo de `integracion-ae4` a `main`:** descartado, no se podía mergear limpio por la numeración de la bitácora. **Responder 201 aunque el mail falle:** descartado por pedido de Emily (se perdería la postulación sin que nadie se entere). |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores; 23 pruebas de los dos archivos tocados en verde (mail enviado, destino por defecto `ADMIN_EMAIL`, mail fallido, sin datos personales en la actividad). **Ramas:** `feat/recordatorio-turno-mail`: PR #17 mergeado (base `integracion-ae4`, llegó a `main` por el PR #25), `git cherry origin/main` marca su único commit como equivalente (`-`) y las cinco pruebas que agrega están en `origin/main`. `feat/fase-4-tienda`: `git cherry` marca `ac0ba11` como NO equivalente (`+`) y cuatro de sus pruebas (`terms-version.test.ts`) no están en `main`, sin PR mergeado con esa rama: no se borra. `docs/informes-v8`: sus 3 commits de la 9.3 todavía no están en `main` (PR 29 abierto). `integracion-ae4`: ya es ancestro de `origin/main`, pero se conserva hasta que la 9.3 llegue a `main`, por pedido de Emily. |
| 4 | Aporte personal | Emily decidió que la postulación va por mail y sin guardarse, que se reuse el correo del estudio si existe, que el mail fallido no puede dar 201, el criterio para armar el PR de la 9.3 y para borrar ramas, y que no se toque Mercado Pago. |
| 5 | Desacuerdo y resolución | El PR 28 (`fix/fase-10-cierre-codigo`) se mergeó mientras se trabajaba y el commit del mail todavía no se había subido: se pasó a una rama nueva desde `main` (cherry-pick de `9fa9656`). Esta entrada y la 96 podrían chocar con la 98 y la 99 del PR 29 al mergear el segundo (los dos agregan al final del archivo); se resuelve conservando las cuatro. Resuelve la duda (a) de la entrada 117. `docs/cobertura-por-requisito.md` es un informe generado y quedó desactualizado en RF-33: no se tocó. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `gh` y `git`. Context7 no se consultó: no se usó ninguna API nueva de una librería (se reutilizan `mailProvider`, Prisma y zod como ya estaban). |

**Impacto en el frontend (contrato):** `POST /api/contact/job-interest` suma una respuesta de error: `500` con `code: 'JOB_INTEREST_MAIL_FAILED'` y `error` en español cuando el mail al estudio falla. `JoinUsSection.tsx` ya muestra el mensaje de error de la respuesta (entrada 117); el `201` no cambia. Hay que cargar en Render nada nuevo, pero conviene que Configuración > Negocio tenga el correo del estudio cargado (si no, llega a `ADMIN_EMAIL`).


## Entrada 121: fase 10 del backend y Fase 7 del frontend pasadas a TERMINADOS

**Fecha:** 2026-11-05 (hora aproximada, Argentina; noche, después del merge del PR 30 de las 23:06)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Marcar como completadas y mover a TERMINADOS las tarjetas «BACKEND Fase 10» (75) y «FRONTEND Fase 7» (76), porque Emily informó que mergeó el PR 28 y el #20, y el PR 30 (postulaciones por mail) también está mergeado. Dejar sin marcar la tarjeta URGENTE (77) y «Subir al código» (74). Cerrar lo que queda de código con un prompt para cada repositorio. |
| 2 | Alternativas y criterio de descarte | (a) Esperar a que mergee también el PR 29 antes de marcar la 75: descartado, la tarjeta no incluye la estimación de horas. (b) Marcar la 77: descartado, faltan la prueba en producción y la etiqueta. (c) Pedirle otra vez a Claude Code el texto de la bitácora para pegarlo a mano: descartado por Emily, pierde tiempo; ahora el frontend la escribe directo en el repo del backend. |
| 3 | Evidencia que la sostiene | Informe de Claude Code: PR 28 mergeado con CI verde, PR 29 y 30 abiertos, 652 pruebas en la rama del PR 30. Mensaje de Emily: «listo» para el PR 28 y el #20, y el PR 30 mergeado. Pendiente de comprobar: que los commits de la Fase 10 del frontend (386aa48 a b172e82) hayan entrado a main, porque se subieron a la rama del PR #20 y puede haberse mergeado antes. El prompt del frontend lo verifica primero. |
| 4 | Aporte personal | Emily mergeó los PR y decidió que la etiqueta v2.0.0 se pone recién con todo el código cerrado, incluido Mercado Pago. |
| 5 | Desacuerdo y resolución | Mercado Pago: tu tablero (tarjetas 49 y 10) declara la cuenta real de Loren como pendiente de puesta en producción, fuera de la entrega. Si querés incluirla antes de v2.0.0, hay que decidirlo; el prompt cubre solo la parte en modo prueba. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello: dos tarjetas marcadas y movidas. No ejecutó ni verificó nada en el código, la base ni los despliegues. Revisión final por Emily pendiente. |

## Entrada 122: AE4, fase 9.3, estimación de horas a partir de los commits (rama `docs/informes-v8`)

**Fecha:** 2026-11-01, 15:24 (Emily confirmó el merge del pull request 24 y de `integracion-ae4` en `main`, pull request 25), 15:25 a 15:26 (consulta del alcance a Emily) y de 15:26 a 15:35 (cálculo, documentos, verificación y commits). Hora de la máquina, UTC-3.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (modelo Opus 5.5)**, a pedido de Emily, solo con lectura de `git log` (sin tocar el historial). `docs/estimacion-horas.md` y `docs/estimacion-horas.csv` (`5cffa20`): 266 commits sin merges en una sola línea de tiempo, 163 del backend (`main` en `4aa87d1`) y 103 del frontend (`main` en `7650a65` más `integracion-ae4` en `67a4c38`), con la fecha de autor en hora de Argentina. Sesiones con umbrales de 60, 90 y 120 minutos; duración = último menos primero más 30 minutos; una sesión de un commit vale 30 minutos. Resultado: **43,3 horas (45 sesiones), 45,5 (42) y 45,5 (42)**; ninguna sesión de más de 10 horas. Horas por semana, por sprint (cierres 03/09, 01/10 y 29/10, más el período desde el 30/10), por mes y total; 93 de 266 commits (35,0 %) con la línea `Co-Authored-By: Claude`, desglosados por período; límites del método; cinco sesiones de ejemplo elegidas con una regla fija; comparación con las 200 horas asignadas a iteraciones (libro v7, hoja «Iteraciones») sin conclusiones. Se volvió a cortar la rama `docs/informes-v8` desde `integracion-ae4` (la anterior se borró, local y remota, porque ya estaba mergeada). README (sección 1.5 y fila de la fase 9) y `docs/cambios-y-decisiones.md` actualizados. |
| 2 | Alternativas y criterio de descarte | **Solo el backend, o solo lo que está en el `main` del frontend:** descartados por Emily, que pidió los dos repositorios con todos los commits de la AE4. **Sumar los dos repositorios por separado:** descartado, una sesión en la que se trabajó en los dos a la vez se contaría dos veces. **Contar los commits locales sin publicar** (`ac0ba11` y `41cd6c0` de `feat/fase-4-tienda`, y `031e319` de `feat/recordatorio-turno-mail`): descartado, su contenido ya entró a `main` por otros commits. **Corregir a mano sesiones con pausas:** descartado, no hubo ninguna de más de 10 horas y el método no distingue pausas. |
| 3 | Evidencia que la sostiene | Los commits salen de `git log --no-merges` en cada rama; la marca de Claude Code, de `git log -i --grep='^Co-Authored-By: Claude'` (36 en el backend, igual que la sección 8.1 del README, y 57 en el frontend). Todos los autores son Emily Kohler; los dos commits registrados por GitHub son ediciones web del README. El desglose de la marca muestra que en la AE4 la tienen 0 de 56 commits del backend y 21 de 28 del frontend. `npm run typecheck:all` sin errores y `npm test` con 57 archivos y 638 pruebas en verde (15:34). |
| 4 | Aporte personal | Emily definió el método (umbrales, 30 minutos de trabajo previo, cierres de sprint, marca para revisar), integró todo en `main` antes del cálculo y decidió el alcance (backend y frontend, con toda la AE4). |
| 5 | Desacuerdo y resolución | El prompt pedía «las ramas fusionadas en `main`»; Emily amplió el alcance a la AE4 del frontend, que no está en el `main` del frontend: queda declarado en los datos y en los límites. El porcentaje según la marca subestima el uso de Claude Code (en la AE4 del backend ningún commit la tiene). **Recordatorio para Emily:** el merge a `main` del backend redespliega Render; según `docs/plan-de-despliegue.md`, las migraciones de la AE4 tenían que estar aplicadas en Supabase antes. Si se aplicaron o no: **no determinado** desde el repositorio. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) con un script descartable de Node para agrupar las sesiones (no queda en el repositorio). Context7 no se usó: no se escribió código que dependa de una librería del proyecto. Commits sin la línea de coautoría, como pidió Emily. Revisión de Emily pendiente. |

**Impacto en el frontend:** ninguno.


## Entrada 123: AE4, push de la fase 9.3 y pull request

**Fecha:** 2026-11-01, 15:36 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Opus 5.5)**: `git push -u origin docs/informes-v8` y pull request 26 con base `integracion-ae4` (https://github.com/emilykohler12/nexa-backend/pull/26). Sin merge. Antes se borró la rama `docs/informes-v8` anterior (local y remota), ya mergeada por el pull request 24. |
| 2 | Alternativas y criterio de descarte | Merge directo o push a `main`: descartados, el flujo de la AE4 es que Emily revise y mergee cada fase, y `main` redespliega a la clienta real. |
| 3 | Evidencia que la sostiene | Commits `5cffa20` (estimación) y `fe8198f` (documentación, entrada 107); `npm test` con 638 pruebas en verde antes del push. |
| 4 | Aporte personal | Emily definió el flujo (push y pull request por fase, ella mergea). |
| 5 | Desacuerdo y resolución | Ninguno. |
| 6 | Herramienta auxiliar | Claude Code (Opus 5.5) y `gh`. |


## Entrada 124: Frontend, fase 10 — errores nuevos del backend, franjas y saldo pendiente (rama `fix/fase-10-frontend` de `nexa-frontend`, PR nexa-frontend#21)

| Elemento | Contenido |
|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), no por Emily**, a pedido de ella, sin merge. Se adaptó el frontend a las respuestas nuevas de la fase 10 del backend. Los commits se hicieron primero sobre la rama del PR nexa-frontend#20 (`386aa48`, `805324d`, `81a353d`, `c894711`, `0953994`, `b172e82`); como ese PR se mergeó antes de que se subieran, se pasaron con `cherry-pick` a `fix/fase-10-frontend` (hashes vigentes: `2717a91`, `80b5381`, `4c8605d`, `ebc4698`, `d38a129`, `c8e3f70`; ver la entrada 125). (a) `errorMessage.ts`: mensajes para `400 VALIDATION_ERROR` (se le saca la ruta del campo), `404 NOT_FOUND`, `400 INSUFFICIENT_STOCK` y el `429` sin código; conservan el texto del servidor cuando es seguro y usan uno propio solo si falta. (b) `JoinUsSection`: distingue 400, 429 y error de envío; los campos opcionales vacíos siguen siendo válidos. (c) Franjas del onboarding y de Horarios: `validateAvailability` exige inicio menor al fin antes de enviar y se muestra el error del servidor (Horarios antes se tragaba el error). (d) Servicios, promociones, eventos, stock, galería y profesionales muestran el motivo del servidor en vez de un texto fijo. (e) La tarjeta «Saldo pendiente a cobrar en local» aclara que descuenta la seña y lo cobrado en el local. |
| 2 | Alternativas y criterio de descarte | **Pisar siempre el texto del servidor con uno fijo por código:** descartado, perdería datos útiles (el nombre del producto en `INSUFFICIENT_STOCK`, el motivo exacto en `VALIDATION_ERROR`); los mensajes propios son solo respaldo. **Dejar la validación de franjas solo en el servidor:** descartado, el cliente avisa antes de enviar y el servidor sigue siendo la validación real. **Cambiar el cálculo de `pendingBalance` en el frontend:** descartado, lo calcula el backend; solo se ajustó el texto. |
| 3 | Evidencia que la sostiene | `npm run lint` y `npm run typecheck:all` sin errores; `npm test` 363 tests en verde en ese momento (eran 333); `npm run build` correcto. Pruebas nuevas por cada cambio: `errorMessage.fase10.test.ts`, `JoinUsSection.test.tsx`, `validateAvailability.test.ts`, `Schedule.test.tsx`, `OnboardingWizard.test.tsx`, `InventoryTab.errors.test.tsx`, `DashboardPage.pendingBalance.test.tsx`. El contrato se verificó en `nexa-backend/src/modules` (`contact`, `professionals/dto`, `products/inventoryMovement.model.ts`, `admin/dashboard.service.ts`). |
| 4 | Aporte personal | Emily definió el alcance (relevar todos los usos de las rutas, mensajes, validación de franjas, etiqueta de `pendingBalance`, una prueba por cambio), que los commits se sumen al PR sin merge, que la bitácora no se toque en el frontend y que no se toque Mercado Pago. |
| 5 | Desacuerdo y resolución | El `429` de postulaciones no trae `code`, así que se trata por status. Quedó abierto que el backend puede responder `500 JOB_INTEREST_MAIL_FAILED` con texto en español y `safeErrorMessage` descarta los 5xx; se resolvió en la entrada 125. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`) con `git`, `npm` y vitest. Context7 no se consultó: no se usó ninguna API nueva de una librería. |

**Impacto en el frontend (contrato):** sin cambios de rutas ni de forma de respuesta; solo se interpretan mejor `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `400 INSUFFICIENT_STOCK` y `429`.


## Entrada 125: Frontend, fase 10 — cierre: verificación de commits, mensaje de postulaciones, README y `.env.example` (rama `fix/fase-10-frontend` de `nexa-frontend`, PR nexa-frontend#21)

| Elemento | Contenido |
|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), no por Emily**, a pedido de ella, sin merge. (a) Se verificó con `git merge-base --is-ancestor` que los commits `386aa48`, `805324d`, `81a353d`, `c894711`, `0953994` y `b172e82` de la fase 10 del frontend NO estaban en `origin/main`: el PR nexa-frontend#20 se mergeó (`4cdc164`) antes de que se subieran. Se cortó `fix/fase-10-frontend` desde `origin/main`, se trajeron con `cherry-pick` sin conflictos (hashes nuevos: `2717a91`, `80b5381`, `4c8605d`, `ebc4698`, `d38a129`, `c8e3f70`) y se abrió el PR nexa-frontend#21. (b) `JoinUsSection` muestra el texto en español que manda el servidor solo cuando responde `500` con `code: 'JOB_INTEREST_MAIL_FAILED'` (commit `56ab518`); el resto de los 5xx sigue con el mensaje genérico. Cierra lo que quedó abierto en el elemento 5 de la entrada 124. (c) README 8.3: cada commit en su propia fila (`b234004`, `4b14174` y `ad28510` estaban pegados con `\|\|`) y hashes actualizados a los de la rama nueva (commit `205792a`). (d) `.env.example` con todas las variables `VITE_` que usa el código: `VITE_API_URL`, `VITE_SENTRY_DSN`, `VITE_TENANT_SLUG`, `VITE_LOCALE` y `VITE_CURRENCY`, con explicación y valores falsos (commit `9d1a696`). |
| 2 | Alternativas y criterio de descarte | **Mostrar el texto de cualquier 5xx:** descartado, `safeErrorMessage` los descarta a propósito porque pueden traer mensajes técnicos; solo se habilita ese código, cuyo texto el backend escribe en español. **Rehacer el PR 20:** descartado, ya estaba mergeado; se usó una rama nueva con `cherry-pick` para no reescribir historia. **Borrar `VITE_GOOGLE_CLIENT_ID` del `.env` local:** descartado, no se editan archivos `.env*`; ver elemento 5. |
| 3 | Evidencia que la sostiene | `npm run lint` y `npm run typecheck:all` sin errores; `npm test` 365 tests en 46 archivos en verde (dos pruebas nuevas en `JoinUsSection.test.tsx`: el 500 con ese código y el 500 con otro código); `npm run build` correcto. `git grep VITE_GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT` no encuentran nada en archivos versionados. `.gitignore` no excluye `.env.example` ni `package-lock.json` (`git check-ignore` vacío) y ambos están versionados. Contrato leído en `nexa-backend` (`origin/main`, `contact.controller.ts`): `500` con el texto «No pudimos enviar tu postulación. Probá de nuevo en un rato.» y `JOB_INTEREST_MAIL_FAILED`. |
| 4 | Aporte personal | Emily pidió cerrar todo lo pendiente de `nexa-frontend` sin confirmaciones, la verificación de los commits, el tratamiento de ese código de error, separar las filas del README, completar `.env.example` y que esta entrada la escribiera Claude Code directo en el backend; sin merge. |
| 5 | Desacuerdo y resolución | El archivo `.env` local (no versionado) todavía tiene `VITE_GOOGLE_CLIENT_ID`; el código ya no la usa. No se tocó porque las reglas del proyecto prohíben editar `.env*`: la borra Emily a mano. El árbol de trabajo de `nexa-backend` tenía cambios sin commitear de otra tarea (rama `chore/cierre-final`); para no pisarlos esta entrada se hizo en un `git worktree` aparte, desde `origin/main`, en la rama `docs/bitacora-fase-10-frontend`. No había PR abiertos en el backend y la última entrada en `main` era la 99, por eso la entrada nueva fue la 100 y esta, la 101 (se agregó después la de los cambios de errores, franjas y saldo). |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`) con `git`, `gh`, `npm` y vitest. Context7 no se consultó: no se usó ninguna API nueva de una librería. |

**Impacto en el backend:** ninguno; en este repositorio solo se agrega esta entrada. **Impacto en el frontend (contrato):** sin cambios de rutas ni de forma de respuesta.


## Entrada 96 bis (recuperada de la rama local `feat/fase-4-tienda`, commit `ac0ba11`; en `main` el número 96 ya lo usa otra entrada): AE4, fase 4 (rama), correcciones de la fase 3b y política de privacidad

**Fecha:** 2026-11-01, de 00:05 a 00:25 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily. (a) El pull request 17 ya estaba mergeado (`c707180`) cuando se subió el commit `031e319` (entrada 95), que por eso no entró. Se actualizó `integracion-ae4`, se cortó `feat/fase-4-tienda` y se pasó ese commit con `cherry-pick` (`41cd6c0`), como commit aparte de la rama de la fase 4. (b) Antes de cambiar la versión se verificó su uso: `users.terms_version` solo se escribe (registro y confirmación de reserva), nada la lee ni la compara. Una clienta con `2026-09` no es bloqueada ni se le pide aceptar de nuevo al ingresar; al reservar se le regraba la versión nueva. Administradora y profesionales tienen `null` y siguen entrando. **No hay efecto sobre el personal.** (c) `PRIVACY_POLICY_VERSION = '2026-11'`. No quedaba ningún otro lugar con la versión `2026-09` (las otras coincidencias son fechas). (d) Pruebas nuevas en `terms-version.test.ts`: versión vigente fijada en `2026-11`, clienta con `2026-09` que ingresa sin cambios, la misma clienta que reserva y queda con `2026-11`, y administradora y profesional sin versión que ingresan y operan. (e) `docs/cambios-y-decisiones.md` deja la frase exacta que indicó Emily y dónde va (sección «2. Propósitos» de `PrivacyPolicyPage.tsx` del frontend, más la constante en `legal.ts`). Reemplaza la frase de una línea de la entrada 95. El frontend no se tocó. (f) La limpieza de `reminder_sent_at` al reprogramar y su prueba ya estaban hechas en `41cd6c0`. |
| 2 | Alternativas y criterio de descarte | Cherry-pick a la rama de la fase 4 en vez de un pull request aparte: es lo que Emily pidió para el caso de pull request ya mergeado. Borrar `feat/recordatorio-turno-mail` (local y remota): descartado, el commit `031e319` no está mergeado; el contenido ya vive en la rama nueva y la rama vieja se puede borrar cuando Emily lo indique. |
| 3 | Evidencia que la sostiene | `gh pr view 17`: estado `MERGED`, 2026-11-01 02:02 UTC. `git branch -r --contains 031e319` solo lista la rama de la fase. `grep` de `termsVersion` y `terms_version` en `src`: dos escrituras, ninguna lectura. `terms-version.test.ts`: 7 pruebas verdes. `typecheck:all` sin errores. |
| 4 | Aporte personal | Emily pidió verificar el efecto de la versión antes de cambiarla (clientas y personal), actualizar las pruebas, no tocar el frontend y dejar la frase escrita; y que la limpieza de `reminder_sent_at` fuera con su prueba. |
| 5 | Desacuerdo y resolución | Ninguno. Queda a la espera del enunciado de la fase 4. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y `gh`. Revisión de Emily pendiente. |


## Entrada 126: AE4, cierre del backend — estimación de horas de los dos repositorios, Mercado Pago en modo prueba, `.env.example` completo y base vacía (rama `chore/cierre-final`)

**Fecha:** 2026-11-06, de 00:00 a 03:30 (hora de la máquina, UTC-3; sesión cortada por el límite de uso y retomada)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de ella, sin merge, en una rama cortada de `origin/main` (`090f0db`). (a) **PR 29:** el pedido era actualizarlo con `main`, pero los PR 29 y 30 ya estaban mergeados; se descartó el merge local (nunca se subió) y se trabajó en una rama nueva. (b) **Commit `3ec1f8b`:** trae a `main` las cuatro pruebas de `terms-version.test.ts` de `ac0ba11` (RF-08, versión de la política 2026-09 → 2026-11); pasan con el código de `main`. La entrada 78 de esa rama (numeración de entonces) se recuperó como «96 bis» al final de la serie de entradas 124 y 125 y se borró la rama local `feat/fase-4-tienda`. (c) **Commit `d867e55`:** `tests/integration/payments.create-preference.test.ts` (5 pruebas de `createPreference` con el SDK de Mercado Pago mockeado, token falso); `.env.example` reescrito con todas las variables, qué significan y un ejemplo falso; sección «Instalación desde una base vacía» en `docs/plan-de-despliegue.md`; `docs/cobertura-por-requisito.md` corregido en la cabecera, RF-33 y RF-08. (d) **Estimación de horas** recalculada con `scripts/estimacion-horas.mjs` (nuevo, versionado) sobre los dos repositorios, con commit de corte por referencia; el commit de esa estimación y de esta entrada se identifica con `git log` de la rama (no puede citar su propio hash). |
| 2 | Alternativas y criterio de descarte | **Regenerar la cobertura con su script:** descartado, el script que la armó no está versionado (era descartable); se corrigió a mano lo que cambió (RF-33 y RF-08) y se dejó escrito en la cabecera que el resto del mapa no se rehízo. **Conservar el script de la estimación fuera del repositorio:** descartado, ahora es reproducible. **Probar la base vacía en la base de pruebas del proyecto:** descartado; se creó una base local nueva (`nexa_vacia_test`) y se borró. **Traer el párrafo de la política de `ac0ba11`:** innecesario, el frontend ya tiene esa frase (`PrivacyPolicyPage.tsx`) y la versión `2026-11`. |
| 3 | Evidencia que la sostiene | **Mercado Pago, pruebas que ya existían (no se duplicaron):** `payments.webhook-signature.test.ts` (firma válida, inválida, sin cabecera y sin clave), `payments.webhook-idempotency.test.ts` (aviso repetido o simultáneo no duplica la seña ni el stock), `payments.webhook-amount.test.ts` (monto y moneda). **Falta que había:** `createPreference`; agregada. **Credenciales:** `git grep` de `APP_USR-…`, `TEST-…`, `sk_live` y JWT en todo el árbol versionado, y `git log -p` de los últimos 300 commits de todas las ramas: sin coincidencias; los únicos archivos de entorno versionados son `.env.example` y `.env.test.example`. **RNF-04:** en `prisma/schema.prisma` no hay columnas de tarjeta; la única mención de `card` es un comentario sobre el medio de cobro del saldo en el local. **Base vacía:** `prisma migrate deploy` aplicó todas las migraciones, `seed:demo` cargó el escenario y el servidor arrancó; el inicio de sesión de administradora, profesional y clienta respondió `200`; no falló ningún paso. **`.gitignore`:** no excluye `package-lock.json`, `.node-version`, `prisma/` ni los `.example`; `package-lock.json` está versionado. Suite completa: 661 pruebas en 59 archivos, todas pasan. |
| 4 | Aporte personal | Emily definió el alcance, que no se toque ninguna cuenta ni credencial real de Mercado Pago, que no se pida confirmación y que el merge lo haga ella. |
| 5 | Desacuerdo y resolución | Sin resolver, para Emily: (a) los criterios de RF-33 en el libro de requisitos v7 siguen diciendo «una entrada en la actividad» y no mencionan el mail; (b) el resto del mapa de cobertura no se rehízo (ver arriba); (c) no se probó un pago de punta a punta en el sandbox de Mercado Pago porque no hay cuenta de prueba cargada. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git`, `gh`, `psql` y Node. Context7 no se consultó: la prueba de `createPreference` usa el SDK de Mercado Pago tal como ya lo importa `payment.service.ts` y Vitest como en el resto de la suite. |

**Impacto en el frontend (contrato):** ninguno. No cambia ninguna ruta ni respuesta.


## Entrada 127: AE4, CI en rojo en `main` (pull request 31) por un tiempo de espera de la base en las pruebas (rama `chore/cierre-final`)

**Fecha:** 2026-11-06 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de ella. El CI del push a `main` por el merge del pull request 31 falló: 651 de 652 pruebas, con `Hook timed out in 15000ms` en el `beforeEach` de `tests/setup.ts` (el `TRUNCATE` de las tablas) en «aviso cargado tarde con una hora anterior» de `appointments.cancellation-refund.test.ts`. Se subió `hookTimeout` de 15 a 60 s y `testTimeout` de 15 a 30 s en `vitest.config.mts`, y se volvió a correr el trabajo fallido. |
| 2 | Alternativas y criterio de descarte | **Arreglar la prueba o el código de la cancelación:** descartado, el código no cambió respecto de las corridas verdes de la rama y la prueba solo usa `Date` falso, que se restaura en `afterEach`. **Reintentar sin tocar nada:** descartado como única medida, volvería a pasar el próximo fallo de un runner lento. |
| 3 | Evidencia que la sostiene | Log del CI: el mismo archivo tardó 23 s y hay pausas de unos 20 s entre pruebas de otros archivos (runner lento); fue un único fallo; las dos corridas de la rama `chore/cierre-final` con el mismo código y los PR 28, 29, 30 y 31 dieron verde; local, 661 de 661. No se pudo probar la causa exacta (el log no la muestra): es una conclusión por descarte. |
| 4 | Aporte personal | Emily detectó el CI en rojo y pidió revisar y corregir. |
| 5 | Desacuerdo y resolución | Si vuelve a aparecer un fallo así con 60 s, deja de ser un runner lento y hay que mirar bloqueos en la base (un `TRUNCATE` espera a cualquier transacción abierta). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `gh`. Context7 no se consultó (solo valores de configuración de Vitest que ya estaban). |

**Impacto en el frontend (contrato):** ninguno.


## Entrada 128: AE4, fase 6 (pendiente) — reglas de alerta de Sentry filtradas por `environment:production` (rama `chore/cierre-final`)

**Fecha:** 2026-11-06 04:36 (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|----------|----------|
| 1 | Qué se decidió | **Hecho por Claude Code**, a pedido de Emily, con la herramienta `update_alert_rule` del conector de Sentry (no hay cambio de código ni de GitHub). Las cuatro reglas «Send a notification for high priority issues» de la organización `kologic` (IDs 6064248, 6076334, 6064296 y 6064235) pasaron de `environment: null` a `environment: production`. Cumple el pendiente de la entrada 100. No se tocó la regla «Send a notification when pull requests are ready» (5913791). |
| 2 | Alternativas y criterio de descarte | **Dejar las reglas sin filtro:** descartado, los avisos anteriores eran todos de `environment: test` (corridas de `npm test`). **Filtrar solo la regla del proyecto del backend:** descartado, las cuatro avisan por mail a los miembros activos y ninguna es de otro entorno que producción. |
| 3 | Evidencia que la sostiene | `find_alert_rules` antes del cambio (las cinco reglas con `environment: null`) y la respuesta de cada `update_alert_rule` con `environment: "production"`. No se probó que una alerta de producción llegue: se verá con el próximo error real. |
| 4 | Aporte personal | Emily indicó el pendiente y confirmó que se filtraran las reglas y se anotara el cambio. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. Siguen abiertos: la regla 6064235 no está conectada a ningún proyecto (conviene borrarla desde Sentry si es un resto de prueba) y la caída 503 de UptimeRobot del 31/10 a las 19:59 UTC, que requiere mirar los eventos y el log de Render de esa franja. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con el conector de Sentry. Context7 no se consultó (no hay código que dependa de una librería). |

**Impacto en el frontend (contrato):** ninguno.


## Entrada 129: libro v8 armado sobre el v7, pendiente de entrega

**Fecha:** 2026-11-06 (hora aproximada, Argentina; después del merge del PR 32 de las 04:26)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Armar 20261106_CatalogoRequisitos_Kohler_v8.xlsx editando el v7 del repositorio, sin pisarlo, con la segunda confirmación de Loren, los cambios de código de las fases 1 a 10 y las cifras del 06/11/2026. Dejar RF-35 como decisión de la autora, sin validación de la propietaria. No cargar valores de RNF-01 ni de RNF-02. |
| 2 | Alternativas y criterio de descarte | (a) Rehacer desde la v6 del proyecto: descartado, el v7 real tenía fórmulas y listas. (b) Marcar todo «Validado» por la segunda confirmación: descartado, solo lo que ella marcó «Sí». (c) Poner valores medidos de RNF-01 y RNF-02: descartado, no hay medición. |
| 3 | Evidencia que la sostiene | Segunda confirmación firmada (14 «Sí», 30/10/2026), leída en Drive. docs/cobertura-por-requisito.md, docs/cambios-y-decisiones.md y docs/estimacion-horas.md del backend en main (0ed2603). Frontend en main (ec35329): 46 archivos y 365 pruebas que corrí yo. Recalculo: 512 fórmulas, 0 errores; 43 requisitos, 12 «Must», 23 validados, 35 con prueba, 6 parciales, 2 sin prueba y 8 brechas abiertas. |
| 4 | Aporte personal | Emily pidió el v8 completo, decidió el recordatorio (RF-35) y quitar campañas, puntos y recordatorio de inactividad, y confirmó los merges. Le toca revisar las decisiones marcadas arriba, medir RNF-01 y RNF-02 y subir el libro al repositorio. |
| 5 | Desacuerdo y resolución | RF-35 contradice la pregunta 11 firmada: se declara y queda «Pendiente». La tarjeta P9 figura terminada sin la prueba del frontend: queda como brecha abierta de RF-02. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con los conectores de Trello y Google Drive, y lectura de los dos repositorios clonados. Corrió las pruebas del frontend, no las del backend. El archivo se generó con openpyxl y no está entregado todavía. Revisión final por Emily pendiente. |

## Entrada 130: libro v8 entregado y tarjeta 73 completada

**Fecha:** 2026-11-06 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Entregar 20261106_CatalogoRequisitos_Kohler_v8.xlsx (entrada 129). Marcar como completada la tarjeta «FRONTEND Fase 3b» y moverla a TERMINADOS. |
| 2 | Alternativas y criterio de descarte | Marcar también las tarjetas 61 y 74: descartado, faltan las mediciones de RNF-01 y RNF-02 y subir el libro al repositorio. |
| 3 | Evidencia que la sostiene | En main del frontend (ec35329) están reminderLink.ts, MyAppointmentsLinkPage.tsx y sus pruebas, y las 365 pruebas pasan. |
| 4 | Aporte personal | Emily revisa el v8 y sube el libro a /03-requisitos. |
| 5 | Desacuerdo y resolución | Ninguno. Siguen abiertas las decisiones de la entrada 129 (RF-35, RF-09, RNF-01 y RNF-02). |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Trello. Revisión final por Emily pendiente. |

## Entrada 131: AE4, validación en el navegador de RF-13 a RF-35 y RNF-06 a RNF-10 (sin cambios de código; base local de pruebas cargada con datos y borrada al final)

**Fecha:** 2026-11-08, de 19:25 a 20:10 aprox. (hora de la máquina, UTC-3). Esta entrada se escribió el 2026-11-09, después de la sesión: se omitió anotarla en el momento y Emily lo señaló.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de ella: probar en el navegador los requisitos RF-13 a RF-18, RF-24, RF-26, RF-29, RF-31 a RF-35 y RNF-06 a RNF-10 y marcar cada uno como validado o pendiente. **No se modificó ningún archivo del repositorio** (ni de `nexa-backend` ni de `nexa-frontend`; `git status` limpio al terminar). Se hizo en cuatro tandas. **Entorno:** backend con `NODE_ENV=test` (usa `.env.test`, base local `nexa_db_test`, puerto 4001) y frontend de Vite en el puerto 5174 con un archivo de configuración temporal `vite.qa.config.ts` (proxy de `/api` al puerto 4001 con `Origin` de `localhost:5173`, porque el 5173 estaba ocupado por la app de Claude); el archivo se creó y se borró en cada tanda. **Datos:** se cargaron con `seed:demo` y con scripts descartables (administradora, clientas y profesional de prueba con credenciales de la propia base de test, un combo, turnos impagos, un servicio especial, un producto, invitaciones); los scripts quedaron en la carpeta temporal de la sesión, fuera del repositorio. **Resultado:** validados RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-26, RF-31, RF-32, RF-34, RNF-06, RNF-08, RNF-09 y RNF-10; pendientes RF-24, RF-29, RF-33, RF-35 y RNF-07 (motivos en el elemento 5). **Al final se borró la base `nexa_db_test`** a pedido de Emily, con una verificación previa de que fuera local y de test; `npm run test:migrate` la vuelve a crear. |
| 2 | Alternativas y criterio de descarte | **Usar `npm run dev` con el `.env` real:** descartado, apunta a la base de producción y los turnos de prueba la habrían ensuciado. **Cambiar `FRONTEND_URL` en `.env.test` para usar otro puerto:** descartado, no se leen ni editan los `.env` desde la terminal (un hook del proyecto lo bloquea); se usó el proxy con `Origin` fijo. **Probar el `429` de la postulación y del ingreso, y el `201` con mail, en el navegador:** no se pudo, en `NODE_ENV=test` los limitadores están apagados y no hay credenciales de correo; quedan cubiertos solo por la suite automática. **Probar los casos de error (409, combo, cancelado, bloqueada) por la interfaz:** descartado donde la interfaz no deja elegirlos (no ofrece horarios ocupados ni el botón de reprogramar un combo); se llamó a la API con la sesión del navegador. **Armar el servicio especial y el combo desde el panel:** se insertaron en la base de test con script, por velocidad. |
| 3 | Evidencia que la sostiene | **RF-13:** de 10:00 a 11:00 a un horario libre; con el horario ocupado `409 PROFESSIONAL_SLOT_TAKEN` y el turno quedó en su hora; combo `400 COMBO_NOT_RESCHEDULABLE` (la tarjeta del combo solo ofrece «Cancelar combo»); reprogramación del personal: aviso en pantalla que persiste al recargar y desaparece al aceptar; el mail se intentó (`[mail] error notificando reprogramación (staff)`) pero falló por falta de credenciales. **RF-14:** el job liberó el turno suelto de Mercado Pago y las dos patas del combo (`cancelled_by system`), dejó el de WhatsApp, tres entradas «Turno liberado por falta de pago» y el horario se pudo reservar de nuevo. **RF-15:** administrador y profesional; fuera de franja `201` confirmado sin seña; mismo inicio `409`. **RF-16:** saldo $10.500 pasa a `paid`; $2.000 queda `partial`; cancelado `400 INVALID_STATUS`. **RF-17:** servicio especial reservado desde la interfaz ($55.000, 75 min, seña pendiente), `409 SLOT_TAKEN` para la misma clienta y para otra, precio y duración recalculados por el servidor aunque se mande otro valor, los dos turnos cancelados por el job (`unpaid_expired`) y el horario se pudo reservar otra vez. **RF-18:** clienta bloqueada desde el panel: reservar y comprar dan `403 CLIENT_BLOCKED`. **RF-24:** con la seña impaga la profesional no recibió aviso; al aprobar el pago (`applyPaymentResult`) recibió uno, y repetir el aviso no lo duplicó; la clienta recibe `new_product` y `new_service`; el combo con las dos patas de la misma profesional generó dos avisos. **RF-26:** el historial del administrador trae estado y motivo (`user_cancelled`, `unpaid_expired`), la profesional ve a la clienta y el administrador ve los finalizados de la profesional. **RF-29:** invitación a 7 días; usada `TOKEN_USED`, vencida `TOKEN_EXPIRED`; registro por la interfaz; cambio de rol, fecha de ingreso y desactivación (el refresh pasa a `401 INVALID_REFRESH_TOKEN`); franja 20:00–08:00 y hora no `HH:mm` dan `400`; un `PATCH` de un solo campo no borra el resto; precio y duración propios se cargan por el onboarding. **RF-31:** detalles de la clienta visibles para el administrador, retiro de esmalte con regla de Configuración y precio del turno sin cambios. **RF-32:** seña de $5.000 a $3.000 en la interfaz, el turno siguiente salió con $3.000; modo porcentaje 20 % da $3.000; `refundPolicy: partial` da `400`; negocio, horario y feriado guardados; seña restaurada a $5.000. **RF-33:** `400 VALIDATION_ERROR` sin datos, con correo inválido y con teléfono inválido; con el mail caído `500 JOB_INTEREST_MAIL_FAILED` y una entrada de error del módulo `jobs` sin datos personales. **RF-34:** panel del administrador contra los turnos (1 asistido, 7 cancelados, señas $37.500, saldo pendiente $68.500, igual que la fórmula de `dashboard.service.ts`); paneles de la profesional con `200`. **RNF-07:** `document.cookie` vacío, cookies `HttpOnly`, `403 FORBIDDEN_ORIGIN` con origen distinto, profesional en rutas de administración `403`. **RNF-10:** `typecheck:all` sin errores, backend 59 archivos y 661 pruebas, frontend 46 archivos y 365 pruebas, y último CI backend en `main` exitoso (06/11). RF-35, RNF-06, RNF-08 y RNF-09 se apoyan en la suite (`appointments.reminder`, `scheduler`, `sentry.scrub`, `timezone-art`, `payments.webhook-*`). |
| 4 | Aporte personal | Emily eligió los requisitos y el criterio de marcado (validado o pendiente con motivo), pidió probar en el navegador, autorizó borrar la base de prueba y detectó que faltaba esta entrada. |
| 5 | Desacuerdo y resolución | **Quedan pendientes, para Emily:** (a) **RF-24:** el criterio pide «un solo aviso por grupo» en un combo, pero el código (`afterCreateGroup`) manda un aviso por pata, aunque sean de la misma profesional; hay que decidir si se cambia el código o el criterio. (b) **RF-29:** el criterio dice que cada profesional completa sus vacaciones, pero `profileSchema` no las acepta y solo las edita el administrador (`PATCH /professionals/:id`); no hay pantalla de vacaciones para la profesional. (c) **RF-33, RF-35 y RNF-07:** falta ver en un entorno con correo el `201`, el mail recibido, la entrada «Nueva postulación» y el recordatorio con sus tres enlaces, y el `429` del ingreso y de la postulación; en producción no se probó. (d) **Observaciones, sin tocar:** en el historial del administrador los cancelados por la clienta dicen solo «Cancelado» (el motivo está en la API, pero la pantalla solo lo escribe para la falta de pago); reprogramar como clienta recalculó la seña del turno con el valor vigente aunque `paymentStatus` siguió en `partial`; el webhook de Mercado Pago responde `500` si falta `MERCADOPAGO_WEBHOOK_SECRET` (en `.env.test` falta). |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con el navegador integrado, `curl`, `gh`, `npm` y scripts de Prisma. Context7 no se consultó: no se escribió código del proyecto. |

**Impacto en el frontend (contrato):** ninguno. No cambia ninguna ruta, método, código de error ni respuesta.


## Entrada 132: tercera confirmación de Loren y cambio de cinco reglas

**Fecha:** 2026-11-08 (hora aproximada, Argentina; noche, antes de los cambios de código del 09/11 a las 02:19)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Crear Confirmacion3_Loren_Nexa.docx (19 preguntas) con lo que no estaba confirmado, y cambiar cinco reglas antes de mandarla: cambio de profesional en combos por el personal, la clienta no cambia de profesional, cobro del servicio completo por la administradora y las profesionales con la forma de pago, clienta bloqueada sin aviso, y recordatorio aunque el correo no esté verificado. Redactar dos prompts para Claude Code. La propietaria marcó «Sí» en todo el 8/11/2026. |
| 2 | Alternativas y criterio de descarte | (a) Pedir confirmación de RNF-06 a RNF-10: descartado, son técnicos y no los puede validar. (b) Mandar el formulario sin cambiar las reglas: descartado, el código y el libro tenían que decir lo mismo. (c) Esperar un PR del backend para empezar el frontend: descartado, no existe y se trabaja directo sobre main. |
| 3 | Evidencia que la sostiene | PDF Confirmacion3_Loren_Nexa.pdf con fecha 8/11/2026. En el texto extraído no se ven las casillas: Emily informó que marcó todo «Sí». Pruebas manuales de Emily de RF-13 a RF-18, RF-24, RF-26, RF-29 y RF-31 a RNF-10. Informe del frontend: origin/main sin los endpoints nuevos. |
| 4 | Aporte personal | Emily definió las cinco reglas, probó los requisitos pendientes y obtuvo la firma. Le toca correr los dos prompts, verificar los mails en producción y medir RNF-01. |
| 5 | Desacuerdo y resolución | Mi prompt del frontend dependía de un PR del backend inexistente. Se corrige: el frontend avanza solo con lo que no depende del backend. El código actual contradice las reglas 3, 4 y 5 (cobro solo del administrador, 403 CLIENT_BLOCKED visible y recordatorio con correo verificado): se cambia el código. Se omitió la entrada de las respuestas anteriores a esta. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5): formulario Word y prompts. No ejecutó ni verificó código. Revisión final por Emily pendiente. |

## Entrada 133: AE4, complemento de las entradas 120, 126 y 127 — hashes y operaciones de GitHub que faltaban

**Fecha:** 2026-11-09 (hora de la máquina, UTC-3). Cubre lo hecho entre el 2026-11-05 22:30 y el 2026-11-06 04:45.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), no por Emily**, a pedido de ella: completar la bitácora con lo que las entradas 120, 126 y 127 no nombraban. **Commits de esta sesión, en orden:** `905f149` (postulaciones por mail, RF-33), `f1db365` (bitácora 96 y 97 y plan de despliegue), `bdb0896` (prueba de RF-24: el aviso al estudio entra en la lista de envíos permitidos), `a78cc8b` (fase 9.3 a `main`, entradas 122 y 123), `3ec1f8b` (pruebas de `terms-version.test.ts` de `ac0ba11`, RF-08), `d867e55` (`createPreference` de Mercado Pago, `.env.example`, cobertura, base vacía), `ed8336a` (estimación de horas y entrada 126), `5158335` (más tiempo de espera de Vitest, entrada 127). **Merges para resolver conflictos de la bitácora:** `d4d3862` (PR 30: se conservaron las entradas 119, 120, 122 y 123) y `c088d90` (PR 32: `main` ya tenía las entradas 124 y 125 del frontend, así que mi entrada 124 pasó a ser la 102). **Pull requests abiertos por mí:** 29 (fase 9.3), 30 (postulaciones) y 32 (cierre del backend), sin merge: los mergeó Emily. **Otras operaciones:** `git branch -D feat/recordatorio-turno-mail` y `git branch -D feat/fase-4-tienda` (solo locales; la remota de ambas no se tocó), y `gh run rerun --failed` sobre la corrida 42179876142 del CI de `main`. Se creó y se borró la base local `nexa_vacia_test` para probar la instalación desde cero. |
| 2 | Alternativas y criterio de descarte | Ya en las entradas 120, 122, 126 y 127. |
| 3 | Evidencia que la sostiene | `git log` de `main` (los hashes de arriba) y `gh pr view` de los pull requests 29, 30 y 32 (estado MERGED). |
| 4 | Aporte personal | Emily pidió que todo lo hecho quede anotado en esta bitácora y que no se suba ningún commit con ese cambio. |
| 5 | Desacuerdo y resolución | La entrada 126 decía que el commit de la estimación «se identifica con `git log`»: es `ed8336a`. La entrada 127 no registraba el reintento del CI: figura arriba. Esta entrada queda **sin commitear**, a pedido de Emily. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y `gh`. Context7 no se consultó (solo documentación). |

**Impacto en el frontend (contrato):** ninguno.


## Entrada 134: AE4, cierre — subida de las entradas 127 y 128 por el pull request 33 y limpieza de ramas en los dos repositorios

**Fecha:** 2026-11-06, de 04:37 a 04:45 aprox. (hora de la máquina, UTC-3). Esta entrada se escribió el 2026-11-09, después de la sesión: se omitió anotarla en el momento.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Sonnet 5.5), a pedido de Emily.** (A) Se commiteó la entrada 128 (`b408b52`) en `chore/cierre-final` y se pusheó; el pull request 32 de esa rama ya estaba mergeado a `main` (07:26 UTC), así que el commit no tenía pull request. (B) Se creó `docs/bitacora-104-sentry` cortada de `origin/main`, se pasó el commit con `cherry-pick` (conflicto en la bitácora: `main` no tenía la entrada 127, que quedó en la rama vieja; se resolvió quitando los marcadores y dejando 103 y 104), se sumó `vitest.config.mts` de la rama vieja (`hookTimeout` 60 s, `testTimeout` 30 s) porque la entrada 127 lo describe y `main` no lo tenía, y se abrió el pull request 33 (mergeado a las 07:44 UTC por Emily). (C) Se borraron las ramas innecesarias. **Backend:** 9 remotas (`chore/cierre-final`, `docs/bitacora-ae3-entradas-frontend`, `docs/bitacora-fase-10-frontend`, `docs/informes-v8`, `docs/fase-9-3-a-main`, `feat/postulaciones-por-mail`, `feat/recordatorio-turno-mail`, `fix/fase-10-cierre-codigo`, `integracion-ae4`) y todas las locales salvo `main`. **Frontend:** 9 remotas (`chore/sincronizar-main-en-integracion`, `docs/bitacora-en-backend-y-noindex-mis-turnos`, `feat/cancelacion-con-hora-de-aviso`, `feat/enlaces-recordatorio-y-fechas`, `feat/horarios-reabiertos-y-estados`, `fix/brechas-requisitos`, `fix/fase-10-frontend`, `fix/fase-7-tienda-alergias-fechas`, `integracion-ae4`) y todas las locales salvo `main`. |
| 2 | Alternativas y criterio de descarte | **Pushear la entrada 128 directo a `main`:** descartado, `CLAUDE.md` pide no pushear a `main` sin pedido expreso y el flujo es rama y pull request que mergea Emily. **Reabrir `chore/cierre-final` con un pull request nuevo:** descartado, arrastraba commits ya mergeados; una rama nueva desde `main` dejó un diff de solo dos archivos. **Dejar `integracion-ae4`:** descartado, estaba contenida en `main` y el cierre terminó el flujo de ramas desde ella. **Borrar con `git branch -d`:** no alcanzó para `fix/fase-7-tienda-alergias-fechas` y las ramas locales, que figuraban como «sin mergear» por commits reescritos con otro hash; se usó `-D` después de comparar su contenido contra `main`. |
| 3 | Evidencia que la sostiene | `gh pr list`: pull requests 28 a 32 mergeados; el 33 mergeado a las 07:44 UTC. `git diff origin/main` de la rama nueva: solo la bitácora (+30 líneas) y `vitest.config.mts`. Antes de borrar se comparó cada rama con `main` por archivos: las diferencias eran versiones más viejas que las de `main` (por ejemplo `estimacion-horas`, el asunto del mail de postulaciones), no trabajo propio. `git branch -a` posterior: backend con `main` y la rama del pull request 33; frontend solo `main`. No se verificó caso por caso que ninguna rama tuviera algo único: es una conclusión por comparación de archivos. |
| 4 | Aporte personal | Emily pidió subir los cambios, avisó que no veía el commit para mergear, pidió abrir el pull request y borrar las ramas innecesarias de los dos repositorios, mergeó el pull request 33 y pidió esta anotación. |
| 5 | Desacuerdo y resolución | La falta de pull request para el commit la señaló Emily; se resolvió con la rama nueva. Las ramas borradas siguen recuperables por su hash mientras GitHub los conserve. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `git` y `gh`. Context7 no se consultó: no se escribió código que dependa de librerías. |

**Impacto en el frontend (contrato):** ninguno.


## Entrada 135: AE4, cambios de reglas del 06/11/2026 — backend (8 puntos, 10 commits, sin migración)

**Fecha:** 2026-11-09, hasta las 02:52 aprox. (hora de la máquina, UTC-3). Trabajo directo sobre `main`, sin rama ni pull request, a pedido de Emily.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), a pedido de Emily.** Se implementaron las reglas de Emily del 06/11/2026, un commit por punto: (5) recordatorio de turno aunque el correo no esté verificado, `fe42e06`; (4) clienta bloqueada con error genérico `400 OPERATION_FAILED` «No pudimos completar la operación» al reservar y al comprar, `1fbb562` (+ prueba de reserva ajustada, `d6dd428`); (2) la clienta no cambia de profesional al reprogramar, `400 PROFESSIONAL_CHANGE_NOT_ALLOWED`, `2f06fce`; (3) cobro en el local también para la profesional en sus turnos, `99aea11`; (6) un aviso y un mail por profesional y por grupo de combo, `86be0c3`; (7) vacaciones de la profesional en `PATCH /profile` con validación, `0fa6c9d`; (1) cambio de profesional en un servicio de combo para el administrador y la profesional, `731b097`; (8) el historial de la clienta devuelve `cancelledBy` para armar el motivo, `fee5a80`; documentación (`CLAUDE.md`, `docs/cambios-y-decisiones.md`, `docs/cobertura-por-requisito.md`), `b5224b3`. Decisiones mías: los cobros del local se **suman** y se rechazan el monto mayor a lo que falta y el turno ya pagado; la clienta **no** recibe mail por el cambio de profesional (la política de privacidad no lo lista); la profesional solo cambia patas de combo y solo las suyas; la nueva profesional debe ofrecer el servicio, tener franja y no repetirse a la misma hora del grupo; la validación de vacaciones rige también para el administrador. |
| 2 | Alternativas y criterio de descarte | **Dejar `403 CLIENT_BLOCKED` con otro texto:** descartado, el código ya delata el bloqueo. **Que el cobro nuevo pise el anterior (como antes):** descartado, dos cobros parciales perdían el primero. **Mail a la clienta al cambiar de profesional:** descartado, agrega un mail que la política de privacidad (`2026-11`) no lista. **Exigir el cambio solo al administrador:** descartado, la regla pide que la profesional también pueda. **Migración para guardar el motivo de cancelación:** no hizo falta, `cancelled_by` ya existía. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` limpio y `npm test`: 61 archivos y 682 pruebas, 682 pasaron (antes 59 y 661). Pruebas nuevas: `appointments.combo-reassign.test.ts` (7), `professional.vacation.test.ts` (8), `appointments.balance-payment.test.ts` (+5), el combo de `notifications.investigation.test.ts`, `appointments.cancel-reschedule.test.ts`, `history-activity-dashboard.test.ts`; actualizadas las que decían lo contrario (`appointments.reminder`, `store.blocking-and-movements`, `appointments.booking`). La base de pruebas local no existía y se recreó con `npm run test:migrate`; una primera corrida dio fallas porque se lanzó a la vez que la del frontend sobre la misma base. |
| 4 | Aporte personal | Emily definió las ocho reglas, el orden, que no hubiera migración y que se trabajara sobre `main`. |
| 5 | Desacuerdo y resolución | **El push a `main` del backend no se hizo:** el hook del proyecto bloquea todo push a `main` («un push a `main` redespliega el backend en Render»). La instrucción de Emily lo pedía, pero no se esquivó el bloqueo; los 11 commits quedan locales y el push lo hace Emily desde su terminal (`git push origin main`; no hay migración que aplicar antes). Además, la bitácora tenía en el árbol de trabajo cambios sin commitear que no son de esta sesión (renumeración de las entradas 133 y 134); se incluyen en este commit tal como estaban. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5) con `git`, `npm` y Vitest. **Context7 no se consultó:** los cambios siguen patrones ya usados en el repositorio (Express, Prisma y zod), sin APIs nuevas de las librerías. |

**Impacto en el frontend (contrato):** sí. `PATCH /api/professional/appointments/:id/balance-payment` es nueva; `PATCH /api/professional/appointments/:id` acepta `professionalId`; la vista del turno de la profesional suma `depositAmount` y `balancePayment`; `reschedule` responde `400 PROFESSIONAL_CHANGE_NOT_ALLOWED`; `CLIENT_BLOCKED` desaparece (ahora `400 OPERATION_FAILED`); `PATCH /api/professionals/profile` acepta `vacationFrom` y `vacationTo` y `GET /profile` los devuelve; el historial de la clienta suma `cancelledBy`. Archivos del frontend afectados: ver la entrada 136.


## Entrada 136: AE4, cambios de reglas del 06/11/2026 — frontend (`nexa-frontend`, 7 commits)

**Fecha:** 2026-11-09, hasta las 02:52 aprox. (hora de la máquina, UTC-3). Repositorio `nexa-frontend`, directo sobre `main`.

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), a pedido de Emily.** Siete commits: `45f54e7` (puntos 1 y 3: `BalancePaymentForm` con forma de pago, monto sugerido y mensaje del servidor para el administrador y la profesional; `ChangeLegProfessional` para cambiar la profesional de un servicio de combo en el modal del administrador y en el diálogo de la profesional); `5eea6c5` (punto 2: `RescheduleModal` sin pasos de servicio ni profesional); `061560b` (punto 4: `errorMessage.ts` muestra el texto genérico para `OPERATION_FAILED` y `CLIENT_BLOCKED`); `0f0b7c2` (punto 5: prueba que falla si algún texto pide verificar el correo; no había ninguno); `7dbcd6e` (punto 8: columna «Motivo» en el historial del administrador, `cancelReason.ts`); `99cfa5b` (punto 7: `VacationSection` en la configuración de la profesional); `39ae7d8` (README 8.3, una fila por commit, aclarando que los hizo Claude Code). Los puntos 1 y 3 van en un solo commit porque comparten archivos. |
| 2 | Alternativas y criterio de descarte | **Dejar el selector de servicio en la reprogramación:** descartado, al fijar la profesional el servicio podría no ser de ella; reprogramar es cambiar día y hora. **Un formulario de cobro para cada rol:** descartado, un solo componente compartido evita que diverjan. **Filtrar en el cliente las profesionales que hacen el servicio:** descartado, el diálogo de la profesional no conoce el id del servicio; valida el servidor y su mensaje se muestra. |
| 3 | Evidencia que la sostiene | `npm run lint` sin errores, `npm run typecheck:all` sin errores, `npm test`: 53 archivos y 395 pruebas, 395 pasaron (antes 46 y 365), `npm run build` correcto. Pruebas nuevas por cada cambio: `BalancePaymentForm`, `ChangeLegProfessional`, `AppointmentModal` y `AppointmentDialog` (combo y cobro), `RescheduleModal`, `errorMessage.blocked`, `noEmailVerificationCopy`, `cancelReason`, `HistoryTab`, `VacationSection`. |
| 4 | Aporte personal | Emily definió las reglas y el alcance en los dos repositorios. |
| 5 | Desacuerdo y resolución | **El push a `main` del frontend no se hizo:** el mismo hook bloquea el push a `main` y no se esquivó; los 7 commits quedan locales y Emily los sube desde su terminal (redespliega Vercel). Conviene subir primero el backend: el frontend ya espera `OPERATION_FAILED`, `cancelledBy` y la ruta de cobro de la profesional (con el backend viejo, el cobro de la profesional daría 404 y el cambio de profesional no se aplicaría). |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5) con `git`, `npm`, Vitest y ESLint. Context7 no se consultó: sin APIs nuevas de librerías. |

**Impacto en el frontend (contrato):** es el propio frontend. Archivos tocados: `src/shared/ui/molecules/BalancePaymentForm.tsx`, `src/shared/ui/molecules/ChangeLegProfessional.tsx`, `src/shared/utils/balancePayment.ts`, `src/shared/utils/cancelReason.ts`, `src/shared/utils/errorMessage.ts`, `src/pages/admin/appointments/AppointmentModal.tsx`, `src/pages/admin/appointments/AppointmentsPage.tsx`, `src/pages/admin/clients/tabs/HistoryTab.tsx`, `src/pages/admin/clients/types.ts`, `src/features/professional/agenda/Agenda.tsx`, `src/features/professional/agenda/dialogs/AppointmentDialog.tsx`, `src/features/professional/types/appointment.ts`, `src/features/professional/settings/Settings.tsx`, `src/features/professional/settings/VacationSection.tsx`, `src/features/client/booking/RescheduleModal.tsx` y `README.md`.


## Entrada 137: AE4, cambios de reglas del 06/11/2026 — subida por rama y pull requests 34 (backend) y 22 (frontend)

**Fecha:** 2026-11-09, 03:00 aprox. (hora de la máquina, UTC-3).

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), a pedido de Emily** («subí todos los cambios y yo solo hago merge»). En cada repositorio se creó la rama `feat/cambios-de-reglas-06-11` desde el `main` local con los commits de las entradas 135 y 136 (backend: 12 sobre `origin/main`, incluida esta entrada; frontend: 7) y se pusheó. Se abrieron los pull requests [nexa-backend#34](https://github.com/emilykohler12/nexa-backend/pull/34) y [nexa-frontend#22](https://github.com/emilykohler12/nexa-frontend/pull/22). El de backend lleva además las entradas 131, 133 y 134 que Emily había escrito en otro chat y que estaban sin commitear en el árbol de trabajo (no estaban en `origin/main`). **Orden de merge: primero el backend, después el frontend** (el frontend ya espera `OPERATION_FAILED`, `cancelledBy` y la ruta de cobro de la profesional). |
| 2 | Alternativas y criterio de descarte | **Push directo a `main`:** descartado, un hook del proyecto lo bloquea y redespliega Render/Vercel; el flujo acordado es rama y pull request que mergea Emily. **Un solo pull request para los dos repositorios:** imposible, son repositorios distintos. **Dejar el `main` local adelantado:** descartado, divergiría del `main` remoto tras el merge. |
| 3 | Evidencia que la sostiene | `git push -u origin feat/cambios-de-reglas-06-11` en ambos (`new branch`); `gh pr create` devolvió las URL de los pull requests 34 y 22. `origin/main` no tenía ninguno de estos commits ni las entradas 131, 133 y 134 antes de la subida. |
| 4 | Aporte personal | Emily aclaró que ya había escrito las entradas 131, 133 y 134, pidió subir todo y que ella solo hace el merge. |
| 5 | Desacuerdo y resolución | Emily creía que los cambios ya estaban subidos; en realidad todo estaba solo en la máquina (el push a `main` estaba bloqueado). Se resolvió con la rama y los pull requests. Los chequeos de CI de cada pull request no se revisaron en esta sesión. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5) con `git` y `gh`. Context7 no se consultó (sin código nuevo). |

**Impacto en el frontend (contrato):** ninguno adicional; ver la entrada 135.

## Entrada 138: una sola cifra de horas de desarrollo y prompt unificado para el código

**Fecha:** 2026-11-09 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Calcular las horas de desarrollo con un solo método: semanas por horas semanales declaradas, desde el 01/06/2026 hasta el 09/11/2026, sin el período del 07/10 al 22/10, y sin las 3 horas de reuniones. Resultado propuesto: unas 420 horas, con corte actualizable el 14/11. No tocar el libro hasta terminar el código. Registrar además el 08/11: prompt único para backend y frontend (cambio de profesional en combos, cobro por la profesional, clienta bloqueada sin aviso, recordatorio sin correo verificado, aviso por grupo en combos, vacaciones de la profesional y motivo de cancelación en el historial), y los resultados de las pruebas manuales de RF-13 a RNF-10. |
| 2 | Alternativas y criterio de descarte | (a) Empezar en abril: descartado, la bitácora del AE1 entregada dice que la programación empezó en junio. (b) Estimar desde commits: descartado, hay commits en solo 30 días desde el 25/08 y nada antes. (c) Usar tres cifras (plan, estimada y mínima): descartado por Emily, una sola. (d) Separar horas con y sin Claude Code: descartado por Emily. |
| 3 | Evidencia que la sostiene | Bitácora del AE1 (entradas de junio, julio y agosto), del AE2 (10/09 al 05/10) y del AE3 (sin entradas del 07/10 al 22/10). Hoja Recursos y Iteraciones del libro (25 horas semanales declaradas). Historial de los dos repositorios, leído por Claude. |
| 4 | Aporte personal | Emily indicó qué meses fueron más intensos, que no tiene fecha exacta de abril ni registro de horas, y que no quiere separar lo hecho con Claude Code. Debe confirmar las 15 horas semanales de los meses livianos. |
| 5 | Desacuerdo y resolución | Emily dijo que trabajó en el código desde abril, y su bitácora del AE1 dice junio. Se usa junio, que coincide con el documento entregado. Claude interpretó «junio y septiembre» como «julio y septiembre»; queda para que Emily lo confirme. No se registró antes la entrada de los mensajes del 08/11. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con el conector de Google Drive y lectura de los repositorios. El resultado es una estimación y no un registro de horas. No se modificó el libro ni el tablero. Revisión final por Emily pendiente. |

## Entrada 139: método de estimación de horas por tres valores

**Fecha:** 2026-11-09 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Estimar las horas de desarrollo con tres valores por tipo de mes (mínimo, probable y máximo), con intervalo del 95 %. Julio y agosto a 25 horas semanales probables, junio, septiembre y el 1 al 6 de octubre a 15, y 25 desde el 23/10. Resultado propuesto: 424 horas (394 a 454). No cambiar el libro hasta terminar el código. |
| 2 | Alternativas y criterio de descarte | (a) COCOMO y puntos de función: descartados, miden el tamaño para un equipo sin asistencia de IA y dan miles de horas, lejos de la realidad. (b) Estimar desde commits: descartado, hay commits en solo 30 días. (c) Repartir el porcentaje por fase del desarrollo (10, 15, 50, 15, 10): descartado, es una regla general sin fuente. |
| 3 | Evidencia que la sostiene | Bitácoras del AE1, AE2 y AE3 (inicio en junio y tramo sin actividad). Hoja Recursos (reuniones y 25 horas semanales). Búsqueda web del 09/11/2026 sobre las fórmulas de la estimación por tres valores. |
| 4 | Aporte personal | Emily corrigió qué meses fueron más intensos y aprobó 15 horas para los livianos. Le toca confirmar las dos últimas semanas y los rangos. |
| 5 | Desacuerdo y resolución | Claude había invertido los meses; Emily lo corrigió. Queda sin verificar el volumen y las páginas del artículo de 1959 y la sección del PMBOK. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con búsqueda web. Es una estimación a posteriori, no un registro de horas. No se modificó el libro. Revisión final por Emily pendiente. |

## Entrada 140: libro v9, horas y tablero

**Fecha:** 2026-11-09 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Armar 20261109_CatalogoRequisitos_Kohler_v9.xlsx sobre el v8, con la tercera confirmación de Loren (8/11/2026), las reglas del 06/11, la prueba manual de Emily y la cifra única de horas (424, intervalo de 394 a 454). Recalcular Recursos con el desarrollo del 01/06 al 09/11 (5,4 meses y 431 horas totales). Marcar tres tarjetas, crear dos y comentar tres. |
| 2 | Alternativas y criterio de descarte | (a) Poner «Validado» a RNF-01 por la prueba de Emily: descartado, la validación es de la propietaria y falta la medición. (b) Cerrar las brechas de los PR 34 y 22: descartado, no están mergeados. (c) Conservar las 200 horas como ejecución: descartado, la cifra única es 424. (d) Dejar las 46 a 48 horas por commits: descartado, contradice la cifra única. |
| 3 | Evidencia que la sostiene | PDF Confirmacion3_Loren_Nexa.pdf (19 «Sí», 8/11/2026). Ramas de los PR 34 y 22 leídas en GitHub (pruebas nuevas por requisito). Informe de Claude Code (682 y 395 pruebas) y prueba manual de Emily. Recalculo: 37 requisitos validados, 11 brechas abiertas, 424 horas, total de Recursos $15.793.053. |
| 4 | Aporte personal | Emily corrigió los meses de mayor trabajo, decidió una sola cifra de horas, aprobó las reglas del 06/11, probó el sistema y obtuvo la respuesta de Loren. Le toca mergear los PR, medir RNF-01 y RNF-02 y confirmar la firma. |
| 5 | Desacuerdo y resolución | Emily dijo que programó desde abril y su bitácora del AE1 dice junio: se usa junio. El PDF de Loren no muestra firma. Los 25 h por semana de las dos últimas semanas son supuesto de Claude, por confirmar. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con los conectores de Trello y Google Drive y lectura de los repositorios. No ejecutó las pruebas de los PR: las cifras salen del informe de Claude Code. Revisión final por Emily pendiente. |

## Entrada 141: AE4, prueba de punta a punta en navegador sobre una base local nueva (09/11/2026, 20:20 a 20:50, hora de Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Probar el flujo de registro, reserva, seña por WhatsApp y reprogramación desde el navegador, con backend y frontend locales apuntando a una base nueva `nexa_e2e_test` (creada, migrada con `prisma migrate deploy` y cargada con `seed:demo`); correr `typecheck:all` y las pruebas de los dos repositorios; consultar `/api/health` de producción; seguir el manual (README) en una copia limpia. No se tocó código ni configuración del proyecto. Cambios fuera del repositorio: bases `nexa_e2e_test`, `nexa_dev_test` y una copia limpia de los dos repos en la carpeta temporal de la sesión; los procesos locales (puertos 4000 y 5173) se frenaron al terminar esa parte. |
| 2 | Alternativas y criterio de descarte | **Registrar una cuenta en producción y pagar con la tarjeta de prueba:** descartado, crear cuentas y cargar datos de tarjeta en un sitio real queda fuera de lo que se puede hacer sin que lo hagas vos; en producción solo se consultó `/api/health`. **Usar el `.env` del backend:** descartado, tiene credenciales reales; las variables se pasaron por proceso (con Brevo, Mercado Pago, Supabase y Sentry vacíos, así que no salió ningún mail ni cobro real). **Crear el `.env` de la copia limpia con `cp`/`sed`:** bloqueado por el hook del proyecto, no se esquivó; las variables se pasaron en línea y la base se llamó `nexa_dev_test` (el hook exige «test» en la URL) en vez de `nexa_dev`. |
| 3 | Evidencia que la sostiene | Navegador: el formulario rechaza teléfono `12345` y bloquea el envío sin aceptar la política (no se mandó ningún POST); con teléfono válido responde `201` y en `users` quedan `terms_accepted_at` y `terms_version = 2026-11`; el asistente de reserva muestra seña de $5.000; con «Coordinar por WhatsApp» el turno queda `confirmed` con `payment_status = pending` y `deposit_amount = 5000`, y «Mis turnos» lo muestra como «Pendiente de seña»; reprogramado de 11:00 a 13:00 desde el modal (la base muestra 13:00). API: tres reservas seguidas respondieron `201` en 44, 36 y 29 ms (solo servidor, sin 4G); repetir un horario ocupado dio `409 PROFESSIONAL_SLOT_TAKEN`; registro con teléfono inválido o sin política da `422 VALIDATION_ERROR`. Producción: `/api/health` dio `200` tres veces (0,3 a 0,5 s, `database: up`) y el frontend de Vercel `200`. Backend: `typecheck:all` sin errores y 661 pruebas en 59 archivos pasaron. Frontend: `typecheck:all` sin errores y 365 pruebas pasaron. Esquema: ninguna columna con datos de tarjeta (solo la palabra `card` como valor posible de método de cobro en un comentario). Copia limpia: clonado, `git checkout v1.3`, `npm ci`, `migrate deploy`, `generate` y `seed:demo` funcionaron. |
| 4 | Aporte personal | Emily pidió la prueba, el criterio de qué reportar (validado, pendiente y por qué) y que las bases de prueba se borren solo cuando ella lo diga. |
| 5 | Desacuerdo y resolución | Hallazgos para corregir en el manual (no se corrigieron, no se pidió): el README manda a hacer `git checkout v1.3`, pero la salida esperada de `seed:demo` describe el código actual (profesional «Valeria», tres turnos, promoción) y el tag da otra («Loren (demo)», sin turnos); el README dice 62 migraciones y el tag trae 54. La working copy del backend estaba en `main` al terminar, no en la rama `feat/cambios-de-reglas-06-11` que indicaba el estado inicial: no se cambió de rama desde esta sesión. Esta entrada quedó sin commitear. Pendientes: pago real con la tarjeta de prueba de Mercado Pago, reserva y pago en producción, medición en 4G con celular, prueba en dos navegadores y en un celular, recordatorio por mail con envío real, y el manual en una máquina limpia de verdad. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con el navegador integrado y la terminal. Context7 no se consultó (no se escribió código que dependa de una librería). |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 142: PR mergeados, v9 al día y documento de horas

**Fecha:** 2026-11-09 (hora aproximada, Argentina; noche, después de los merges de las 20:23)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Actualizar el libro v9 con los PR 34 y 22 ya mergeados (6 brechas abiertas, cifras de main). Reescribir estimacion-horas.md con la cifra única de 424 horas y descartar la estimación por commits. Dejar la hoja Recursos sin cambios hasta que Emily pase los cobros de Claude Pro. |
| 2 | Alternativas y criterio de descarte | (a) Poner las 48 horas por commits en el libro: descartado, vuelve a haber dos cifras y los commits empiezan el 25/08. (b) Suponer el importe de los meses nuevos de Claude Pro: descartado, el precio puede haber cambiado. (c) Dejar las brechas abiertas por precaución: descartado, el código ya está en main. |
| 3 | Evidencia que la sostiene | Historial de GitHub: merges #34 y #22 del 09/11/2026 20:23. Pruebas del frontend corridas en main (53 archivos y 395). Informe de Claude Code (682 pruebas) y 61 archivos de prueba contados en el backend. Archivo estimacion-horas.md del repositorio. |
| 4 | Aporte personal | Emily mergeó los PR, informó que Claude Pro se pagó de agosto a noviembre y que vence el 24/11, y pasó el documento de horas. Le toca pasar los importes, correr el prompt de Claude Code y probar en producción. |
| 5 | Desacuerdo y resolución | Claude había dado los PR por abiertos y Emily lo corrigió. La frase «pongas lo que dice ahí» fue ambigua: se resolvió con la cifra única y queda para que Emily la confirme. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con GitHub clonado y el conector de Trello (un comentario). Corrió las pruebas del frontend; las del backend no. Revisión final por Emily pendiente. |

## Entrada 143: AE4, baja de las bases y la copia limpia de la prueba de la entrada 141 (09/11/2026)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Eliminar las bases locales `nexa_e2e_test` y `nexa_dev_test` y la copia limpia de los dos repositorios creadas en la entrada 141. No se tocaron `nexa_db` ni `nexa_db_test`. |
| 2 | Alternativas y criterio de descarte | **Dejarlas para repetir la prueba:** descartado, Emily pidió borrarlas cuando se lo dijera y lo dijo. |
| 3 | Evidencia que la sostiene | Dos `DROP DATABASE` correctos; después, `pg_database` solo lista `nexa_db` y `nexa_db_test`. |
| 4 | Aporte personal | Emily dio la orden de eliminar. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. |
| 6 | Herramienta auxiliar | Claude Code (Sonnet 5.5) con `psql`. Context7 no se consultó. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 144: cifra única de horas (424), baja de la estimación por commits, entradas del chat intercaladas por fecha y renumeración de la bitácora

**Fecha:** 2026-11-10, de 16:28 a 21:50 aprox. (hora de la máquina, UTC-3; la sesión se cortó y se retomó)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code, no por Emily**, a pedido de ella, directo sobre `main`. **(a) Horas:** `docs/estimacion-horas.md` se reemplazó por el archivo que pasó Emily (cifra única: 424 horas de desarrollo, intervalo del 95 % de 394 a 454, del 01/06 al 09/11/2026, método de tres valores); se borró `docs/estimacion-horas.csv`; `scripts/estimacion-horas.mjs` ya no calcula horas ni escribe archivos: solo imprime la cantidad de commits por repositorio y la tabla de commits con la línea `Co-Authored-By: Claude` (se quitó de las referencias por defecto la rama `origin/integracion-ae4`, que ya no existe). Se corrigieron el índice de documentos del README y `docs/cambios-y-decisiones.md` (fase 9 y el párrafo de las 43,3 a 45,5 horas por commits). En `CLAUDE.md` y `docs/cobertura-por-requisito.md` no había ninguna mención de esas horas. **(b) Bitácora:** se sumaron las 31 entradas de las sesiones de Claude (chat) que faltaban (letras E a AI; las A a D ya estaban como entradas 64 a 67, con el mismo texto), cada una en su lugar por fecha, y se renumeró lo que venía después. Entradas nuevas: 68, 69, 72 a 82, 84, 86, 89, 91, 94, 111 a 113, 116, 118, 121, 129, 130, 132, 138 a 140 y 142. **Equivalencia (número anterior → nuevo):** 68→70, 69→71, 70→83, 71→85, 72→87, 73→88, 74→90, 75→92, 76→93, 77→95, 78 a 88→96 a 106, 89 a 92→107 a 110, 93→114, 94→115, 95→117, 96→119, 97→120, 98 a 104→122 a 128, 78 bis→96 bis, 105→131, 106 a 110→133 a 137; las dos entradas del 09/11 que estaban sin commitear (prueba de punta a punta y baja de las bases) quedaron como 141 y 143. Las referencias entre entradas se actualizaron en la bitácora, en la tabla 8.3 del README, en `docs/cambios-y-decisiones.md`, en `docs/plan-de-despliegue.md` y en dos comentarios de `src/jobs/scheduler.ts` (solo comentarios, sin cambio de código). |
| 2 | Alternativas y criterio de descarte | **Borrar el script:** descartado, la tabla de commits con la línea de coautoría sigue en el documento y así se puede regenerar. **Dejar las entradas del chat con letras al final:** descartado, Emily pidió orden cronológico y correr los números. **Reordenar también las entradas que ya estaban fuera de orden** (frontend 107 a 110, fase 9.3 en 122 y 123, y la 96 bis): descartado, obligaba a bajar números y Emily pidió solo correrlos hacia arriba; quedan donde estaban. **Cambiar los mensajes de los commits que citan los números viejos:** imposible sin reescribir el historial; se dejó la equivalencia acá y una nota en la sección 8.3 del README. |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores y `npm test` con 683 pruebas en 61 archivos, todas pasan. El script corrido hoy imprime 196 commits del backend y 125 del frontend (el documento conserva el corte del 06/11: 179 y 124). **Fechas cotejadas** con `git log` y con la fecha de creación y de merge de los pull requests de los dos repositorios (`gh pr list`): las 30 fechas restantes coinciden; se corrigió una, la entrada 94, que decía 2026-11-01 y pasa a 2026-10-31 de noche, porque revisa el pull request 17 (abierto el 31/10 a las 22:58) y pide las correcciones que la entrada 95 hace el 31/10 a las 23:10. Dentro de un mismo día el orden sale de los hechos que cada entrada cita: 68 y 69 van antes de la 70 (la 71 ya da por hecha la constancia de Loren y la 69 todavía cuenta 303 pruebas); 72 a 82 después del merge del pull request 13 y antes de la fase 1; 84 después de los commits de las 23:47; 116, 118 y 121 según los merges del 05/11. A las fechas de esas entradas se les agregó entre paréntesis el hecho que las ubica. |
| 4 | Aporte personal | Emily decidió la cifra única, pasó el documento de horas y las entradas del chat, y pidió verificar las fechas, correr los números y subir directo a `main`. |
| 5 | Desacuerdo y resolución | Sin resolver, para Emily: (a) la hora dentro del día de las entradas del chat es aproximada; la 142 se ubicó después de la 141 por los merges de las 20:23, sin otra prueba. (b) Las entradas 70 y 71 dicen «04:50 (hora de la máquina)», pero el pull request 13 se creó a las 01:50 de Argentina (04:50 UTC): no se tocó. (c) El README de `nexa-frontend` cita esta bitácora con los números anteriores (entradas 78, 82 y 89 a 94, hoy 96, 100 y 107 a 110, 114 y 115): no se cambió porque el pedido era solo el backend. (d) La entrada 73 habla de estimar las horas desde los commits y la 111 cita las 43,3 a 45,5 horas: son el registro de lo decidido entonces y se dejan, con la aclaración en la 111. No se tocó Mercado Pago ni ningún `.env`. |
| 6 | Herramienta auxiliar | Claude Code: la sesión empezó con Claude Sonnet 5.5 (`claude-sonnet-5-5`) y se retomó con Claude Fable 5.2 (`claude-fable-5-2`). `git`, `gh` y Node. Context7 no se consultó (no cambió código que dependa de una librería). El hash del commit de este cambio va en la línea de abajo, agregada en un commit posterior porque un commit no puede citar su propio hash. |

**Impacto en el frontend (contrato):** ninguno. No cambia ninguna ruta ni respuesta.

**Commit de este cambio:** `6146c03` (sobre `078c0c4`, el merge del pull request 34).

## Entrada 145: footer y barra de Kologic a todo el ancho (frontend) y README de los dos repositorios rehechos

**Fecha:** 2026-11-10, de 21:55 a 22:40 aprox. (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Fable 5.2, `claude-fable-5-2`), no por Emily**, a pedido de ella. **(a) Frontend, commit `be8a00f` (rama `feat/footer-ancho-completo`):** el footer y la barra de Kologic de la página de inicio ocupan todo el ancho de la pantalla, con un margen lateral que crece con el ancho (`clamp(24px, 5vw, 80px)`); antes tenían un tope de 1200 y 1152 px. La barra de Kologic pasa de clases de Tailwind a `KologicBar.css` y reserva 96 px a la derecha (en celular, 92 px de cada lado, apilada y centrada) para el botón flotante de WhatsApp (60 px más 24 px de margen), así el correo de Kologic no queda debajo. **(b) README de los dos repositorios:** describen `main` y ya no mandan a `git checkout v1.3`; instancia AE4; 62 migraciones; salida real de `seed:demo` (Valeria, tres turnos, promoción) también en el del frontend; pruebas actuales (backend 683 en 61 archivos, frontend 395 en 53); versiones instaladas (Zod 4.6.7, Vitest 5.0.5); catálogo v7 como última versión subida (v8 y v9 todavía no están en el repositorio); segundo corte de las cifras de la sección 8 al 09/11/2026; sección 8.3 del backend completada con la fase 10, RF-33, el cierre, los cambios de reglas del 06/11 y esta rama; en el del frontend, enlaces a las bitácoras que apuntan al backend (antes daban 404), las fases 7 y 10 en sus propias tablas, los números de entrada nuevos y el párrafo equivocado sobre `BITACORA.md` eliminado. **(c) GitHub:** el push directo a `main` del backend lo bloquea el hook del proyecto; los dos commits de la entrada 144 y este cambio van en la rama `docs/horas-bitacora-readme` con pull request, y el frontend en su rama con pull request; el merge lo hace Emily. |
| 2 | Alternativas y criterio de descarte | **Solo subir el tope de ancho del footer:** descartado, Emily pidió todo el ancho. **Mover el botón de WhatsApp:** descartado, es fijo en todas las páginas; alcanza con reservarle el lugar en la barra. **Mantener el manual sobre la etiqueta `v1.3`:** descartado, esa etiqueta trae 54 migraciones y otros datos de demo (hallazgo de la entrada 141). **Inventar la etiqueta de la AE4 en el README:** descartado, todavía no existe; el README lo dice. **Esquivar el hook para pushear a `main`:** descartado. |
| 3 | Evidencia que la sostiene | Navegador (servidor local del frontend en el puerto 5183, porque el 5173 estaba ocupado por otro programa): a 1600 px el contenido del footer va de 80 a 1505 px, la marca de Kologic empieza en 80 px y el correo termina en 1409 px (el botón de WhatsApp ocuparía de 1501 a 1561); a 375 px el correo va de 132 a 243 px (el botón, de 291 a 351) y no hay desplazamiento horizontal. El botón no se vio en pantalla porque sin backend no hay número de WhatsApp cargado: la separación se comprobó con las medidas. Frontend: `lint` sin errores, `typecheck:all` sin errores, 395 pruebas en 53 archivos y `build` correcto. Backend: desde la corrida de la entrada 144 (683 pruebas) solo cambiaron el README y esta bitácora. Cifras de la sección 8 con los comandos que el README lista, sobre `origin/main` de cada repositorio. |
| 4 | Aporte personal | Emily pidió el cambio de ancho, que el correo no se cruce con el botón de WhatsApp, rehacer los dos README y que quede listo para que ella solo haga el merge. |
| 5 | Desacuerdo y resolución | Sin desacuerdos. Para Emily: (a) los libros v8 y v9 no están en `03-requisitos`; (b) falta poner la etiqueta de la versión congelada y, cuando exista, cambiar la fila «Versión» de los README; (c) el modelo de las sesiones de las fases 10 en adelante se tomó de cada entrada, no se volvió a verificar. |
| 6 | Herramienta auxiliar | Claude Code (Claude Fable 5.2) con el navegador integrado, `git`, `gh` y Node. Context7 no se consultó: el cambio del frontend es CSS y marcado, sin API de ninguna librería. |

**Impacto en el frontend (contrato):** ninguno. No cambia ninguna ruta ni respuesta.

## Entrada 146: AE4, instalación y revisión del seed de la presentación (datos sintéticos, base local)

**Fecha:** 2026-11-12 23:55 a 2026-11-13 00:20 aprox. (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), no por Emily**, a pedido de ella, sin commit. **(a) Instalación:** los archivos de `scripts/seed_AE4/` pasaron a `scripts/seed-presentacion.ts`, `scripts/demo-turnos-ahora.ts` y `scripts/seed-presentacion/` (plan, verificadores, horarios de demostración); se agregaron a `package.json` los comandos `seed:presentacion`, `seed:presentacion:verificar`, `demo:turnos-ahora`, `demo:turnos-ahora:verificar` y `demo:recordatorio`, y a `.env.example` los nombres `SEED_*` sin valores. `demo-turnos-vivo.ts` quedó sin instalar en `scripts/seed_AE4/` (ver 5). **(b) Correcciones al seed:** el WhatsApp del negocio se cargaba como `3765018665` y el frontend arma `https://wa.me/<número>`, así que el enlace «Coordinar por WhatsApp» no funcionaba: ahora `5493765018665` (el mismo que `social.data.ts` del frontend); las variables vacías (como queda al copiar `.env.example`) pisaban los valores por defecto porque se usaba `??`: ahora cuentan como no definidas; `SEED_PASSWORD` es obligatoria (había una contraseña por defecto escrita en un repositorio público); la versión de la política sale de `PRIVACY_POLICY_VERSION` (estaba repetida a mano); los correos de `SEED_PRO_EMAIL` y `SEED_CLIENT_EMAIL` se normalizan con `trim().toLowerCase()` como en el resto del backend y no pueden coincidir entre sí ni con `ADMIN_EMAIL`; las fechas `SEED_REF_DATE` y `SEED_WEEK_START` se validan; el control de «base local» solo acepta `localhost`, `127.0.0.1` y `::1` (antes también `postgres` y `db`) y el seed se niega si la base ya tiene cuentas que no son de demostración (`SEED_ACEPTAR_CUENTAS_AJENAS=1` lo permite a propósito); `demo-turnos-ahora` suma `--reiniciar` (borra solo los turnos marcados `DEMO-AHORA` de la clienta de demostración, para repetir entre el ensayo y la presentación) y ya cuenta los horarios con `slot_locked` como ocupados. Esa lógica común vive en `scripts/seed-presentacion/entorno.ts`. **(c) `scripts/demo-recordatorio.ts`:** recibe el id de un turno y llama a `runAppointmentReminderJob` con `now` = inicio menos 3 horas. Por defecto solo muestra cuántos turnos entran en la ventana y no envía nada; envía únicamente con `--enviar`, solo si el turno elegido es el único que entra y si el correo de la clienta no es `@example.com`; `--restaurar` deja el recordatorio como «sin enviar». |
| 2 | Alternativas y criterio de descarte | **Dejar los archivos como llegaron:** descartado, el WhatsApp mal formateado y las variables vacías rompían la demostración. **Instalar también `demo-turnos-vivo.ts`:** descartado, hace lo mismo que `demo-turnos-ahora` con otra marca (`DEMO_VIVO`) que el control de los 450 turnos no excluye, y usa a Loren en vez de la Profesional E. **Que el script de recordatorio envíe directo:** descartado, el job manda un mail por cada turno que entre en la ventana, no solo el elegido, y el mail es real. **Usar la base de `.env` o la de `.env.test`:** descartado; se creó una base local nueva, `nexa_presentacion_test` (el hook del proyecto exige «test» en el nombre para correr `prisma`). |
| 3 | Evidencia que la sostiene | `npm run typecheck:all` sin errores; los scripts (que `typecheck:all` no incluye) se revisaron con un `tsconfig` temporal, también sin errores, y se borró. `npm run seed:presentacion:verificar`: 17 líneas ok, 0 fallas; `npm run demo:turnos-ahora:verificar`: 24 ok, 0 fallas. Con `prisma migrate deploy` sobre la base nueva (62 migraciones), el servidor arrancado una vez (creó un administrador de prueba `@example.com`) y el seed corrido tres veces: 450 turnos nuevos la primera, 0 las otras dos; SQL de solo lectura: 450 turnos, categorías 220/130/70/30, profesionales 120/85/85/65/65/15/15, 0 pares activos con el mismo inicio, 2 turnos de la clienta de demostración confirmados (25/11 y 27/11, 08:00) con `reminder_sent_at` nulo y 139 de los 141 confirmados con la marca puesta. Con el servidor local y la API: ingresan administrador, profesionales y clienta; la clienta cancela el turno de «menos de 12 h» y la seña queda `partial` (retenida) y el de «12 h o más» queda `refunded`; el administrador ve 453 turnos (450 más 3 de demostración). Pruebas de negativos: sin `SEED_PASSWORD`, base remota, fecha mala, correos repetidos, correo del administrador y base con una cuenta real: el seed se niega en todos. `npm test`: 683 pruebas en 61 archivos, todas pasan. |
| 4 | Aporte personal | Emily subió los archivos, dio el pedido paso a paso y pidió revisar todo y avisar cada problema. |
| 5 | Desacuerdo y resolución | Sin resolver, para Emily: (a) el seed y `demo-turnos-ahora` no envían ningún mail; solo `demo-recordatorio --enviar` y el programador de tareas (que arranca siempre, también en desarrollo) pueden hacerlo, y no se ejecutó ningún envío real; (b) los 450 incluyen 3 turnos cancelados, 1 inasistencia marcada y 1 automática, y el tablero cuenta como «atendidos» solo los `finished` con fecha de hoy o anterior; (c) no se creó la rama `feature/seed-presentacion`; (d) la base `nexa_presentacion_test` quedó en el PostgreSQL local, con el administrador `admin.presentacion@example.com` y datos sintéticos. No se tocó ningún `.env` ni Mercado Pago. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5) con `psql`, Node, `tsx`, `tsc` y la API local. Context7 no se consultó: no se usó ninguna API nueva de una librería (solo `dotenv` con la misma opción `quiet` que ya usa `env.ts`). |

**Impacto en el frontend (contrato):** ninguno. No cambia ninguna ruta ni respuesta; son scripts y variables de entorno.

## Entrada 147: capítulos V, VI, VII y IX redactados (sesión de chat AJ)

**Fecha:** 2026-11-10 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Redactar los capítulos V, VI, VII y IX en un Word, con el formato de la Resolución 97/23 y la lista de verificación formal. Usar la cifra única de 424 horas de desarrollo (431 en total) y 200 como lo planificado. Armar la matriz de decisión ponderada del Capítulo IX a partir del ADR-001, con una tabla por perfil en el Capítulo VII y componentes de terceros leídos de los repositorios. |
| 2 | Alternativas y criterio de descarte | (a) Inventar las actas de los sprints: descartado, no hay evidencia; se declara como pendiente. (b) Cargar valores medidos de RNF-01: descartado, no hay medición. (c) Incluir canales de redes sociales de Loren: descartado, no constan. (d) Copiar «Gmail SMTP» del Capítulo X: descartado, el código usa Brevo en producción. |
| 3 | Evidencia que la sostiene | Resolución 97/23 (arts. 20 a 24), consigna AE4 v02, lista de verificación formal, informe AE2 v4.1 y su devolución, repositorios en main, libro v9 y bitácoras. Kotler y Armstrong (2012), verificado por búsqueda web. |
| 4 | Aporte personal | Emily confirmó las 25 horas semanales de las últimas dos semanas y definió el alcance. Le toca revisar la matriz, completar los datos pendientes y firmar su Capítulo XII. |
| 5 | Desacuerdo y resolución | El Capítulo X de la AE2 dice «Gmail SMTP» y el sistema envía por Brevo: se escribe lo que hace el código y queda pendiente corregir el Capítulo X. Los pesos y puntajes de la matriz son una propuesta de Claude, por confirmar. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con los conectores de Google Drive y los repositorios clonados. Las cifras de pruebas del backend salen del informe de Claude Code. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 148: datos de prueba (seed) de la semana del 2 al 7 de noviembre (sesión de chat AK)

**Fecha:** 2026-11-10 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Armar un seed de datos sintéticos adaptado al schema.prisma real (nexa-backend/prisma/seed.ts): 11 turnos, 3 profesionales (Loren, Sol y Ludmila) y 6 clientas ficticias, para la semana del lunes 2 al sábado 7 de noviembre de 2026. Quitar el 80 % de ocupación y el 20 % de solapamiento. Mantener 3 profesionales y 3 categorías. Cargar maquillaje en Rostro sin profesional asignada. Redactar un correo al profesor con el enfoque estadístico. |
| 2 | Alternativas y criterio de descarte | (a) Datos reales de clientas: descartado, Ley 25.326. (b) Factor de estacionalidad y ocupación del 80 %: descartado por Emily, no hay datos medidos. (c) Inventar las otras 4 profesionales: descartado por ahora, queda como consulta al profesor. (d) Modelar la reprogramación como dos turnos enlazados (como en el JSON): descartado, el schema usa previousDate y previousTime. (e) Crear cuentas de Google: descartado, OAuth no está implementado, se usan alias de Gmail. (f) Cargar la comisión del 20 %: no se cargó, commissionPct queda en 0 hasta definir la base de cálculo. |
| 3 | Evidencia que la sostiene | schema.prisma, el documento de arquitectura pegado por Emily, capturas de las publicaciones de Instagram del estudio (precios y horarios de Loren, Sol y Ludmila) y los datos que aportó Emily (nombres, rubros, precios de maquillaje). No se pudo abrir la carpeta de Drive. Las proporciones del Gráfico 1 y las cifras de 450 y 120 turnos vienen de Emily, sin verificar contra la tesis. |
| 4 | Aporte personal | Emily aportó los nombres y rubros de las profesionales, los precios de maquillaje, y decidió trabajar con 3 profesionales, descartar el 80 % y el 20 % y consultar al profesor. Le toca confirmar los supuestos del código, definir si la limpieza facial es Rostro o Cuerpo, correr el seed y enviar el correo. |
| 5 | Desacuerdo y resolución | Claude advirtió que los parámetros de 450 turnos, 120 de Loren, 80 % y 20 % no estaban verificados, y Emily los quitó. Claude detectó que healthConsentGivenAt figura en el documento pero no existe en el schema (el consentimiento está en Client.consents). Correcciones de Claude: se había dicho 12 turnos y el seed tiene 11, y la distribución del seed (4, 3 y 4) no coincide con el Gráfico 1. La limpieza facial quedó en Cuerpo por un supuesto de Claude, por confirmar. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5). El seed.ts no se ejecutó ni se probó contra una base de datos, así que su funcionamiento queda sin verificar. Los valores supuestos están marcados en el código. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 149: instrumentos 36 y 37, hoja de ruta y factibilidad tecnológica, clase 12/11 (sesión de chat AL)

**Fecha:** 2026-11-11 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Resolver los Instrumentos 36 y 37 en un solo Word, sobre la plantilla oficial de la AE4 y con datos del libro v6. La hoja de ruta tiene 6 evoluciones en 3 horizontes. Ahora: Mercado Pago en producción y medición de RNF-01. Próximo: indicador de inasistencias y liquidación de comisión. Después: talleres y segunda instancia. El Instrumento 37 evalúa dos hipótesis. La H1, predicción de inasistencia, da un índice de 3,05 y se posterga con condición. La H2, gamificación, no pasa la prueba de necesidad. |
| 2 | Alternativas y criterio de descarte | (a) Chatbot de WhatsApp como evolución: descartado, L-03 lo excluye y queda en 36.3. (b) Pronóstico de demanda por franja: descartado, no hay turnos reales (datos en 1). (c) H1 repetida en el horizonte Después: descartado, quedó solo en 36.3 para no duplicar. (d) Seguir los apuntes de arquitectura pegados (chatbot, talleres con seña del 50 %): descartado, el catálogo v6 los excluye. |
| 3 | Evidencia que la sostiene | Consigna AE4 v02 y plantillas de la carpeta «Estudio Proyecto» del Drive. Libro v6 (H-xx, R-xx, L-xx, trazabilidad, Recursos). Ley 25.326 en argentina.gob.ar/normativa/nacional/64790/texto. No se pudo abrir el Trello (bloquea acceso automático) ni GitHub, así que la etiqueta v2.0.0 y su fecha están sin verificar. |
| 4 | Aporte personal | Emily mandó la consigna y los links, y pidió el formato APA 7 y la versión en Word editable. Le toca confirmar la etiqueta y su fecha, validar los umbrales con Loren, revisar los puntajes de la matriz y las 40 horas, y defenderlo en la clase del 12/11. |
| 5 | Desacuerdo y resolución | Claude advirtió que los apuntes de arquitectura contradicen el catálogo v6 y se siguió el v6. El libro v6 está al estado v1.3 y el proyecto apunta a v2.0.0, por eso quedó resaltado para confirmar. Primero se entregó un PDF y Emily pidió Word, así que se rehízo el documento. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5). Los puntajes, los umbrales y las 40 horas son propuesta de Claude, sin validar con Loren. No se contrastó el documento con la rúbrica oficial de la AE4. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 150: Instrumento 39 resuelto, con medición propia (sesión de chat AM)

**Fecha:** 2026-11-11 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Resolver el Instrumento 39 en un Word con 9 supuestos, la prueba de los diez de 5 componentes y 5 experimentos. Medir tamaños y tiempos con 5.400 y 54.000 turnos sintéticos, tomar las cuotas de los proveedores de su documentación y dejar los resultados observados como «Pendiente». |
| 2 | Alternativas y criterio de descarte | (a) Multiplicar por diez cargas sin medir: descartado, es un error frecuente del instrumento. (b) Usar la prueba de Prisma del backend: descartado, el entorno de Claude no puede descargar los motores y se midió con SQL directo. (c) Poner resultados a los experimentos: descartado, no hay turnos reales. |
| 3 | Evidencia que la sostiene | Plantilla del Instrumento 39 y libro de trabajo de la AE4. Medición del 11/11/2026 en PostgreSQL 16 con las 62 migraciones. Ayuda oficial de Brevo (300 mails por día) y página de precios de Supabase (500 MB), consultadas el 11/11/2026. Medición de 29 a 44 ms por reserva del 09/11/2026. |
| 4 | Aporte personal | Emily pidió el instrumento y debe repetir la medición, validar los umbrales con Loren y medir E-05. |
| 5 | Desacuerdo y resolución | La medición la ejecutó Claude y no Emily: el documento lo declara. Los umbrales de E-01, E-03 y E-04 son propuestos por Claude y quedan para que Emily los confirme. El Instrumento 36 y 37 tiene datos desactualizados. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5) con los conectores de Google Drive y los repositorios clonados. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 151: Instrumento 38, ficha de búsqueda marcaria (sesión de chat AN)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Armar la ficha en Word sobre la plantilla de la AE4, con la consulta real al INPI que hizo Emily el 12/11/2026 (04:29 a 04:38). Signo KOLOGIC, denominativa, clases 42 y 9; la 35 se descartó. Marca: sí, más adelante. Código fuente en la DNDA: sí. Base de datos propia: no. Dominio: sí. Confidencialidad: sí, por contrato. |
| 2 | Alternativas y criterio de descarte | (a) Registrar NEXA: descartado, tiene 450 resultados, un NEXA en clase 9 y varios en clase 35. (b) Marca mixta: descartada hasta que haya logo. (c) Clase 35 para Kologic: descartada, no presta gestión comercial a terceros. (d) AAIP para la base de datos: fuera de la ficha, es obligación del responsable (Loren) y va en privacidad. (e) Búsqueda fonética arancelada: no se hizo, la cátedra no exige trámites arancelados. |
| 3 | Evidencia que la sostiene | Capturas y PDF de las actas 1288762, 1614901 y 1824537 del Portal de Trámites del INPI. Captura de Donweb para el dominio. Plantilla de la AE4. Fichas oficiales de INPI, DNDA y AAIP en argentina.gob.ar. |
| 4 | Aporte personal | Emily hizo la búsqueda real y sacó las capturas. Le toca completar los estados de las NEXA (clases 9 y 35), buscar las variantes de KOLOGIC, repetir el dominio en nic.ar, escribir el motivo del nombre, definir el titular y confirmar las decisiones. |
| 5 | Desacuerdo y resolución | Emily preguntó si el instrumento pide código en DNDA y base en AAIP: la plantilla pide DNDA para los dos y la AAIP queda afuera. Claude marcó que «clase 8» parece un error y que la captura muestra NEXA en clase 9. También marcó que el dominio se consultó en Donweb y no en NIC. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5). Claude no consultó el INPI: todo resultado sale de lo que mandó Emily. Los riesgos y las decisiones son propuesta de Claude, a confirmar. Varios estados quedan sin completar. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 152: Instrumento 38, versión final de la ficha marcaria (sesión de chat AO)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rehacer el Word del Instrumento 38 con los datos que dio Emily. Signo KOLOGIC, denominativa, sin variantes. NEXA se resume por clase: 42 y 9 sin registros, 35 con 17 resultados. Titular de la marca, el dominio y el depósito del código: la autora. Dominio kologic.ar disponible en NIC Argentina (04:48) y kologic.com.ar en Donweb (04:38). |
| 2 | Alternativas y criterio de descarte | (a) Buscar variantes de KOLOGIC: descartado por Emily. (b) Listar cada NEXA de la clase 35 con su estado: descartado, la captura no muestra esa columna. (c) Incluir las capturas amplias de NEXA (450 resultados): descartado, una muestra un NEXA en clase 9 que contradice lo informado por Emily. (d) Registrar NEXA ahora: descartado, hay 17 antecedentes en la clase 35. |
| 3 | Evidencia que la sostiene | Capturas y PDF de las actas 1288762, 1614901 y 1824537 del INPI. Captura de la clase 35 de NEXA (17 resultados). Captura sin registros del 12/11/2026, 04:35. Capturas de Donweb y NIC Argentina. Instructivo del Buscador de marcas del INPI. |
| 4 | Aporte personal | Emily hizo las búsquedas y las capturas, explicó el significado del nombre, decidió trabajar solo con KOLOGIC sin variantes y aclaró que NEXA no tiene antecedentes en las clases 9 y 42. Le toca revisar la ficha y resolver la duda del acta 1341836. |
| 5 | Desacuerdo y resolución | Emily afirmó que NEXA en clase 9 no tiene resultados, y una captura de la búsqueda amplia muestra el acta 1341836 en esa clase. Se siguió el dato de Emily y se dejó la captura afuera. Queda abierta la pregunta de cuál es el caso. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5). Claude no consultó el INPI ni NIC: todos los resultados salen de lo que mandó Emily. Los riesgos y las decisiones de trámite son propuesta de Claude. Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 153: lectura de la v9.1 y preguntas previas a Claude Code (sesión de chat AP)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | No crear más archivos hasta definir todo. Leer la v9.1 y contrastarla con el seed y la matriz. Preparar un prompt de solo lectura para Claude Code con las preguntas necesarias, antes de rehacer el seed y la matriz. |
| 2 | Alternativas y criterio de descarte | (a) Seguir con la v6: descartado, la v9.1 cambia la tolerancia (30 minutos), los estados, los combos y el horario reabierto. (b) Crear cuentas de Gmail por rol: descartado, alcanza una casilla con alias, sujeto a la lista permitida del proveedor de correo. (c) Mostrar el cobro con Mercado Pago de prueba: no seguro, no hay credenciales de prueba cargadas (RF-03 abierta); alternativa: coordinar por WhatsApp. |
| 3 | Evidencia que la sostiene | Libro v9.1 (hojas Cambios v9, Reglas, Límites, Código y pruebas, Panel y prioridades del Catálogo); consigna y grilla del coloquio de la AE4; schema.prisma. |
| 4 | Aporte personal | Emily detectó que se había usado la v6 en lugar de la v9, pidió frenar la creación de archivos y definió las preguntas previas. Le toca correr el prompt en Claude Code, traer las respuestas, configurar un correo de prueba y las credenciales de prueba de Mercado Pago. |
| 5 | Desacuerdo y resolución | Resueltas con la v9.1: M-05 es una brecha aceptada por Loren el 30/10 (declarar en el Capítulo IX); RF-04 ya declara que la seña solo se marca como devuelta. Quedan abiertas la tolerancia de 20 minutos del informe frente a los 30 del libro, y el nombre real de los estados (completed frente a finished). |
| 6 | Herramienta auxiliar (declaración de uso) | Claude (chat, Claude Sonnet 5.5) con los conectores de Google Drive y Google Sheets. Función: lectura y contraste de la v9.1 y redacción del prompt. Pieza afectada: ninguna (solo lectura). Fecha: 12/11/2026. Verificación: el contenido leído corresponde a la v9.1 del 10/11/2026; no se leyeron todas las hojas. Verificación de Emily: pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 154: seed v3, matriz y guía de estudio (sesión de chat AQ)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Rehacer el seed con el relevamiento de Claude Code y el libro v9.1: reparto por cuotas sobre la grilla de 120 minutos, 14 casos de prueba, estados reales (finished, no_show_auto, cancelled_no_show), Gmail reales solo por variables de entorno y administrador creado por seedAdmin(). Rehacer la matriz de pruebas (58 casos). Redactar en Word una guía de estudio con instalación, correos, guion cronológico y preguntas del profesor. |
| 2 | Alternativas y criterio de descarte | (a) Crear Gmail para todas las cuentas: descartado, solo la profesional y la clienta reciben mails que se muestran. (b) prisma.seed: descartado, el repositorio ya usa scripts con tsx. (c) Horarios cada 30 minutos: descartado, la pantalla de reserva usa bloques de 120. (d) Cargar mpPaymentId inventados: descartado, solo lo escribe el webhook. (e) Dejar el recordatorio activo para todos los turnos: descartado, se marcó como enviado en las cuentas ficticias. (f) Mostrar el cobro con tarjeta de prueba: descartado, no hay credenciales de prueba. |
| 3 | Evidencia que la sostiene | Respuestas de Claude Code a los 24 puntos (12/11/2026), libro v9.1, schema.prisma, respuesta del PosDr. Díaz, consigna AE4 v02 y grilla del coloquio. verify-plan.ts ejecutado: 450 turnos, categorías y profesionales exactos, sin turnos activos repetidos, todo sobre la grilla y salida idéntica en dos corridas. |
| 4 | Aporte personal | Emily aportó la composición real del equipo, decidió qué cuentas de Gmail usar y pidió la guía de estudio. Le toca crear la Gmail de la profesional y configurar el envío, correr el seed en una base local vacía, confirmar con Loren los datos provisorios, ensayar la demostración, completar la matriz y hacer la verificación posterior. |
| 5 | Desacuerdo y resolución | El relevamiento de código corrigió a Claude: finished y no completed, día 0 igual a lunes, tolerancia de 30 minutos, grilla de 120 minutos, sin lista de correos permitidos y seed previo existente; se corrigieron el seed y la matriz. Quedan abiertos: el supuesto de los 15 peinados de la profesional de maquillaje, la base de capacidad (4.200 frente a 1.050), la tolerancia de 20 minutos del informe y el comentario desactualizado de schema.prisma. |
| 6 | Herramienta auxiliar (declaración de uso) | Claude (chat, Claude Sonnet 5.5) con los conectores de Google Drive y Google Sheets. Función: generar el seed, la matriz y la guía en Word. Pieza afectada: scripts/seed-presentacion.ts, scripts/seed-presentacion/, matriz_pruebas_nexa.xlsx y Guia_Nexa_datos_demostracion_defensa.docx. Fecha: 12/11/2026. Verificación: verify-plan.ts ejecutado sin base de datos; seed-presentacion.ts no se ejecutó ni se compiló contra Prisma; no se vio ninguna pantalla ni correo. Verificación de Emily: pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 155: Instrumento 39 sin cambios en el repositorio (sesión de chat AR)

**Fecha:** 2026-11-11 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | No ejecutar en Claude Code la repetición de la medición del Instrumento 39. Guardar el método y sus resultados en el Portafolio AE4. Corregir el Anexo A del documento para que lo diga. |
| 2 | Alternativas y criterio de descarte | Repetir la medición ahora en el repositorio: descartado, podría chocar con el trabajo de otra sesión sobre el mismo repositorio mientras se prepara la demostración. |
| 3 | Evidencia que la sostiene | Las bases de la medición (nexa_m5400 y nexa_m54000) son distintas de nexa_dev y de la base de seed:demo. |
| 4 | Aporte personal | Emily decidió no ejecutarlo. Le toca guardar los archivos en el Portafolio. |
| 5 | Desacuerdo y resolución | El documento quedaba afirmando que los scripts estaban en el repositorio; se corrigió el Anexo A. |
| 6 | Herramienta auxiliar | Claude (chat, Claude Sonnet 5.5). Revisión final por Emily pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 156: aclaración de fechas de los turnos de demostración (sesión de chat AS)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Aclarar que los 14 casos de la semana del 2 al 7 de noviembre son solo evidencia y que los turnos para cancelar o reprogramar en vivo son los confirmados del 21 al 30 de noviembre. Cambiar SEED_REF_DATE por defecto a 2026-11-21, el día siguiente a la presentación. |
| 2 | Alternativas y criterio de descarte | (a) Dejar 2026-11-19 como fecha de referencia: descartado, los turnos del día de la presentación quedaban confirmados y vencidos, y el proceso de no asistido los marcaba. (b) Cargar turnos de diciembre: descartado, no hace falta, el mes cargado alcanza. (c) Mostrar la cancelación con menos de 12 horas en vivo: descartado, la hora de aviso futura da 400 INVALID_NOTICE_TIME; se muestra con A13. |
| 3 | Evidencia que la sostiene | Pregunta de Emily; respuestas de Claude Code (reloj real, autoNoShow con más de 30 minutos, hora de aviso no futura); verify-plan.ts ejecutado con la nueva fecha (turnos futuros del 21 al 30 de noviembre, dos turnos de la clienta de demostración el 25/11). |
| 4 | Aporte personal | Emily detectó que los turnos de la semana pasada no se podían cancelar ni reprogramar. Le toca fijar SEED_REF_DATE según el día real de su presentación. |
| 5 | Desacuerdo y resolución | Claude había fijado el 19/11 como fecha de referencia, sin considerar los turnos vencidos del mismo día; se corrigió. Queda sin resolver la demostración en vivo de la cancelación con menos de 12 horas. |
| 6 | Herramienta auxiliar (declaración de uso) | Claude (chat, Claude Sonnet 5.5). Función: corregir la fecha de referencia y regenerar el seed y la guía. Pieza afectada: scripts/seed-presentacion.ts, scripts/seed-presentacion/verify-plan.ts, scripts/seed-presentacion/README.md y Guia_Nexa_datos_demostracion_defensa.docx. Fecha: 12/11/2026. Verificación: verify-plan.ts ejecutado sin base de datos; el seed no se ejecutó contra una base. Verificación de Emily: pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 157: cuentas reales de demostración y turnos que dependen del reloj (sesión de chat AT)

**Fecha:** 2026-11-12 (hora aproximada, Argentina)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | Usar como administrador de la instancia de demostración la cuenta real de Loren, con base y contraseña de demostración. Usar noralikohler@gmail.com para la Profesional E, emilykohler@hotmail.com.ar para la clienta de demostración y dejar pocos turnos propios a la Profesional E. Agregar demo-turnos-ahora.ts, que crea tres turnos contados desde el momento real (menos de 12 horas, 12 horas o más y recordatorio). |
| 2 | Alternativas y criterio de descarte | (a) Cargar el seed en la base real de Loren: descartado, mezcla datos inventados con el negocio real y no se pueden borrar. (b) Cancelar con menos de 12 horas un turno lejano: imposible, la hora de aviso no puede ser futura (R-02). (c) Cambiar el reloj de la computadora: descartado, rompería las conexiones cifradas del correo. (d) Agregar una octava profesional: descartado, rompe los 450 turnos y las 7 agendas del Gráfico 2. |
| 3 | Evidencia que la sostiene | Mensajes de Emily con los correos; respuestas de Claude Code (reloj real, INVALID_NOTICE_TIME, recordatorio entre 5 y 1 hora, reminderSentAt); libro v9.1 (R-02, R-24, L-12); verify-plan.ts y verify-demo-times.ts ejecutados sin base de datos. |
| 4 | Aporte personal | Emily aportó los tres correos, definió qué cuenta ve todos los turnos y pidió poder cancelar y reprogramar cualquier turno. Le toca correr el seed y el comando en su base local, configurar el envío de Gmail y confirmar que los mails llegan, incluida la carpeta de no deseados de Hotmail. |
| 5 | Desacuerdo y resolución | Claude había afirmado que no se podía mostrar la cancelación con menos de 12 horas; se resolvió con turnos creados al momento de presentar. Queda declarado que esos turnos no pasan por la reserva y pueden caer fuera del horario del estudio. Siguen abiertos el programador de tareas en desarrollo y el envío real de correos. |
| 6 | Herramienta auxiliar (declaración de uso) | Claude (chat, Claude Sonnet 5.5). Función: reasignar los correos reales, crear demo-turnos-ahora.ts y actualizar la guía. Pieza afectada: scripts/seed-presentacion.ts, scripts/demo-turnos-ahora.ts, scripts/seed-presentacion/ y Guia_Nexa_datos_demostracion_defensa.docx. Fecha: 12/11/2026. Verificación: verificaciones sin base de datos ejecutadas; ni el seed ni el comando se ejecutaron contra una base, ni se vieron pantallas ni correos. Verificación de Emily: pendiente. |

**Impacto en el frontend (contrato):** ninguno.

## Entrada 158: ajustes pedidos al probar la demostración en local (avisos, vacaciones, mails y formularios)

**Fecha:** 2026-11-13, (hora de la máquina, UTC-3)

| # | Elemento | Registro |
|---|---|---|
| 1 | Qué se decidió | **Hecho por Claude Code (Claude Sonnet 5.5, `claude-sonnet-5-5`), no por Emily**, a pedido de ella, en las ramas `fix/ajustes-demo-13-11` de los dos repositorios. **(a) Seña por WhatsApp:** al agendar con la seña coordinada por WhatsApp (turno suelto o combo) se avisa YA a la profesional (aviso + mail) y queda en Actividad «Nuevo turno: seña por coordinar por WhatsApp», con el botón «Marcar seña pagada»; marcarla paga no repite el aviso (`wasAnnounced`, que además cubre los turnos anteriores a este cambio). Un turno sin seña también se avisa al agendar (antes no se avisaba nunca). Con Mercado Pago sigue igual: el aviso sale al aprobarse el pago. `GET /api/admin/activity` suma `pendingWhatsappDeposit`. **(b) Avisos a la clienta:** cuando el personal cancela, reprograma o cambia la profesional de un servicio de su combo, además del mail (el de cambio de profesional es nuevo: «Cambió la profesional de tu turno — Nexa») se le crea un aviso en la app y el frontend lo muestra como ventana emergente al entrar (`StaffChangePopup`), que se cierra solo con los botones y marca los avisos como leídos. **(c) Vacaciones:** `GET /api/professional/:id/availability` devuelve `vacationFrom`, `vacationTo` y `onVacation`; el asistente de reserva no ofrece horarios esos días y dice «La profesional está de vacaciones del … al …»; si igual se reserva, el `400 OUT_OF_HOURS` dice que está de vacaciones. **(d) Precios del combo:** las vistas de turno suman `serviceListPrice` (precio de lista) y `simultaneousWith[].price` pasa a ser el de lista; el administrador ve 22.000 y 24.000 en vez de los precios repartidos (20.087 y 21.913). **(e) Registro:** se quitó el mail «Verificá tu email» y su plantilla; la cuenta nace con `emailVerified = true` (el endpoint `verify-email` queda para enlaces viejos). **(f) Admin > Turnos:** el formulario del turno ya no se cierra al tocar afuera, solo con la cruz. **(g) Seed de la presentación:** modo reducido (`SEED_SKIP_MONTH=1`, `SEED_SKIP_BUSINESS=1`, `SEED_PRO_KEY`), con 7 agendas, 13 servicios, 2 servicios simultáneos y los 14 casos de la semana (sin los 450 turnos). Se actualizaron `CLAUDE.md` y `docs/cambios-y-decisiones.md`. |
| 2 | Alternativas y criterio de descarte | **Avisar a la profesional recién al marcar la seña paga (como estaba):** descartado, Emily pidió que lleguen todos los turnos agendados, también los de WhatsApp. **Mail al administrador por cada turno de WhatsApp:** descartado, alcanza con Actividad (que es lo que Emily pidió) y no suma un mail nuevo. **Ocultar los días de vacaciones en el calendario:** descartado, el selector de fecha es un `<input type="date">` nativo; se muestra el mensaje al elegir el día. **Mostrar el precio repartido de cada servicio del combo:** descartado, Emily pidió los precios de los servicios ya creados. **Permitir finalizar solo turnos ya empezados:** no se hizo, ver 5. |
| 3 | Evidencia que la sostiene | Backend: `npm run typecheck:all` sin errores; 10 pruebas nuevas en `tests/integration/ajustes-13-11.test.ts` y `npm test` con todas las pruebas en verde (la prueba que lista cada `mailProvider.send` se actualizó: sale «Verificá tu email» y entra «Cambió la profesional de tu turno»). Frontend: `lint`, `typecheck:all` y `npm test` en verde, con pruebas nuevas del popup, del modal y del mensaje de vacaciones. En el navegador, sobre una base local: la clienta ve el popup al entrar tras una cancelación del administrador y no vuelve a verlo; el asistente de reserva muestra el mensaje de vacaciones del 26 al 28/11; la entrada de Actividad de una reserva por WhatsApp trae el botón verde y desaparece al usarlo. |
| 4 | Aporte personal | Emily probó la demostración y pidió cada ajuste, y definió que el aviso emergente sea para cancelaciones del personal. |
| 5 | Desacuerdo y resolución | Sin resolver, para Emily: (a) **el tablero no muestra** un turno marcado como finalizado y pagado si su fecha es futura: es una regla del código (`dashboard.service.ts`: «una fecha futura marcada finished es un dato inconsistente»); los turnos que marcó eran del 21/11 y hoy es 13/11. No se cambió; si se quiere, el backend puede negar finalizar un turno que no empezó (como ya hace con «no asistió»). (b) **El remitente de los mails** sale de `MAIL_USER` y `MAIL_PASS` del `.env` (hoy `emilynoralikohler@gmail.com`); para que salgan desde `kologic6@gmail.com` hay que cambiarlos ahí con la contraseña de aplicación de esa cuenta. No se tocó ningún `.env`. (c) Mercado Pago: sin cambios. |
| 6 | Herramienta auxiliar | Claude Code (Claude Sonnet 5.5) con Node, `tsx`, `vitest`, `psql` y el navegador integrado. Context7 no se consultó (no se usó ninguna API nueva de una librería). |

**Impacto en el frontend (contrato):** sí, ya aplicado en `nexa-frontend` (rama `fix/ajustes-demo-13-11`). Respuestas con campos nuevos: `GET /api/professional/:id/availability` (`vacationFrom`, `vacationTo`, `onVacation`), `GET /api/admin/activity` (`pendingWhatsappDeposit`), vistas de turno de administrador y profesional (`serviceListPrice`; `simultaneousWith[].price` ahora es el precio de lista) y `GET /api/client/notifications` (tipos nuevos `appointment_cancelled`, `appointment_rescheduled`, `professional_changed`). Archivos del frontend: `features/client/booking/availability.ts`, `features/client/booking/steps/DateTimeStep.tsx`, `features/client/notifications/{types.ts,Notifications.tsx,StaffChangePopup.tsx}`, `layouts/ClientLayout.tsx`, `pages/admin/activity/ActivityPage.tsx`, `pages/admin/appointments/AppointmentModal.tsx`, `app/data/admin/{activity.data.ts,calendar.data.ts}`. Mientras no estén los dos pull requests mergeados, conviene subir primero el backend (los campos nuevos son aditivos y el frontend viejo los ignora).

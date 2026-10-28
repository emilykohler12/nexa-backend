# Nexa backend

API REST de Nexa (gestión de turnos de Loren Estudio de Belleza). Es el Proyecto Final de Grado de Emily Kohler **y** lo usa una clienta real en producción: tratar cada cambio como si pudiera llegar a producción. Node 24, Express 5, Prisma 6, PostgreSQL (Supabase), zod 4, JWT en cookies, Mercado Pago, Sentry, Supabase Storage, node-cron. TypeScript con `strict: false`, CommonJS. Comentarios y mensajes de error al usuario en español rioplatense.

## Estructura

- `src/app/`: `app.ts` (middlewares), `server.ts`, `routes.ts` (monta todos los routers bajo `/api`), `config/env.ts` (zod; si falta una variable el proceso hace `exit(1)`), `middlewares/errorHandler.ts` (`AppError`), `constants/http.ts`, `validators/datetime.ts`, `database/prisma.ts`.
- `src/modules/<modulo>/`: **las capas no son uniformes**, mirar el módulo vecino antes de crear uno. Lo común es `*.routes.ts` → `*.controller.ts` → `*.service.ts`. Algunos suman `*.repository.ts` (auth, invitations, professionals), `*.model.ts` (products, promotions, services, specialEvents), `dto/`, `middleware/`, `providers/`, `templates/`. `appointments` no tiene routes propio: `appointment.controller.ts` se monta desde `clients/client.routes.ts`, `professionals/professional.routes.ts` y `admin/`.
- `src/jobs/`: `scheduler.ts` registra los cron (node-cron) de autoNoShow, autoPromotions, inactivityReminder y releaseUnpaidAppointments.
- `prisma/schema.prisma` y `prisma/migrations/`. `scripts/seed-demo.ts`. `src/generated/prisma` es generado.
- `tests/integration/*.test.ts`, `tests/helpers/{auth,factories}.ts`, `tests/setup.ts`.
- `00-gestion/` a `05-entregas/` es documentación académica y de gestión que forma parte de la entrega: no editarla salvo pedido expreso.

## Comandos

- `npm run dev` (tsx watch), `npm run build` (prisma generate + tsc), `npm start` (`dist/app/server.js`).
- `npm test` = `cross-env NODE_ENV=test vitest run`. Un solo archivo: `npx cross-env NODE_ENV=test vitest run tests/integration/auth.test.ts`; un caso: agregar `-t "texto del it"`.
- `npm run test:migrate`: `prisma migrate deploy` usando `.env.test`.
- `npm run typecheck` (solo `src`), `npm run typecheck:all` (`src` + `tests`, es el que corre el CI).
- `npm run seed:demo`.

## Tests

Necesitan un PostgreSQL de pruebas apuntado por `.env.test` (copiar de `.env.test.example`). `tests/setup.ts` aborta si `DATABASE_URL` no contiene "test", trunca todas las tablas antes de cada test (si agregás una tabla al schema, sumala a `TABLES`) y mockea mail, Mercado Pago y login social. Los archivos corren en serie (`fileParallelism: false`). Los helpers `cookieFor()` y `factories.ts` evitan pasar por el login real.

## Reglas de arquitectura (verificadas en código)

- **Single-tenant por despliegue** (ADR-001): cada estudio tiene su propia base, backend y frontend. No hay `tenantId` ni `businessId` en el código: no agregar filtros de tenant ni inventar esa columna. En el frontend, el "tenant" es solo la marca (nombre, logo, colores y textos) cargada desde archivos fijos en `nexa-frontend/src/app/data/tenant/`; `VITE_TENANT_SLUG` está definida pero no se usa. Para un cliente nuevo se clona el sistema y se adaptan esos archivos y las variables de entorno.
- **Auth** (ADR-003, reescrito el 2026-10-24 con las limitaciones conocidas): JWT en cookies `httpOnly` `access_token` (15 min) y `refresh_token` (7 días, `path=/api/auth/refresh`, se guarda en base). En producción `sameSite=none` + `secure`. No hay header `Authorization`. **Sesiones por dispositivo**: cada dispositivo tiene una fila en `refresh_sessions` (máx. 10 por usuaria, el `sid` viaja en los dos JWT, se guarda el SHA-256 del refresh token); iniciar sesión en otro dispositivo no cierra los demás; `logout` cierra solo el dispositivo; cambiar/recuperar la contraseña, desactivar o anonimizar cierra todos. El refresh rota el token con control optimista y acepta el token anterior 30 s solo para renovar el access (dos pestañas a la vez). Para abrir una sesión usar `authService.startSession(user)`, nunca firmar tokens a mano. La columna `users.refresh_token` y el canje de las sesiones del formato anterior se quitaron (migración `20261028120000_drop_users_refresh_token`): un refresh token sin `sid` da `401 INVALID_REFRESH_TOKEN`. `logout` no exige sesión vigente. **CSRF**: la API no interpreta formularios (`express.urlencoded` quitado) y `middlewares/trustedOrigin.ts` rechaza con `403 FORBIDDEN_ORIGIN` todo pedido que cambia datos y trae un `Origin` distinto de `FRONTEND_URL`; no agregar un parser `urlencoded` ni cambiar `FRONTEND_URL` sin revisarlo. `change-password` exige `{ currentPassword, password }` (si la actual es incorrecta, `400 INVALID_CURRENT_PASSWORD`: nunca 401, el frontend desloguea ante cualquier 401). `reset-password` exige `{ email, token, password }`, busca el código de esa cuenta y limita a 5 intentos fallidos cada 15 minutos por email (`429 TOO_MANY_ATTEMPTS`). Los emails se guardan siempre con `trim().toLowerCase()` (el login los pasa a minúsculas) y se buscan sin distinguir mayúsculas (`mode: 'insensitive'`). Una invitación no puede pisar una cuenta admin ni una desactivada y se consume de forma atómica; el alta por invitación entrega las mismas dos cookies que el login (`auth/utils/cookies.ts`) y no devuelve el access token en el cuerpo. Rutas protegidas con `authenticate` + `authorize(...roles)` / `requireRole(...)`; roles `client`, `professional`, `admin`. El secreto mínimo es 32 caracteres.
- **Validación** (ADR-002 en espíritu): zod en el borde (DTOs en `dto/` o `.safeParse` en el controller) y se responde con código `VALIDATION_ERROR`: `400` en casi todos los módulos (usar este), `422` solo en `auth.controller.ts`. Fechas `YYYY-MM-DD` y horas `HH:mm` como texto, con `dateSchema`/`timeSchema` de `src/app/validators/datetime.ts`.
- **Hora de Argentina**: los turnos son texto en hora de Argentina (UTC-3, sin horario de verano) y el servidor de producción (Render) corre en UTC. Nunca usar `new Date('YYYY-MM-DDTHH:mm:00')` sin zona, `getHours()`/`getDate()` ni `toISOString().slice(0, 10)` para "hoy" o para comparar con un turno: usar `todayArgentinaStr()`, `appointmentInstant(date, time)` y `argentinaParts()` de `src/app/utils/argentinaTime.ts`. Los cron usan `timezone: 'America/Argentina/Buenos_Aires'`. No fijar `TZ` en el servidor: `toAdminView` y `normalizeAdminUpdateInput` dependen de que el proceso esté en UTC. Los tests corren con `TZ=UTC` (`vitest.config.mts`) para reproducir producción. Los jobs de recordatorio y campañas y los dashboards también lo usan; para rangos de calendario (día, semana, mes, año) con getters locales hay `argentinaWallClock()`, que NO es un instante real y no se compara con fechas de la base.
- **Errores**: lanzar `new AppError(HTTP.X, 'mensaje', 'CODIGO')` y el handler responde `{ error, code }`. Cualquier otro error se loguea en el servidor y al cliente sale un 500 genérico: nunca devolver `err.message` de Prisma.
- **R-01, disponibilidad de la profesional** (ADR-002): la garantía es el índice único parcial `appointments_professional_date_time_active_key` sobre `(professional_id, date, time) WHERE status NOT IN ('cancelled','no_show')`, creado solo en SQL de la migración (no es `@@unique` de Prisma; no perderlo al tocar el schema). No hay consulta previa: se hace el `INSERT` y `isSlotConflict()` traduce la violación a `409 PROFESSIONAL_SLOT_TAKEN` (eventos especiales: `SLOT_TAKEN`; sin profesional libre: `NO_PROFESSIONAL_FREE`). La reserva de la clienta fuera de franja devuelve `400 OUT_OF_HOURS` (`assertWithinAvailability`); los turnos manuales del admin/profesional no se validan a propósito. **Limitación conocida**: el índice compara la hora de inicio, no detecta solapamientos por duración.

## Seguridad

- Nunca loguear ni devolver tokens, cookies, datos de pago ni contenido de `.env`. `beforeSend` de Sentry (`src/sentry.ts`) descarta errores de validación y 404 y, con `scrubSensitiveData`, borra cookies, cuerpo, query string, cabeceras sensibles y email/IP del usuario. Los mensajes de error y los `console.error` igual pueden llegar a Sentry: no meter datos sensibles en ellos.
- **Mails**: todo mail sale por `mailProvider` (`auth/providers/mail.provider.ts`); ningún otro módulo debe hablar con un servidor de correo ni nombrar una dirección. En producción se envía por la API HTTPS de Brevo (`BREVO_API_KEY` solo en Render): Render bloquea el SMTP en el plan gratis (`ETIMEDOUT`/`ENETUNREACH` en el puerto 587). Sin esa clave se usa SMTP, solo para desarrollo. El remitente es siempre `MAIL_FROM` (`kologic6@gmail.com`), verificado como remitente en Brevo. Los envíos que no deben delatar si una cuenta existe (recuperar contraseña, registro) no esperan al mail: un fallo queda solo en el log del servidor (`[mail] ❌`).
- Webhook de Mercado Pago: Mercado Pago reintenta cada 15 minutos (y cada vez más espaciado) hasta recibir 200, y no está documentado que el `ts` se renueve, así que **no** se rechazan avisos por antigüedad. La protección contra repeticiones es la idempotencia: `applyPaymentResult` y `applyGroupPaymentResult` usan escrituras condicionales (`updateMany` con `paymentStatus` distinto del final), no un chequeo previo. Antes de marcar algo como pagado se compara el monto y la moneda que informa Mercado Pago con la seña o el total esperado (`payments/paidAmount.ts`): si no coinciden no se registra y queda un aviso de error en la actividad. El webhook responde 200 después de procesar y 500 si falló algo transitorio (para que Mercado Pago reintente); no loguear el objeto de error completo del SDK.
- `helmet` con CSP `default-src 'none'`, rate limit global (100/min) y limiters propios en `auth.routes.ts` (desactivados con `NODE_ENV=test`), CORS con `origin: FRONTEND_URL` y `credentials: true`, `trust proxy` en 1.
- Webhook de Mercado Pago: `POST /api/webhook/mercadopago`, protegido por `verificarFirmaMercadoPago`.
- Uploads: `POST /api/uploads/image`, multer en memoria, 5 MB, sube a Supabase Storage.
- `.env` y `.env.test` tienen credenciales reales de infraestructura: no leerlos ni imprimirlos, usar los `.example`.

## Producción y base de datos

- Según `00-gestion/RUNBOOK.md`, el backend corre en Render y la base en Supabase. Un push a `main` redespliega el backend, así que no pushear a `main` sin que Emily lo pida.
- Una migración nueva va primero a la base de Supabase y recién después al push. Nunca correr migraciones, seeds ni tests contra otra base que no sea la de `.env.test`. No editar migraciones ya existentes.

## Contrato con el frontend

`nexa-frontend` está en `../nexa-frontend` y consume esta API (`VITE_API_URL`) con cookies. Cualquier cambio de ruta, método, código de error o forma de respuesta hay que avisarlo antes de dar la tarea por terminada, con la lista de archivos del frontend afectados (ver skill `cambio-de-contrato`).

## Forma de trabajar

- **Context7 siempre que se pueda.** Antes de escribir o cambiar código que dependa de una librería (Express 5, Prisma 6, zod 4, Vitest, Supertest, multer, node-cron, Mercado Pago, Sentry, Supabase), consultar su documentación vigente con el MCP `context7` (`resolve-library-id` y después `query-docs`). No usarlo para lógica de negocio propia. En las consultas no pegar código del proyecto ni datos reales.
- **Bitácora obligatoria.** Todo cambio en el código, la configuración o GitHub (ediciones, borrados, commits, push, ramas, pull requests) se anota en `bitacora3.md` con fecha y hora exactas y los seis elementos: qué se decidió, alternativas y criterio de descarte, evidencia, aporte personal, desacuerdo y resolución, y herramienta auxiliar. Las entradas se agregan al final, en el mismo cambio que las motiva.

## Antes de dar algo por terminado

1. `npm run typecheck:all`
2. `npm test` (con el PostgreSQL de pruebas levantado)
3. Si cambió una ruta o una respuesta, avisar el impacto en el frontend.

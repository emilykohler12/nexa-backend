# Plan de despliegue de la AE4

Orden para llevar a producción las fases de la AE4. Reglas generales (de `CLAUDE.md` y de la skill `nueva-migracion`): la base de Supabase se migra **antes** del push a `main`, las migraciones se aplican a mano en el SQL Editor (nunca desde Claude Code), un push a `main` redespliega Render, y antes de migrar tiene que existir un respaldo reciente.

## Antes de empezar

1. Respaldo reciente (workflow «Backup diario de la base de datos» en GitHub Actions).
2. Correr `docs/consultas-previas-produccion.sql` y guardar la salida. Resultado del 31/10/2026 en `docs/cambios-y-decisiones.md`.
3. `node scripts/migration-checksums.mjs` y pegar el SELECT en Supabase: todas las migraciones anteriores tienen que dar `OK`.

## Migraciones, en este orden (todas ANTES del despliegue)

| Migración | Fase | Qué hace | Tipo |
|---|---|---|---|
| `20261030150000_quitar_campanas_puntos_recordatorio_nacimiento` | 1 | Borra las tablas de campañas y las columnas de puntos, recordatorio de inactividad y fecha de nacimiento | **Borra** (con 0 filas, ver `docs/cambios-y-decisiones.md`) |
| `20261031120000_turno_horario_original_bloqueado` | 2 | `appointments.slot_locked` y predicado nuevo del índice de R-01 | Agrega |
| `20261031121000_crear_horarios_reabiertos` | 2 | Tabla `reopened_slots` | Agrega |
| `20261031122000_actividad_con_turno` | 2 | `activity_logs.appointment_id` | Agrega |
| `20261031130000_cancelacion_con_hora_de_aviso` | 3 | Columnas de la cancelación con hora de aviso | Agrega |
| `20261031131000_politica_de_devolucion_full_o_none` | 3 | Los `partial` viejos pasan a `full` | Modifica datos |
| `20261031140000_recordatorio_de_turno_enviado` | 3b | `appointments.reminder_sent_at` (nullable) | **Agrega** |
| `20261101120000_fecha_ingreso_profesional` | 6 | `professionals.joined_at` (fecha, nullable): fecha de ingreso para el desempate por antigüedad | **Agrega** |

La migración de la fase 3b solo **agrega** una columna nullable: por eso se aplica antes del despliegue. El backend nuevo la lee y la escribe; el backend viejo, que sigue corriendo mientras Render redespliega, la ignora sin problema.

Para cada migración: aplicar el SQL, registrarla con `node scripts/migration-checksums.mjs insert <nombre>`, y volver a correr el SELECT de verificación (todo `OK`).

## Despliegue

1. Push a `main` (lo hace Emily). Render redespliega el backend.
2. En el log de arranque tiene que aparecer: `[jobs] scheduler iniciado (hora de Argentina) — release-unpaid (cada 5 min) + auto-no-show (cada 5 min) + appointment-reminder (cada 5 min)`.
3. Verificar que `BREVO_API_KEY`, `MAIL_FROM` y `FRONTEND_URL` están en Render: el recordatorio sale por Brevo y sus enlaces usan `FRONTEND_URL`.

## Dependencia con el frontend (fase 3b)

Los botones del mail llevan a `FRONTEND_URL/mis-turnos?turno=<id>&accion=ver|reprogramar|cancelar`. Mientras el frontend no tenga esa ruta, los enlaces no abren la pantalla correcta. Conviene publicar el frontend antes, o al mismo tiempo, que el backend con el job. Lista de lo que falta en el frontend: ver la entrada 75 de la bitácora.

## Qué cambia en el manual de despliegue con la fase 8

La fase 8 no agrega migraciones ni cambia rutas. Lo que cambia para el manual (`00-gestion/RUNBOOK.md`, que no se edita en esta rama porque es documentación académica):

1. **Lista de variables de Render** (RUNBOOK, «Variables de entorno que tienen que estar en Render»): le faltan `BREVO_API_KEY` (sin ella los mails intentan salir por SMTP, que Render bloquea), `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin ellas falla la subida de imágenes). `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER` y `MAIL_PASS` solo se usan sin `BREVO_API_KEY`, o sea en desarrollo. Si `JWT_EXPIRES_IN` o `JWT_REFRESH_EXPIRES_IN` están cargadas, no pueden estar vacías (un valor vacío no toma el valor por defecto de 15m y 7d). `BACKEND_PUBLIC_URL` tiene que ser la URL pública del backend: sin ella Mercado Pago no recibe `notification_url` y ningún pago se confirma solo. No definir `TZ`. Si en Render hoy están cargadas o no: **no determinado** (no se puede ver desde el repositorio).
2. **`.env.example`** ahora tiene todas las variables que lee el backend (las de `src/app/config/env.ts` más `SENTRY_DSN`), así que sirve de lista de control contra Render → Environment.
3. **`npm run seed:demo`** carga un escenario completo (profesional, clienta de demo con un turno confirmado, uno `no_show_auto` y uno cancelado, y una promoción vigente). Es **solo para desarrollo o una base de demostración**: nunca correrlo contra Supabase de producción, porque crea cuentas de demo (`@nexa.local`) y una promoción visible en el inicio. Cada corrida borra y vuelve a crear los turnos de la clienta de demo.
4. Las salidas esperadas del README (sección 4.5) cambian: la profesional de demo se llama «Valeria (demo)» y se suman la clienta de demo, los tres turnos y la promoción.

## Después del despliegue

- Con un turno de prueba confirmado que empiece en menos de 5 horas (creado con más de 5 horas de anticipación, con la cuenta de Emily y el correo verificado), comprobar que llega el mail y que aparece la entrada «Recordatorio de turno enviado» en Actividad.
- Revisar en Actividad que no haya entradas «No se pudo enviar el recordatorio del turno» repetidas.

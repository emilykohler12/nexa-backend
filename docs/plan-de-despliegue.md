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

La migración de la fase 3b solo **agrega** una columna nullable: por eso se aplica antes del despliegue. El backend nuevo la lee y la escribe; el backend viejo, que sigue corriendo mientras Render redespliega, la ignora sin problema.

Para cada migración: aplicar el SQL, registrarla con `node scripts/migration-checksums.mjs insert <nombre>`, y volver a correr el SELECT de verificación (todo `OK`).

## Despliegue

1. Push a `main` (lo hace Emily). Render redespliega el backend.
2. En el log de arranque tiene que aparecer: `[jobs] scheduler iniciado (hora de Argentina) — release-unpaid (cada 5 min) + auto-no-show (cada 5 min) + appointment-reminder (cada 5 min)`.
3. Verificar que `BREVO_API_KEY`, `MAIL_FROM` y `FRONTEND_URL` están en Render: el recordatorio sale por Brevo y sus enlaces usan `FRONTEND_URL`.

## Dependencia con el frontend (fase 3b)

Los botones del mail llevan a `FRONTEND_URL/mis-turnos?turno=<id>&accion=ver|reprogramar|cancelar`. Mientras el frontend no tenga esa ruta, los enlaces no abren la pantalla correcta. Conviene publicar el frontend antes, o al mismo tiempo, que el backend con el job. Lista de lo que falta en el frontend: ver la entrada 75 de la bitácora.

## Después del despliegue

- Con un turno de prueba confirmado que empiece en menos de 5 horas (creado con más de 5 horas de anticipación, con la cuenta de Emily y el correo verificado), comprobar que llega el mail y que aparece la entrada «Recordatorio de turno enviado» en Actividad.
- Revisar en Actividad que no haya entradas «No se pudo enviar el recordatorio del turno» repetidas.

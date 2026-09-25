# RUNBOOK — Qué hacer si algo se cae

Proyecto Nexa (Loren Estudio de Belleza)

Guía de referencia rápida para cuando algo falla en producción. Pensada para
resolver en el momento, sin tener que investigar desde cero.

## Servicios y dónde mirar

| Servicio | URL | Dónde ver logs/estado |
|---|---|---|
| Backend (API) | https://lorenestudiodebelleza.onrender.com | Render → el servicio → pestaña "Logs" |
| Frontend | https://lorenestudiodebelleza.vercel.app | Vercel → el proyecto → pestaña "Deployments" |
| Base de datos | Supabase (proyecto `ivtesgdigllikyefhkov`) | supabase.com → el proyecto → "Database" / "Logs" |
| Errores en vivo | Sentry (proyectos backend y frontend) | sentry.io |
| El sitio está caído | UptimeRobot | uptimerobot.com — manda mail apenas el `/api/health` deja de responder |

## "El sitio no carga / da error"

1. Entrá a `https://lorenestudiodebelleza.onrender.com/api/health`.
   - Si responde `{"status":"ok","database":"up",...}` → el backend está bien, el problema es del frontend (revisá Vercel → Deployments, ¿el último build falló?).
   - Si responde `{"status":"error","database":"down",...}` o no responde nada → seguí al punto 2.
2. Andá a Render → Logs del servicio. Buscá el error más reciente (suele estar al final).
   - `Variables de entorno inválidas` → falta o está mal cargada una env var. Revisá Render → Environment contra la lista de abajo.
   - `Can't reach database server` / timeout → la base de Supabase puede estar pausada (los proyectos free se pausan solos tras 7 días sin actividad) o caída. Entrá a supabase.com y fijate si el proyecto pide ser "reactivado".
   - Errores de TypeScript en el build → alguien pusheó código que no compila. Mirá el commit más reciente en GitHub.
3. Si el build de Render falla pero no sabés por qué, pegale el log completo a Claude Code en este repo — ya resolvimos varios así en la sesión de este mismo proyecto.

## "Nadie puede pagar (seña o pedido)"

1. Revisá que `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` estén cargadas en Render (Environment).
2. Si son credenciales de PRUEBA (`APP_USR-...` de tu cuenta de test), los pagos van a "funcionar" pero nunca van a mover plata real — es esperable hasta que se carguen las credenciales de producción reales de Mercado Pago.
3. Revisá en Mercado Pago (developers.mercadopago.com) que el webhook esté configurado apuntando a `https://lorenestudiodebelleza.onrender.com/api/payments/webhook` (o la ruta que corresponda).

## "La base de datos se cayó / hay que restaurar"

1. Los backups diarios están en GitHub → este repo → pestaña **Actions** → workflow "Backup diario de la base de datos" → cada corrida tiene un artifact descargable (`nexa-backup-<id>.dump`), se guardan 30 días.
2. Para restaurar en una base nueva (ej. si hay que recrear el proyecto de Supabase):
   ```bash
   pg_restore --no-owner --no-acl -d "postgresql://usuario:pass@host:puerto/postgres" nexa-backup.dump
   ```
3. **Probá el restore en una base de prueba antes de necesitarlo de verdad** (ver sección de abajo) — un backup nunca probado no es un backup confiable.

## Variables de entorno que tienen que estar en Render

`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`,
`JWT_REFRESH_EXPIRES_IN`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `ADMIN_NAME`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`,
`MAIL_FROM`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SENTRY_DSN`.

(`GOOGLE_CLIENT_ID` y las de `WHATSAPP_*` quedaron sin usar tras remover el login
social y no tener todavía el chatbot — no hace falta cargarlas.)

## Cómo probar un restore (hacer esto al menos una vez)

1. Descargá el artifact más reciente del workflow de backup.
2. Creá una base Postgres nueva y vacía en cualquier lado (otro proyecto de Supabase free, o local con `docker run postgres`).
3. `pg_restore --no-owner --no-acl -d "<connection-string-de-la-base-de-prueba>" nexa-backup.dump`
4. Conectate con un cliente de Postgres (o `npx prisma studio` apuntando `DATABASE_URL` a esa base) y confirmá que las tablas y datos están.
5. Anotá cuánto tardó — eso te dice cuánto tiempo de caída real tendrías si algún día hace falta restaurar de verdad.

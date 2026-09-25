# SOP — Procedimientos operativos estándar para Loren

Proyecto Nexa. Tareas de rutina/mantenimiento, explicadas paso a paso.

## Desplegar un cambio nuevo

1. Backend: `git push origin main` en `nexa-backend` → Render redespliega solo.
2. Frontend: `git push origin main` en `nexa-frontend` → Vercel redespliega solo.
3. Mirá los logs del deploy (Render/Vercel) hasta ver "Build successful" / "Deployment ready".
4. Si el build falla, no queda en producción el código roto — el deploy anterior sigue sirviendo hasta que uno nuevo funcione.

## Aplicar un cambio de esquema de base de datos (migración)

Cuando se agrega/cambia un campo en `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name <nombre_descriptivo>   # local, crea la migración
```
Eso crea el `.sql` en `prisma/migrations/`. Para aplicarlo en producción (Supabase):
```bash
DATABASE_URL="<la-connection-string-de-supabase>" npx prisma migrate deploy
```
Nunca uses `migrate dev` contra la base de producción — borra y recrea si detecta drift. `migrate deploy` solo aplica migraciones nuevas, es seguro.

## Rotar un secreto (JWT, contraseña de Mercado Pago, etc.)

1. Generá el valor nuevo.
2. Actualizalo en Render → Environment (backend) y/o Vercel → Environment Variables (frontend), según corresponda.
3. Guardar dispara un redeploy automático — no hace falta tocar código.
4. Si rotás `JWT_SECRET`/`JWT_REFRESH_SECRET`: todas las sesiones activas se invalidan (todos tienen que volver a loguearse). Avisar si es en horario de uso.

## Agregar o cambiar la cuenta admin

- El servidor crea automáticamente un admin con `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` la primera vez que arranca **si no existe ya un usuario con ese email**.
- Cambiar esas variables en Render y reiniciar el servicio **no borra** el admin viejo, crea uno nuevo aparte.
- Para agregar otro admin manualmente después: desde el panel admin (si hay una pantalla para eso) o directo en la base vía Prisma Studio.

## Revisar que todo esté sano (chequeo semanal sugerido)

1. `https://lorenestudiodebelleza.onrender.com/api/health` responde `status: ok`.
2. UptimeRobot no tiene alertas de caída sin resolver.
3. Sentry (backend y frontend) sin errores nuevos sin revisar.
4. GitHub Actions → el workflow de backup diario corrió sin fallar los últimos 7 días.
5. `npm audit` en ambos repos — revisar si aparecieron vulnerabilidades nuevas de severidad alta.

## Actualizar dependencias

No actualizar Prisma/TypeScript a versiones "major" (el aviso que aparece en cada build,
ej. "Update available 6.19.3 -> 8.0.0-rc.17") sin probar antes en local — son cambios
grandes que pueden romper el build. Las actualizaciones de parche/minor (`npm update`)
son en general seguras.

## Antes de un load test contra producción

`scripts/load-test.yml` (Artillery) tiene un escenario de reserva de turnos que
**crea turnos de verdad** si se corre completo. Correrlo contra producción sin avisar
puede llenar la agenda de turnos falsos. Si hace falta probar contra el sitio real,
avisar antes y limpiar los turnos de prueba después.

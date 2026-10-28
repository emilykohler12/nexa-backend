# SOP — Procedimientos operativos estándar para Loren

Proyecto Nexa. Tareas de rutina/mantenimiento, explicadas paso a paso.

## Desplegar un cambio nuevo

1. Trabajá en una rama (`git switch -c nombre-descriptivo`), commiteá y subí la rama (`git push -u origin nombre-descriptivo`).
2. Abrí un pull request hacia `main` en GitHub. El CI (GitHub Actions) corre el typecheck y los tests; esperá que quede en verde.
3. **Si el cambio incluye una migración de base de datos, aplicala primero en Supabase** (sección siguiente). Si no, el código nuevo consulta una tabla o columna que todavía no existe y falla.
4. Mergeá el pull request. El merge a `main` es lo que dispara el deploy:
   - Backend (`nexa-backend`) → Render redespliega solo.
   - Frontend (`nexa-frontend`) → Vercel redespliega solo.
5. Mirá los logs del deploy (Render/Vercel) hasta ver "Build successful" / "Deployment ready".
6. Si el build falla, no queda en producción el código roto — el deploy anterior sigue sirviendo hasta que uno nuevo funcione.
7. Si el cambio toca una ruta o la forma de una respuesta del backend, desplegá el backend primero y el frontend después, y revisá que el frontend nuevo no dependa de algo que el backend viejo no tiene.

## Aplicar un cambio de esquema de base de datos (migración)

Cuando se agrega/cambia un campo en `prisma/schema.prisma`, en tu PC:
```bash
npx prisma migrate dev --name <nombre_descriptivo>   # local, crea la migración
```
Eso crea el `.sql` en `prisma/migrations/<fecha>_<nombre>/migration.sql`.

**La migración de producción se aplica a mano desde el SQL Editor de Supabase.** El comando `prisma migrate deploy` desde tu PC no funcionó contra Supabase (error `P1001`, no llega a la base), así que no se usa.

Pasos:
1. Abrí el archivo `migration.sql` de la migración nueva, copiá todo su contenido.
2. En Supabase: proyecto → **SQL Editor** → New query → pegá el SQL → **Run**. Tiene que terminar sin errores.
3. Registrá la migración en la tabla `_prisma_migrations` (así Prisma y el script de control saben que ya está aplicada). En la carpeta de `nexa-backend`, en PowerShell:
   ```bash
   node scripts/migration-checksums.mjs insert <nombre_de_la_carpeta_de_la_migracion> | clip
   ```
   Pegá en una consulta nueva del SQL Editor y ejecutá. Siempre **después** de haber corrido el SQL del paso 2.
4. Controlá que todo esté al día:
   ```bash
   node scripts/migration-checksums.mjs | clip
   ```
   Pegá en el SQL Editor y ejecutá. La tabla que devuelve tiene que mostrar una sola fila: `OK` con la cantidad de migraciones que hay en `prisma/migrations/`. Si aparece `FALTA APLICAR`, `CHECKSUM DISTINTO`, `INCOMPLETA` o `SOLO EN LA BASE`, la columna `detalle` dice cuáles; no mergees hasta resolverlo.

Reglas: nunca uses `migrate dev` contra la base de producción (borra y recrea si detecta drift), nunca edites una migración ya existente, y nunca corras migraciones, seeds ni tests contra otra base que no sea la de pruebas (`.env.test`).

## Rotar un secreto (JWT, contraseña de Mercado Pago, etc.)

1. Generá el valor nuevo.
2. Actualizalo en Render → Environment (backend) y/o Vercel → Environment Variables (frontend), según corresponda.
3. Guardar dispara un redeploy automático — no hace falta tocar código.
4. Si rotás `JWT_SECRET`/`JWT_REFRESH_SECRET`: todas las sesiones activas se invalidan (todos tienen que volver a loguearse, en todos sus dispositivos). Avisar si es en horario de uso.

## Cerrar las sesiones de una usuaria

Cada dispositivo tiene su propia sesión (tabla `refresh_sessions`, máximo 10 por usuaria). Cerrar sesión en un dispositivo no cierra los demás. Se cierran todas a la vez cuando la usuaria cambia o recupera su contraseña, o cuando se desactiva o anonimiza su cuenta. Para forzarlo a mano, en el SQL Editor: `DELETE FROM refresh_sessions WHERE user_id = '<id de la usuaria>';`.

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
6. El control de migraciones (`node scripts/migration-checksums.mjs`, ver arriba) devuelve solo `OK`.

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

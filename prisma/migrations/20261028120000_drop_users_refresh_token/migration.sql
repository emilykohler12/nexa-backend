-- Se quita la columna users.refresh_token, el token único por usuaria que usaban las sesiones
-- anteriores a las sesiones por dispositivo (tabla refresh_sessions). Pasaron los 7 días que dura
-- un refresh token desde el despliegue del 2026-10-28, así que no queda ninguna sesión de ese formato.
--
-- ORDEN: aplicar este SQL DESPUÉS de desplegar el código que ya no lee la columna. Si se aplica
-- antes, el código anterior (que sí la lee) falla en todas las consultas a users.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "refresh_token";

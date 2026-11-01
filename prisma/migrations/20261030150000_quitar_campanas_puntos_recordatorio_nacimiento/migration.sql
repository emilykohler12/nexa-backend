-- Quita las funciones eliminadas el 30/10/2026 (decisión confirmada por escrito por la propietaria):
--   * campañas automáticas por mail (tablas auto_promotion_sends y auto_promotions),
--   * puntos de fidelización (clients.loyalty_points),
--   * recordatorio de inactividad por mail (clients.last_inactivity_reminder_at),
--   * fecha de nacimiento (clients.birth_date).
--
-- DESTRUCTIVA: los datos de estas tablas y columnas se pierden. Antes de aplicarla, hacer
-- respaldo y correr docs/consultas-previas-produccion.sql (cuenta cuántas clientas tienen
-- fecha de nacimiento o puntos, y cuántas campañas hay).
--
-- ORDEN (al revés que las migraciones que agregan columnas): desplegar PRIMERO el código nuevo,
-- que ya no lee estas columnas, y recién después aplicar este SQL en Supabase. Si se aplicara antes,
-- el código viejo (que todavía hace SELECT de birth_date, loyalty_points y
-- last_inactivity_reminder_at sobre clients) fallaría hasta que Render termine de redesplegar.
-- Mientras tanto, con el código nuevo y las columnas todavía presentes, no pasa nada.
-- Para registrarla en _prisma_migrations: node scripts/migration-checksums.mjs insert 20261030150000_quitar_campanas_puntos_recordatorio_nacimiento

-- DropTable (primero la hija, que tiene la clave foránea)
DROP TABLE "auto_promotion_sends";
DROP TABLE "auto_promotions";

-- AlterTable
ALTER TABLE "clients"
  DROP COLUMN "birth_date",
  DROP COLUMN "loyalty_points",
  DROP COLUMN "last_inactivity_reminder_at";

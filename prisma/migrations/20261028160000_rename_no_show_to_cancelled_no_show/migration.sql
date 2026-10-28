-- RF-05: el estado del turno que no se presenta pasa de 'no_show' a 'cancelled_no_show'
-- (en el catálogo: «cancelado por inasistencia»).
--
-- 1) El índice único parcial de R-01 (profesional, fecha, hora) excluye los turnos que ya no
--    ocupan el horario. Se vuelve a crear con la lista nueva. Se deja también 'no_show' en la
--    lista a propósito: entre aplicar esta migración y desplegar el código nuevo, el código
--    anterior todavía puede escribir 'no_show', y esos turnos no deben bloquear el horario.
--    DROP INDEX y CREATE INDEX van juntos en un mismo script (una sola transacción implícita),
--    así que no queda ningún momento sin garantía de no superposición.
-- 2) Los turnos guardados con el estado viejo pasan al nuevo.
--
-- ORDEN: aplicar este SQL ANTES de desplegar el código que escribe 'cancelled_no_show'. Si se
-- despliega primero, esos turnos seguirían bloqueando el horario (el índice viejo no los excluye).
-- Después del despliegue, volver a correr solo el UPDATE por si el código anterior alcanzó a
-- marcar algún turno con 'no_show' en el medio.

-- DropIndex
DROP INDEX "appointments_professional_date_time_active_key";

-- CreateIndex (índice parcial, solo existe en SQL: Prisma no lo modela)
CREATE UNIQUE INDEX "appointments_professional_date_time_active_key"
  ON "appointments" ("professional_id", "date", "time")
  WHERE "status" NOT IN ('cancelled', 'no_show', 'cancelled_no_show');

-- Datos
UPDATE "appointments" SET "status" = 'cancelled_no_show' WHERE "status" = 'no_show';

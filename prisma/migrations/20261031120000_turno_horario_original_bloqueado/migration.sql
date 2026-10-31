-- Fase 2 de la AE4 (inasistencia y horario reabierto): el horario ORIGINAL de un turno marcado como
-- no asistido, o cancelado después de su hora de inicio, no se vuelve a reservar nunca.
--
-- 1) appointments.slot_locked: true cuando el turno ya no está activo pero su horario queda bloqueado.
--    Lo escribe el código en la MISMA sentencia UPDATE que cambia el estado, así que la fila nunca sale
--    del índice y no hay un instante en el que otra reserva pueda colarse.
-- 2) El índice único parcial de R-01 (profesional, fecha, hora de inicio) se recrea con el predicado
--    ampliado: cuentan los turnos activos Y los que tienen el horario bloqueado. 'no_show_auto' (estado
--    nuevo) no está en la lista de excluidos, así que sigue ocupando el horario sin hacer nada más.
--    DROP INDEX y CREATE INDEX van juntos en este script (una sola transacción): no queda ningún momento
--    sin garantía de no superposición.
--
-- Las filas que ya existen quedan con slot_locked = false: el índice nuevo tiene exactamente el mismo
-- contenido que el viejo, así que no puede fallar por duplicados (ver consulta 3 de
-- docs/consultas-previas-produccion.sql).
--
-- ORDEN: migración que AGREGA una columna -> aplicar este SQL en Supabase ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "slot_locked" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "appointments_professional_date_time_active_key";

-- CreateIndex (índice parcial, solo existe en SQL: Prisma no lo modela)
CREATE UNIQUE INDEX "appointments_professional_date_time_active_key"
  ON "appointments" ("professional_id", "date", "time")
  WHERE "status" NOT IN ('cancelled', 'cancelled_no_show') OR "slot_locked";

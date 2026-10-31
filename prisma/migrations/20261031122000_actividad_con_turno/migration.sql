-- Fase 2 de la AE4: el registro de actividad guarda a qué turno se refiere cada entrada que toca un
-- turno (columna nullable, sin clave foránea a propósito: el registro no debe impedir ni arrastrar el
-- borrado de un turno) y se indexa para buscar el historial de un turno.
--
-- ORDEN: columna nueva nullable -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN "appointment_id" UUID;

-- CreateIndex
CREATE INDEX "activity_logs_appointment_id_idx" ON "activity_logs"("appointment_id");

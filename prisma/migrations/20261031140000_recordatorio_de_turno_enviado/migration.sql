-- Fase 3b de la AE4: recordatorio de turno por mail. El job appointmentReminder.job.ts anota en cada turno
-- cuándo mandó el recordatorio para no reenviarlo nunca (columna nullable, sin valor por defecto: los turnos
-- existentes quedan en NULL). Solo AGREGA una columna; no borra ni modifica nada.
--
-- ORDEN: columna nueva nullable -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ;

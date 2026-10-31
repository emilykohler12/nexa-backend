-- Fase 3 de la AE4 (cancelación y devolución): se guarda quién canceló el turno y, cuando cancela el
-- personal por aviso de la clienta, cuándo avisó, por qué medio, la nota y quién lo cargó y cuándo.
-- Todas las columnas son nullable: los turnos que ya existen quedan sin esos datos.
--
-- ORDEN: columnas nuevas nullable -> aplicar este SQL en Supabase ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "appointments"
  ADD COLUMN "cancelled_by" VARCHAR(10),
  ADD COLUMN "client_notice_at" TIMESTAMPTZ,
  ADD COLUMN "notice_channel" VARCHAR(20),
  ADD COLUMN "notice_note" VARCHAR(200),
  ADD COLUMN "notice_loaded_by_id" UUID,
  ADD COLUMN "notice_loaded_at" TIMESTAMPTZ;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_notice_loaded_by_id_fkey"
  FOREIGN KEY ("notice_loaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

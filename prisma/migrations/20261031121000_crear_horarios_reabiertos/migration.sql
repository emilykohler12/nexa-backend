-- Fase 2 de la AE4: tabla de horarios reabiertos. Cada fila nace de UN turno (appointment_id único)
-- marcado como no asistido, o cancelado ya empezado, hasta 40 minutos después de su hora de inicio.
-- La vigencia es implícita (closes_at = hora original + 60 minutos); closed_at solo se completa cuando
-- el personal corrige el estado del turno de origen (ver ADR-002, revisión del 31/10/2026).
--
-- ORDEN: tabla nueva -> aplicar ANTES de desplegar el código.

-- CreateTable
CREATE TABLE "reopened_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "original_time" VARCHAR(5) NOT NULL,
    "first_start" VARCHAR(5) NOT NULL,
    "opens_at" TIMESTAMPTZ NOT NULL,
    "closes_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "closed_reason" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reopened_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reopened_slots_appointment_id_key" ON "reopened_slots"("appointment_id");

-- CreateIndex
CREATE INDEX "reopened_slots_professional_id_date_idx" ON "reopened_slots"("professional_id", "date");

-- AddForeignKey
ALTER TABLE "reopened_slots" ADD CONSTRAINT "reopened_slots_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

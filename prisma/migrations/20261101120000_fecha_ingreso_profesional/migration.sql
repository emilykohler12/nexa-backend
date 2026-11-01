-- Fase 6 de la AE4 (RF-06): fecha de ingreso de la profesional al estudio. La carga el administrador y se usa
-- para el desempate por antigüedad al asignar "cualquier profesional". Columna nullable y sin valor por defecto:
-- mientras esté en NULL se usa professionals.created_at, así que las profesionales existentes no cambian de
-- orden. Solo AGREGA una columna; no borra ni modifica nada.
--
-- ORDEN: columna nueva nullable -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN "joined_at" DATE;

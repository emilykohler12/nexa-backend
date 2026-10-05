-- RF-12: no se guarda el nombre de quien acompaña. Se reemplazan
-- "accompanied" + "companion_name" (texto libre) por "has_companion" (booleano)
-- y "companion_relation" (lista cerrada, sin nombre).

ALTER TABLE "appointments" ADD COLUMN "has_companion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN "companion_relation" VARCHAR(20);

-- Conserva la condición de acompañante: venía marcada o había un nombre cargado.
UPDATE "appointments"
SET "has_companion" = true
WHERE "accompanied" = true
   OR ("companion_name" IS NOT NULL AND btrim("companion_name") <> '');

-- Borra los nombres guardados (y la columna vieja del booleano).
ALTER TABLE "appointments" DROP COLUMN "companion_name";
ALTER TABLE "appointments" DROP COLUMN "accompanied";

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_companion_relation_check"
  CHECK ("companion_relation" IS NULL OR "companion_relation" IN ('child', 'partner', 'family', 'friend', 'other'));

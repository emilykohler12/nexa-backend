-- RF-04: la seña se devuelve con 12 horas o más de aviso (no 24).
-- Cambia el default de la columna y corrige la fila existente si quedó
-- con el valor de fábrica (24). Si el local ya cargó otro valor a mano,
-- no se toca.
ALTER TABLE "payment_settings" ALTER COLUMN "cancellation_hours" SET DEFAULT 12;

UPDATE "payment_settings" SET "cancellation_hours" = 12 WHERE "cancellation_hours" = 24;

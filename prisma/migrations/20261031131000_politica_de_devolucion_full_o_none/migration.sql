-- Fase 3 de la AE4: la política de devolución de la seña admite solo 'full' o 'none' (el valor 'partial'
-- se elimina). Los 'partial' pasan a 'full'. payment_settings tiene UNA sola fila, así que el cambio afecta
-- a 0 o 1 filas; antes de aplicarlo, la consulta 1 de docs/consultas-previas-produccion.sql muestra el valor actual.
--
-- ORDEN: solo datos -> se puede aplicar antes o después de desplegar; el código nuevo valida 'full' | 'none'.

UPDATE "payment_settings" SET "refund_policy" = 'full' WHERE "refund_policy" = 'partial';

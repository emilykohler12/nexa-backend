-- Tablero del administrador: «Señas por devolver (Mercado Pago)». El sistema solo MARCA la seña como devuelta
-- (payment_status = 'refunded'); la devolución real se hace a mano en Mercado Pago. Esta columna guarda cuándo el
-- administrador la devolvió; en NULL la seña todavía falta devolver. Columna nueva nullable y sin valor por defecto: las
-- señas ya marcadas como devueltas quedan en NULL, o sea «falta devolver», hasta que el administrador las marque.
-- Solo AGREGA una columna; no borra ni modifica nada.
--
-- ORDEN: columna nueva nullable -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "deposit_refunded_at" TIMESTAMPTZ;

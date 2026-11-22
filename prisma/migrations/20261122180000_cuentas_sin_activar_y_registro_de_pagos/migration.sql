-- 1) Cuentas «sin activar»: la clienta que crea el personal (alta del administrador o turno manual con correo) todavía no
--    eligió contraseña. Si se registra con ese correo se le manda un código para activarla en vez de rechazarla.
--    Columna nueva con valor por defecto false: las cuentas que ya existen quedan como están.
-- 2) Motivo corto del pago fallido y monto realmente cobrado cuando superó la seña (ambas nullable, sin valor por defecto).
-- 3) Tabla payment_records: registro de todos los pagos de Mercado Pago con su resultado y motivo; los que hay que devolver
--    llevan needs_refund = true hasta que el administrador los marca con refunded_at.
-- Solo AGREGA columnas y una tabla; no borra ni modifica nada.
--
-- ORDEN: columnas y tabla nuevas -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pending_activation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "payment_note" VARCHAR(120),
ADD COLUMN "deposit_paid_amount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mp_payment_id" VARCHAR(50) NOT NULL,
    "kind" VARCHAR(15) NOT NULL,
    "ref_id" UUID NOT NULL,
    "mp_status" VARCHAR(30) NOT NULL,
    "status_detail" VARCHAR(80),
    "outcome" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(160) NOT NULL,
    "expected_amount" DECIMAL(10,2),
    "paid_amount" DECIMAL(10,2),
    "currency" VARCHAR(10),
    "needs_refund" BOOLEAN NOT NULL DEFAULT false,
    "refunded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_mp_payment_id_key" ON "payment_records"("mp_payment_id");

-- CreateIndex
CREATE INDEX "payment_records_needs_refund_refunded_at_idx" ON "payment_records"("needs_refund", "refunded_at");

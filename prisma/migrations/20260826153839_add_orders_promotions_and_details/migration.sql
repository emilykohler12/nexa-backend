-- AlterTable: nuevos campos de detalle del turno (uñas/cabello/piel)
ALTER TABLE "appointments" ADD COLUMN     "hair_length" VARCHAR(20),
ADD COLUMN     "has_other_salon_polish" BOOLEAN,
ADD COLUMN     "is_nail_reconstruction" BOOLEAN,
ADD COLUMN     "nail_reconstruction_count" INTEGER,
ADD COLUMN     "skin_type" VARCHAR(20),
ADD COLUMN     "wants_extensions" BOOLEAN;

-- Evita doble reserva: índice único parcial. Se excluyen 'cancelled' (obvio) y
-- 'no_show' (el turno ya pasó y quedó resuelto — no debe seguir bloqueando el horario).
CREATE UNIQUE INDEX "appointments_professional_date_time_active_key"
  ON "appointments" ("professional_id", "date", "time")
  WHERE "status" NOT IN ('cancelled', 'no_show');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "delivery_type" VARCHAR(20) NOT NULL,
    "delivery_address" TEXT,
    "phone" VARCHAR(30),
    "notes" TEXT,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: product_orders pasa a ser línea de un Order (antes era el pedido completo)
ALTER TABLE "product_orders" ADD COLUMN "order_id" UUID;

-- Data migration: un Order por cada ProductOrder existente (pedidos de un solo item
-- creados antes de este cambio), asumiendo retiro en local ya que no había ese dato.
INSERT INTO "orders" ("id", "client_id", "delivery_type", "total_price", "created_at")
SELECT gen_random_uuid(), po."client_id", 'pickup', po."total_price", po."created_at"
FROM "product_orders" po;

UPDATE "product_orders" po
SET "order_id" = o."id"
FROM "orders" o
WHERE o."client_id" = po."client_id"
  AND o."total_price" = po."total_price"
  AND o."created_at" = po."created_at"
  AND po."order_id" IS NULL;

ALTER TABLE "product_orders" ALTER COLUMN "order_id" SET NOT NULL;
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

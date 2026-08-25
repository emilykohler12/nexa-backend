-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "accompanied" BOOLEAN,
ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "companion_name" VARCHAR(150),
ADD COLUMN     "design_type" VARCHAR(10),
ADD COLUMN     "design_value" TEXT;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "product_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_orders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

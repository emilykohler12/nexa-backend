-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "consents" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contraindications" TEXT,
ADD COLUMN     "document" VARCHAR(30),
ADD COLUMN     "loyalty_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "photo" TEXT;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "duration" INTEGER NOT NULL,
    "service_price" DECIMAL(10,2) NOT NULL,
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "client_notes" TEXT,
    "internal_notes" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "brand" VARCHAR(100) NOT NULL DEFAULT '',
    "category_id" VARCHAR(50) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 5000,
    "deposit_percent" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_hours" INTEGER NOT NULL DEFAULT 24,
    "refund_policy" VARCHAR(20) NOT NULL DEFAULT 'full',

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

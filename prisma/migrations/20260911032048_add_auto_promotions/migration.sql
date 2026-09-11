-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "auto_promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "discount_type" VARCHAR(10) NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "audience_type" VARCHAR(20) NOT NULL DEFAULT 'all',
    "audience_client_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "audience_category_id" VARCHAR(50),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auto_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_promotion_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auto_promotion_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "period_key" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_promotion_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_promotion_sends_auto_promotion_id_client_id_period_key_key" ON "auto_promotion_sends"("auto_promotion_id", "client_id", "period_key");

-- AddForeignKey
ALTER TABLE "auto_promotion_sends" ADD CONSTRAINT "auto_promotion_sends_auto_promotion_id_fkey" FOREIGN KEY ("auto_promotion_id") REFERENCES "auto_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

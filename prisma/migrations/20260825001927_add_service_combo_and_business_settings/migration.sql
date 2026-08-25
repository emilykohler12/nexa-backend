-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "is_combo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "business_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL DEFAULT '',
    "logo" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "address" VARCHAR(255) NOT NULL DEFAULT '',
    "phone" VARCHAR(30) NOT NULL DEFAULT '',
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "instagram" VARCHAR(255),
    "facebook" VARCHAR(255),
    "tiktok" VARCHAR(255),
    "whatsapp" VARCHAR(30),
    "policies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_schedule_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day" VARCHAR(20) NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "open_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "close_time" VARCHAR(5) NOT NULL DEFAULT '18:00',

    CONSTRAINT "business_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" VARCHAR(10) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_schedule_days_day_key" ON "business_schedule_days"("day");

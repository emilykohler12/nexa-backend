-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bio" TEXT,
    "photo" VARCHAR(500),
    "specialty" VARCHAR(100),
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "certifications" TEXT,
    "languages" TEXT[],
    "commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "commission_type" TEXT NOT NULL DEFAULT 'to_owner',
    "status" TEXT NOT NULL DEFAULT 'active',
    "instagram" VARCHAR(255),
    "facebook" VARCHAR(255),
    "tiktok" VARCHAR(255),
    "twitter" VARCHAR(255),
    "policies" TEXT,
    "payment_methods" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "professional_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "professional_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professionals_user_id_key" ON "professionals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_availability_professional_id_day_of_week_key" ON "professional_availability"("professional_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_availability" ADD CONSTRAINT "professional_availability_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

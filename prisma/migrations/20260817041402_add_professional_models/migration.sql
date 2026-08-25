/*
  Warnings:

  - You are about to drop the column `commission_pct` on the `professionals` table. All the data in the column will be lost.
  - You are about to drop the column `commission_type` on the `professionals` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `professionals` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "professional_availability" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "start_time" SET DATA TYPE TEXT,
ALTER COLUMN "end_time" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "professionals" DROP COLUMN "commission_pct",
DROP COLUMN "commission_type",
DROP COLUMN "status",
ALTER COLUMN "photo" SET DATA TYPE TEXT,
ALTER COLUMN "specialty" SET DATA TYPE TEXT,
ALTER COLUMN "languages" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "instagram" SET DATA TYPE TEXT,
ALTER COLUMN "facebook" SET DATA TYPE TEXT,
ALTER COLUMN "tiktok" SET DATA TYPE TEXT,
ALTER COLUMN "twitter" SET DATA TYPE TEXT,
ALTER COLUMN "payment_methods" SET DEFAULT ARRAY[]::TEXT[];

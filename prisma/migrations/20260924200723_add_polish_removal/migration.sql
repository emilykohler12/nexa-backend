-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "polish_removal_label" VARCHAR(100),
ADD COLUMN     "polish_removal_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "polish_removal_rules" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

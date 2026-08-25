-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "twitter" VARCHAR(255);

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

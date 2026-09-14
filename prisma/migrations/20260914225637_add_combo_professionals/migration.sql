-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "combo_professionals" JSONB NOT NULL DEFAULT '{}';

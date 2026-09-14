-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "cancel_reason" VARCHAR(30);

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

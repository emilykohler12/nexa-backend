-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "deposit_method" VARCHAR(20);

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

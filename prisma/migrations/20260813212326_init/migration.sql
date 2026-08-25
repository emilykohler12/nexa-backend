-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "verification_token" VARCHAR(255);

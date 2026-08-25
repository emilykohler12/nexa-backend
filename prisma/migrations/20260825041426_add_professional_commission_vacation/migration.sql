-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "commission_pct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commission_type" VARCHAR(20) NOT NULL DEFAULT 'earned',
ADD COLUMN     "vacation_from" DATE,
ADD COLUMN     "vacation_to" DATE;

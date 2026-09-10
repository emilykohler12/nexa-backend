-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "mp_payment_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "mp_payment_id" VARCHAR(50),
ADD COLUMN     "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

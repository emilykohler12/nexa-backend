-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "balance_collected_by_id" UUID,
ADD COLUMN     "balance_paid_amount" DECIMAL(10,2),
ADD COLUMN     "balance_paid_at" TIMESTAMPTZ,
ADD COLUMN     "balance_payment_method" VARCHAR(20);

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_balance_collected_by_id_fkey" FOREIGN KEY ("balance_collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

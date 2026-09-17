-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "promotion_id" UUID;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

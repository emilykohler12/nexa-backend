-- DropIndex
DROP INDEX "professional_availability_professional_id_day_of_week_key";

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "end_date" VARCHAR(10),
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "start_date" VARCHAR(10);

-- CreateIndex
CREATE INDEX "professional_availability_professional_id_day_of_week_idx" ON "professional_availability"("professional_id", "day_of_week");

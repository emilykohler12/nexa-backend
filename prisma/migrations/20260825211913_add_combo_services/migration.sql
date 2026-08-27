-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "combo_group_id" UUID;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "combo_service_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "simultaneous" BOOLEAN NOT NULL DEFAULT false;

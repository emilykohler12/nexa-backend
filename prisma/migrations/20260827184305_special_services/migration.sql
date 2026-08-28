-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "selected_packages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "selected_zones" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "is_special" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "special_date" VARCHAR(10),
ADD COLUMN     "special_slots" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "zones" JSONB NOT NULL DEFAULT '[]';

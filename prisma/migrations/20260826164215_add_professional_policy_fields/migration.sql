-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "after_care" TEXT,
ADD COLUMN     "cancellation_policy" TEXT,
ADD COLUMN     "deposit_policy" TEXT,
ADD COLUMN     "late_penalty" TEXT,
ADD COLUMN     "prior_recommendations" TEXT,
ADD COLUMN     "reschedule_policy" TEXT,
ADD COLUMN     "tolerance_minutes" INTEGER;

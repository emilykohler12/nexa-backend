-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "previous_date" VARCHAR(10),
ADD COLUMN     "previous_time" VARCHAR(5),
ADD COLUMN     "reschedule_notice_pending" BOOLEAN NOT NULL DEFAULT false;

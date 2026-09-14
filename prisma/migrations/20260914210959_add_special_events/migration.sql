-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "special_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "title" VARCHAR(150),
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "special_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "special_events" ADD CONSTRAINT "special_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_events" ADD CONSTRAINT "special_events_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

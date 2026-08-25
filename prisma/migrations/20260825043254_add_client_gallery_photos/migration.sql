-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "client_gallery_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "category" VARCHAR(10) NOT NULL,
    "show_on_home" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_gallery_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_gallery_photos" ADD CONSTRAINT "client_gallery_photos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

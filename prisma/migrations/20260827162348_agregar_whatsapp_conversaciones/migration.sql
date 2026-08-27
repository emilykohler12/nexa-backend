-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "conversaciones_whatsapp" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "telefono" VARCHAR(20) NOT NULL,
    "estado_actual" VARCHAR(50) NOT NULL DEFAULT 'inicio',
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversaciones_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_whatsapp_procesados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wamid" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_whatsapp_procesados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_whatsapp_telefono_key" ON "conversaciones_whatsapp"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "mensajes_whatsapp_procesados_wamid_key" ON "mensajes_whatsapp_procesados"("wamid");

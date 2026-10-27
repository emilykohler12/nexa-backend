-- Sesiones por dispositivo: una fila por cada dispositivo con la sesión abierta, para que iniciar
-- sesión en el celular no cierre la renovación de la sesión de la compu. Reemplaza al token único
-- de users.refresh_token (esa columna se conserva por ahora para no desloguear a nadie; se vacía
-- sola a medida que las sesiones viejas se renuevan y se podrá quitar en una migración posterior).
-- Es aditiva: solo crea una tabla nueva. No borra ni modifica datos.

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "previous_token_hash" VARCHAR(64),
    "previous_valid_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

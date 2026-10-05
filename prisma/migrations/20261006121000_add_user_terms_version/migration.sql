-- RF-08: versión de la política de privacidad aceptada, junto a terms_accepted_at.
-- Las filas existentes quedan en NULL: aceptaron antes de que se guardara la
-- versión y no se les asigna una retroactivamente.
ALTER TABLE "users" ADD COLUMN "terms_version" VARCHAR(20);

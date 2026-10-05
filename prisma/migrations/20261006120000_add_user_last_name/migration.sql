-- RF-02: apellido en un campo propio. Columna nullable: las filas existentes
-- quedan en NULL (no se parte el nombre viejo en dos, no hay forma segura de
-- saber dónde termina el nombre y empieza el apellido).
ALTER TABLE "users" ADD COLUMN "last_name" VARCHAR(100);

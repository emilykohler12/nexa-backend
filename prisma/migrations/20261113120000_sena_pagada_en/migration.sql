-- Tablero del administrador: «Ingresos por señas confirmadas» tiene que sumar la seña el día en que se pagó, no el día
-- del turno (con «Hoy», una seña pagada hoy por un turno de la semana que viene no aparecía). Columna nueva nullable y
-- sin valor por defecto: en NULL el tablero sigue usando la fecha del turno, así que las señas ya registradas no
-- cambian. Solo AGREGA una columna; no borra ni modifica nada.
--
-- ORDEN: columna nueva nullable -> aplicar ANTES de desplegar el código.

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "deposit_paid_at" TIMESTAMPTZ;

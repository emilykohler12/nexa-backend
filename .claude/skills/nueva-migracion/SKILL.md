---
name: nueva-migracion
description: Cambios de prisma/schema.prisma seguros para datos reales (columnas nullable o con default, sin borrar en el mismo deploy), cómo generar la migración, probarla contra la base de pruebas con npm run test:migrate y documentarla. Usar siempre que haya que agregar o cambiar tablas, columnas, índices o enums.
disable-model-invocation: true
---

# Nueva migración de Prisma

La base de producción (Supabase) tiene datos de una clienta real y un push a `main` redespliega el backend. Una migración mal pensada rompe producción. Nunca se modifica una migración que ya existe (el hook lo bloquea): se crea una nueva.

## Reglas de seguridad para los datos

1. **Agregar es seguro, quitar no.** Columnas nuevas: `NULL` permitido o con `DEFAULT`. Una columna `NOT NULL` sin default falla en una tabla con filas. Si necesitás `NOT NULL`, hacelo en pasos: agregar nullable, rellenar los datos, y recién en una migración posterior pasarla a `NOT NULL`.
2. **No borrar ni renombrar en el mismo deploy en que el código deja de usarlo.** El backend viejo sigue corriendo mientras Render redespliega, y el frontend puede estar desfasado. Secuencia: (1) deploy que deja de usar la columna o tabla, (2) más tarde, otra migración que la elimina. Un renombre es agregar la nueva, copiar datos, migrar el código y borrar la vieja después.
3. **Cambios de tipo, nuevos `UNIQUE` y nuevos índices únicos** pueden fallar con datos existentes: antes verificá con una consulta que no hay duplicados ni valores que no entran.
4. **Enums**: agregar valores está bien; quitar o renombrar no.
5. **El índice único parcial de R-01** (`appointments_professional_date_time_active_key`) vive solo en el SQL de una migración, no en `schema.prisma`. No lo toques ni dejes que una migración generada lo elimine: revisá el SQL generado buscando `DROP INDEX`.
6. **Nada destructivo sin aviso.** Si la migración incluye `DROP`, `DELETE` o `TRUNCATE`, ponelo en un comentario al inicio del SQL (como en `20261006123000_drop_whatsapp_bot_tables`: "BORRA todas las filas…") y avisá a Emily antes de seguir.
7. Para tablas nuevas, sumala a `TABLES` en `tests/setup.ts` (si no, los tests no la truncan).

## Cómo generarla

Nunca contra la base de `.env` (es la real). Los hooks bloquean `prisma migrate` si no pueden asegurar que la base es la de pruebas.

1. Editá `prisma/schema.prisma`.
2. Generá el SQL sin aplicarlo, apuntando explícitamente a la base local de pruebas (el valor sale de tu `.env.test.example`; no leas `.env.test`):

   ```
   DATABASE_URL="postgresql://<usuario>:<clave>@localhost:5432/<base_de_pruebas>" npx prisma migrate dev --create-only --name <descripcion_corta_en_snake_case>
   ```

   Si `migrate dev` no puede usarse (base de pruebas sin permisos para la shadow database), escribí la carpeta a mano: `prisma/migrations/<AAAAMMDDHHMMSS>_<nombre>/migration.sql`, con el mismo formato de timestamp que las anteriores, y pasá el SQL por la revisión de abajo.
3. **Revisá el `migration.sql` generado** línea por línea: ¿hay `DROP`?, ¿`NOT NULL` sin default?, ¿se pierde el índice parcial de R-01?, ¿cambios de tipo? Ajustalo a mano si hace falta y agregá comentarios en español explicando el porqué, como en las migraciones existentes.

## Cómo probarla

1. `npm run test:migrate` (aplica con `.env.test`).
2. `npx prisma generate`.
3. `npm run typecheck:all`
4. `npm test`

Para probar que la migración funciona con filas ya existentes, cargá datos de prueba en la base local (`seed:demo` solo contra la base de pruebas, nunca la real) antes de aplicar la migración.

## Cómo llega a producción

El orden importa. Según tus notas de despliegue, el push a `main` redespliega Render, así que **la base de Supabase se migra antes del push**:

1. Revisá el SQL final con Emily.
2. Antes de aplicar, verificá el estado de la base con el script del repo, que **no** se conecta a nada y solo imprime SQL: `node scripts/migration-checksums.mjs`. Emily pega el resultado en el SQL Editor de Supabase (es un SELECT de solo lectura) y debe ver `OK` para todas las migraciones anteriores y `FALTA APLICAR` solo para la nueva.
3. Aplicá el SQL de la migración en el SQL Editor de Supabase (lo hace Emily; nunca desde esta sesión).
4. Registrala en `_prisma_migrations` para que Prisma no la considere pendiente: `node scripts/migration-checksums.mjs insert <nombre_de_la_migracion>` imprime el `INSERT` exacto (el `checksum` es el SHA-256 hexadecimal del `migration.sql` con saltos de línea LF). Emily lo corre **después** del paso 3. Alternativa oficial, si la conexión a la base lo permite: `DATABASE_URL=… npx prisma migrate resolve --applied <nombre_de_la_migracion>`.
5. Volvé a correr el SELECT del paso 2: tiene que dar todo `OK`.
6. Recién ahí, push a `main` (lo hace Emily).

Verificado el 2026-10-24 contra la base de pruebas: los 51 checksums que escribió Prisma coinciden con el SHA-256 de los `migration.sql`, y el `INSERT` generado reproduce la misma fila. Si un checksum no coincide, `prisma migrate deploy` solo **avisa** ("migrations have been modified since they were applied") y no falla, pero conviene corregirlo para que el aviso no quede.

Antes de migrar producción, que exista un backup reciente (workflow "Backup diario de la base de datos" en GitHub Actions, ver `00-gestion/RUNBOOK.md`).

## Cómo documentarla

- Comentario inicial en el `migration.sql` explicando el motivo y si borra algo.
- Entrada en `bitacora3.md` (o en la bitácora que corresponda) con fecha exacta y los seis elementos.
- Si cambia una regla de negocio de reservas, proponé actualizar el ADR-002 (no se edita `04-diseno/` sin pedido de Emily).
- Si cambia la forma de alguna respuesta de la API, seguí también la skill `cambio-de-contrato`.
- Mencionar la migración en el mensaje de commit (el commit lo pide Emily).

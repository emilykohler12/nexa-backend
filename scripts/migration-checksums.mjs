// scripts/migration-checksums.mjs
//
// Genera SQL para comparar o registrar las migraciones de Prisma en una base que se
// migra a mano (la de Supabase). NO se conecta a ninguna base: solo lee prisma/migrations
// y escribe SQL por pantalla, que se pega en el SQL Editor.
//
//   node scripts/migration-checksums.mjs
//       Imprime un SELECT de solo lectura que compara _prisma_migrations con las carpetas
//       del repo y resume: OK, FALTA APLICAR, CHECKSUM DISTINTO, INCOMPLETA, SOLO EN LA BASE.
//
//   node scripts/migration-checksums.mjs insert <nombre_de_migracion> [<otra> ...]
//       Imprime los INSERT para registrar en _prisma_migrations migraciones cuyo SQL ya se
//       corrió a mano. Hacerlo DESPUÉS de correr el SQL de la migración.
//
// El checksum que guarda Prisma es el SHA-256 (hexadecimal) del migration.sql. Se calcula
// sobre los bytes con saltos de línea LF, que es lo que tiene el repo en git y lo que va a
// leer Prisma en Render (Linux).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'prisma', 'migrations')

function checksumOf(name) {
  const file = path.join(migrationsDir, name, 'migration.sql')
  if (!existsSync(file)) throw new Error(`No existe ${path.relative(root, file)}`)
  const lf = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(lf).digest('hex')
}

const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(path.join(migrationsDir, d.name, 'migration.sql')))
  .map(d => d.name)
  .sort()

const [mode, ...args] = process.argv.slice(2)

if (mode === 'insert') {
  if (args.length === 0) {
    console.error('Uso: node scripts/migration-checksums.mjs insert <nombre_de_migracion> [...]')
    process.exit(1)
  }
  for (const name of args) {
    if (!names.includes(name)) {
      console.error(`La migración "${name}" no existe en prisma/migrations.`)
      process.exit(1)
    }
  }
  console.log('-- Correr DESPUÉS de ejecutar el SQL de cada migración.')
  for (const name of args) {
    console.log(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)\n` +
      `VALUES (gen_random_uuid()::text, '${checksumOf(name)}', now(), '${name}', now(), 1);`,
    )
  }
} else if (mode === undefined) {
  const values = names.map(n => `  ('${n}', '${checksumOf(n)}')`).join(',\n')
  console.log(`-- Solo lectura: compara _prisma_migrations con las ${names.length} migraciones del repo.
WITH esperado(migration_name, checksum) AS (VALUES
${values}
),
comparacion AS (
  SELECT
    COALESCE(e.migration_name, m.migration_name) AS migracion,
    CASE
      WHEN m.migration_name IS NULL THEN 'FALTA APLICAR'
      WHEN e.migration_name IS NULL THEN 'SOLO EN LA BASE'
      WHEN m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL THEN 'INCOMPLETA'
      WHEN m.checksum <> e.checksum THEN 'CHECKSUM DISTINTO'
      ELSE 'OK'
    END AS estado
  FROM esperado e
  FULL OUTER JOIN _prisma_migrations m ON m.migration_name = e.migration_name
)
SELECT estado, count(*) AS cantidad,
       string_agg(migracion, E'\\n' ORDER BY migracion) FILTER (WHERE estado <> 'OK') AS detalle
FROM comparacion
GROUP BY estado
ORDER BY estado;`)
} else {
  console.error('Modo desconocido. Usá sin argumentos, o "insert <nombre> ...".')
  process.exit(1)
}

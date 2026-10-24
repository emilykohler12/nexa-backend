// PreToolUse (Edit|Write|MultiEdit): impide tocar archivos que no se editan a mano.
//  - .env y .env.* (salvo los .example)
//  - package-lock.json
//  - dist/** y src/generated/**
//  - migraciones de Prisma ya existentes (crear una nueva sí se permite)
import { existsSync } from 'node:fs'
import path from 'node:path'
import { readInput, relPath, block } from './_lib.mjs'

const input = readInput()
const filePath = input.tool_input?.file_path
if (!filePath) process.exit(0)

const rel = relPath(input, filePath)
const base = path.posix.basename(rel)

if (/^\.env(\..+)?$/.test(base) && !base.endsWith('.example')) {
  block(`Bloqueado: ${rel} es un archivo de entorno con credenciales. Editá el .example correspondiente y cargá los valores reales vos a mano.`)
}

if (rel === 'package-lock.json') {
  block('Bloqueado: package-lock.json lo gestiona npm. Cambiá package.json y pedile a Emily que corra npm install.')
}

if (rel === 'dist' || rel.startsWith('dist/')) {
  block('Bloqueado: dist/ es salida de compilación. Editá el código en src/ y volvé a correr npm run build.')
}

if (rel.startsWith('src/generated/')) {
  block('Bloqueado: src/generated/ lo genera Prisma. Cambiá prisma/schema.prisma y corré npx prisma generate.')
}

if (rel.startsWith('prisma/migrations/')) {
  const abs = path.resolve(input.cwd || process.cwd(), filePath)
  if (existsSync(abs)) {
    block(`Bloqueado: ${rel} es una migración que ya existe y puede estar aplicada en Supabase. Creá una migración nueva en lugar de modificarla (skill nueva-migracion).`)
  }
}

process.exit(0)

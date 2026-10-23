// PreToolUse (Bash|PowerShell): frena comandos que pueden romper producción.
//  - git push --force / -f / --force-with-lease / +refspec
//  - git push a main (un push a main redespliega el backend en Render)
//  - prisma migrate reset, prisma db push --force-reset
//  - prisma migrate deploy|dev y db push cuando no se puede asegurar que la base es la de pruebas
import { execFileSync } from 'node:child_process'
import { readInput, block } from './_lib.mjs'

const input = readInput()
const cmd = input.tool_input?.command
if (typeof cmd !== 'string') process.exit(0)

// Se analiza cada sub-comando por separado (separados por ; && || | o salto de línea).
const parts = cmd.split(/&&|\|\||[;|\n]/).map(s => s.trim()).filter(Boolean)

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: input.cwd || process.cwd(), encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

// Una base "de pruebas" es local y con "test" en el nombre.
function isTestDb(url) {
  return typeof url === 'string' && /(localhost|127\.0\.0\.1|\[::1\])/.test(url) && /test/i.test(url)
}

for (const part of parts) {
  // ---- git push ----
  if (/\bgit\b.*\bpush\b/.test(part)) {
    if (/(^|\s)(--force|-f|--force-with-lease(=\S+)?|--force-if-includes)(\s|$)/.test(part) || /\s\+\S+/.test(part.replace(/^.*\bpush\b/, ''))) {
      block('Bloqueado: git push con force. Reescribir el historial remoto puede pisar commits del repo que despliega la clienta. Si es imprescindible, hacelo vos desde tu terminal.')
    }
    const args = part.replace(/^.*\bpush\b/, '').split(/\s+/).filter(a => a && !a.startsWith('-'))
    const mentionsMain = args.some(a => /(^|:)(main|master)$/.test(a))
    const branch = currentBranch()
    const noRefspec = args.length <= 1 // vacío o solo el remoto
    const headOnMain = args.includes('HEAD') && branch === 'main'
    if (mentionsMain || headOnMain || (noRefspec && (branch === 'main' || branch === null))) {
      block(`Bloqueado: este push va a main (rama actual: ${branch ?? 'desconocida'}) y un push a main redespliega el backend en Render. Trabajá en una rama y pusheá esa (git push -u origin <rama>), o hacé el push a main vos desde tu terminal después de migrar Supabase si hay migraciones.`)
    }
  }

  // ---- prisma ----
  if (/\bprisma\b/.test(part)) {
    if (/\bmigrate\s+reset\b/.test(part)) {
      block('Bloqueado: prisma migrate reset borra todos los datos de la base que apunte DATABASE_URL (puede ser la de producción). Para la base de pruebas, truncá desde tests/setup.ts o recreala a mano.')
    }
    if (/\bdb\s+push\b/.test(part) && /--force-reset/.test(part)) {
      block('Bloqueado: prisma db push --force-reset borra todos los datos de la base.')
    }
    if (/\bmigrate\s+(deploy|dev)\b/.test(part) || /\bdb\s+push\b/.test(part)) {
      const inline = part.match(/DATABASE_URL=("([^"]*)"|'([^']*)'|(\S+))/)
      const inlineUrl = inline ? (inline[2] ?? inline[3] ?? inline[4]) : null
      const url = inlineUrl ?? process.env.DATABASE_URL
      if (!isTestDb(url)) {
        block('Bloqueado: no puedo asegurar que prisma apunte a la base de pruebas. Prisma lee .env por defecto (que es la base real) y este hook no lo abre. Para migrar la base de pruebas usá `npm run test:migrate` (carga .env.test), o anteponé DATABASE_URL="postgresql://…localhost…test…" al comando. La base de Supabase se migra a mano (SQL Editor), nunca desde acá.')
      }
    }
  }
}

process.exit(0)

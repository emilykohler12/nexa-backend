// PreToolUse (Bash|PowerShell): frena comandos que pueden romper producción o saltarse
// la protección de archivos.
//  - git push con force y git push a main (un push a main redespliega el backend en Render)
//  - prisma migrate reset, prisma db push --force-reset
//  - prisma migrate deploy|dev y db push si no se puede asegurar que la base es la de pruebas
//  - leer o escribir .env / .env.* (salvo .example) desde la terminal
//  - escribir package-lock.json, dist/, src/generated/ o migraciones ya existentes desde la terminal
//    (sed -i, redirecciones, tee, rm, mv, cp, Set-Content, etc.)
//
// El comando se analiza por tramos (separados por ; && || | salto de línea fuera de comillas).
// El texto de heredocs, here-strings de PowerShell, echo/printf y mensajes de git commit se
// trata como dato y no dispara reglas; el contenido de `bash -c "..."` sí se analiza.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { readInput, block } from './_lib.mjs'

const input = readInput()
const cmd = input.tool_input?.command
if (typeof cmd !== 'string') process.exit(0)
const cwd = input.cwd || process.cwd()

// ---------- preparación del texto ----------

// Quita el cuerpo de here-strings de PowerShell (@' … '@) y de heredocs (<<EOF … EOF).
// Se conserva el cuerpo del heredoc solo si lo ejecuta un intérprete (bash <<EOF).
function stripBodies(text) {
  text = text.replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, '@""@')
  const out = []
  let tag = null
  let keep = false
  for (const line of text.split('\n')) {
    if (tag !== null) {
      if (line.trim() === tag) tag = null
      else if (keep) out.push(line)
      continue
    }
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1/)
    if (m) {
      tag = m[2]
      keep = /^\s*(?:\S+=\S*\s+)*(?:(?:ba|z|da|k)?sh|pwsh|powershell)\b/i.test(line)
    }
    out.push(line)
  }
  return out.join('\n')
}

// Parte en tramos respetando comillas.
function splitSegments(text) {
  const segs = []
  let cur = ''
  let q = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      cur += c
      if (c === '\\' && q === '"') cur += text[++i] ?? ''
      else if (c === q) q = null
      continue
    }
    if (c === '"' || c === "'") { q = c; cur += c; continue }
    if (c === ';' || c === '\n' || c === '|' || c === '&') {
      if (c === '&' && (cur.endsWith('>') || text[i + 1] === '>')) { cur += c; continue } // 2>&1, &>
      segs.push(cur)
      cur = ''
      if ((c === '&' || c === '|') && text[i + 1] === c) i++
      continue
    }
    cur += c
  }
  segs.push(cur)
  return segs.map(s => s.trim()).filter(Boolean)
}

function commandWord(seg) {
  for (const t of seg.split(/\s+/)) {
    if (/^[A-Za-z_]\w*=/.test(t)) continue // VAR=valor antepuesto
    return t.replace(/^["'(]+/, '').toLowerCase()
  }
  return ''
}

const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/g

// Los argumentos de echo/printf y los mensajes de commit son texto, no comandos.
function dropData(seg) {
  const w = commandWord(seg)
  if (['echo', 'printf', 'write-host', 'write-output'].includes(w)) {
    // El texto va antes de la primera redirección: el destino de ">" sí se analiza.
    let q = null
    let cut = seg.length
    for (let i = 0; i < seg.length; i++) {
      const c = seg[i]
      if (q) { if (c === q) q = null; continue }
      if (c === '"' || c === "'") { q = c; continue }
      if (c === '>') { cut = i; break }
    }
    return seg.slice(0, cut).replace(QUOTED, '""') + seg.slice(cut)
  }
  if (w === 'git' && /\bcommit\b|\btag\b/.test(seg)) {
    return seg.replace(/(?<![-\w])(-[A-Za-z]*m|--message)(=|\s+)("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g, '$1 ""')
  }
  return seg
}

// ---------- utilidades ----------

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// Una base "de pruebas" es local y con "test" en el nombre.
function isTestDb(url) {
  return typeof url === 'string' && /(localhost|127\.0\.0\.1|\[::1\])/.test(url) && /test/i.test(url)
}

const cleanTok = t => t.replace(/^[("'`]+|[)"'`;,]+$/g, '').replace(/\\/g, '/')

function normalize(tok) {
  let p = cleanTok(tok)
  const root = cwd.replace(/\\/g, '/').replace(/\/$/, '')
  if (p.toLowerCase().startsWith(root.toLowerCase() + '/')) p = p.slice(root.length + 1)
  return p.replace(/^\.\//, '')
}

const isEnvFile = p => {
  const b = path.posix.basename(p)
  return /^\.env(\..+)?$/.test(b) && !b.endsWith('.example')
}
const isLock = p => path.posix.basename(p) === 'package-lock.json'
const isDist = p => /(^|\/)dist(\/|$)/.test(p)
const isGenerated = p => /(^|\/)src\/generated(\/|$)/.test(p)
const isMigrationPath = p => /(^|\/)prisma\/migrations(\/|$)/.test(p)

const WRITE_WORD = /(^|[\s(])(rm|del|erase|rd|rmdir|unlink|remove-item|ri|mv|move|ren|rename|move-item|rename-item|cp|copy|copy-item|tee|truncate|set-content|add-content|out-file|clear-content|new-item|ni|sc|ac)(\s|$)/i
const DELETE_ONLY_OK = /(^|[\s(])(rm|del|erase|rd|rmdir|unlink|remove-item|ri)(\s|$)/i
const SED_INPLACE = /\b(sed|perl)\b[^|;&]*\s(-[A-Za-z]*i[A-Za-z]*\b|--in-place)/i

function redirectTargets(seg) {
  const out = []
  for (const m of seg.matchAll(/(?:^|[^0-9&>])>>?\s*(["']?)([^\s"'|&;)]+)\1/g)) {
    if (!/^(\/dev\/null|nul|\$null)$/i.test(m[2])) out.push(normalize(m[2]))
  }
  return out
}

// Comandos que solo miran el entorno sin abrir el contenido.
const ENV_SAFE_WORDS = new Set(['git', 'ls', 'dir', 'll', 'get-childitem', 'gci', 'test-path', 'stat', 'test', '[', 'file'])

// ---------- análisis ----------

const segments = splitSegments(stripBodies(cmd)).map(dropData)

for (const seg of segments) {
  const word = commandWord(seg)
  const tokens = seg.split(/\s+/).map(normalize).filter(Boolean)
  const redirs = redirectTargets(seg)
  const writes = WRITE_WORD.test(seg) || SED_INPLACE.test(seg)

  // ---- .env desde la terminal ----
  const envTouched = [...tokens, ...redirs].some(isEnvFile)
  if (envTouched && !ENV_SAFE_WORDS.has(word)) {
    block('Bloqueado: este comando lee o escribe un archivo .env / .env.* (credenciales reales de base, JWT, Mercado Pago, Supabase y Sentry). No se abren desde la terminal. Usá los .example, y si necesitás cambiar un valor, hacelo vos a mano. Para migrar la base de pruebas usá `npm run test:migrate`.')
  }

  // ---- escrituras a archivos protegidos ----
  if (redirs.some(isLock) || (writes && tokens.some(isLock))) {
    block('Bloqueado: package-lock.json lo gestiona npm. Cambiá package.json y pedile a Emily que corra npm install.')
  }
  const buildTarget = p => isDist(p) || isGenerated(p)
  const writesNoDelete = redirs.some(buildTarget) || ((writes && !DELETE_ONLY_OK.test(seg) || SED_INPLACE.test(seg)) && tokens.some(buildTarget))
  if (writesNoDelete) {
    block('Bloqueado: dist/ es salida de compilación y src/generated/ lo genera Prisma. No se escriben a mano desde la terminal: corré npm run build o npx prisma generate.')
  }
  const migTouched = [...tokens, ...redirs].filter(isMigrationPath).some(p => existsSync(path.resolve(cwd, p)))
  if (migTouched && (writes || redirs.some(isMigrationPath))) {
    block('Bloqueado: este comando modifica o borra una migración de Prisma que ya existe y puede estar aplicada en Supabase. Creá una migración nueva (skill nueva-migracion).')
  }

  // ---- git push ----
  if (/\bgit\b/.test(seg) && /\bpush\b/.test(seg)) {
    const afterPush = seg.replace(/^.*?\bpush\b/, '')
    if (/(^|\s)(--force|-f|--force-with-lease(=\S+)?|--force-if-includes)(?=$|[\s'"`;)])/.test(afterPush) || /\s\+\S+/.test(afterPush)) {
      block('Bloqueado: git push con force. Reescribir el historial remoto puede pisar commits del repo que despliega la clienta. Si es imprescindible, hacelo vos desde tu terminal.')
    }
    const args = afterPush.split(/\s+/).map(cleanTok).filter(a => a && !a.startsWith('-'))
    const mentionsMain = args.some(a => /(^|:)(main|master)$/.test(a))
    const branch = currentBranch()
    const noRefspec = args.length <= 1 // vacío o solo el remoto
    const headOnMain = args.includes('HEAD') && branch === 'main'
    if (mentionsMain || headOnMain || (noRefspec && (branch === 'main' || branch === null))) {
      block(`Bloqueado: este push va a main (rama actual: ${branch ?? 'desconocida'}) y un push a main redespliega el backend en Render. Trabajá en una rama y pusheá esa (git push -u origin <rama>), o hacé el push a main vos desde tu terminal después de migrar Supabase si hay migraciones.`)
    }
  }

  // ---- prisma ----
  if (/\bprisma\b/.test(seg)) {
    if (/\bmigrate\s+reset\b/.test(seg)) {
      block('Bloqueado: prisma migrate reset borra todos los datos de la base que apunte DATABASE_URL (puede ser la de producción). Para la base de pruebas, truncá desde tests/setup.ts o recreala a mano.')
    }
    if (/\bdb\s+push\b/.test(seg) && /--force-reset/.test(seg)) {
      block('Bloqueado: prisma db push --force-reset borra todos los datos de la base.')
    }
    if (/\bmigrate\s+(deploy|dev)\b/.test(seg) || /\bdb\s+push\b/.test(seg)) {
      const inline = seg.match(/DATABASE_URL=("([^"]*)"|'([^']*)'|(\S+))/)
      const inlineUrl = inline ? (inline[2] ?? inline[3] ?? inline[4]) : null
      const url = inlineUrl ?? process.env.DATABASE_URL
      if (!isTestDb(url)) {
        block('Bloqueado: no puedo asegurar que prisma apunte a la base de pruebas. Prisma lee .env por defecto (que es la base real) y este hook no lo abre. Para migrar la base de pruebas usá `npm run test:migrate` (carga .env.test), o anteponé DATABASE_URL="postgresql://…localhost…test…" al comando. La base de Supabase se migra a mano (SQL Editor), nunca desde acá.')
      }
    }
  }
}

process.exit(0)

// PostToolUse (Edit|Write|MultiEdit): si se tocó un .ts de src/ o tests/, corre tsc
// y muestra solo los errores de ese archivo. Usa tsconfig.test.json porque cubre
// src/ y tests/ juntos (unos 2 s en este proyecto).
import { spawnSync } from 'node:child_process'
import { readInput, relPath } from './_lib.mjs'

const input = readInput()
const filePath = input.tool_input?.file_path
if (!filePath) process.exit(0)

const rel = relPath(input, filePath)
if (!/\.ts$/.test(rel) || !/^(src|tests)\//.test(rel)) process.exit(0)

const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.test.json', '--noEmit', '--pretty', 'false'], {
  cwd: input.cwd || process.cwd(),
  encoding: 'utf8',
  shell: true,
  timeout: 120_000,
})

const lines = `${run.stdout || ''}\n${run.stderr || ''}`.split(/\r?\n/)
const mine = []
let keep = false
for (const line of lines) {
  if (/^\S.*\(\d+,\d+\): error TS/.test(line)) keep = line.replace(/\\/g, '/').startsWith(rel + '(')
  else if (!/^\s/.test(line)) keep = false
  if (keep) mine.push(line)
}

if (mine.length === 0) process.exit(0)

process.stderr.write(`Errores de TypeScript en ${rel}:\n${mine.join('\n')}\n`)
process.exit(2)

// Utilidades compartidas por los hooks de Claude Code de este proyecto.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

// Ruta relativa a la raíz del proyecto, con "/" como separador.
export function relPath(input, filePath) {
  const root = input.cwd || process.cwd()
  const abs = path.resolve(root, filePath || '')
  return path.relative(root, abs).split(path.sep).join('/')
}

// Bloquea la herramienta: el mensaje de stderr le llega a Claude.
export function block(message) {
  process.stderr.write(message + '\n')
  process.exit(2)
}

// Pide confirmación a la usuaria antes de seguir (no bloquea del todo).
export function ask(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }))
  process.exit(0)
}

// Todo el texto nuevo que una llamada Edit / Write / MultiEdit quiere escribir.
export function newContent(toolInput = {}) {
  const parts = []
  if (typeof toolInput.content === 'string') parts.push(toolInput.content)
  if (typeof toolInput.new_string === 'string') parts.push(toolInput.new_string)
  if (Array.isArray(toolInput.edits)) {
    for (const e of toolInput.edits) if (typeof e?.new_string === 'string') parts.push(e.new_string)
  }
  return parts.join('\n')
}

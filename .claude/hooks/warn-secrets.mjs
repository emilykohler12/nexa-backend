// PreToolUse (Edit|Write|MultiEdit): avisa (pide confirmación) si el texto nuevo parece
// traer un secreto real. No bloquea del todo: puede ser un falso positivo.
import { readInput, newContent, ask } from './_lib.mjs'

const input = readInput()
const text = newContent(input.tool_input)
if (!text) process.exit(0)

const findings = []

if (/APP_USR-[A-Za-z0-9-]{12,}/.test(text) || /\bTEST-[0-9]{8,}-[0-9]{6}-[0-9a-f]{20,}/.test(text)) {
  findings.push('token de Mercado Pago (APP_USR-… / TEST-…)')
}
if (/\bsb_(secret|publishable)_[A-Za-z0-9_-]{16,}/.test(text) || /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/.test(text)) {
  findings.push('JWT largo o clave de Supabase (anon/service_role)')
}
if (/\bhttps:\/\/[a-z0-9]{20}\.supabase\.co\b/.test(text) && /(service_role|SERVICE_ROLE)/.test(text)) {
  findings.push('URL de Supabase junto a una clave service_role')
}

// postgresql://usuario:clave@host: se ignoran hosts locales, claves de ejemplo y el CI (postgres:postgres).
const placeholder = /^(postgres|password|pass|contrase[nñ]a|clave|secret|changeme|xxx+|\*+|<.*>|\$\{.*\}|\[.*\]|your[-_ ]?password)$/i
for (const m of text.matchAll(/postgres(?:ql)?:\/\/([^:\s/@]+):([^@\s]+)@([^\s/:?"'`]+)/g)) {
  const [, , pass, host] = m
  if (/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(host)) continue
  if (placeholder.test(pass)) continue
  findings.push(`cadena postgresql:// con contraseña para el host ${host}`)
}

if (findings.length === 0) process.exit(0)

ask(`Posible secreto real en el contenido nuevo: ${[...new Set(findings)].join('; ')}. Los secretos van en .env (que no se versiona), no en el código. ¿Es un valor de ejemplo o de prueba?`)

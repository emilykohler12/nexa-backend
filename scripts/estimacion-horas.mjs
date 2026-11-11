// scripts/estimacion-horas.mjs
//
// Cuenta commits de los DOS repositorios (backend y frontend) y cuántos llevan la línea Co-Authored-By: Claude.
// Solo LEE (git log) e IMPRIME por consola: no escribe archivos ni calcula horas.
// Las horas de desarrollo (cifra única, 424) salen de otro método y están en docs/estimacion-horas.md.
//
// Uso: node scripts/estimacion-horas.mjs [--backend <ref,ref>] [--frontend <ref,ref>] [--frontend-dir ../nexa-frontend]
// Por defecto:
//   backend:  origin/main + HEAD
//   frontend: origin/main + las ramas remotas que todavía no están en origin/main
// Hacer `git fetch` en los dos repositorios antes de correrlo.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const BACK_DIR = process.cwd()
const FRONT_DIR = path.resolve(args['frontend-dir'] ?? '../nexa-frontend')
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()

const backRefs = args.backend ? args.backend.split(',') : ['origin/main', 'HEAD']
const frontRefs = args.frontend
  ? args.frontend.split(',')
  : [...new Set(['origin/main', ...git(FRONT_DIR, 'branch', '-r', '--no-merged', 'origin/main').split('\n').map(s => s.trim()).filter(s => s && !s.includes('->'))])]

const MARK = /^Co-Authored-By:\s*Claude/im
function commits(dir, repo, refs) {
  const raw = git(dir, 'log', '--no-merges', '--format=%H%x1f%aI%x1f%B%x1e', ...refs)
  return raw.split('\x1e').map(s => s.trim()).filter(Boolean).map(rec => {
    const [hash, iso, body] = rec.split('\x1f')
    return { repo, hash: hash.slice(0, 7), t: new Date(iso).getTime(), claude: MARK.test(body ?? '') }
  })
}

const ART = -3 * 3600 * 1000 // Argentina, UTC-3 sin horario de verano
const fmt = t => new Date(t + ART).toISOString().slice(0, 16).replace('T', ' ')
const day = t => fmt(t).slice(0, 10)
const all = [...commits(BACK_DIR, 'backend', backRefs), ...commits(FRONT_DIR, 'frontend', frontRefs)].sort((a, b) => a.t - b.t)
const pct = (n, d) => (100 * n / d).toFixed(1).replace('.', ',')

const PERIODS = [
  ['Hasta el 24/09/2026', d => d <= '2026-09-24'],
  ['Del 25/09 al 29/10/2026', d => d > '2026-09-24' && d <= '2026-10-29'],
  ['Desde el 30/10/2026 (AE4)', d => d > '2026-10-29']
]
const count = (repo, f = () => true) => all.filter(c => c.repo === repo && f(day(c.t)))

const nBack = count('backend').length
const nFront = count('frontend').length
const marked = all.filter(c => c.claude)

console.log(`Referencias del backend: ${backRefs.join(', ')}`)
console.log(`Referencias del frontend: ${frontRefs.join(', ')}`)
console.log(`Commits sin merges. Backend: ${nBack}. Frontend: ${nFront}. Total: ${all.length}.`)
console.log(`Primer commit: ${fmt(all[0].t)} (hora de Argentina).`)
console.log(`Con la línea Co-Authored-By: Claude: ${marked.length} de ${all.length} (${pct(marked.length, all.length)} %): ${marked.filter(c => c.repo === 'backend').length} de ${nBack} en el backend y ${marked.filter(c => c.repo === 'frontend').length} de ${nFront} en el frontend.`)
console.log('\n| Período (fecha de autor) | Backend | Frontend |\n|---|---|---|')
for (const [name, f] of PERIODS) {
  const cell = repo => { const l = count(repo, f); return `${l.filter(c => c.claude).length} de ${l.length}` }
  console.log(`| ${name} | ${cell('backend')} | ${cell('frontend')} |`)
}

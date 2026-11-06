// scripts/estimacion-horas.mjs
//
// Estimación de horas de desarrollo a partir de los commits de los DOS repositorios (backend y frontend).
// Solo LEE (git log); no cambia nada del historial. Genera docs/estimacion-horas.md y docs/estimacion-horas.csv.
//
// Uso: node scripts/estimacion-horas.mjs [--backend <ref,ref>] [--frontend <ref,ref>] [--frontend-dir ../nexa-frontend]
// Por defecto:
//   backend:  origin/main + HEAD (la rama de trabajo, o sea los pull requests abiertos)
//   frontend: origin/main + origin/integracion-ae4 + las ramas remotas que todavía no están en origin/main
// Hacer `git fetch` en los dos repositorios antes de correrlo.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const BACK_DIR = process.cwd()
const FRONT_DIR = path.resolve(args['frontend-dir'] ?? '../nexa-frontend')
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()

function refsFor(dir, given, defaults) {
  if (given) return given.split(',')
  const list = defaults(dir)
  return list
}
const backRefs = refsFor(BACK_DIR, args.backend, () => ['origin/main', 'HEAD'])
const frontRefs = refsFor(FRONT_DIR, args.frontend, dir => {
  const unmerged = git(dir, 'branch', '-r', '--no-merged', 'origin/main').split('\n').map(s => s.trim()).filter(s => s && !s.includes('->'))
  return [...new Set(['origin/main', 'origin/integracion-ae4', ...unmerged])]
})

const MARK = /^Co-Authored-By:\s*Claude/im
function commits(dir, repo, refs) {
  const raw = git(dir, 'log', '--no-merges', '--date-order', '--format=%H%x1f%aI%x1f%an%x1f%B%x1e', ...refs)
  return raw.split('\x1e').map(s => s.trim()).filter(Boolean).map(rec => {
    const [hash, iso, author, body] = rec.split('\x1f')
    const t = new Date(iso).getTime()
    return { repo, hash: hash.slice(0, 7), t, author, claude: MARK.test(body ?? '') }
  })
}
const cut = (dir, refs) => refs.map(r => `${r} ${git(dir, 'rev-parse', '--short', r)} (${git(dir, 'log', '-1', '--format=%cI', r)})`)

const all = [...commits(BACK_DIR, 'backend', backRefs), ...commits(FRONT_DIR, 'frontend', frontRefs)]
  .sort((a, b) => a.t - b.t)
// Un mismo commit puede aparecer por más de una rama: git log ya lo deduplica dentro de cada repositorio.

const ART = -3 * 3600 * 1000 // Argentina, UTC-3 sin horario de verano
const art = t => new Date(t + ART)
const pad = n => String(n).padStart(2, '0')
const fmt = t => { const d = art(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
const day = t => fmt(t).slice(0, 10)
const month = t => fmt(t).slice(0, 7)

const PRIOR = 30 * 60 * 1000
function sessionsFor(gapMin) {
  const out = []
  for (const c of all) {
    const last = out[out.length - 1]
    if (last && c.t - last.end <= gapMin * 60 * 1000) { last.end = c.t; last.commits.push(c) }
    else out.push({ start: c.t, end: c.t, commits: [c] })
  }
  return out.map(s => ({ ...s, hours: (s.end - s.start + PRIOR) / 3600000, claude: s.commits.some(c => c.claude) }))
}
const GAPS = [60, 90, 120]
const S = Object.fromEntries(GAPS.map(g => [g, sessionsFor(g)]))
const sum = (a, f = x => x.hours) => a.reduce((n, x) => n + f(x), 0)
const h1 = n => n.toFixed(1).replace('.', ',')

const sprint = d => d <= '2026-09-03' ? 'Sprint 1 (hasta el 03/09)' : d <= '2026-10-01' ? 'Sprint 2 (04/09 al 01/10)' : d <= '2026-10-29' ? 'Sprint 3 (02/10 al 29/10)' : 'Después del sprint 3 (desde el 30/10)'
const SPRINTS = ['Sprint 1 (hasta el 03/09)', 'Sprint 2 (04/09 al 01/10)', 'Sprint 3 (02/10 al 29/10)', 'Después del sprint 3 (desde el 30/10)']
const byKey = (sess, key) => { const m = new Map(); for (const s of sess) { const k = key(s); m.set(k, [...(m.get(k) ?? []), s]) } return m }

const nBack = all.filter(c => c.repo === 'backend').length
const nFront = all.length - nBack
const marked = all.filter(c => c.claude)
const period = (c) => { const d = day(c.t); return d <= '2026-09-24' ? 'Hasta el 24/09/2026' : d <= '2026-10-29' ? 'Del 25/09 al 29/10/2026' : 'Desde el 30/10/2026 (AE4)' }
const PERIODS = ['Hasta el 24/09/2026', 'Del 25/09 al 29/10/2026', 'Desde el 30/10/2026 (AE4)']

const first = all[0], last = all[all.length - 1]
const today = day(Date.now())
const t90 = S[90], over10 = g => S[g].filter(s => s.hours > 10).length

let md = `# Estimación de horas de desarrollo

Estimación **a partir de los commits**, hecha solo con lectura de los dos repositorios (\`git log\`), sin cambiar nada del historial. No es un registro de horas: la autora no llevó registro de horas por función (libro de requisitos v7, hoja «Iteraciones»). La tabla de sesiones está en \`docs/estimacion-horas.csv\`. Se regenera con \`node scripts/estimacion-horas.mjs\` (versionado) después de un \`git fetch\` en los dos repositorios.

## Corte de los datos

Calculado el **${today}** (hora de Argentina). Entran los commits alcanzables desde estas referencias, que incluyen lo mergeado **y** el trabajo que todavía está en ramas o pull requests abiertos:

| Repositorio | Referencia | Commit de corte (hash abreviado y fecha del commit) |
|---|---|---|
${[['backend', BACK_DIR, backRefs], ['frontend', FRONT_DIR, frontRefs]].flatMap(([n, d, r]) => cut(d, r).map(x => { const [ref, hash, ...date] = x.split(' '); return `| ${n} | \`${ref}\` | \`${hash}\` ${date.join(' ').replace(/[()]/g, '')} |` })).join('\n')}

- **Backend** (\`nexa-backend\`): **${nBack} commits** sin merges. \`HEAD\` es la rama \`chore/cierre-final\` (el pull request abierto que trae esta misma estimación): su propio commit de estimación no se cuenta.
- **Frontend** (\`nexa-frontend\`): **${nFront} commits** sin merges. Incluye \`integracion-ae4\` y las ramas remotas que todavía no están en \`main\`. Los pull requests 28, 29 y 30 del backend y el 20 del frontend ya están mergeados y por eso entran vía \`main\`.
- **Sin merges ni bots.** Se sacaron los merges (\`--no-merges\`). No hay commits de bots: todos tienen como autora a Emily Kohler; los que registró GitHub (ediciones del README desde la web) se cuentan como trabajo de la autora.
- **Afuera:** lo que no está en ninguna de esas referencias (por ejemplo ramas locales borradas), porque contarlo duplicaría trabajo que entró a \`main\` por otros commits.
- **Hora:** la fecha de **autor** de cada commit, pasada a hora de Argentina (UTC-3, sin horario de verano). Primer commit: ${fmt(first.t)}; último: ${fmt(last.t)}.
- Los commits de los dos repositorios van en **una sola línea de tiempo**, así una sesión en la que se trabajó en los dos a la vez cuenta una sola vez.

## Método

1. Se ordenan los ${all.length} commits por fecha de autor.
2. Dos commits consecutivos son de la **misma sesión** si entre uno y otro pasan **90 minutos o menos**. Se repite con **60** y con **120** minutos para dar un rango.
3. **Duración de una sesión** = último commit menos primer commit, más 30 minutos de trabajo previo al primer commit. Una sesión de un solo commit vale 30 minutos.
4. Cada sesión se asigna al día (en hora de Argentina) de su **primer** commit: una sesión que pasa la medianoche o el cierre de un sprint cuenta entera en el día en que empezó.
5. Se marcan **para revisar** las sesiones de más de 10 horas.
6. **Claude Code:** un commit se cuenta «con Claude Code» si su mensaje tiene una línea \`Co-Authored-By: Claude …\`. Se informa el porcentaje de commits con esa línea y el de horas de las sesiones que tienen al menos un commit con ella.

## Totales

| | 60 min | 90 min | 120 min |
|---|---|---|---|
| Sesiones | ${GAPS.map(g => S[g].length).join(' | ')} |
| Horas estimadas | ${GAPS.map(g => h1(sum(S[g]))).join(' | ')} |
| Sesiones de más de 10 horas (para revisar) | ${GAPS.map(g => over10(g)).join(' | ')} |
| Horas de sesiones con al menos un commit con la marca de Claude Code | ${GAPS.map(g => { const c = sum(S[g].filter(s => s.claude)); return `${h1(c)} (${h1(100 * c / sum(S[g]))} %)` }).join(' | ')} |

**Rango: de ${h1(sum(S[60]))} a ${h1(sum(S[120]))} horas; ${h1(sum(S[90]))} con el umbral de 90 minutos.**

**Commits con la marca \`Co-Authored-By: Claude\`:** ${marked.length} de ${all.length} (${h1(100 * marked.length / all.length)} %): ${marked.filter(c => c.repo === 'backend').length} de ${nBack} en el backend y ${marked.filter(c => c.repo === 'frontend').length} de ${nFront} en el frontend. La línea no se puso de forma pareja:

| Período (fecha de autor) | Backend | Frontend |
|---|---|---|
${PERIODS.map(p => { const f = r => { const l = all.filter(c => c.repo === r && period(c) === p); return `${l.filter(c => c.claude).length} de ${l.length}` }; return `| ${p} | ${f('backend')} | ${f('frontend')} |` }).join('\n')}

Por eso este porcentaje **subestima** el uso de Claude Code: desde el 25/09/2026 se dejó de agregar la línea casi siempre (README, sección 8.2). Según la sección 8.2 del README, casi todos los commits que no son merges, ediciones web ni los primeros de agosto los hizo Claude Code; esa cifra no sale de las marcas y no se usa acá.

## Por sprint

| Sprint | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
${SPRINTS.map(n => { const f = g => h1(sum(S[g].filter(s => sprint(day(s.start)) === n))); return `| ${n} | ${t90.filter(s => sprint(day(s.start)) === n).length} | ${f(60)} | ${f(90)} | ${f(120)} |` }).join('\n')}

## Por mes

| Mes | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
${[...byKey(t90, s => month(s.start)).keys()].sort().map(m => { const f = g => h1(sum(S[g].filter(s => month(s.start) === m))); return `| ${m} | ${t90.filter(s => month(s.start) === m).length} | ${f(60)} | ${f(90)} | ${f(120)} |` }).join('\n')}
`
writeFileSync(path.join(BACK_DIR, 'docs/estimacion-horas.md'), md)

const csv = ['sesion,inicio,fin,commits_backend,commits_frontend,horas_60,horas_90,horas_120,con_marca_claude']
t90.forEach((s, i) => {
  const at = (g) => { const x = S[g].find(q => q.start <= s.start && q.end >= s.start); return x ? x.hours.toFixed(2) : '' }
  csv.push([i + 1, fmt(s.start), fmt(s.end), s.commits.filter(c => c.repo === 'backend').length, s.commits.filter(c => c.repo === 'frontend').length, at(60), at(90), at(120), s.claude ? 'si' : 'no'].join(','))
})
writeFileSync(path.join(BACK_DIR, 'docs/estimacion-horas.csv'), csv.join('\n') + '\n')
console.log(`commits ${all.length} (backend ${nBack}, frontend ${nFront}); horas 60/90/120 = ${GAPS.map(g => h1(sum(S[g]))).join(' / ')}`)

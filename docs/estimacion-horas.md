# Estimación de horas de desarrollo

Estimación **a partir de los commits**, hecha solo con lectura de los dos repositorios (`git log`), sin cambiar nada del historial. No es un registro de horas: la autora no llevó registro de horas por función (libro de requisitos v7, hoja «Iteraciones»). La tabla de sesiones está en `docs/estimacion-horas.csv`. Se regenera con `node scripts/estimacion-horas.mjs` (versionado) después de un `git fetch` en los dos repositorios.

## Corte de los datos

Calculado el **2026-11-06** (hora de Argentina). Entran los commits alcanzables desde estas referencias, que incluyen lo mergeado **y** el trabajo que todavía está en ramas o pull requests abiertos:

| Repositorio | Referencia | Commit de corte (hash abreviado y fecha del commit) |
|---|---|---|
| backend | `origin/main` | `090f0db` 2026-11-05T23:06:13-03:00 |
| backend | `HEAD` | `d867e55` 2026-11-06T03:12:04-03:00 |
| frontend | `origin/main` | `ec35329` 2026-11-05T23:29:34-03:00 |
| frontend | `origin/integracion-ae4` | `703484f` 2026-11-05T17:05:35-03:00 |
| frontend | `origin/fix/fase-7-tienda-alergias-fechas` | `b172e82` 2026-11-05T22:56:16-03:00 |

- **Backend** (`nexa-backend`): **179 commits** sin merges. `HEAD` es la rama `chore/cierre-final` (el pull request abierto que trae esta misma estimación): su propio commit de estimación no se cuenta.
- **Frontend** (`nexa-frontend`): **124 commits** sin merges. Incluye `integracion-ae4` y las ramas remotas que todavía no están en `main`. Los pull requests 28, 29 y 30 del backend y el 20 del frontend ya están mergeados y por eso entran vía `main`.
- **Sin merges ni bots.** Se sacaron los merges (`--no-merges`). No hay commits de bots: todos tienen como autora a Emily Kohler; los que registró GitHub (ediciones del README desde la web) se cuentan como trabajo de la autora.
- **Afuera:** lo que no está en ninguna de esas referencias (por ejemplo ramas locales borradas), porque contarlo duplicaría trabajo que entró a `main` por otros commits.
- **Hora:** la fecha de **autor** de cada commit, pasada a hora de Argentina (UTC-3, sin horario de verano). Primer commit: 2026-08-25 16:43; último: 2026-11-06 03:12.
- Los commits de los dos repositorios van en **una sola línea de tiempo**, así una sesión en la que se trabajó en los dos a la vez cuenta una sola vez.

## Método

1. Se ordenan los 303 commits por fecha de autor.
2. Dos commits consecutivos son de la **misma sesión** si entre uno y otro pasan **90 minutos o menos**. Se repite con **60** y con **120** minutos para dar un rango.
3. **Duración de una sesión** = último commit menos primer commit, más 30 minutos de trabajo previo al primer commit. Una sesión de un solo commit vale 30 minutos.
4. Cada sesión se asigna al día (en hora de Argentina) de su **primer** commit: una sesión que pasa la medianoche o el cierre de un sprint cuenta entera en el día en que empezó.
5. Se marcan **para revisar** las sesiones de más de 10 horas.
6. **Claude Code:** un commit se cuenta «con Claude Code» si su mensaje tiene una línea `Co-Authored-By: Claude …`. Se informa el porcentaje de commits con esa línea y el de horas de las sesiones que tienen al menos un commit con ella.

## Totales

| | 60 min | 90 min | 120 min |
|---|---|---|---|
| Sesiones | 48 | 45 | 45 |
| Horas estimadas | 46,1 | 48,3 | 48,3 |
| Sesiones de más de 10 horas (para revisar) | 0 | 0 | 0 |
| Horas de sesiones con al menos un commit con la marca de Claude Code | 25,4 (55,1 %) | 26,1 (54,0 %) | 26,1 (54,0 %) |

**Rango: de 46,1 a 48,3 horas; 48,3 con el umbral de 90 minutos.**

**Commits con la marca `Co-Authored-By: Claude`:** 130 de 303 (42,9 %): 52 de 179 en el backend y 78 de 124 en el frontend. La línea no se puso de forma pareja:

| Período (fecha de autor) | Backend | Frontend |
|---|---|---|
| Hasta el 24/09/2026 | 27 de 33 | 32 de 37 |
| Del 25/09 al 29/10/2026 | 9 de 74 | 4 de 38 |
| Desde el 30/10/2026 (AE4) | 16 de 72 | 42 de 49 |

Por eso este porcentaje **subestima** el uso de Claude Code: desde el 25/09/2026 se dejó de agregar la línea casi siempre (README, sección 8.2). Según la sección 8.2 del README, casi todos los commits que no son merges, ediciones web ni los primeros de agosto los hizo Claude Code; esa cifra no sale de las marcas y no se usa acá.

## Por sprint

| Sprint | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
| Sprint 1 (hasta el 03/09) | 5 | 4,2 | 4,2 | 4,2 |
| Sprint 2 (04/09 al 01/10) | 16 | 18,8 | 20,1 | 20,1 |
| Sprint 3 (02/10 al 29/10) | 14 | 13,6 | 14,5 | 14,5 |
| Después del sprint 3 (desde el 30/10) | 10 | 9,5 | 9,5 | 9,5 |

## Por mes

| Mes | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
| 2026-08 | 4 | 3,6 | 3,6 | 3,6 |
| 2026-09 | 16 | 18,9 | 20,2 | 20,2 |
| 2026-10 | 20 | 17,9 | 18,9 | 18,9 |
| 2026-11 | 5 | 5,7 | 5,7 | 5,7 |

# Estimación de horas de desarrollo

Estimación **a partir de los commits**, hecha solo con lectura del repositorio (`git log`), sin cambiar nada del historial. No es un registro de horas: la autora no llevó registro de horas por función (libro de requisitos v7, hoja «Iteraciones»). La tabla de sesiones está en `docs/estimacion-horas.csv`.

## Datos

- **Backend** (`nexa-backend`): los commits alcanzables desde `main` en `4aa87d1` (después del merge del pull request 25, que integró `integracion-ae4`), sin merges: **163 commits**.
- **Frontend** (`nexa-frontend`): los commits alcanzables desde `main` en `7650a65` **o** desde `integracion-ae4` en `67a4c38`, sin merges: **103 commits**. Por decisión de Emily del 01/11/2026 entran todos los commits de la AE4 del frontend, aunque `integracion-ae4` del frontend todavía no está mergeada en su `main`.
- **Sin merges ni bots.** Se sacaron los merges (`--no-merges`). No hay commits de bots: todos tienen como autora a Emily Kohler; uno del frontend y uno del backend los registró GitHub (ediciones del README desde la web) y se cuentan como trabajo de la autora.
- **Afuera:** los commits que no están en ninguna de esas ramas, por ejemplo los dos de la rama local `feat/fase-4-tienda` del backend (`ac0ba11` y `41cd6c0`) y el de `feat/recordatorio-turno-mail` (`031e319`), cuyo contenido entró a `main` por otros commits: contarlos duplicaría trabajo.
- **Hora:** la fecha de **autor** de cada commit, pasada a hora de Argentina (UTC-3, sin horario de verano). Primer commit: 2026-08-25 16:43; último: 2026-11-01 15:20.
- Los commits de los dos repositorios van en **una sola línea de tiempo**, así una sesión en la que se trabajó en los dos a la vez cuenta una sola vez.

## Método

1. Se ordenan los 266 commits por fecha de autor.
2. Dos commits consecutivos son de la **misma sesión** si entre uno y otro pasan **90 minutos o menos**. Se repite con **60** y con **120** minutos para dar un rango.
3. **Duración de una sesión** = último commit menos primer commit, más 30 minutos de trabajo previo al primer commit. Una sesión de un solo commit vale 30 minutos.
4. Cada sesión se asigna al día (en hora de Argentina) de su **primer** commit: una sesión que pasa la medianoche o el cierre de un sprint cuenta entera en el día en que empezó.
5. Se marcan **para revisar** las sesiones de más de 10 horas.
6. **Claude Code:** un commit se cuenta «con Claude Code» si su mensaje tiene una línea `Co-Authored-By: Claude …`. Se informa el porcentaje de commits con esa línea y el de horas de las sesiones que tienen al menos un commit con ella.

## Totales

| | 60 min | 90 min | 120 min |
|---|---|---|---|
| Sesiones | 45 | 42 | 42 |
| Horas estimadas | 43,3 | 45,5 | 45,5 |
| Sesiones de más de 10 horas (para revisar) | 0 | 0 | 0 |
| Horas de sesiones con al menos un commit con la marca de Claude Code | 22,6 (52,3 %) | 23,3 (51,1 %) | 23,3 (51,1 %) |

**Rango: de 43,3 a 45,5 horas; 45,5 con el umbral de 90 minutos.**

**Commits con la marca `Co-Authored-By: Claude`:** 93 de 266 (35,0 %): 36 de 163 en el backend y 57 de 103 en el frontend. La línea no se puso de forma pareja:

| Período (fecha de autor) | Backend | Frontend |
|---|---|---|
| Hasta el 24/09/2026 | 27 de 33 | 32 de 37 |
| Del 25/09 al 29/10/2026 | 9 de 74 | 4 de 38 |
| Desde el 30/10/2026 (AE4) | 0 de 56 | 21 de 28 |

Por eso este porcentaje **subestima** el uso de Claude Code: desde el 25/09/2026 se dejó de agregar la línea casi siempre (README, sección 8.2), y en la AE4 del backend ningún commit la tiene aunque todos los hizo Claude Code. Según la sección 8.2 del README, casi todos los commits que no son merges, ediciones web ni los primeros de agosto los hizo Claude Code; esa cifra no sale de las marcas y no se usa acá.

## Por sprint

| Sprint | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
| Sprint 1 (hasta el 03/09) | 5 | 4,2 | 4,2 | 4,2 |
| Sprint 2 (04/09 al 01/10) | 16 | 18,8 | 20,1 | 20,1 |
| Sprint 3 (02/10 al 29/10) | 14 | 13,6 | 14,5 | 14,5 |
| Después del sprint 3 (desde el 30/10) | 7 | 6,7 | 6,7 | 6,7 |

## Por mes

| Mes | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
| agosto 2026 | 4 | 3,6 | 3,6 | 3,6 |
| septiembre 2026 | 16 | 18,9 | 20,2 | 20,2 |
| octubre 2026 | 20 | 17,9 | 18,9 | 18,9 |
| noviembre 2026 | 2 | 2,9 | 2,9 | 2,9 |

## Por semana (de lunes a domingo)

Las semanas sin ningún commit no aparecen.

| Semana que empieza el | Sesiones (90 min) | 60 min | 90 min | 120 min |
|---|---|---|---|---|
| 24/08/2026 | 4 | 3,6 | 3,6 | 3,6 |
| 31/08/2026 | 2 | 1,2 | 1,2 | 1,2 |
| 07/09/2026 | 2 | 4,4 | 5,1 | 5,1 |
| 14/09/2026 | 5 | 6,1 | 6,1 | 6,1 |
| 21/09/2026 | 7 | 7,2 | 7,8 | 7,8 |
| 28/09/2026 | 2 | 1,2 | 1,2 | 1,2 |
| 05/10/2026 | 4 | 2,8 | 3,7 | 3,7 |
| 12/10/2026 | 1 | 0,5 | 0,5 | 0,5 |
| 19/10/2026 | 3 | 3,8 | 3,8 | 3,8 |
| 26/10/2026 | 12 | 12,6 | 12,6 | 12,6 |

## Sesiones para revisar (más de 10 horas)

- **60 minutos:** ninguna.
- **90 minutos:** ninguna.
- **120 minutos:** ninguna.

Una sesión larga puede ser trabajo continuo o pausas cortas (comer, esperar una corrida de pruebas) que el método no distingue. No se corrigió ninguna.

## Cinco sesiones de ejemplo (umbral de 90 minutos)

Elegidas con una regla fija: la primera, la más larga, la que tiene más commits en los dos repositorios, la última de un solo commit y la última.

- **Sesión 1, la primera.** 2026-08-25 16:43 a 16:53, 2 commits (1 del backend, 1 del frontend, 0 con la marca de Claude Code): 0,7 horas = 0,2 entre el primer y el último commit más 0,5 de trabajo previo. Commits: `ebbdcdf` (frontend, 16:43) Mi primer commit; `98c15ea` (backend, 16:53) Commit inicial.
- **Sesión 7, la más larga.** 2026-09-10 18:41 a 21:41, 15 commits (7 del backend, 8 del frontend, 15 con la marca de Claude Code): 3,5 horas = 3,0 entre el primer y el último commit más 0,5 de trabajo previo. Commits: `4a818fa` (backend, 18:41) Pasarela de pago Mercado Pago (sandbox) + libera turnos impagos; `4cd6bc4` (frontend, 18:41) Checkout de Mercado Pago + descripción de servicio solo en el modal; `33a1285` (frontend, 18:47) Fix: tras login desde el carrito, volver al carrito y no al panel; `50f707c` (backend, 18:53) Fix: no mandar auto_return a Mercado Pago cuando el front es localhost; y 11 más.
- **Sesión 41, la que tiene más commits en los dos repositorios.** 2026-11-01 03:40 a 04:52, 27 commits (15 del backend, 12 del frontend, 6 con la marca de Claude Code): 1,7 horas = 1,2 entre el primer y el último commit más 0,5 de trabajo previo. Commits: `ff25797` (backend, 03:40) feat: tienda pública solo con productos disponibles, lista del administrador y salida de inventario al pagar; `3fc9b79` (backend, 03:40) test: tienda pública, lista del administrador, validación del pedido y libro de inventario; `76af3af` (backend, 03:40) docs: README, CLAUDE.md, cambios y decisiones y bitácora (entrada 78) de la fase 4; `0aeb530` (frontend, 03:41) fix: las fechas de «hoy» se calculan en hora de Argentina y no en UTC; y 23 más.
- **Sesión 28, la última de un solo commit (vale 30 minutos).** 2026-10-23 16:53 a 16:53, 1 commit (1 del backend, 0 del frontend, 0 con la marca de Claude Code): 0,5 horas = 30 minutos por ser un solo commit. Commits: `a0aceac` (backend, 16:53) Configuración de Claude Code: CLAUDE.md, hooks, subagentes, skills y Context7.
- **Sesión 42, la última.** 2026-11-01 14:39 a 15:20, 18 commits (18 del backend, 0 del frontend, 0 con la marca de Claude Code): 1,2 horas = 0,7 entre el primer y el último commit más 0,5 de trabajo previo. Commits: `f5c2390` (backend, 14:39) test: seña en porcentaje, PATCH /settings/payments y límites de la devolución (RF-03, RF-32, RF-04); `a34749a` (backend, 14:39) test: firma del webhook de Mercado Pago, válida, inválida y sin cabecera (RNF-09); `718e8e6` (backend, 14:39) test: galería, autogestión de la profesional, invitación, detalles del turno, postulación y reserva tardía en combos y servicios especiales (RF-28, RF-29, RF-31, RF-33); `aa86b17` (backend, 14:39) test: reseñas, historiales, actividad e indicadores del panel (RF-25, RF-26, RF-27, RF-34); y 14 más.

## Límites del método

- **Mide la actividad que dejó commits, no el trabajo.** No cuenta el tiempo de lectura, análisis, reuniones, entrevistas, pruebas manuales, diseño, despliegues ni el trabajo en documentos que no están en estos repositorios (informe, Trello, libro de requisitos fuera de `03-requisitos/`). Tampoco el trabajo que nunca se commiteó.
- **Los 30 minutos de trabajo previo son un supuesto**, igual para todas las sesiones. El umbral entre sesiones también es arbitrario: por eso el rango de 60 a 120 minutos.
- **Commits agrupados:** si se trabajó varias horas y se hizo un solo commit al final, la sesión vale 30 minutos. Los commits de la AE4 se hicieron por tema al final de cada fase, así que esas horas probablemente quedan por debajo.
- **Fecha de autor:** un commit reescrito (rebase, cherry-pick) conserva la fecha original; un commit hecho con la fecha de la máquina mal puesta quedaría corrido. No se encontró ninguno, pero no se puede descartar.
- **Claude Code:** un commit hecho por Claude Code genera muchas líneas en poco tiempo; las horas miden el tiempo de la sesión de la autora con la herramienta, no el esfuerzo que llevaría escribirlo a mano. El porcentaje según las marcas subestima el uso real (ver arriba).
- **Asignación por día de inicio:** una sesión que cruza un cierre de sprint o de mes cuenta entera en el período en que empezó.
- **Dos repositorios:** el frontend entra con su `integracion-ae4` sin mergear en su `main`; si se cambia algo antes de mergearla, los números cambian.

## Comparación con las 200 horas planificadas

El presupuesto planificado del proyecto es de **200 horas** (libro de requisitos v7, hoja «Iteraciones»). La estimación por commits da **43,3, 45,5 y 45,5 horas** con los umbrales de 60, 90 y 120 minutos, o sea el 21,6 %, el 22,8 % y el 22,8 % de las 200 horas. Las dos cifras miden cosas distintas (un presupuesto de todo el proyecto contra la actividad que dejó commits en dos repositorios), así que esta comparación no permite sacar ninguna conclusión sobre si el plan se cumplió.

# Estimación de horas de desarrollo

Cifra única del proyecto: **424 horas de desarrollo**, con un intervalo del 95 % de **394 a 454 horas**, del 01/06/2026 al 09/11/2026. Es una estimación a posteriori y no un registro de horas: la autora no llevó un registro horario. La misma cifra figura en el informe, en el libro de requisitos (hoja «Horas de desarrollo», celda B16) y en la bitácora. Las 200 horas del Capítulo V son lo planificado y se muestran aparte como tal. La cifra se actualiza en el corte del congelamiento de la versión.

## Por qué no se estima con los commits

Los repositorios `nexa-backend` y `nexa-frontend` empiezan el 25/08/2026, cuando el sistema ya estaba avanzado: la programación empezó en junio de 2026 (bitácora del AE1, entrada de junio, semana 1) y los commits se subieron recién en agosto. Además, desde esa fecha hay commits en solo 30 días distintos y varios son del mismo trabajo. Una estimación solo con commits deja afuera todo lo anterior y no mide el tiempo real, por eso no se usa para la cifra de horas. Una versión anterior de este documento calculaba horas por sesiones de commits; se reemplaza por este método.

## Método

Estimación por tres valores (Malcolm et al., 1959; PMI, 2017):

1. **Calendario.** Sale de las bitácoras: inicio el 01/06/2026 (bitácora del AE1) y sin actividad de código del 07/10 al 22/10/2026 (bitácora del AE3). El corte es el 09/11/2026.
2. **Tres valores por período.** Para cada tipo de mes la autora declara las horas semanales mínimas, probables y máximas. Las 25 horas semanales probables de los meses de más programación son las declaradas en el plan (5 horas por día).
3. **Valor esperado y desvío por semana.** E = (mínimo + 4 × probable + máximo) / 6. Desvío = (máximo − mínimo) / 6.
4. **Horas del período** = semanas × E. El desvío del período = semanas × desvío semanal.
5. **Total** = suma de los períodos. El desvío del total es la raíz de la suma de las varianzas de los períodos. Intervalo del 95 % = total ± 1,96 desvíos.
6. **Exclusiones.** Se restan las 3 horas de reuniones con la referente. No entran la capacitación prevista, los informes, la redacción de bitácoras ni el estudio.

## Cálculo

| Período | Desde | Hasta | Semanas | Mínimo | Probable | Máximo | Horas esperadas |
|---|---|---|---|---|---|---|---|
| Junio de 2026 | 01/06 | 30/06 | 4,3 | 10 | 15 | 20 | 64 |
| Julio de 2026 | 01/07 | 31/07 | 4,4 | 20 | 25 | 30 | 111 |
| Agosto de 2026 | 01/08 | 31/08 | 4,4 | 20 | 25 | 30 | 111 |
| Septiembre de 2026 | 01/09 | 30/09 | 4,3 | 10 | 15 | 20 | 64 |
| 1 al 6 de octubre de 2026 | 01/10 | 06/10 | 0,9 | 10 | 15 | 20 | 13 |
| 7 al 22 de octubre de 2026 | | | | | | | sin actividad |
| 23 de octubre al 9 de noviembre de 2026 | 23/10 | 09/11 | 2,6 | 20 | 25 | 30 | 64 |

- Total esperado: 427 horas. Menos 3 horas de reuniones: **424 horas**.
- Desvío del total: 15,2 horas. Intervalo del 95 %: **394 a 454 horas**.
- Semanas con actividad: 20,9.

## Límites de la estimación

- Los valores semanales son un juicio de la autora, no un dato medido.
- Se supone que los errores de cada período son independientes. Si todos fueran en el mismo sentido, el margen sería de unas 68 horas y no de unas 30.
- El valor de las dos últimas semanas (25 horas semanales) es un supuesto a confirmar.
- La estimación incluye el desarrollo hecho con asistencia de IA. No se separa lo hecho con y sin Claude Code: el uso de IA se declara en la bitácora y en el README (sección 8).

## Historial de commits (dato complementario, no es la cifra de horas)

Calculado el 2026-11-06 (hora de Argentina), con los commits alcanzables desde `origin/main` y las ramas abiertas de los dos repositorios, sin merges:

- Backend: 179 commits. Frontend: 124 commits. Total: 303.
- Primer commit: 2026-08-25 16:43. Autora de todos los commits: Emily Kohler.
- Commits con la línea `Co-Authored-By: Claude`: 130 de 303 (42,9 %): 52 de 179 en el backend y 78 de 124 en el frontend. La línea no se puso de forma pareja y el porcentaje subestima el uso de Claude Code, porque desde el 25/09/2026 se dejó de agregar casi siempre (README, sección 8.2).

| Período (fecha de autor) | Backend | Frontend |
|---|---|---|
| Hasta el 24/09/2026 | 27 de 33 | 32 de 37 |
| Del 25/09 al 29/10/2026 | 9 de 74 | 4 de 38 |
| Desde el 30/10/2026 (AE4) | 16 de 72 | 42 de 49 |

## Referencias

- Malcolm, D. G., Roseboom, J. H., Clark, C. E., y Fazar, W. (1959). Application of a technique for research and development program evaluation. *Operations Research, 7*(5), 646–669.
- Project Management Institute. (2017). *A guide to the project management body of knowledge (PMBOK guide)* (6.ª ed.).

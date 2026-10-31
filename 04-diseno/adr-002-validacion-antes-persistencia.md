# ADR-002: Integridad de la reserva — índice único parcial como fuente de verdad

**Fecha:** 2026-09-18 (reescrito el 2026-10-06 para que describa el código real)
**Estado:** ACEPTADO
**Impacto:** CRÍTICO (integridad de datos)

> **Nota de revisión (2026-10-06).** La versión anterior de este ADR (subida en
> `84a1782`, 2026-09-25) describía una consulta previa con `findMany`, errores
> `400 HOUR_TAKEN` / `400 OUT_OF_HOURS`, funciones `validateAvailability()` y
> `validateBusinessHours()` y "15 casos" de test. Nada de eso existía en el
> código: la doble reserva la evita un índice único parcial desde `2586b81`
> (2026-08-27) y la validación de horario no existía. Esta versión corrige el
> registro y documenta la validación de horario agregada el 2026-10-06.

---

## 1. Contexto

El caso de uso central es **reservar un turno sin conflictos horarios**: el
problema de origen de Loren son los turnos superpuestos (el mismo horario
ofrecido a dos clientas, caso del 24/11/2025).

Dos preguntas de diseño:

1. ¿Dónde se garantiza que una profesional no tenga dos turnos activos que
   empiecen a la misma hora?
2. ¿Cómo se evita que una clienta reserve fuera del horario de trabajo de la
   profesional?

Decisión de contexto que no se revisa acá: **cada profesional define sus propias
franjas horarias** (`professional_availability`, varias franjas por día) y la
grilla del frontend ofrece solo las franjas libres.

---

## 2. Alternativas evaluadas

### Opción A — Validar solo en el frontend

La grilla de horarios ya oculta los horarios ocupados.

**Descartada:** cualquiera puede mandar la request directo a la API (DevTools,
curl) y dos clientas que miran la misma grilla al mismo tiempo ven el mismo
horario libre. No protege la integridad.

### Opción B — Trigger en la base de datos

Un `BEFORE INSERT` que busque solapamientos y aborte.

**Descartada:** la lógica queda escondida en la base, fuera de Prisma y de los
tests de integración, y el error que devuelve es genérico. Además, un trigger
que hace `SELECT` y después deja insertar tiene la misma carrera que la opción C
si no se bloquea la tabla.

### Opción C — Consulta previa en el backend y después `INSERT`

```ts
const taken = await prisma.appointment.findFirst({ where: { professionalId, date, time, status: { notIn: ['cancelled', 'no_show'] } } })
if (taken) throw new AppError(409, ...)
await prisma.appointment.create(...)
```

**Descartada como garantía:** entre el `SELECT` y el `INSERT` hay una ventana
en la que otra request puede insertar el mismo horario (dos reservas
simultáneas pasan las dos la consulta). Solo sería correcta con un bloqueo
explícito, que agrega complejidad y contención.

### Opción elegida — Índice único parcial + traducción del error a 409

La base garantiza la unicidad de forma **atómica** y el servicio traduce la
violación a un error claro para la usuaria.

---

## 3. Decisión

### 3.1 Fuente de verdad: índice único parcial

Migración `20260826153839_add_orders_promotions_and_details/migration.sql:11`
(commit `2586b81`, 2026-08-27):

```sql
CREATE UNIQUE INDEX "appointments_professional_date_time_active_key"
  ON "appointments" ("professional_id", "date", "time")
  WHERE "status" NOT IN ('cancelled', 'no_show');
```

- Un turno **cancelado** o **no_show** no bloquea el horario: se puede volver a
  reservar.
- La unicidad es por **hora de inicio** (`professional_id, date, time`).
- Es atómico: si dos reservas llegan a la vez, una inserta y la otra recibe la
  violación. No hay carrera entre consulta e inserción porque **no hay consulta
  previa**.
- No es un `@@unique` de Prisma (tiene `WHERE`), por eso vive solo en la
  migración.

### 3.2 Traducción del error

`isSlotConflict()` (`src/modules/appointments/appointment.service.ts:691`)
reconoce la violación por el nombre del índice, por `P2002` o por
`duplicate key value violates unique constraint`, y el servicio responde
**HTTP 409**:

| Flujo | Función | Código |
|---|---|---|
| Reserva de la clienta | `createForClient` (`:737`, error en `:788`) | `PROFESSIONAL_SLOT_TAKEN` |
| Combo | `createComboForClient` (`:811`, error en `:950`) | `PROFESSIONAL_SLOT_TAKEN` |
| Reprogramación de la clienta | `rescheduleForClient` (`:1359`, error en `:1422`) | `PROFESSIONAL_SLOT_TAKEN` |
| Turno manual admin/profesional | `createManualAppointment` (`:549`, error en `:583`) | `PROFESSIONAL_SLOT_TAKEN` |
| Evento especial | `createSpecialForClient` (`:1116`, error en `:1205`) | `SLOT_TAKEN` |

No existe el código `HOUR_TAKEN`. La única comprobación previa es la de los
**eventos especiales** (`:1165`): bloquea la fila del servicio con
`SELECT … FOR UPDATE` dentro de la transacción y verifica que el cupo del evento
siga libre (`SLOT_TAKEN`). Es un cupo propio del evento, no reemplaza al índice.

### 3.3 Validación de horario (agregada el 2026-10-06)

**Hallazgo:** antes de este cambio, `POST /api/client/appointments` aceptaba un
turno a las **23:00** para una profesional con disponibilidad de 09:00 a 18:00
(respuesta **201**). El índice solo impide la doble reserva, no reservar fuera
del horario.

**Validación mínima, solo para el flujo de la clienta:**
`assertWithinAvailability()` (`appointment.service.ts:675`, usa
`src/modules/appointments/availability.ts`) exige que la hora de inicio caiga en
alguna franja activa de la profesional para ese día de la semana
(`startTime <= time < endTime`) y que no esté de vacaciones. Si no se cumple:
**HTTP 400 `OUT_OF_HOURS`**.

- Se aplica en `createForClient`, `createComboForClient` (cada componente) y
  `rescheduleForClient`.
- **No** se aplica a los turnos manuales del admin o de la profesional
  (`createManualAppointment`): pueden cargar un sobreturno a propósito.
- No reemplaza al índice: es una regla de negocio previa, no la garantía de
  integridad.

La asignación automática con "cualquier profesional" (R-04,
`resolveProfessionalId`, `:604`) ya filtra por la misma disponibilidad y por
turnos a esa hora; si ninguna está libre responde **409 `NO_PROFESSIONAL_FREE`**.

---

## 4. Consecuencias

**Positivas**
- La integridad no depende del frontend ni del orden de las requests.
- Una sola consulta (el `INSERT`) en el camino feliz; no hay latencia extra de
  verificación para la doble reserva.
- Mensajes claros para la usuaria (409 / 400 con código).

**Negativas / a tener en cuenta**
- El índice compara **horas de inicio**, no intervalos: dos turnos de la misma
  profesional que se superponen pero empiezan a distinta hora (10:00 de 2 h y
  11:00) no los frena el índice. Lo evita la grilla del frontend, que ofrece
  franjas de duración fija. Si hiciera falta en la base, la alternativa es una
  restricción de exclusión (`EXCLUDE USING gist` sobre un rango de tiempo).
- El índice vive solo en SQL: hay que recordarlo al cambiar el modelo con Prisma.

---

## 5. Tests

| Archivo | Casos (`it`) | Qué cubre |
|---|---|---|
| `tests/integration/appointments.booking.test.ts` | 21 | Reserva, doble reserva con 409 (`:93`), asignación R-04, promociones, "Pendiente de seña" |
| `tests/integration/appointments.out-of-hours.test.ts` | 6 | `OUT_OF_HOURS` en reserva, día sin franja, combo y reprogramación; el turno manual del admin no se valida |
| `tests/integration/appointments.combo.test.ts` | 5 | 409 en combos (`:67`) |
| `tests/integration/appointments.cancel-reschedule.test.ts` | 10 | 409 al reprogramar a un horario ocupado (`:146`) |

Antes de los cambios del 2026-10-06, `appointments.booking.test.ts` tenía
**13 casos** (versión de la etiqueta `v1`, commit `a44fddb`). Subió a 21 al
agregar los casos de R-04 (asignación automática) y de "Pendiente de seña" (RF-02).

---

**Revisado por:** Emily Kohler


---

## Revisión del 2026-10-31 (AE4, fase 2): inasistencia, horario original bloqueado y horario reabierto

Esta revisión **agrega** reglas; el texto de arriba sigue siendo el registro de la decisión original. Las reglas
fueron confirmadas por escrito por la propietaria el 30/10/2026 (formulario firmado) y se evalúan en hora de
Argentina. Lo que cambia respecto de las secciones 2 a 4:

1. **El índice único parcial cambia de predicado.** Pasa de `WHERE status NOT IN ('cancelled','cancelled_no_show')` a
   `WHERE status NOT IN ('cancelled','cancelled_no_show') OR slot_locked`
   (migración `20261031120000_turno_horario_original_bloqueado`). `appointments.slot_locked` vale `true` cuando el
   turno ya no está activo pero su horario **original** no se vuelve a ofrecer nunca: un `cancelled_no_show` (marcado
   por el personal) o un `cancelled` hecho **después** de la hora de inicio. El código lo escribe en la **misma
   sentencia `UPDATE`** que cambia el estado: la fila no sale del índice en ningún momento y no hay ventana de carrera.
   Las filas existentes quedan en `false`, así que el índice nuevo tiene el mismo contenido que el viejo y no puede
   fallar por duplicados al crearse. Alternativa descartada: sacar `cancelled_no_show` de la lista de exclusión; los
   `cancelled_no_show` viejos podrían chocar con turnos posteriores en el mismo horario.
2. **Estado nuevo `no_show_auto`** («No asistió (automático)»). Lo asigna solo el job `autoNoShow` (cada 5 minutos) a
   un turno `confirmed` sin llegada registrada con **más de 30 minutos** de su hora de inicio (con 30 exactos no).
   No está en la lista de exclusión del índice: **sigue ocupando el horario** sin cambiar nada más. No suma a la
   carga semanal de la asignación «cualquiera» (R-04), la clienta no puede cancelarlo ni reprogramarlo y
   `paymentStatus` no cambia. Antes el job pasaba el turno a `cancelled_no_show` a los 20 minutos, lo que liberaba el
   horario.
3. **Marca del personal y corrección** (`changeStatusByStaff`). Marcar `cancelled_no_show` vale desde la hora de
   inicio (antes: `400 NO_SHOW_BEFORE_START`) y solo desde `confirmed` o `no_show_auto`; la seña queda retenida. Desde
   `no_show_auto` o `cancelled_no_show` el personal puede pasar a `finished` siempre y a `confirmed` solo si no se
   superpone con otro turno activo de la profesional (`409 APPOINTMENT_OVERLAP`); al confirmar queda registrada la
   llegada para que el job no lo vuelva a marcar. Cada cambio deja una entrada de actividad con quién, de qué
   estado a cuál y el id del turno (`activity_logs.appointment_id`, sin clave foránea).
4. **Horario reabierto** (tabla `reopened_slots`, una fila por turno de origen). Si la marca ocurre hasta 40 minutos
   después de la hora de inicio, se ofrecen inicios cada 5 minutos desde el siguiente múltiplo de 5 al momento de la
   marca hasta 60 minutos después de la hora original (inclusive). Un inicio se acepta solo si el servicio termina
   dentro de una franja de la profesional y **no pisa ningún turno activo, ni antes ni después**. Esa verificación por
   duración se hace bajo un `pg_advisory_xact_lock` por profesional y día, dentro de la transacción que crea el turno,
   porque el índice solo compara el inicio exacto y dos reservas simultáneas (16:35 y 16:40) pasarían las dos la
   verificación. Pasada la hora límite el horario no se ofrece ni se acepta (`409 REOPENED_SLOT_CLOSED`). La vigencia es
   implícita; `closed_at` solo se completa cuando el personal corrige el estado del turno de origen. La reserva en un
   horario reabierto es un turno normal (confirmado, con seña, sujeto a la liberación por falta de pago).
5. **Reserva tardía.** La clienta puede reservar o reprogramar (turno simple, combo, evento especial) hasta 15 minutos
   después de la hora de inicio, inclusive; después `400 START_TIME_PASSED`. El personal queda exento. La tolerancia se
   aplica también a los inicios del horario reabierto.
6. **Qué NO cambia.** El backend sigue aceptando cualquier hora dentro de la franja de la profesional: no impone la
   grilla de 120 minutos que genera el frontend. Por eso la defensa del horario original es el índice, y la del horario
   reabierto es la oferta del servidor (`reopenedStarts` y `earliestStart` en
   `GET /api/professional/:id/availability`) más la validación al reservar dentro del rango de la ventana. Una hora fuera
   de ese rango y de la grilla sigue siendo aceptable si cae dentro de la franja, como antes.

**Limitaciones que quedan.** (a) La verificación por duración existe solo para los inicios de un horario reabierto: el
resto de las reservas sigue comparando solo la hora de inicio (sección 4). (b) Los horarios reabiertos no cruzan la
medianoche (el último inicio es 23:55). (c) Una profesional con dos ventanas el mismo día las ve unidas.

**Pruebas.** `appointments.reopened-slots.test.ts` (42 casos: marca a los 32, 40 y 41 minutos, original no reservable
por la clienta, el personal ni un INSERT directo, reservas en el horario reabierto hasta las 17:00, servicio que no
entra, reservas simultáneas, reserva tardía, correcciones y caso María) y `appointments.arrival-noshow.test.ts`
(job con 29, 30 y 31 minutos, una entrada de actividad por turno, la clienta no cancela un `no_show_auto`).

**Revisado por:** Emily Kohler (pendiente) — redactado por Claude Code (Sonnet 5.5).

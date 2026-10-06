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

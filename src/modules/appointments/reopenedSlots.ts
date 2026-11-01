// src/modules/appointments/reopenedSlots.ts
//
// Reglas de horarios de la Fase 2 de la AE4 (confirmadas por escrito por la propietaria el 30/10/2026):
//
//  - Inasistencia automática: más de 30 minutos después de la hora de inicio, sin llegada registrada.
//  - Reserva tardía: la clienta puede reservar o reprogramar hasta 15 minutos DESPUÉS de la hora de inicio
//    (START_TIME_PASSED pasado ese margen). El personal queda exento.
//  - Horario reabierto: si un turno se marca como no asistido (o se cancela ya empezado) hasta 40 minutos
//    después de su hora de inicio, se ofrecen inicios cada 5 minutos desde la marca hasta 60 minutos después de
//    la hora ORIGINAL (inclusive), solo si el servicio entra entre los demás turnos y dentro de la franja.
//  - El horario ORIGINAL nunca se reabre: lo garantiza el índice único parcial (Appointment.slotLocked).
//
// Toda hora se evalúa en America/Argentina/Buenos_Aires (ver argentinaTime.ts). Las comparaciones de tiempo
// son en milisegundos y los límites de "hasta N minutos" son inclusivos; los de "más de N minutos", estrictos.
import type { Prisma } from '@prisma/client'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'
import { argentinaParts, appointmentInstant } from '../../app/utils/argentinaTime'
import { backendDayOf } from './availability'

type Db = Prisma.TransactionClient

const MINUTE = 60_000

export const NO_SHOW_AUTO_AFTER_MINUTES            = 30
export const STAFF_NO_SHOW_REOPEN_LIMIT_MINUTES    = 40
export const REOPENED_WINDOW_MINUTES               = 60
export const LATE_BOOKING_TOLERANCE_MINUTES        = 15
export const REOPENED_STEP_MINUTES                 = 5

// Estados que, por sí solos, ya no ocupan el horario (el turno quedó sin efecto).
export const RELEASED_STATUSES = ['cancelled', 'cancelled_no_show'] as const
// Estados que no suman a la carga semanal (R-04): además de los liberados, la inasistencia automática.
export const NOT_COUNTED_IN_LOAD_STATUSES = ['cancelled', 'cancelled_no_show', 'no_show_auto'] as const
// Estados del turno que ya se dio por no asistido.
export const NO_SHOW_STATUSES = ['no_show_auto', 'cancelled_no_show'] as const

// Turno "activo" para decidir superposiciones: todo lo que no está cancelado ni marcado como no asistido
// por el personal. 'no_show_auto' SÍ cuenta (sigue ocupando el horario hasta que el personal lo resuelva).
export const ACTIVE_STATUS_FILTER = { notIn: [...RELEASED_STATUSES] }

// Turnos que ocupan un inicio: los activos más los que tienen el horario original bloqueado. Es el mismo
// criterio que el predicado del índice único parcial appointments_professional_date_time_active_key.
export const OCCUPYING_SLOT_FILTER = {
  OR: [{ status: ACTIVE_STATUS_FILTER }, { slotLocked: true }],
} satisfies Prisma.AppointmentWhereInput

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function startInstant(a: { date: string; time: string }): Date {
  return appointmentInstant(a.date, a.time)
}

// ¿El turno ya empezó? Una cancelación hecha desde la hora de inicio deja el horario original bloqueado.
export function hasStarted(a: { date: string; time: string }, now: Date = new Date()): boolean {
  return now.getTime() >= startInstant(a).getTime()
}

// Reserva tardía (2.6): hasta 15 minutos después de la hora de inicio, inclusive.
export function assertStartTimeNotPassed(date: string, time: string, now: Date = new Date()): void {
  if (now.getTime() > startInstant({ date, time }).getTime() + LATE_BOOKING_TOLERANCE_MINUTES * MINUTE) {
    throw new AppError(HTTP.BAD_REQUEST, 'Ese horario ya pasó. Elegí otro horario.', 'START_TIME_PASSED')
  }
}

// Primer inicio que se ofrece al abrirse un horario reabierto: el siguiente múltiplo de 5 minutos a partir
// del minuto de la marca (marcar a las 16:40 deja 16:45 como máximo, marcar a las 16:32 deja 16:35).
export function firstReopenedStart(now: Date): string | null {
  const m = toMinutes(argentinaParts(now).time)
  const next = Math.floor(m / REOPENED_STEP_MINUTES) * REOPENED_STEP_MINUTES + REOPENED_STEP_MINUTES
  return next >= 24 * 60 ? null : toHHmm(next)
}

// Último inicio de un horario reabierto: 60 minutos después de la hora original, sin pasar de las 23:55
// (los horarios reabiertos no cruzan la medianoche).
function lastReopenedStartMinutes(originalTime: string): number {
  return Math.min(toMinutes(originalTime) + REOPENED_WINDOW_MINUTES, 24 * 60 - REOPENED_STEP_MINUTES)
}

// Abre el horario reabierto de un turno si la marca/cancelación ocurre dentro de los 40 minutos posteriores
// a su hora de inicio (inclusive). Devuelve null si no corresponde. Una fila por turno de origen.
export async function openReopenedSlot(
  db: Db,
  appointment: { id: string; professionalId: string; date: string; time: string },
  now: Date,
) {
  const elapsed = now.getTime() - startInstant(appointment).getTime()
  if (elapsed < 0 || elapsed > STAFF_NO_SHOW_REOPEN_LIMIT_MINUTES * MINUTE) return null

  const firstStart = firstReopenedStart(now)
  if (!firstStart || toMinutes(firstStart) > lastReopenedStartMinutes(appointment.time)) return null

  const closesAt = new Date(startInstant(appointment).getTime() + REOPENED_WINDOW_MINUTES * MINUTE)
  const data = {
    professionalId: appointment.professionalId,
    date:           appointment.date,
    originalTime:   appointment.time,
    firstStart,
    opensAt:        now,
    closesAt,
    closedAt:       null,
    closedReason:   null,
  }
  return db.reopenedSlot.upsert({
    where:  { appointmentId: appointment.id },
    create: { appointmentId: appointment.id, ...data },
    update: data,
  })
}

// El personal corrigió el estado del turno de origen: el horario reabierto sin reservar se cierra.
// Las reservas que ya se hicieron adentro se mantienen.
export async function closeReopenedSlots(db: Db, appointmentId: string, reason: string, now: Date) {
  return db.reopenedSlot.updateMany({
    where: { appointmentId, closedAt: null },
    data:  { closedAt: now, closedReason: reason },
  })
}

// Serializa las reservas de un horario reabierto de una profesional en un día: sin esto, dos reservas
// simultáneas de 16:45 y 16:50 pasarían las dos la verificación por duración (el índice único solo
// compara el inicio exacto). El lock se libera solo al terminar la transacción.
export async function lockProfessionalDay(tx: Db, professionalId: string, date: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reopened:${professionalId}:${date}`}))`
}

// Franjas activas de la profesional ese día de la semana (professional_availability).
async function dayRanges(db: Db, professionalId: string, date: string): Promise<{ startTime: string; endTime: string }[]> {
  const professional = await db.professional.findUnique({
    where:  { userId: professionalId },
    select: { availability: { where: { active: true, dayOfWeek: backendDayOf(date) }, select: { startTime: true, endTime: true } } },
  })
  return professional?.availability ?? []
}

type Interval = { start: number; end: number }

async function activeIntervals(db: Db, professionalId: string, date: string, excludeId?: string): Promise<Interval[]> {
  const rows = await db.appointment.findMany({
    where: {
      professionalId, date, status: ACTIVE_STATUS_FILTER,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { time: true, duration: true },
  })
  return rows.map(r => ({ start: toMinutes(r.time), end: toMinutes(r.time) + r.duration }))
}

function overlaps(candidate: Interval, others: Interval[]): boolean {
  return others.some(o => candidate.start < o.end && o.start < candidate.end)
}

function fitsInRanges(ranges: { startTime: string; endTime: string }[], candidate: Interval): boolean {
  return ranges.some(r => toMinutes(r.startTime) <= candidate.start && candidate.end <= toMinutes(r.endTime))
}

// Verificación por duración (solo para inicios de un horario reabierto): el servicio tiene que terminar
// dentro de una franja de la profesional y no pisarse con ningún turno activo, ni antes ni después.
export async function assertServiceFits(
  db: Db,
  p: { professionalId: string; date: string; time: string; duration: number; excludeAppointmentId?: string },
): Promise<void> {
  const candidate: Interval = { start: toMinutes(p.time), end: toMinutes(p.time) + p.duration }
  const ranges = await dayRanges(db, p.professionalId, p.date)
  if (!fitsInRanges(ranges, candidate)) {
    throw new AppError(HTTP.CONFLICT, 'El servicio no termina dentro del horario de trabajo de la profesional. Elegí otro horario.', 'SERVICE_DOES_NOT_FIT')
  }
  const others = await activeIntervals(db, p.professionalId, p.date, p.excludeAppointmentId)
  if (overlaps(candidate, others)) {
    throw new AppError(HTTP.CONFLICT, 'El servicio no entra antes del siguiente turno de la profesional. Elegí otro horario.', 'SERVICE_DOES_NOT_FIT')
  }
}

// ¿Se superpone con otro turno activo de la profesional? (corrección a "confirmado", regla 2.7)
export async function hasOverlap(
  db: Db,
  p: { professionalId: string; date: string; time: string; duration: number; excludeAppointmentId?: string },
): Promise<boolean> {
  const others = await activeIntervals(db, p.professionalId, p.date, p.excludeAppointmentId)
  return overlaps({ start: toMinutes(p.time), end: toMinutes(p.time) + p.duration }, others)
}

// Horario reabierto vigente que gobierna un inicio: el rango [hora original, hora original + 60 min] de un
// horario reabierto que el personal no cerró.
async function governingWindow(db: Db, professionalId: string, date: string, time: string) {
  const windows = await db.reopenedSlot.findMany({ where: { professionalId, date, closedAt: null } })
  const t = toMinutes(time)
  return windows.find(w => toMinutes(w.originalTime) <= t && t <= lastReopenedStartMinutes(w.originalTime)) ?? null
}

// Valida el inicio que elige una CLIENTA (reserva, combo, reprogramación). Devuelve si cae dentro de un
// horario reabierto: en ese caso el que llama tiene que repetir `assertServiceFits` adentro de la transacción
// que crea el turno, bajo `lockProfessionalDay`. Los turnos manuales del personal no pasan por acá.
export async function checkClientStart(
  db: Db,
  p: { professionalId: string; date: string; time: string; duration: number; now: Date; excludeAppointmentId?: string },
): Promise<{ reopened: boolean }> {
  assertStartTimeNotPassed(p.date, p.time, p.now)

  const window = await governingWindow(db, p.professionalId, p.date, p.time)
  if (!window) return { reopened: false }

  // El horario ORIGINAL nunca se reabre.
  if (p.time === window.originalTime) {
    throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
  }
  // Pasada la hora límite (hora original + 60 minutos) el horario reabierto ya no se acepta.
  if (p.now.getTime() > window.closesAt.getTime()) {
    throw new AppError(HTTP.CONFLICT, 'Ese horario reabierto ya cerró. Elegí otro horario.', 'REOPENED_SLOT_CLOSED')
  }
  const t = toMinutes(p.time)
  if (t % REOPENED_STEP_MINUTES !== 0 || t < toMinutes(window.firstStart)) {
    throw new AppError(HTTP.CONFLICT, 'Ese horario no está disponible. Elegí uno de los que se ofrecen.', 'REOPENED_SLOT_UNAVAILABLE')
  }
  await assertServiceFits(db, p)
  return { reopened: true }
}

// Inicios que se ofrecen hoy en los horarios reabiertos de la profesional para un servicio de `duration`
// minutos. Los calcula el servidor: el frontend no debe inventarlos ni filtrarlos con el reloj del navegador.
export async function reopenedStartsFor(
  db: Db,
  p: { professionalId: string; date: string; duration: number; now: Date },
): Promise<string[]> {
  const windows = (await db.reopenedSlot.findMany({ where: { professionalId: p.professionalId, date: p.date, closedAt: null } }))
    .filter(w => p.now.getTime() <= w.closesAt.getTime())
  if (windows.length === 0) return []

  const ranges = await dayRanges(db, p.professionalId, p.date)
  const others = await activeIntervals(db, p.professionalId, p.date)

  const starts = new Set<string>()
  for (const w of windows) {
    for (let t = toMinutes(w.firstStart); t <= lastReopenedStartMinutes(w.originalTime); t += REOPENED_STEP_MINUTES) {
      const time = toHHmm(t)
      if (time === w.originalTime) continue
      // Reserva tardía: un inicio que ya pasó hace más de 15 minutos no se ofrece.
      if (p.now.getTime() > startInstant({ date: p.date, time }).getTime() + LATE_BOOKING_TOLERANCE_MINUTES * MINUTE) continue
      const candidate: Interval = { start: t, end: t + p.duration }
      if (fitsInRanges(ranges, candidate) && !overlaps(candidate, others)) starts.add(time)
    }
  }
  return [...starts].sort()
}

// Primer inicio ("HH:mm") que una clienta puede reservar en `date` según la reserva tardía (hasta 15
// minutos después de la hora de inicio). null si la fecha ya pasó. El frontend filtra con esto, no con el
// reloj del navegador.
export function earliestBookableStart(date: string, now: Date = new Date()): string | null {
  const today = argentinaParts(now).date
  if (date < today) return null
  if (date > today) return '00:00'
  const limit = argentinaParts(new Date(Math.ceil((now.getTime() - LATE_BOOKING_TOLERANCE_MINUTES * MINUTE) / MINUTE) * MINUTE))
  return limit.date < today ? '00:00' : limit.time
}

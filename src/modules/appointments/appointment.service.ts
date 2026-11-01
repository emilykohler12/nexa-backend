// src/modules/appointments/appointment.service.ts
import type { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import fs   from 'fs'
import path from 'path'
import { prisma }        from '../../app/database/prisma'
import { AppError }      from '../../app/middlewares/errorHandler'
import { assertValidPhone } from '../../app/validators/phone'
import { releaseSpecialSlot } from './specialSlots'
import { HTTP }          from '../../app/constants/http'
import { fullName }      from '../../app/utils/fullName'
import { PRIVACY_POLICY_VERSION } from '../../app/constants/legal'
import type { CompanionRelation } from '../../app/constants/companion'
import { backendDayOf, weekRangeOf, isTimeInRanges, isOnVacation } from './availability'
import { settingsService, computeDeposit } from '../settings/settings.service'
import { activityService } from '../activity/activity.service'
import { paymentService } from '../payments/payment.service'
import { notificationService } from '../professionals/notification.service'
import { mailProvider } from '../auth/providers/mail.provider'
import { bcryptProvider } from '../auth/providers/bcrypt.provider'
import type { SpecialSlot } from '../services/service.model'
import { todayArgentinaStr, appointmentInstant } from '../../app/utils/argentinaTime'
import { isPaymentAcceptable, type PaidInfo } from '../payments/paidAmount'
import {
  NOT_COUNTED_IN_LOAD_STATUSES, NO_SHOW_STATUSES, OCCUPYING_SLOT_FILTER,
  assertServiceFits, assertStartTimeNotPassed, checkClientStart, closeReopenedSlots, hasOverlap,
  hasStarted, lockProfessionalDay, openReopenedSlot, startInstant, STAFF_NO_SHOW_REOPEN_LIMIT_MINUTES,
} from './reopenedSlots'
import {
  decideRefund, describeCancellation, isDepositPaid, noticeHoursBetween, buildStaffCancellation,
  type CancelledBy, type CancellationNotice, type NoticeChannel,
} from './cancellationRules'

export function loadTemplate(name: string, replacements: Record<string, string>): string {
  const candidates = [
    path.join(__dirname, 'templates', `${name}.html`),
    path.join(process.cwd(), 'src', 'modules', 'appointments', 'templates', `${name}.html`),
    path.join(process.cwd(), 'dist', 'modules', 'appointments', 'templates', `${name}.html`),
  ]

  let html: string | null = null
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      html = fs.readFileSync(filePath, 'utf8')
      break
    }
  }
  if (!html) {
    throw new Error(`No se encontró el template "${name}.html". Rutas buscadas:\n${candidates.join('\n')}`)
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }
  return html
}

export function formatDate(date: string): string {
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

// 'no_show_auto' lo escribe SOLO el job autoNoShow (más de 30 minutos sin llegada registrada); sigue
// ocupando el horario hasta que el personal lo resuelva (marcar no asistido, finalizar o confirmar).
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'finished', 'cancelled', 'cancelled_no_show', 'no_show_auto'] as const
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number]

// Etiquetas para mostrar (displayStatus incluido). El frontend las usa tal cual.
export const STATUS_LABELS: Record<string, string> = {
  pending:           'Pendiente',
  pending_deposit:   'Pendiente de seña',
  confirmed:         'Confirmado',
  finished:          'Finalizado',
  cancelled:         'Cancelado',
  cancelled_no_show: 'No asistió',
  no_show_auto:      'No asistió (automático)',
}

function assertValidStatus(status: string) {
  if (!APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Estado de turno inválido', 'INVALID_STATUS')
  }
}

export const BALANCE_PAYMENT_METHODS = ['cash', 'transfer', 'card', 'other'] as const
export type BalancePaymentMethod = typeof BALANCE_PAYMENT_METHODS[number]

const APPOINTMENT_INCLUDE = {
  client:            { include: { client: true } },
  professional:      true,
  service:           true,
  balanceCollectedBy: true,
  noticeLoadedBy:     true,
} satisfies Prisma.AppointmentInclude

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>

function detailsOf(a: AppointmentRow) {
  return {
    allergies:        a.allergies ?? null,
    hasCompanion:      a.hasCompanion,
    companionRelation: a.companionRelation ?? null,
    designPreference: a.designType
      ? { type: a.designType as 'image' | 'text', value: a.designValue ?? null }
      : null,
    hasOtherSalonPolish:     a.hasOtherSalonPolish ?? null,
    isNailReconstruction:    a.isNailReconstruction ?? null,
    nailReconstructionCount: a.nailReconstructionCount ?? null,
    hairLength:              a.hairLength ?? null,
    wantsExtensions:         a.wantsExtensions ?? null,
    skinType:                a.skinType ?? null,
  }
}

// RF-02 — el libro pide que el turno recién reservado figure "pendiente de seña".
// El estado persistido sigue siendo 'confirmed' (ocupa el horario y lo usan el
// índice único, el job de impagos y los calendarios); la etiqueta se deriva:
// confirmado + seña > 0 todavía sin pagar => 'pending_deposit'.
function displayStatusOf(a: { status: string; paymentStatus: string; depositAmount: { toString(): string } | number }): string {
  if (a.status === 'confirmed' && a.paymentStatus === 'pending' && Number(a.depositAmount) > 0) return 'pending_deposit'
  return a.status
}

function toClientView(a: AppointmentRow) {
  return {
    id:                a.id,
    serviceId:         a.serviceId,
    serviceName:       a.service.name,
    categoryId:        a.service.categoryId,
    professionalId:    a.professionalId,
    professionalName:  a.professional.name,
    professionalPhone: a.professional.phone ?? '',
    date:              a.date,
    time:              a.time,
    duration:          a.duration,
    price:             Number(a.servicePrice),
    depositAmount:     Number(a.depositAmount),
    status:            a.status,
    displayStatus:     displayStatusOf(a),
    statusLabel:       STATUS_LABELS[displayStatusOf(a)] ?? a.status,
    cancelReason:      a.cancelReason,
    paymentStatus:     a.paymentStatus,
    depositMethod:     a.depositMethod,
    arrivedAt:         a.arrivedAt ? a.arrivedAt.toISOString() : null,
    comboGroupId:      a.comboGroupId,
    rescheduleNoticePending: a.rescheduleNoticePending,
    previousDate:            a.previousDate ?? null,
    previousTime:            a.previousTime ?? null,
    selectedZones:     (a.selectedZones ?? []) as unknown as { name: string; price: number; duration: number }[],
    selectedPackages:  (a.selectedPackages ?? []) as unknown as { name: string; price: number; duration: number }[],
    details:           detailsOf(a),
  }
}

function balancePaymentOf(a: AppointmentRow) {
  if (!a.balancePaidAt) return null
  return {
    method:        a.balancePaymentMethod,
    amount:        Number(a.balancePaidAmount),
    paidAt:        a.balancePaidAt.toISOString(),
    collectedById: a.balanceCollectedById,
    collectedByName: a.balanceCollectedBy?.name ?? null,
  }
}

// Detalle de la cancelación para el personal: quién canceló, si la seña se marcó devuelta y, si fue la clienta
// avisando, cuándo avisó, por qué medio, la nota y quién lo cargó y cuándo.
function cancellationOf(a: AppointmentRow) {
  if (a.status !== 'cancelled') return null
  return {
    cancelledBy:     a.cancelledBy,
    cancelledAt:     a.cancelledAt ? a.cancelledAt.toISOString() : null,
    refunded:        a.paymentStatus === 'refunded',
    noticeAt:        a.clientNoticeAt ? a.clientNoticeAt.toISOString() : null,
    noticeHours:     a.clientNoticeAt ? Math.round(noticeHoursBetween(startInstant(a), a.clientNoticeAt) * 100) / 100 : null,
    noticeChannel:   a.noticeChannel,
    noticeNote:      a.noticeNote,
    noticeLoadedBy:  a.noticeLoadedBy ? { id: a.noticeLoadedBy.id, name: a.noticeLoadedBy.name } : null,
    noticeLoadedAt:  a.noticeLoadedAt ? a.noticeLoadedAt.toISOString() : null,
  }
}

function polishRemovalOf(a: AppointmentRow) {
  if (a.polishRemovalPrice == null) return null
  return { label: a.polishRemovalLabel, price: Number(a.polishRemovalPrice) }
}

// RNF-03 — la alergia del perfil de la clienta solo se muestra a una profesional que ya la atendió: al menos un
// turno finalizado con ella. La alergia del propio turno (details.allergies) se muestra siempre a su profesional.
async function hasAttended(professionalId: string, clientId: string): Promise<boolean> {
  const finished = await prisma.appointment.findFirst({
    where: { professionalId, clientId, status: 'finished' }, select: { id: true },
  })
  return finished !== null
}

function toProfessionalView(a: AppointmentRow, peers: ComboPeer[] | null, attended: boolean) {
  return {
    id:            a.id,
    comboGroupId:  a.comboGroupId,
    client: {
      id:        a.client.id,
      name:      fullName(a.client),
      phone:     a.client.phone ?? '',
      email:     a.client.email,
      photo:     null as string | null,
      allergies: attended ? a.client.client?.allergies ?? '' : '',
      notes:     a.client.client?.notes ?? '',
    },
    serviceName:    a.service.name,
    servicePrice:   Number(a.servicePrice),
    duration:       a.duration,
    date:           a.date,
    time:           a.time,
    status:         a.status,
    displayStatus:  displayStatusOf(a),
    statusLabel:    STATUS_LABELS[displayStatusOf(a)] ?? a.status,
    cancelReason:   a.cancelReason,
    paymentStatus:  a.paymentStatus,
    arrivedAt:      a.arrivedAt ? a.arrivedAt.toISOString() : null,
    cancellation:   cancellationOf(a),
    internalNotes:  a.internalNotes ?? '',
    selectedZones:     (a.selectedZones ?? []) as unknown as { name: string; price: number; duration: number }[],
    selectedPackages:  (a.selectedPackages ?? []) as unknown as { name: string; price: number; duration: number }[],
    details:        detailsOf(a),
    isSimultaneous: !!peers,
    // Las OTRAS profesionales del combo simultáneo (sin contar esta pata).
    simultaneousWith: peers
      ? peers.filter(p => p.appointmentId !== a.id)
      : [],
  }
}

function toAdminView(a: AppointmentRow, peers: ComboPeer[] | null = null) {
  const start = `${a.date}T${a.time}:00`
  const end   = new Date(new Date(start).getTime() + a.duration * 60000).toISOString()
  return {
    id:               a.id,
    comboGroupId:     a.comboGroupId,
    title:            fullName(a.client),
    clientName:       fullName(a.client),
    clientPhone:      a.client.phone ?? '',
    clientEmail:      a.client.email,
    professionalId:   a.professionalId,
    professionalName: a.professional.name,
    serviceId:        a.serviceId,
    serviceName:      a.service.name,
    serviceDuration:  a.duration,
    servicePrice:     Number(a.servicePrice),
    start,
    end,
    status:            a.status,
    displayStatus:     displayStatusOf(a),
    statusLabel:       STATUS_LABELS[displayStatusOf(a)] ?? a.status,
    cancelReason:      a.cancelReason,
    paymentStatus:     a.paymentStatus,
    depositMethod:     a.depositMethod,
    arrivedAt:         a.arrivedAt ? a.arrivedAt.toISOString() : null,
    cancellation:      cancellationOf(a),
    balancePayment:    balancePaymentOf(a),
    polishRemoval:     polishRemovalOf(a),
    depositAmount:     Number(a.depositAmount),
    clientNotes:       a.clientNotes ?? '',
    professionalNotes: a.internalNotes ?? '',
    selectedZones:     (a.selectedZones ?? []) as unknown as { name: string; price: number; duration: number }[],
    selectedPackages:  (a.selectedPackages ?? []) as unknown as { name: string; price: number; duration: number }[],
    details:           detailsOf(a),
    isSimultaneous:    !!peers,
    simultaneousWith:  peers
      ? peers.filter(p => p.appointmentId !== a.id)
      : [],
  }
}

// ── Efectos secundarios — actividad, notificación in-app, email ──────

// Notificación in-app + mail — esto SÍ va una vez por profesional (cada una
// necesita enterarse de su propio servicio), a diferencia del log de
// actividad del admin, que para un combo se consolida en uno solo (ver
// afterCreateGroup). El mail se espera (no fire-and-forget) para no disparar
// varios al mismo tiempo en un combo — de a uno, y si falla queda registrado
// en Actividad en vez de perderse en la consola del servidor.
async function notifyProfessionalOfNewAppointment(a: AppointmentRow) {
  await notificationService.notify(a.professionalId, {
    type:  'new_appointment',
    title: 'Nuevo turno',
    body:  `${fullName(a.client)} reservó ${a.service.name} para el ${a.date} a las ${a.time}.`,
  })
  try {
    await mailProvider.send(
      a.professional.email,
      'Nuevo turno agendado — Nexa',
      loadTemplate('appointmentCreated', {
        PROFESSIONAL_NAME: a.professional.name,
        CLIENT_NAME:        fullName(a.client),
        SERVICE_NAME:        a.service.name,
        DATE:                formatDate(a.date),
        TIME:                a.time,
      }),
    )
  } catch (err: any) {
    console.error('[mail] error notificando nuevo turno:', err.message)
    await activityService.log({
      action: 'No se pudo enviar el mail de aviso de turno nuevo', module: 'system', level: 'warning', appointmentId: a.id,
      detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}: ${err.message}`,
    })
  }
}

async function afterCreate(a: AppointmentRow) {
  await activityService.log({
    action: 'Nuevo turno', module: 'appointments', level: 'success', appointmentId: a.id,
    detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}`,
  })
  await notifyProfessionalOfNewAppointment(a)
}

// Para un combo/simultáneo: UN solo log de actividad para el admin (antes
// quedaba uno por cada servicio del combo), pero cada profesional sigue
// recibiendo su propia notificación in-app + mail — cada una necesita
// enterarse de su parte igual.
async function afterCreateGroup(legs: AppointmentRow[]) {
  if (legs.length === 0) return
  if (legs.length === 1) { await afterCreate(legs[0]); return }

  const summary = legs.map(l => `${l.service.name} con ${l.professional.name}`).join(', ')
  await activityService.log({
    action: 'Nuevo turno simultáneo', module: 'appointments', level: 'success', appointmentId: legs[0].id,
    detail: `${fullName(legs[0].client)} el ${legs[0].date} ${legs[0].time}: ${summary}`,
  })
  for (const leg of legs) await notifyProfessionalOfNewAppointment(leg)
}

async function afterCancel(a: AppointmentRow, emailClient: boolean, extraDetail = '') {
  await activityService.log({
    action: 'Turno cancelado', module: 'appointments', level: 'warning', appointmentId: a.id,
    detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}${extraDetail}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'cancelled_appointment',
    title: 'Turno cancelado',
    body:  `El turno de ${fullName(a.client)} (${a.service.name}, ${a.date} ${a.time}) fue cancelado.`,
  })
  if (emailClient) {
    mailProvider.send(
      a.client.email,
      'Tu turno fue cancelado — Nexa',
      loadTemplate('appointmentCancelled', {
        CLIENT_NAME:  fullName(a.client),
        SERVICE_NAME: a.service.name,
        DATE:         formatDate(a.date),
        TIME:         a.time,
      }),
    ).catch(err => console.error('[mail] error notificando cancelación:', err.message))
  }
}

// Auditoría de cualquier cambio de estado de un turno que no sea "cancelado"
// (la cancelación ya se audita aparte en afterCancel). Cubre tanto los cambios
// manuales (profesional/admin marcando "no asistió", "finalizado", etc.) como
// el marcado automático del job autoNoShow.job.ts.
async function logStatusChange(a: AppointmentRow, from: string, to: string, actorName: string, extra = '') {
  await activityService.log({
    userName:      actorName,
    action:        'Cambio de estado de turno',
    module:        'appointments',
    appointmentId: a.id,
    detail:        `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}: "${from}" → "${to}"${extra}`,
  })
}

// Cambio de estado hecho por el personal (profesional o administrador), con las reglas de la AE4:
//  - 'no_show_auto' lo escribe solo el sistema.
//  - Marcar 'cancelled_no_show' vale para un turno confirmado o ya marcado automáticamente, y solo desde su
//    hora de inicio. Hasta 40 minutos después se genera un horario reabierto; pasado ese margen se marca igual.
//    La seña NO cambia (queda retenida). El horario original queda bloqueado (slot_locked).
//  - Corrección (regla 2.7): de 'no_show_auto' o 'cancelled_no_show' se puede pasar a 'finished' siempre, y
//    a 'confirmed' solo si no se superpone con otro turno activo de la profesional. El horario reabierto sin
//    reservar se cierra y queda en el registro de actividad quién, cuándo y de qué estado a cuál.
//  - Corregir a 'confirmed' deja registrada la llegada (arrivedAt = ahora): si no, el job lo volvería a
//    marcar como no asistido en la corrida siguiente.
// El cambio y el horario reabierto se escriben en una sola transacción.
async function changeStatusByStaff(appointment: AppointmentRow, to: string, actorName: string, now: Date = new Date()): Promise<AppointmentRow> {
  const from = appointment.status
  if (from === to) return appointment

  const invalid = (message: string) => new AppError(HTTP.BAD_REQUEST, message, 'INVALID_STATUS_TRANSITION')
  const fromNoShow = (NO_SHOW_STATUSES as readonly string[]).includes(from)

  if (to === 'no_show_auto') {
    throw invalid('El estado "No asistió (automático)" lo asigna solo el sistema')
  }
  if (to === 'cancelled_no_show') {
    if (!['confirmed', 'no_show_auto'].includes(from)) {
      throw invalid('Solo se puede marcar como "No asistió" un turno confirmado o ya marcado como no asistido automáticamente')
    }
    if (!hasStarted(appointment, now)) {
      throw new AppError(HTTP.BAD_REQUEST, 'No se puede marcar como "No asistió" un turno que todavía no empezó', 'NO_SHOW_BEFORE_START')
    }
  } else if (fromNoShow && !['finished', 'confirmed'].includes(to)) {
    throw invalid('Un turno marcado como no asistido solo se puede corregir a "Finalizado" o "Confirmado"')
  }
  const correcting = fromNoShow && ['finished', 'confirmed'].includes(to)

  if (correcting && to === 'confirmed' && await hasOverlap(prisma, {
    professionalId: appointment.professionalId, date: appointment.date, time: appointment.time,
    duration: appointment.duration, excludeAppointmentId: appointment.id,
  })) {
    throw new AppError(HTTP.CONFLICT, 'No se puede confirmar: el turno se superpone con otro turno activo de la profesional', 'APPOINTMENT_OVERLAP')
  }

  const { updated, reopenedFrom } = await prisma.$transaction(async (tx) => {
    const row = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status:     to,
        slotLocked: to === 'cancelled_no_show',
        ...(correcting && to === 'confirmed' && !appointment.arrivedAt ? { arrivedAt: now } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    })
    let firstStart: string | null = null
    if (to === 'cancelled_no_show') {
      firstStart = (await openReopenedSlot(tx, row, now))?.firstStart ?? null
    }
    if (correcting) await closeReopenedSlots(tx, row.id, 'corrected', now)
    return { updated: row, reopenedFrom: firstStart }
  })

  const extra = correcting
    ? ' (corrección del personal)'
    : to === 'cancelled_no_show'
      ? (reopenedFrom ? `; se reabre el horario desde las ${reopenedFrom}` : `; pasaron más de ${STAFF_NO_SHOW_REOPEN_LIMIT_MINUTES} minutos de la hora de inicio, no se reabre el horario`)
      : ''
  await logStatusChange(updated, from, to, actorName, extra)
  return updated
}

// Datos de la cancelación que manda el personal en el PATCH (ver cancellationRules.ts).
type StaffCancellationInput = {
  cancelledBy?:    CancelledBy
  clientNoticeAt?: string
  noticeChannel?:  NoticeChannel
  noticeNote?:     string
}

// ¿El cambio de estado toca la inasistencia (marcarla, o salir de ella)? Esos cambios van por changeStatusByStaff.
function isNoShowTransition(from: string, to: string): boolean {
  return to === 'cancelled_no_show' || to === 'no_show_auto' || (NO_SHOW_STATUSES as readonly string[]).includes(from)
}

// Un turno marcado como no asistido no se cancela ni se reprograma: primero se corrige su estado (2.7).
function assertNoShowStateAllowsChange(a: { status: string }, change: { cancelling: boolean; rescheduling: boolean }): void {
  if (change.cancelling && a.status === 'finished') {
    throw new AppError(HTTP.BAD_REQUEST, 'Un turno finalizado no se puede cancelar', 'INVALID_STATUS_TRANSITION')
  }
  if (!(NO_SHOW_STATUSES as readonly string[]).includes(a.status)) return
  if (change.cancelling || change.rescheduling) {
    throw new AppError(
      HTTP.BAD_REQUEST,
      `Un turno marcado como no asistido no se ${change.cancelling ? 'cancela' : 'reprograma'}: corregí primero su estado`,
      'INVALID_STATUS_TRANSITION',
    )
  }
}

// Update del personal: un horario ocupado (índice único parcial) responde 409 en lugar de un error 500.
async function updateAppointmentRow(id: string, data: Prisma.AppointmentUpdateInput): Promise<AppointmentRow> {
  try {
    return await prisma.appointment.update({ where: { id }, data, include: APPOINTMENT_INCLUDE })
  } catch (err: any) {
    if (isSlotConflict(err)) {
      throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
    }
    throw err
  }
}

async function afterReschedule(a: AppointmentRow, previousDate?: string | null, previousTime?: string | null) {
  const detail = previousDate && previousTime
    ? `${a.service.name} — ${fullName(a.client)} con ${a.professional.name}: ${previousDate} ${previousTime} → ${a.date} ${a.time}`
    : `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} → ${a.date} ${a.time}`

  await activityService.log({
    action: 'Turno reprogramado', module: 'appointments', level: 'warning', appointmentId: a.id,
    detail,
  })
  await notificationService.notify(a.professionalId, {
    type:  'rescheduled_appointment',
    title: 'Turno reprogramado',
    body:  `${fullName(a.client)} reprogramó ${a.service.name} para el ${a.date} a las ${a.time}.`,
  })
  mailProvider.send(
    a.professional.email,
    'Turno reprogramado — Nexa',
    loadTemplate('appointmentRescheduled', {
      PROFESSIONAL_NAME: a.professional.name,
      CLIENT_NAME:        fullName(a.client),
      SERVICE_NAME:        a.service.name,
      DATE:                formatDate(a.date),
      TIME:                a.time,
    }),
  ).catch(err => console.error('[mail] error notificando reprogramación:', err.message))
}

// Cuando ADMIN o PROFESIONAL reprograman (no el cliente), el cliente no lo sabe
// todavía — se le manda el mail acá, y el aviso en la app queda marcado con
// rescheduleNoticePending hasta que lo confirma vía acknowledge-reschedule.
async function afterStaffReschedule(a: AppointmentRow, previousDate: string, previousTime: string) {
  await activityService.log({
    action: 'Turno reprogramado', module: 'appointments', level: 'warning', appointmentId: a.id,
    detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name}: ${previousDate} ${previousTime} → ${a.date} ${a.time}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'rescheduled_appointment',
    title: 'Turno reprogramado',
    body:  `El turno de ${fullName(a.client)} (${a.service.name}) se reprogramó para el ${a.date} a las ${a.time}.`,
  })
  mailProvider.send(
    a.client.email,
    'Tu turno fue reprogramado — Nexa',
    loadTemplate('appointmentRescheduledByStaff', {
      CLIENT_NAME:    fullName(a.client),
      SERVICE_NAME:   a.service.name,
      PREVIOUS_DATE:  formatDate(previousDate),
      PREVIOUS_TIME:  previousTime,
      DATE:           formatDate(a.date),
      TIME:           a.time,
    }),
  ).catch(err => console.error('[mail] error notificando reprogramación (staff):', err.message))
}

async function registerArrival(appointment: AppointmentRow): Promise<AppointmentRow> {
  if (appointment.arrivedAt) return appointment
  if (appointment.status !== 'confirmed') {
    throw new AppError(HTTP.BAD_REQUEST, 'Solo se puede registrar la llegada de un turno confirmado', 'INVALID_STATUS')
  }
  if (appointment.date !== todayArgentinaStr()) {
    throw new AppError(HTTP.BAD_REQUEST, 'Solo se puede registrar la llegada el día del turno', 'NOT_TODAY')
  }
  return prisma.appointment.update({
    where:   { id: appointment.id },
    data:    { arrivedAt: new Date() },
    include: APPOINTMENT_INCLUDE,
  })
}

// Registra el cobro del saldo (precio - seña) hecho en el local — la seña ya
// se cobra sola por Mercado Pago, esto es la parte que se paga en mano al
// momento del servicio. `collectedById` es quién lo registra (la profesional
// del turno, o el admin si lo carga por ella).
async function registerBalancePayment(
  appointment: AppointmentRow,
  data: { method: BalancePaymentMethod; amount: number },
  collectedById: string,
): Promise<AppointmentRow> {
  if (!BALANCE_PAYMENT_METHODS.includes(data.method)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Método de pago inválido', 'INVALID_PAYMENT_METHOD')
  }
  if (!(data.amount > 0)) {
    throw new AppError(HTTP.BAD_REQUEST, 'El monto tiene que ser mayor a cero', 'INVALID_AMOUNT')
  }
  if (['cancelled', 'cancelled_no_show', 'no_show_auto'].includes(appointment.status)) {
    throw new AppError(HTTP.BAD_REQUEST, 'No se puede registrar un cobro sobre un turno cancelado o no asistido', 'INVALID_STATUS')
  }

  const alreadyPaid = appointment.paymentStatus === 'partial' || appointment.paymentStatus === 'paid'
    ? Number(appointment.depositAmount)
    : 0
  const fullyPaid = alreadyPaid + data.amount >= Number(appointment.servicePrice)

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      balancePaymentMethod: data.method,
      balancePaidAmount:    data.amount,
      balancePaidAt:        new Date(),
      balanceCollectedById: collectedById,
      paymentStatus:        fullyPaid ? 'paid' : appointment.paymentStatus,
    },
    include: APPOINTMENT_INCLUDE,
  })

  const methodLabel = { cash: 'efectivo', transfer: 'transferencia', card: 'tarjeta', other: 'otro método' }[data.method]
  await activityService.log({
    userName: updated.balanceCollectedBy?.name ?? 'Admin',
    action: 'Cobro de saldo registrado',
    module: 'payments',
    appointmentId: updated.id,
    detail: `${updated.service.name} — ${fullName(updated.client)} con ${updated.professional.name}: $${data.amount} en ${methodLabel} (turno ${appointment.id})`,
  })

  return updated
}

// Cancelar un turno que forma parte de un combo cancela todo el grupo (comboGroupId): las patas de un combo se
// reservan y viven juntas, así que dejar una activa mientras el resto se cancela dejaría a la clienta con una
// experiencia incompleta. La devolución de la seña se decide UNA sola vez para todo el grupo (ver
// cancellationRules.ts) con la hora del primer turno del grupo, y se aplica a las patas que tengan seña paga.
//
// Una cancelación hecha cuando el turno ya empezó deja bloqueado el horario ORIGINAL (slot_locked) y, si pasaron
// hasta 40 minutos desde el inicio, abre un horario reabierto. Cada pata se escribe en su propia transacción.
type CancelOptions = {
  cancelledBy: CancelledBy
  emailClient: boolean
  reason?:     string
  // Aviso de la clienta cargado por el personal (solo cancelledBy 'client'). Sin aviso, las horas se cuentan
  // desde ahora (cancelación de la clienta desde la app).
  notice?:     CancellationNotice
  now?:        Date
}

async function cancelWithGroup(appointment: AppointmentRow, opts: CancelOptions): Promise<AppointmentRow[]> {
  const now      = opts.now ?? new Date()
  const settings = await settingsService.getPaymentSettings()

  // Solo las patas que todavía se pueden cancelar: una pata finalizada o ya marcada como no asistida
  // conserva su estado.
  const group = appointment.comboGroupId
    ? await prisma.appointment.findMany({
        where:   { comboGroupId: appointment.comboGroupId, status: { in: ['pending', 'confirmed'] } },
        include: APPOINTMENT_INCLUDE,
      })
    : [appointment]

  const paid        = group.some(isDepositPaid)
  const firstStart  = new Date(Math.min(...group.map(a => startInstant(a).getTime())))
  const noticeHours = opts.cancelledBy === 'client' ? noticeHoursBetween(firstStart, opts.notice?.at ?? now) : undefined
  const refunded    = decideRefund({ settings, cancelledBy: opts.cancelledBy, paid, noticeHours })
  const extra       = describeCancellation({
    cancelledBy: opts.cancelledBy, hadPaidDeposit: paid, refunded, notice: opts.notice, noticeHours,
  })

  const updatedList: AppointmentRow[] = []
  for (const a of group) {
    const started = hasStarted(a, now)
    const updated = await prisma.$transaction(async (tx) => {
      // Servicio especial: el horario del día vuelve a quedar libre (lock del servicio primero, como al reservar).
      if (a.service.isSpecial) await releaseSpecialSlot(tx, a)
      const row = await tx.appointment.update({
        where: { id: a.id },
        data: {
          status:        'cancelled',
          cancelledAt:   now,
          cancelReason:  opts.reason ?? 'user_cancelled',
          cancelledBy:   opts.cancelledBy,
          paymentStatus: refunded && isDepositPaid(a) ? 'refunded' : a.paymentStatus,
          // Cancelada ya empezada: el horario ORIGINAL queda bloqueado (no se vuelve a reservar).
          slotLocked:    started,
          ...(opts.notice ? {
            clientNoticeAt:   opts.notice.at,
            noticeChannel:    opts.notice.channel,
            noticeNote:       opts.notice.note,
            noticeLoadedById: opts.notice.loadedById,
            noticeLoadedAt:   opts.notice.loadedAt,
          } : {}),
        },
        include: APPOINTMENT_INCLUDE,
      })
      // Ya empezado y hasta 40 minutos después del inicio: se abre un horario reabierto.
      if (started) await openReopenedSlot(tx, row, now)
      return row
    })
    await afterCancel(updated, opts.emailClient, extra)
    updatedList.push(updated)
  }
  return updatedList
}

type ComboPeer = {
  appointmentId:    string
  serviceName:      string
  professionalId:   string
  professionalName: string
  status:           string
  duration:         number
  price:            number
}

// Un combo es "simultáneo" cuando todas sus patas activas comparten fecha y
// hora. Para cada grupo simultáneo devuelve la lista de patas (servicio +
// profesional), para poder mostrarle al profesional/admin con quién comparte
// el horario. Los grupos que NO son simultáneos no aparecen en el Map.
async function comboGroupPeers(comboGroupIds: (string | null)[]): Promise<Map<string, ComboPeer[]>> {
  const ids = [...new Set(comboGroupIds.filter((id): id is string => id !== null))]
  const result = new Map<string, ComboPeer[]>()
  if (ids.length === 0) return result

  const rows = await prisma.appointment.findMany({
    where:   { comboGroupId: { in: ids } },
    include: { service: true, professional: true },
  })
  const byGroup = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byGroup.get(r.comboGroupId!) ?? []
    list.push(r)
    byGroup.set(r.comboGroupId!, list)
  }
  for (const [groupId, entries] of byGroup) {
    const active = entries.filter(e => e.status !== 'cancelled')
    if (active.length > 1 && active.every(e => e.date === active[0].date && e.time === active[0].time)) {
      result.set(groupId, entries.map(e => ({
        appointmentId:    e.id,
        serviceName:      e.service.name,
        professionalId:   e.professionalId,
        professionalName: e.professional.name,
        status:           e.status,
        duration:         e.duration,
        price:            Number(e.servicePrice),
      })))
    }
  }
  return result
}

// Turno manual del admin (walk-in / por teléfono) — busca un cliente existente por email
// o crea uno nuevo. Sin email (frecuente en un walk-in) se genera uno placeholder único,
// así cada turno manual sin datos de contacto completos igual queda con un cliente propio.
async function findOrCreateManualClient(name: string, phone: string, email: string): Promise<string> {
  assertValidPhone(phone)
  // Minúsculas, como hace el login: si no, la clienta creada a mano no podría entrar después.
  const trimmedEmail = email.trim().toLowerCase()
  if (trimmedEmail) {
    const existing = await prisma.user.findFirst({ where: { email: { equals: trimmedEmail, mode: 'insensitive' } } })
    if (existing) {
      if (existing.role !== 'client') {
        throw new AppError(HTTP.BAD_REQUEST, 'Ese email ya pertenece a una cuenta que no es de cliente', 'EMAIL_NOT_CLIENT')
      }
      return existing.id
    }
  }

  const finalEmail    = trimmedEmail || `walkin-${randomUUID()}@nexa.local`
  const passwordHash  = await bcryptProvider.hash(randomUUID())
  const user = await prisma.user.create({
    data: {
      name, email: finalEmail, phone: phone.trim() || null,
      passwordHash, role: 'client', emailVerified: true,
    },
  })
  return user.id
}

// Turno manual (walk-in / por teléfono) — usado tanto por el admin (elige el
// profesional) como por el propio profesional (se crea para sí mismo). Sin seña,
// paymentStatus queda en 'pending' ya que se salta el flujo de pago del cliente.
async function createManualAppointment(professionalId: string, data: {
  clientName: string; clientPhone: string; clientEmail: string
  serviceId: string; date: string; time: string
}): Promise<AppointmentRow> {
  const service = await prisma.service.findUnique({ where: { id: data.serviceId } })
  if (!service || service.status !== 'active') {
    throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
  }
  const professional = await prisma.user.findUnique({ where: { id: professionalId } })
  if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
    throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
  }

  const clientId = await findOrCreateManualClient(data.clientName, data.clientPhone, data.clientEmail)

  let appointment: AppointmentRow
  try {
    appointment = await prisma.appointment.create({
      data: {
        clientId,
        professionalId,
        serviceId:      data.serviceId,
        date:           data.date,
        time:           data.time,
        duration:       service.duration,
        servicePrice:   Number(service.price),
        depositAmount:  0,
        status:         'confirmed',
        paymentStatus:  'pending',
      },
      include: APPOINTMENT_INCLUDE,
    })
  } catch (err: any) {
    if (isSlotConflict(err)) {
      throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
    }
    throw err
  }

  await afterCreate(appointment)
  return appointment
}

export const ANY_PROFESSIONAL_SENTINEL = 'any'

// R-04 (RF-06) — "Cualquiera". Candidatas: profesionales activas, habilitadas
// para el servicio, con una franja de disponibilidad que cubra ese día y hora,
// sin vacaciones esa fecha y sin turno que ocupe esa hora de inicio (activo, incluida la inasistencia
// automática, o con el horario original bloqueado). Entre ellas, la de menor carga de la SEMANA de la fecha
// pedida (lunes a domingo, turnos no cancelados ni marcados como no asistidos: cancelled_no_show y no_show_auto); a igual carga, la
// de mayor antigüedad (Professional.createdAt ascendente). Si hay profesionales
// para el servicio pero ninguna libre en ese horario → 409.
// `excludeIds` saca profesionales ya asignados a otro servicio del mismo combo
// simultáneo (no puede hacer dos a la vez); `allowedIds` es la restricción que
// el admin puede poner por componente de combo.
async function resolveProfessionalId(
  serviceId: string,
  requestedProfessionalId: string,
  slot: { date: string; time: string },
  excludeIds: string[] = [],
  allowedIds?: string[],
): Promise<string> {
  if (requestedProfessionalId !== ANY_PROFESSIONAL_SENTINEL) return requestedProfessionalId

  const enabled = await prisma.user.findMany({
    where: {
      role:   { in: ['professional', 'admin'] },
      active: true,
      id:     allowedIds && allowedIds.length > 0 ? { in: allowedIds, notIn: excludeIds } : excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      professional: { services: { some: { serviceId, active: true } } },
    },
    select: {
      id: true,
      professional: {
        select: {
          createdAt: true, joinedAt: true, vacationFrom: true, vacationTo: true,
          availability: { where: { active: true, dayOfWeek: backendDayOf(slot.date) }, select: { startTime: true, endTime: true } },
        },
      },
    },
  })
  if (enabled.length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, 'No hay profesionales disponibles para este servicio', 'NO_PROFESSIONAL_AVAILABLE')
  }

  // Ocupa el inicio todo turno activo (incluida la inasistencia automática) y los que dejaron el horario
  // original bloqueado: es el mismo criterio que el índice único parcial.
  const busy = await prisma.appointment.findMany({
    where:  { professionalId: { in: enabled.map(u => u.id) }, date: slot.date, time: slot.time, ...OCCUPYING_SLOT_FILTER },
    select: { professionalId: true },
  })
  const busyIds = new Set(busy.map(b => b.professionalId))

  let candidates = enabled.filter(u =>
    u.professional &&
    !busyIds.has(u.id) &&
    !isOnVacation(u.professional, slot.date) &&
    isTimeInRanges(u.professional.availability, slot.time),
  )

  // Si el inicio cae dentro de un horario reabierto de alguna candidata, solo sirve la que lo tiene vigente
  // y el servicio le entra (ver checkClientStart). Fuera de los horarios reabiertos no cambia nada.
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true } })
  const checked: typeof candidates = []
  for (const u of candidates) {
    try {
      await checkClientStart(prisma, { professionalId: u.id, date: slot.date, time: slot.time, duration: service?.duration ?? 0, now: new Date() })
      checked.push(u)
    } catch (err) {
      if (!(err instanceof AppError)) throw err
    }
  }
  candidates = checked
  if (candidates.length === 0) {
    throw new AppError(HTTP.CONFLICT, 'Ninguna profesional está libre en ese día y horario. Elegí otro horario.', 'NO_PROFESSIONAL_FREE')
  }

  const week   = weekRangeOf(slot.date)
  const counts = await prisma.appointment.groupBy({
    by:     ['professionalId'],
    where:  {
      professionalId: { in: candidates.map(c => c.id) },
      date:           { gte: week.from, lte: week.to },
      // La inasistencia automática ocupa el horario pero NO suma a la carga semanal.
      status:         { notIn: [...NOT_COUNTED_IN_LOAD_STATUSES] },
    },
    _count: { id: true },
  })
  const load = new Map(counts.map(c => [c.professionalId, c._count.id]))
  // Menos carga semanal primero; a igual carga gana la más antigua en el estudio (fecha de ingreso que carga el
  // administrador, o la de alta de la cuenta si no la cargó); a igual antigüedad, el id para que sea estable.
  const seniority = (u: (typeof candidates)[number]) => (u.professional!.joinedAt ?? u.professional!.createdAt).getTime()
  candidates.sort((a, b) =>
    (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
    || seniority(a) - seniority(b)
    || a.id.localeCompare(b.id),
  )
  return candidates[0].id
}

// Flujo de la clienta (reserva, combo, reprogramación): la hora de inicio tiene
// que caer dentro de alguna franja que la profesional definió para ese día de
// la semana, y no en sus vacaciones. Los turnos manuales del admin/profesional
// NO pasan por acá (pueden cargar un sobreturno a propósito). El índice único
// parcial sigue siendo la única defensa contra la doble reserva; esto solo
// evita reservar fuera del horario de trabajo (ADR-002).
async function assertWithinAvailability(professionalUserId: string, date: string, time: string): Promise<void> {
  const professional = await prisma.professional.findUnique({
    where:  { userId: professionalUserId },
    select: {
      vacationFrom: true, vacationTo: true,
      availability: { where: { active: true, dayOfWeek: backendDayOf(date) }, select: { startTime: true, endTime: true } },
    },
  })
  if (!professional || isOnVacation(professional, date) || !isTimeInRanges(professional.availability, time)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Ese horario está fuera de la disponibilidad de la profesional. Elegí otro horario.', 'OUT_OF_HOURS')
  }
}

// El índice único parcial que evita doble reserva no es un @@unique de Prisma (tiene
// un WHERE), así que la violación llega como PrismaClientUnknownRequestError sin
// err.code — se detecta por el nombre de la constraint en el mensaje.
function isSlotConflict(err: any): boolean {
  const msg = String(err?.message ?? '')
  return err?.code === 'P2002'
    || msg.includes('appointments_professional_date_time_active_key')
    || msg.includes('duplicate key value violates unique constraint')
}

async function assertClientNotBlocked(clientId: string) {
  const client = await prisma.client.findUnique({ where: { userId: clientId } })
  if (client?.blocked) {
    throw new AppError(HTTP.FORBIDDEN, 'Tu cuenta está bloqueada y no puede reservar turnos. Contactanos para más información.', 'CLIENT_BLOCKED')
  }
}

function isPromoLive(promo: { status: string; startDate: string | null; endDate: string | null }): boolean {
  if (promo.status !== 'active') return false
  const today = todayArgentinaStr()
  if (promo.startDate && promo.startDate > today) return false
  if (promo.endDate && promo.endDate < today) return false
  return true
}

// Valida una promoción de servicio (home) contra el servicio que se está reservando
// y devuelve el precio repriceado — nunca se confía en un precio mandado por el
// cliente, igual que resolvePromotionGroup en order.service.ts para la tienda.
// Solo soporta promos simples de un único servicio (kind: 'discount'), que es lo
// único que ofrece ServicePromotionsSection en el home.
async function resolveServicePromotion(promotionId: string, serviceId: string): Promise<number> {
  const promo = await prisma.promotion.findUnique({ where: { id: promotionId } })
  if (!promo || promo.type !== 'service' || !isPromoLive(promo)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Esta promoción ya no está disponible. Volvé a elegir el servicio.', 'PROMOTION_NOT_AVAILABLE')
  }
  if (promo.kind !== 'discount') {
    throw new AppError(HTTP.BAD_REQUEST, 'Esta promoción no se puede reservar así. Volvé a elegir el servicio.', 'PROMOTION_MISMATCH')
  }
  const items = (promo.items as unknown as { id: string }[] | null) ?? []
  if (items.length !== 1 || items[0].id !== serviceId) {
    throw new AppError(HTTP.BAD_REQUEST, 'La promoción no corresponde a este servicio. Volvé a elegir el servicio.', 'PROMOTION_MISMATCH')
  }
  return Number(promo.price)
}

export const appointmentService = {

  // ── Cliente ──────────────────────────────────────────────────────

  createForClient: async (
    clientId: string,
    input: { serviceId: string; professionalId: string; date: string; time: string; termsAccepted: boolean; promotionId?: string | null; depositMethod?: 'mercadopago' | 'whatsapp' },
  ) => {
    await assertClientNotBlocked(clientId)

    // RF-06.01 — (re)graba la aceptación de Términos/Política al confirmar la
    // reserva. Cubre tanto el registro reciente como cuentas viejas sin este dato.
    await prisma.user.update({ where: { id: clientId }, data: { termsAcceptedAt: new Date(), termsVersion: PRIVACY_POLICY_VERSION } })

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } })
    if (!service || service.status !== 'active') {
      throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
    }

    // Reserva tardía: hasta 15 minutos después de la hora de inicio. Va antes de elegir profesional.
    const now = new Date()
    assertStartTimeNotPassed(input.date, input.time, now)

    const professionalId = await resolveProfessionalId(input.serviceId, input.professionalId, { date: input.date, time: input.time })
    const professional = await prisma.user.findUnique({ where: { id: professionalId } })
    if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
      throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
    }
    await assertWithinAvailability(professionalId, input.date, input.time)
    // Horario reabierto: valida el inicio y la duración (ver reopenedSlots.ts).
    const startCheck = await checkClientStart(prisma, { professionalId, date: input.date, time: input.time, duration: service.duration, now })

    const paymentSettings = await settingsService.getPaymentSettings()
    const price   = input.promotionId ? await resolveServicePromotion(input.promotionId, input.serviceId) : Number(service.price)
    const deposit = computeDeposit(price, paymentSettings)

    let appointment: AppointmentRow
    try {
      // En un horario reabierto la verificación por duración se repite adentro de la transacción, bajo un
      // lock por profesional y día, para que dos reservas simultáneas no se pisen.
      const createRow = (db: Prisma.TransactionClient) => db.appointment.create({
        data: {
          clientId,
          professionalId,
          serviceId:      input.serviceId,
          date:           input.date,
          time:           input.time,
          duration:       service.duration,
          servicePrice:   price,
          depositAmount:  deposit,
          // Solo tiene sentido guardarlo si de verdad hay seña que coordinar.
          depositMethod:  deposit > 0 && input.depositMethod === 'whatsapp' ? 'whatsapp' : null,
          promotionId:    input.promotionId ?? null,
          status:         'confirmed',
          // Arranca en 'pending' — solo pasa a 'partial' cuando llega el
          // webhook de Mercado Pago confirmando que la seña se pagó de verdad
          // (o cuando el admin la marca paga a mano, si se coordinó por WhatsApp).
          paymentStatus:  'pending',
        },
        include: APPOINTMENT_INCLUDE,
      })
      appointment = startCheck.reopened
        ? await prisma.$transaction(async (tx) => {
            await lockProfessionalDay(tx, professionalId, input.date)
            await assertServiceFits(tx, { professionalId, date: input.date, time: input.time, duration: service.duration })
            return createRow(tx)
          })
        : await createRow(prisma)
    } catch (err: any) {
      if (err instanceof AppError) throw err
      if (isSlotConflict(err)) {
        throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
      }
      throw err
    }

    // OJO: acá NO se llama a afterCreate. El turno recién se le avisa al
    // profesional (notificación + mail + actividad) cuando se confirma el pago
    // de la seña — ver applyPaymentResult. Hasta entonces es solo una reserva
    // provisoria que el job release-unpaid libera si no se paga.
    return toClientView(appointment)
  },

  // Reserva un combo (siempre en simultáneo): crea un turno por cada servicio
  // componente, todos con el mismo comboGroupId, misma fecha y hora.
  //
  // Precio: el del servicio combo que cargó el admin (no la suma de los
  // componentes) — se reparte proporcionalmente entre las patas para que el
  // total cobrado coincida con el precio anunciado.
  //
  // Seña: UNA sola para todo el combo (se paga por el día/hora, no por
  // servicio). Se guarda entera en la primera pata y 0 en las demás; el pago
  // real entra por una única preferencia de Mercado Pago con external_reference
  // "group:<comboGroupId>".
  createComboForClient: async (
    clientId: string,
    input: {
      comboServiceId: string
      simultaneous: boolean
      components: { serviceId: string; professionalId: string; date: string; time: string }[]
      depositMethod?: 'mercadopago' | 'whatsapp'
    },
  ) => {
    await assertClientNotBlocked(clientId)

    const comboService = await prisma.service.findUnique({ where: { id: input.comboServiceId } })
    if (!comboService || comboService.status !== 'active' || !comboService.isCombo) {
      throw new AppError(HTTP.BAD_REQUEST, 'Combo no disponible', 'SERVICE_NOT_FOUND')
    }
    if (input.components.length === 0) {
      throw new AppError(HTTP.BAD_REQUEST, 'El combo necesita al menos un servicio', 'COMBO_EMPTY')
    }

    const expectedIds = comboService.comboServiceIds
    const providedIds = input.components.map(c => c.serviceId)
    const sameSet =
      expectedIds.length === providedIds.length &&
      new Set(expectedIds).size === expectedIds.length &&
      new Set(providedIds).size === providedIds.length &&
      expectedIds.every(id => providedIds.includes(id))
    if (!sameSet) {
      throw new AppError(HTTP.BAD_REQUEST, 'Los servicios del combo no coinciden con su configuración', 'COMBO_MISMATCH')
    }

    // El admin puede haber restringido, para este combo puntual, qué profesionales
    // pueden hacer cada componente — { [serviceId]: professionalId[] }.
    const comboProfessionals = (comboService.comboProfessionals ?? {}) as Record<string, string[]>

    // "Cualquiera" se resuelve antes de entrar a la transacción — cada componente
    // se resuelve en orden. En simultáneo se van excluyendo los profesionales ya
    // asignados: nadie puede hacer dos servicios a la vez.
    const resolvedComponents: { serviceId: string; professionalId: string; date: string; time: string; reopened?: boolean }[] = []
    const now = new Date()
    for (const component of input.components) {
      // Reserva tardía: hasta 15 minutos después de la hora de inicio.
      assertStartTimeNotPassed(component.date, component.time, now)
      const excludeIds = input.simultaneous ? resolvedComponents.map(c => c.professionalId) : []
      const allowedIds = comboProfessionals[component.serviceId]
      if (
        component.professionalId !== ANY_PROFESSIONAL_SENTINEL &&
        allowedIds && allowedIds.length > 0 &&
        !allowedIds.includes(component.professionalId)
      ) {
        throw new AppError(HTTP.BAD_REQUEST, 'Esa profesional no está habilitada para ese servicio en este turno simultáneo', 'PROFESSIONAL_NOT_ALLOWED')
      }
      const professionalId = await resolveProfessionalId(component.serviceId, component.professionalId, { date: component.date, time: component.time }, excludeIds, allowedIds)
      await assertWithinAvailability(professionalId, component.date, component.time)
      const componentService = await prisma.service.findUnique({ where: { id: component.serviceId }, select: { duration: true } })
      const startCheck = await checkClientStart(prisma, {
        professionalId, date: component.date, time: component.time, duration: componentService?.duration ?? 0, now,
      })
      resolvedComponents.push({ ...component, professionalId, reopened: startCheck.reopened })
    }

    if (input.simultaneous) {
      const [first, ...rest] = resolvedComponents
      const allSame = rest.every(c => c.date === first.date && c.time === first.time)
      if (!allSame) {
        throw new AppError(HTTP.BAD_REQUEST, 'Los turnos simultáneos deben tener la misma fecha y hora', 'COMBO_NOT_SIMULTANEOUS')
      }
      // Si el cliente eligió a mano la misma profesional para dos servicios,
      // en simultáneo es imposible — se lo decimos claro en vez de dejar que
      // reviente el índice único como "horario ocupado".
      const proIds = resolvedComponents.map(c => c.professionalId)
      if (new Set(proIds).size !== proIds.length) {
        throw new AppError(
          HTTP.CONFLICT,
          'No se puede hacer dos servicios en simultáneo con la misma profesional. Elegí una profesional distinta para cada uno.',
          'SAME_PROFESSIONAL_SIMULTANEOUS',
        )
      }
    }

    const paymentSettings = await settingsService.getPaymentSettings()
    const comboGroupId    = randomUUID()
    const comboPrice      = Number(comboService.price)
    const comboDeposit    = computeDeposit(comboPrice, paymentSettings)
    // Sin seña que cobrar (combo sin precio o política de seña en 0): las patas
    // se confirman al toque, sin pasar por Mercado Pago.
    const noDeposit       = comboDeposit <= 0

    // Precio de catálogo de cada componente — para repartir el precio del combo
    // en proporción a lo que "vale" cada servicio.
    const componentServices = await prisma.service.findMany({
      where:  { id: { in: resolvedComponents.map(c => c.serviceId) } },
    })
    const svcById   = new Map(componentServices.map(s => [s.id, s]))
    const rawTotal  = resolvedComponents.reduce((s, c) => s + Number(svcById.get(c.serviceId)?.price ?? 0), 0) || 1

    let created: AppointmentRow[]
    try {
      created = await prisma.$transaction(async (tx) => {
        const rows: AppointmentRow[] = []
        let assignedSoFar = 0
        for (let i = 0; i < resolvedComponents.length; i++) {
          const component = resolvedComponents[i]
          const service = svcById.get(component.serviceId)
          if (!service || service.status !== 'active') {
            throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
          }
          const professional = await tx.user.findUnique({ where: { id: component.professionalId } })
          if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
            throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
          }
          // Horario reabierto: verificación por duración bajo lock (ver reopenedSlots.ts).
          if (component.reopened) {
            await lockProfessionalDay(tx, component.professionalId, component.date)
            await assertServiceFits(tx, { professionalId: component.professionalId, date: component.date, time: component.time, duration: service.duration })
          }

          // La última pata se lleva el resto, así la suma da exacto el precio del combo.
          const isLast   = i === resolvedComponents.length - 1
          const legPrice = isLast
            ? comboPrice - assignedSoFar
            : Math.round(comboPrice * (Number(service.price) / rawTotal))
          assignedSoFar += legPrice

          const appointment = await tx.appointment.create({
            data: {
              clientId,
              professionalId: component.professionalId,
              serviceId:      component.serviceId,
              date:           component.date,
              time:           component.time,
              duration:       service.duration,
              servicePrice:   legPrice,
              // La seña entera va en la primera pata; el resto en 0.
              depositAmount:  i === 0 ? comboDeposit : 0,
              depositMethod:  i === 0 && comboDeposit > 0 && input.depositMethod === 'whatsapp' ? 'whatsapp' : null,
              status:         'confirmed',
              // Arranca 'pending' — pasa a 'partial' cuando Mercado Pago
              // confirma la única seña del grupo (applyGroupPaymentResult).
              // Sin seña, se confirma directamente.
              paymentStatus:  noDeposit ? 'partial' : 'pending',
              comboGroupId,
            },
            include: APPOINTMENT_INCLUDE,
          })
          rows.push(appointment)
        }
        return rows
      })
    } catch (err: any) {
      if (err instanceof AppError) throw err
      if (isSlotConflict(err)) {
        throw new AppError(HTTP.CONFLICT, 'Uno de los horarios del combo ya no está disponible. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
      }
      throw err
    }

    // Con seña: a los profesionales se les avisa recién cuando se paga
    // (applyGroupPaymentResult). Sin seña: se avisa acá, ya está confirmado.
    if (noDeposit) {
      await afterCreateGroup(created)
    }

    return {
      comboGroupId,
      comboName:    comboService.name,
      totalPrice:   comboPrice,
      depositAmount: comboDeposit,
      appointments: created.map(toClientView),
    }
  },

  // Genera el checkout de Mercado Pago para la ÚNICA seña de un combo ya creado.
  createComboPaymentPreference: async (clientId: string, comboGroupId: string) => {
    const legs = await prisma.appointment.findMany({
      where:   { comboGroupId, status: { not: 'cancelled' } },
      include: APPOINTMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
    if (legs.length === 0 || legs.some(l => l.clientId !== clientId)) {
      throw new AppError(HTTP.NOT_FOUND, 'Combo no encontrado', 'NOT_FOUND')
    }
    if (legs.every(l => l.paymentStatus === 'partial')) {
      throw new AppError(HTTP.BAD_REQUEST, 'La seña de este combo ya está paga', 'ALREADY_PAID')
    }
    if (legs.some(l => l.depositMethod === 'whatsapp')) {
      throw new AppError(HTTP.BAD_REQUEST, 'La seña de este combo se coordina por WhatsApp, no por Mercado Pago', 'WHATSAPP_DEPOSIT')
    }

    const deposit    = legs.reduce((s, l) => s + Number(l.depositAmount), 0)
    const serviceNames = legs.map(l => l.service.name).join(' + ')

    const { checkoutUrl } = await paymentService.createPreference({
      title:             `Seña combo — ${serviceNames}`,
      amount:            deposit,
      externalReference: `group:${comboGroupId}`,
      payerEmail:        legs[0].client.email,
    })
    return { checkoutUrl }
  },

  // Verificación "a demanda" de la seña del combo — no depende del webhook.
  verifyComboPayment: async (clientId: string, comboGroupId: string): Promise<{ paymentStatus: string }> => {
    const legs = await prisma.appointment.findMany({
      where:  { comboGroupId, status: { not: 'cancelled' } },
      select: { clientId: true, paymentStatus: true },
    })
    if (legs.length === 0 || legs.some(l => l.clientId !== clientId)) {
      throw new AppError(HTTP.NOT_FOUND, 'Combo no encontrado', 'NOT_FOUND')
    }
    if (legs.every(l => l.paymentStatus === 'partial')) return { paymentStatus: 'partial' }

    const found = await paymentService.findPaymentByReference(`group:${comboGroupId}`)
    if (found) await appointmentService.applyGroupPaymentResult(comboGroupId, found.id, found.status, { amount: found.amount, currency: found.currency })

    const fresh = await prisma.appointment.findFirst({
      where:  { comboGroupId, status: { not: 'cancelled' } },
      select: { paymentStatus: true },
    })
    return { paymentStatus: fresh?.paymentStatus ?? 'pending' }
  },

  // Aplica el resultado del pago de la seña de un combo a TODAS sus patas.
  // Idempotente (webhook + polling). Al aprobarse, se le avisa a cada profesional.
  applyGroupPaymentResult: async (comboGroupId: string, mpPaymentId: string, status: string, paid?: PaidInfo) => {
    const legs = await prisma.appointment.findMany({
      where:   { comboGroupId, status: { not: 'cancelled' } },
      include: APPOINTMENT_INCLUDE,
    })
    if (legs.length === 0) {
      console.warn(`[mercadopago] Webhook para combo inexistente: ${comboGroupId}`)
      return
    }
    if (legs.every(l => l.paymentStatus === 'partial')) return // ya aplicado

    // La seña del combo es única y es la suma de la seña de cada pata.
    if (!(await isPaymentAcceptable({
      kind: 'Combo', id: comboGroupId, mpPaymentId, status,
      expected: legs.reduce((sum, l) => sum + Number(l.depositAmount), 0), paid,
    }))) return

    const paymentStatus = status === 'approved' ? 'partial' : status
    // Escritura condicional: si otro aviso del mismo pago ya aplicó el resultado a
    // todas las patas, esta llamada no cambia nada y no vuelve a notificar.
    const claimed = await prisma.appointment.updateMany({
      where: { comboGroupId, status: { not: 'cancelled' }, paymentStatus: { not: 'partial' } },
      data:  { paymentStatus, mpPaymentId },
    })
    if (claimed.count === 0) return

    await activityService.log({
      action: 'Pago de seña recibido', module: 'payments', appointmentId: legs[0].id,
      detail: `Combo ${comboGroupId} — Mercado Pago informó estado "${status}"`,
    })

    if (status === 'approved') {
      await afterCreateGroup(legs.map(leg => ({ ...leg, paymentStatus })))
    }
  },

  // El admin confirma a mano que cobró (o coordinó) la seña de un turno que el
  // cliente eligió pagar por WhatsApp en vez de Mercado Pago — no hay webhook
  // que lo confirme solo. Funciona tanto para un turno suelto como para un
  // combo (ahí aplica a TODAS las patas, igual que applyGroupPaymentResult).
  // Idempotente: si ya estaba paga, solo devuelve el estado actual.
  registerWhatsappDepositPaid: async (id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')

    if (appointment.comboGroupId) {
      const comboGroupId = appointment.comboGroupId
      const legs = await prisma.appointment.findMany({
        where:   { comboGroupId, status: { not: 'cancelled' } },
        include: APPOINTMENT_INCLUDE,
      })
      if (legs.length === 0) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
      const depositLeg = legs.find(l => Number(l.depositAmount) > 0) ?? legs[0]
      if (depositLeg.depositMethod !== 'whatsapp') {
        throw new AppError(HTTP.BAD_REQUEST, 'Este turno no coordina el pago de la seña por WhatsApp', 'NOT_WHATSAPP_DEPOSIT')
      }

      if (!legs.every(l => l.paymentStatus === 'partial')) {
        await prisma.appointment.updateMany({
          where: { comboGroupId, status: { not: 'cancelled' } },
          data:  { paymentStatus: 'partial' },
        })
        await activityService.log({
          action: 'Seña coordinada por WhatsApp marcada como paga', module: 'payments', appointmentId: legs[0].id,
          detail: `Combo — ${fullName(legs[0].client)}: ${legs.map(l => l.service.name).join(', ')}`,
        })
        await afterCreateGroup(legs.map(l => ({ ...l, paymentStatus: 'partial' })))
      }

      const fresh = await prisma.appointment.findMany({
        where:   { comboGroupId, status: { not: 'cancelled' } },
        include: APPOINTMENT_INCLUDE,
      })
      const peers  = (await comboGroupPeers([comboGroupId])).get(comboGroupId) ?? null
      const target = fresh.find(l => l.id === id) ?? fresh[0]
      return toAdminView(target, peers)
    }

    const full = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!full) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    if (full.depositMethod !== 'whatsapp') {
      throw new AppError(HTTP.BAD_REQUEST, 'Este turno no coordina el pago de la seña por WhatsApp', 'NOT_WHATSAPP_DEPOSIT')
    }
    if (full.paymentStatus === 'partial') return toAdminView(full, null)

    const updated = await prisma.appointment.update({
      where: { id }, data: { paymentStatus: 'partial' }, include: APPOINTMENT_INCLUDE,
    })
    await activityService.log({
      action: 'Seña coordinada por WhatsApp marcada como paga', module: 'payments', appointmentId: updated.id,
      detail: `${updated.service.name} — ${fullName(updated.client)} con ${updated.professional.name}`,
    })
    await afterCreate(updated)
    return toAdminView(updated, null)
  },

  // Reserva de un "servicio especial": el cliente elige zonas/paquetes (arman el
  // precio/duración, nunca confiados del cliente) y un horario puntual — el
  // profesional sale del horario, el cliente nunca lo elige. El horario se
  // bloquea con un lock de fila (FOR UPDATE) sobre el Service dentro de la misma
  // transacción que crea el turno, así dos reservas simultáneas del mismo
  // horario quedan serializadas: la segunda relee el array ya actualizado y
  // encuentra el horario tomado → 409 SLOT_TAKEN.
  createSpecialForClient: async (
    clientId: string,
    input: { serviceId: string; time: string; zoneIds: string[]; packageIds: string[] },
  ) => {
    await assertClientNotBlocked(clientId)

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } })
    if (!service || service.status !== 'active' || !service.isSpecial || !service.specialDate) {
      throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
    }

    // Reserva tardía: hasta 15 minutos después de la hora del horario del evento.
    assertStartTimeNotPassed(service.specialDate, input.time)

    const zones    = ((service.zones    as unknown as { id: string; name: string; duration: number; price: number; active: boolean }[]) ?? [])
    const packages = ((service.packages as unknown as { id: string; name: string; zoneIds: string[]; duration: number; price: number; active: boolean }[]) ?? [])

    const selectedZones    = zones.filter(z => z.active && input.zoneIds.includes(z.id))
    const selectedPackages = packages.filter(p => p.active && input.packageIds.includes(p.id))
    if (selectedZones.length !== input.zoneIds.length || selectedPackages.length !== input.packageIds.length) {
      throw new AppError(HTTP.BAD_REQUEST, 'Una de las zonas o paquetes elegidos ya no está disponible', 'ZONE_NOT_FOUND')
    }
    if (selectedZones.length === 0 && selectedPackages.length === 0) {
      throw new AppError(HTTP.BAD_REQUEST, 'Elegí al menos una zona o paquete', 'VALIDATION_ERROR')
    }

    // Precio/duración siempre calculados server-side sobre el catálogo real del
    // servicio — nunca confiados de lo que mande el cliente (mismo principio
    // que el fix de precios de promociones).
    const price    = selectedZones.reduce((s, z) => s + z.price, 0)    + selectedPackages.reduce((s, p) => s + p.price, 0)
    const duration = selectedZones.reduce((s, z) => s + z.duration, 0) + selectedPackages.reduce((s, p) => s + p.duration, 0)

    const paymentSettings = await settingsService.getPaymentSettings()
    const deposit = computeDeposit(price, paymentSettings)

    const zonesSnapshot    = selectedZones.map(z => ({ name: z.name, price: z.price, duration: z.duration }))
    const packagesSnapshot = selectedPackages.map(p => ({ name: p.name, price: p.price, duration: p.duration }))

    let appointment: AppointmentRow
    try {
      appointment = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ status: string; is_special: boolean; special_slots: unknown }[]>`
          SELECT status, is_special, special_slots FROM services WHERE id = ${input.serviceId}::uuid FOR UPDATE
        `
        const row = locked[0]
        if (!row || row.status !== 'active' || !row.is_special) {
          throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
        }

        const slots = (row.special_slots as SpecialSlot[]) ?? []
        const slotIndex = slots.findIndex(s => s.time === input.time && s.active && !s.appointmentId)
        if (slotIndex === -1) {
          throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible. Elegí otro.', 'SLOT_TAKEN')
        }
        const slot = slots[slotIndex]

        const professional = await tx.user.findUnique({ where: { id: slot.professionalId } })
        if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
          throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
        }

        const created = await tx.appointment.create({
          data: {
            clientId,
            professionalId: slot.professionalId,
            serviceId:      input.serviceId,
            date:           service.specialDate!,
            time:           input.time,
            duration,
            servicePrice:   price,
            depositAmount:  deposit,
            status:         'confirmed',
            // RF-03 y RF-17: nace sin la seña paga, igual que un turno común. Pasa a 'partial' recién cuando
            // Mercado Pago confirma el pago; si no se paga, el job de liberación lo cancela y libera el horario.
            paymentStatus:  'pending',
            selectedZones:    zonesSnapshot    as unknown as Prisma.InputJsonValue,
            selectedPackages: packagesSnapshot as unknown as Prisma.InputJsonValue,
          },
          include: APPOINTMENT_INCLUDE,
        })

        const updatedSlots = slots.map((s, i) =>
          i === slotIndex ? { ...s, appointmentId: created.id, clientName: fullName(created.client) } : s
        )
        await tx.service.update({
          where: { id: input.serviceId },
          data:  { specialSlots: updatedSlots as unknown as Prisma.InputJsonValue },
        })

        return created
      })
    } catch (err: any) {
      if (err instanceof AppError) throw err
      if (isSlotConflict(err)) {
        throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible. Elegí otro.', 'SLOT_TAKEN')
      }
      throw err
    }

    await afterCreate(appointment)
    return toClientView(appointment)
  },

  listForClient: async (clientId: string) => {
    const rows = await prisma.appointment.findMany({
      where:   { clientId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })
    return rows.map(toClientView)
  },

  // Genera el checkout de Mercado Pago para pagar la seña de un turno ya
  // creado (status 'confirmed', paymentStatus todavía 'pending').
  createPaymentPreference: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.paymentStatus === 'partial') {
      throw new AppError(HTTP.BAD_REQUEST, 'La seña de este turno ya está paga', 'ALREADY_PAID')
    }
    if (appointment.depositMethod === 'whatsapp') {
      throw new AppError(HTTP.BAD_REQUEST, 'La seña de este turno se coordina por WhatsApp, no por Mercado Pago', 'WHATSAPP_DEPOSIT')
    }

    const { checkoutUrl } = await paymentService.createPreference({
      title:             `Seña — ${appointment.service.name}`,
      amount:            Number(appointment.depositAmount),
      externalReference: `appointment:${appointment.id}`,
      payerEmail:        appointment.client.email,
    })

    return { checkoutUrl }
  },

  // Verificación "a demanda" de la seña — no depende del webhook. Le pregunta a
  // Mercado Pago si hay un pago contra "appointment:<id>" y, si lo hay, aplica
  // el resultado igual que el webhook. La usa el polling del front y el botón
  // "ya pagué, verificar".
  verifyPayment: async (clientId: string, id: string): Promise<{ paymentStatus: string }> => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.paymentStatus === 'partial') return { paymentStatus: 'partial' }

    const found = await paymentService.findPaymentByReference(`appointment:${id}`)
    if (found) {
      await appointmentService.applyPaymentResult(id, found.id, found.status, { amount: found.amount, currency: found.currency })
    }

    const fresh = await prisma.appointment.findUnique({ where: { id }, select: { paymentStatus: true } })
    return { paymentStatus: fresh?.paymentStatus ?? appointment.paymentStatus }
  },

  // Llamado desde el webhook de Mercado Pago y desde verifyPayment — el estado
  // 'status' ya viene verificado contra la API de Mercado Pago, no confiado del
  // webhook en crudo.
  applyPaymentResult: async (id: string, mpPaymentId: string, status: string, paid?: PaidInfo) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) {
      console.warn(`[mercadopago] Webhook para turno inexistente: ${id}`)
      return
    }

    // Idempotencia — el webhook y el polling pueden llegar los dos. Si la seña
    // ya estaba paga, no re-notificamos al profesional ni re-logueamos.
    if (appointment.paymentStatus === 'partial') return

    // Un pago aprobado por otro monto u otra moneda no es la seña: no se registra.
    if (!(await isPaymentAcceptable({
      kind: 'Turno', id, mpPaymentId, status, expected: Number(appointment.depositAmount), paid,
    }))) return

    const paymentStatus = status === 'approved' ? 'partial' : status // 'partial' = seña pagada

    // El chequeo de arriba no alcanza si dos avisos llegan a la vez (payment.created y
    // payment.updated, o el webhook junto con verifyPayment): los dos leen "pendiente".
    // Por eso la escritura es condicional y la base decide quién gana; el otro no hace nada.
    const claimed = await prisma.appointment.updateMany({
      where: { id, paymentStatus: { not: 'partial' } },
      data:  { paymentStatus, mpPaymentId },
    })
    if (claimed.count === 0) return
    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id }, include: APPOINTMENT_INCLUDE })

    await activityService.log({
      action: 'Pago de seña recibido', module: 'payments', appointmentId: id,
      detail: `Turno ${id} — Mercado Pago informó estado "${status}"`,
    })

    // Recién ahora, con la seña paga, se le avisa al profesional (notificación
    // in-app + mail + actividad "Nuevo turno"). Antes de esto el turno era solo
    // una reserva provisoria.
    if (status === 'approved') {
      await afterCreate(updated)
    }
  },

  cancelForClient: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.status === 'cancelled') {
      throw new AppError(HTTP.BAD_REQUEST, 'El turno ya está cancelado', 'ALREADY_CANCELLED')
    }
    // La clienta solo cancela turnos pendientes o confirmados: no uno finalizado ni uno marcado como no
    // asistido (automático o por el personal).
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      throw new AppError(HTTP.BAD_REQUEST, 'Este turno ya no se puede cancelar', 'NOT_CANCELLABLE')
    }

    // Combo simultáneo: se cancela SOLO esta pata; las demás quedan igual (mismo día, hora y profesional). NO se
    // devuelve nada, salvo que esta sea la última pata activa: ahí se canceló el combo entero y la devolución de
    // la seña del grupo se evalúa UNA sola vez, con las horas entre ahora y el inicio del combo.
    if (appointment.comboGroupId) {
      const now = new Date()
      const legs = await prisma.appointment.findMany({ where: { comboGroupId: appointment.comboGroupId } })
      const isLastLeg = !legs.some(l => l.id !== id && ['pending', 'confirmed'].includes(l.status))

      let refunded = false
      let extra    = ' — cancela la clienta; la seña del combo no se evalúa hasta que se cancele la última pata'
      if (isLastLeg) {
        const settings    = await settingsService.getPaymentSettings()
        const paid        = legs.some(isDepositPaid)
        const firstStart  = new Date(Math.min(...legs.map(l => startInstant(l).getTime())))
        const noticeHours = noticeHoursBetween(firstStart, now)
        refunded = decideRefund({ settings, cancelledBy: 'client', paid, noticeHours })
        extra    = describeCancellation({ cancelledBy: 'client', hadPaidDeposit: paid, refunded, noticeHours })
      }

      const started = hasStarted(appointment, now)
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.appointment.update({
          where: { id },
          data: {
            status:        'cancelled',
            cancelledAt:   now,
            cancelReason:  'user_cancelled',
            cancelledBy:   'client',
            paymentStatus: refunded && isDepositPaid(appointment) ? 'refunded' : appointment.paymentStatus,
            // Cancelada ya empezada: el horario ORIGINAL queda bloqueado y, hasta 40 minutos después, se reabre.
            slotLocked:    started,
          },
          include: APPOINTMENT_INCLUDE,
        })
        if (started) await openReopenedSlot(tx, row, now)
        return row
      })
      // Si se devuelve (última pata), se marca todo el grupo con seña paga como devuelto para que el
      // administrador lo vea claro.
      if (refunded) {
        await prisma.appointment.updateMany({
          where: { comboGroupId: appointment.comboGroupId, paymentStatus: { in: ['partial', 'paid'] } },
          data:  { paymentStatus: 'refunded' },
        })
      }
      await afterCancel(updated, false, extra)

      return { appointment: toClientView(updated), refunded, partialCombo: !isLastLeg }
    }

    // Turno suelto — cancelación normal.
    const updatedList = await cancelWithGroup(appointment, { cancelledBy: 'client', emailClient: false })
    const target       = updatedList.find(a => a.id === id)!
    const refunded      = target.paymentStatus === 'refunded'

    return { appointment: toClientView(target), refunded }
  },

  rescheduleForClient: async (
    clientId: string,
    id: string,
    input: { serviceId: string; professionalId: string; date: string; time: string },
  ) => {
    const existing = await prisma.appointment.findUnique({ where: { id } })
    if (!existing || existing.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (!['pending', 'confirmed'].includes(existing.status)) {
      throw new AppError(HTTP.BAD_REQUEST, 'Este turno ya no se puede reprogramar', 'NOT_RESCHEDULABLE')
    }
    if (existing.comboGroupId) {
      throw new AppError(
        HTTP.BAD_REQUEST,
        'Los turnos de un combo no se pueden reprogramar individualmente. Cancelá el combo y reservalo de nuevo.',
        'COMBO_NOT_RESCHEDULABLE',
      )
    }
    if (input.professionalId === ANY_PROFESSIONAL_SENTINEL) {
      throw new AppError(HTTP.BAD_REQUEST, 'Para reprogramar elegí un profesional específico', 'INVALID_PROFESSIONAL')
    }

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } })
    if (!service || service.status !== 'active') {
      throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
    }
    const professional = await prisma.user.findUnique({ where: { id: input.professionalId } })
    if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
      throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
    }
    await assertWithinAvailability(input.professionalId, input.date, input.time)
    // Reserva tardía (hasta 15 minutos después de la hora de inicio) y horario reabierto.
    const now        = new Date()
    const startCheck = await checkClientStart(prisma, {
      professionalId: input.professionalId, date: input.date, time: input.time,
      duration: service.duration, now, excludeAppointmentId: id,
    })

    const paymentSettings = await settingsService.getPaymentSettings()
    const price   = Number(service.price)
    const deposit = computeDeposit(price, paymentSettings)

    const previousDate = existing.date
    const previousTime = existing.time

    let updated: AppointmentRow
    try {
      const updateRow = (db: Prisma.TransactionClient) => db.appointment.update({
        where: { id },
        data: {
          serviceId:      input.serviceId,
          professionalId: input.professionalId,
          date:           input.date,
          time:           input.time,
          duration:       service.duration,
          servicePrice:   price,
          depositAmount:  deposit,
          status:         'confirmed',
          // El cliente ya está viendo la fecha/hora actual al reprogramar, así que
          // cualquier aviso pendiente de un cambio anterior por el negocio queda obsoleto.
          rescheduleNoticePending: false,
          previousDate: null,
          previousTime: null,
          // El nuevo horario vuelve a ser elegible para el recordatorio por mail (reminder.ts).
          reminderSentAt: null,
        },
        include: APPOINTMENT_INCLUDE,
      })
      updated = startCheck.reopened
        ? await prisma.$transaction(async (tx) => {
            await lockProfessionalDay(tx, input.professionalId, input.date)
            await assertServiceFits(tx, { professionalId: input.professionalId, date: input.date, time: input.time, duration: service.duration, excludeAppointmentId: id })
            return updateRow(tx)
          })
        : await updateRow(prisma)
    } catch (err: any) {
      if (err instanceof AppError) throw err
      if (isSlotConflict(err)) {
        throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
      }
      throw err
    }

    await afterReschedule(updated, previousDate, previousTime)
    return toClientView(updated)
  },

  updateDetailsForClient: async (
    clientId: string,
    id: string,
    data: {
      allergies?:     string | null
      hasCompanion?:      boolean
      companionRelation?: CompanionRelation | null
      designPreference?: { type: 'image' | 'text'; value: string | null } | null
      hasOtherSalonPolish?:     boolean | null
      isNailReconstruction?:    boolean | null
      nailReconstructionCount?: number | null
      hairLength?:              string | null
      wantsExtensions?:         boolean | null
      skinType?:                string | null
      consentAlertas:           boolean
    },
  ) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }

    // RF-06.02 — deja registrado el consentimiento expreso para guardar
    // observaciones operativas (alergias, tipo de piel, etc.), con fecha y a
    // qué turno corresponde. Client puede no existir todavía (se crea recién
    // acá si hace falta) — por eso upsert en vez de update.
    await prisma.client.upsert({
      where:  { userId: clientId },
      create: { userId: clientId, consents: [`alertas_servicio:${id}:${new Date().toISOString()}`] },
      update: { consents: { push: `alertas_servicio:${id}:${new Date().toISOString()}` } },
    })

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        allergies:     data.allergies ?? null,
        hasCompanion:      data.hasCompanion ?? false,
        companionRelation: data.hasCompanion ? (data.companionRelation ?? null) : null,
        designType:    data.designPreference?.type  ?? null,
        designValue:   data.designPreference?.value ?? null,
        hasOtherSalonPolish:     data.hasOtherSalonPolish     ?? null,
        isNailReconstruction:    data.isNailReconstruction    ?? null,
        nailReconstructionCount: data.nailReconstructionCount ?? null,
        hairLength:              data.hairLength              ?? null,
        wantsExtensions:         data.wantsExtensions         ?? null,
        skinType:                data.skinType                ?? null,
      },
      include: APPOINTMENT_INCLUDE,
    })

    return toClientView(updated)
  },

  acknowledgeReschedule: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        rescheduleNoticePending: false,
        previousDate: null,
        previousTime: null,
      },
      include: APPOINTMENT_INCLUDE,
    })

    return toClientView(updated)
  },

  // ── Profesional ──────────────────────────────────────────────────

  listForProfessional: async (professionalId: string) => {
    const rows = await prisma.appointment.findMany({
      where:   { professionalId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })
    const peersByGroup = await comboGroupPeers(rows.map(r => r.comboGroupId))
    const attendedClients = new Set(rows.filter(r => r.status === 'finished').map(r => r.clientId))
    return rows.map(a => toProfessionalView(a, a.comboGroupId ? peersByGroup.get(a.comboGroupId) ?? null : null, attendedClients.has(a.clientId)))
  },

  // Turno manual cargado por el propio profesional (walk-in, teléfono) — mismo
  // cuerpo que el del admin, pero el profesional siempre es el autenticado.
  createForProfessional: async (professionalId: string, data: {
    clientName: string; clientPhone: string; clientEmail: string
    serviceId: string; date: string; time: string
  }) => {
    const appointment = await createManualAppointment(professionalId, data)
    return toProfessionalView(appointment, null, await hasAttended(professionalId, appointment.clientId))
  },

  updateForProfessional: async (
    professionalId: string,
    id: string,
    data: { status?: string; internalNotes?: string; date?: string; time?: string } & StaffCancellationInput,
  ) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.professionalId !== professionalId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (data.status !== undefined) assertValidStatus(data.status)
    const cancelling = data.status === 'cancelled' && appointment.status !== 'cancelled'

    const rescheduling = !cancelling && (
      (data.date !== undefined && data.date !== appointment.date) ||
      (data.time !== undefined && data.time !== appointment.time)
    )

    assertNoShowStateAllowsChange(appointment, { cancelling, rescheduling })

    if (cancelling) {
      // Quién cancela y el aviso de la clienta se validan ANTES de tocar nada (hora de aviso futura o de más de
      // 48 horas para la profesional, cancelledBy faltante).
      const now = new Date()
      const cancellation = buildStaffCancellation(data, { id: professionalId, name: appointment.professional.name, role: 'professional' }, now)
      if (data.internalNotes !== undefined) {
        await prisma.appointment.update({ where: { id }, data: { internalNotes: data.internalNotes } })
      }
      const updatedList = await cancelWithGroup(appointment, { ...cancellation, emailClient: true, now })
      const target = updatedList.find(a => a.id === id)!
      const peers = target.comboGroupId ? (await comboGroupPeers([target.comboGroupId])).get(target.comboGroupId) ?? null : null
      return toProfessionalView(target, peers, await hasAttended(professionalId, target.clientId))
    }

    // Marcar o corregir una inasistencia tiene reglas propias (ver changeStatusByStaff).
    const statusChanging = data.status !== undefined && data.status !== appointment.status
    const viaNoShowRules = statusChanging && isNoShowTransition(appointment.status, data.status!)
    if (viaNoShowRules) await changeStatusByStaff(appointment, data.status!, appointment.professional.name)

    const updated = await updateAppointmentRow(id, {
      ...(statusChanging && !viaNoShowRules ? { status: data.status, slotLocked: false } : {}),
      ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
      ...(data.date           !== undefined ? { date: data.date }                   : {}),
      ...(data.time           !== undefined ? { time: data.time }                   : {}),
      ...(rescheduling ? {
        rescheduleNoticePending: true,
        previousDate: appointment.date,
        previousTime: appointment.time,
        reminderSentAt: null,
      } : {}),
    })
    if (statusChanging && !viaNoShowRules) {
      await logStatusChange(updated, appointment.status, data.status!, appointment.professional.name)
    }
    if (rescheduling) await afterStaffReschedule(updated, appointment.date, appointment.time)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toProfessionalView(updated, peers, await hasAttended(professionalId, updated.clientId))
  },

  listClientsForProfessional: async (professionalId: string) => {
    const rows = await prisma.appointment.findMany({
      where:   { professionalId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ date: 'asc' }],
    })

    const byClient = new Map<string, AppointmentRow[]>()
    for (const a of rows) {
      const list = byClient.get(a.clientId) ?? []
      list.push(a)
      byClient.set(a.clientId, list)
    }

    const today = todayArgentinaStr()

    return Array.from(byClient.values()).map(list => {
      const first = list[0]
      const next = list.find(a => a.date >= today && ['pending', 'confirmed'].includes(a.status))
      // RNF-03 — la alergia del perfil es un dato de salud: solo la ve una profesional que ya atendió a la
      // clienta (al menos un turno finalizado con ella). Cancelados, inasistencias y turnos futuros no alcanzan.
      const attended = list.some(a => a.status === 'finished')
      return {
        id:            first.client.id,
        name:          fullName(first.client),
        email:         first.client.email,
        phone:         first.client.phone ?? '',
        photo:         null as string | null,
        allergies:     attended ? first.client.client?.allergies ?? '' : '',
        preferences:   first.client.client?.preferences ?? '',
        observations:  first.client.client?.observations ?? '',
        visits: list.map(a => ({
          id:            a.id,
          date:          a.date,
          serviceName:   a.service.name,
          price:         Number(a.servicePrice),
          notes:         a.internalNotes ?? '',
          status:        a.status,
          displayStatus: displayStatusOf(a),
          internalNotes: a.internalNotes ?? null,
        })),
        nextAppointment: next ? next.date : null,
        cancellations:   list.filter(a => a.status === 'cancelled').length,
      }
    })
  },

  getHistoryForProfessional: async (professionalId: string) => {
    const rows = await prisma.appointment.findMany({
      where:   { professionalId, status: 'finished' },
      include: { client: true, service: true },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })
    return rows.map(a => ({
      id:      a.id,
      service: a.service.name,
      client:  fullName(a.client),
      date:    a.date,
      time:    a.time,
      price:   Number(a.servicePrice),
      status:  'finished' as const,
    }))
  },

  // ── Admin ────────────────────────────────────────────────────────

  listForAdmin: async () => {
    const rows = await prisma.appointment.findMany({
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })
    const peersByGroup = await comboGroupPeers(rows.map(r => r.comboGroupId))
    return rows.map(a => toAdminView(a, a.comboGroupId ? peersByGroup.get(a.comboGroupId) ?? null : null))
  },

  updateForAdmin: async (id: string, data: {
    status?: string; professionalId?: string
    date?: string; time?: string
    duration?: number; servicePrice?: number
    internalNotes?: string; clientNotes?: string
    clientName?: string; clientPhone?: string; clientEmail?: string
  } & StaffCancellationInput, actorName: string = 'Admin', actorId: string | null = null) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')

    if (data.status !== undefined) assertValidStatus(data.status)

    if (data.professionalId !== undefined) {
      const professional = await prisma.user.findUnique({ where: { id: data.professionalId } })
      if (!professional || !['professional', 'admin'].includes(professional.role)) {
        throw new AppError(HTTP.BAD_REQUEST, 'Profesional no válido', 'PROFESSIONAL_NOT_FOUND')
      }
    }

    // Los datos de contacto pertenecen al cliente (User), no al turno — se actualizan aparte.
    assertValidPhone(data.clientPhone)
    const clientUpdate: Record<string, unknown> = {}
    if (data.clientName  !== undefined) clientUpdate.name  = data.clientName
    if (data.clientPhone !== undefined) clientUpdate.phone = data.clientPhone
    if (data.clientEmail !== undefined) clientUpdate.email = data.clientEmail
    if (Object.keys(clientUpdate).length > 0) {
      try {
        await prisma.user.update({ where: { id: appointment.clientId }, data: clientUpdate })
      } catch (err: any) {
        if (err?.code === 'P2002') throw new AppError(HTTP.CONFLICT, 'Ese email ya está en uso', 'EMAIL_TAKEN')
        throw err
      }
    }

    const cancelling = data.status === 'cancelled' && appointment.status !== 'cancelled'

    const rescheduling = !cancelling && (
      (data.date !== undefined && data.date !== appointment.date) ||
      (data.time !== undefined && data.time !== appointment.time)
    )

    const otherFields = {
      ...(data.professionalId !== undefined ? { professionalId: data.professionalId } : {}),
      ...(data.date           !== undefined ? { date: data.date }                   : {}),
      ...(data.time           !== undefined ? { time: data.time }                   : {}),
      ...(data.duration       !== undefined ? { duration: data.duration }           : {}),
      ...(data.servicePrice   !== undefined ? { servicePrice: data.servicePrice }   : {}),
      ...(data.internalNotes  !== undefined ? { internalNotes: data.internalNotes } : {}),
      ...(data.clientNotes    !== undefined ? { clientNotes: data.clientNotes }     : {}),
      ...(rescheduling ? {
        rescheduleNoticePending: true,
        previousDate: appointment.date,
        previousTime: appointment.time,
        reminderSentAt: null,
      } : {}),
    }

    assertNoShowStateAllowsChange(appointment, { cancelling, rescheduling })

    if (cancelling) {
      // Quién cancela y el aviso de la clienta se validan ANTES de tocar nada. El administrador puede cargar
      // un aviso de cualquier antigüedad.
      const now = new Date()
      const cancellation = buildStaffCancellation(data, { id: actorId, name: actorName, role: 'admin' }, now)
      if (Object.keys(otherFields).length > 0) {
        await updateAppointmentRow(id, otherFields)
      }
      const updatedList = await cancelWithGroup(appointment, { ...cancellation, emailClient: true, now })
      const target = updatedList.find(a => a.id === id)!
      const peers = target.comboGroupId ? (await comboGroupPeers([target.comboGroupId])).get(target.comboGroupId) ?? null : null
      return toAdminView(target, peers)
    }

    // Marcar o corregir una inasistencia tiene reglas propias (ver changeStatusByStaff).
    const statusChanging = data.status !== undefined && data.status !== appointment.status
    const viaNoShowRules = statusChanging && isNoShowTransition(appointment.status, data.status!)
    if (viaNoShowRules) await changeStatusByStaff(appointment, data.status!, actorName)

    const updated = await updateAppointmentRow(id, {
      ...(statusChanging && !viaNoShowRules ? { status: data.status, slotLocked: false } : {}),
      ...otherFields,
    })
    if (statusChanging && !viaNoShowRules) {
      await logStatusChange(updated, appointment.status, data.status!, actorName)
    }
    if (rescheduling) await afterStaffReschedule(updated, appointment.date, appointment.time)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toAdminView(updated, peers)
  },

  // Turno manual — el admin lo carga directamente (walk-in, teléfono, etc.), sin pasar
  // por el flujo de pago del cliente: sin seña, paymentStatus queda en 'pending'.
  createForAdmin: async (data: {
    clientName: string; clientPhone: string; clientEmail: string
    serviceId: string; professionalId: string; date: string; time: string
  }) => {
    const appointment = await createManualAppointment(data.professionalId, data)
    return toAdminView(appointment)
  },

  // ── Registro de llegada ──────────────────────────────────────────
  // La clienta marca que llegó al local (o lo hace el profesional/admin por
  // ella, ej. si no tiene el celular a mano). Evita que autoNoShow.job.ts
  // cancele el turno a los 20 minutos de la hora pactada. Idempotente: una
  // segunda llamada no falla, simplemente no vuelve a tocar arrivedAt.
  markArrivalForClient: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    const updated = await registerArrival(appointment)
    return toClientView(updated)
  },

  markArrivalForProfessional: async (professionalId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.professionalId !== professionalId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    const updated = await registerArrival(appointment)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toProfessionalView(updated, peers, await hasAttended(professionalId, updated.clientId))
  },

  markArrivalForAdmin: async (id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    const updated = await registerArrival(appointment)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toAdminView(updated, peers)
  },

  // ── Cobro del saldo en el local ──────────────────────────────────
  // Solo el admin lo completa (no la profesional) — es quien concilia el
  // efectivo/tarjeta recibido en el local, no la información la reporta
  // sola cada profesional.
  registerBalancePaymentForAdmin: async (
    adminId: string, id: string, data: { method: string; amount: number },
  ) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    const updated = await registerBalancePayment(appointment, data as { method: BalancePaymentMethod; amount: number }, adminId)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toAdminView(updated, peers)
  },

  // Retiro de esmalte de otro salón — puramente informativo (ver comentario
  // en el schema). Solo el admin lo carga, igual que el cobro del saldo.
  registerPolishRemoval: async (id: string, data: { label: string; price: number }) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    const updated = await prisma.appointment.update({
      where: { id },
      data:  { polishRemovalLabel: data.label, polishRemovalPrice: data.price },
      include: APPOINTMENT_INCLUDE,
    })
    await activityService.log({
      action: 'Retiro de esmalte registrado', module: 'appointments', appointmentId: updated.id,
      detail: `${updated.service.name} — ${fullName(updated.client)}: ${data.label} ($${data.price}, solo a modo de control)`,
    })
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toAdminView(updated, peers)
  },

  // Le muestra al cliente, en la confirmación, quién se llevaría el turno si
  // elige "cualquier profesional disponible" — mismo criterio (R-04) que
  // resolveProfessionalId usa de verdad al crear el turno, para el día y hora
  // elegidos. Es solo una vista previa: puede cambiar si alguien reserva entre
  // este preview y la reserva real; la asignación final se recalcula al crear.
  previewAnyProfessional: async (serviceId: string, slot: { date: string; time: string }) => {
    const professionalId = await resolveProfessionalId(serviceId, ANY_PROFESSIONAL_SENTINEL, slot)
    const professional = await prisma.user.findUnique({ where: { id: professionalId }, select: { id: true, name: true } })
    if (!professional) throw new AppError(HTTP.NOT_FOUND, 'Profesional no encontrado', 'NOT_FOUND')
    return { professionalId: professional.id, professionalName: professional.name }
  },
}

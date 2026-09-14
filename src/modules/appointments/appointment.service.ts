// src/modules/appointments/appointment.service.ts
import type { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import fs   from 'fs'
import path from 'path'
import { prisma }        from '../../app/database/prisma'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'
import { settingsService, computeDeposit } from '../settings/settings.service'
import { activityService } from '../activity/activity.service'
import { paymentService } from '../payments/payment.service'
import { notificationService } from '../professionals/notification.service'
import { mailProvider } from '../auth/providers/mail.provider'
import { bcryptProvider } from '../auth/providers/bcrypt.provider'
import type { SpecialSlot } from '../services/service.model'

function loadTemplate(name: string, replacements: Record<string, string>): string {
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

function formatDate(date: string): string {
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'finished', 'cancelled', 'no_show'] as const
export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number]

function assertValidStatus(status: string) {
  if (!APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    throw new AppError(HTTP.BAD_REQUEST, 'Estado de turno inválido', 'INVALID_STATUS')
  }
}

const APPOINTMENT_INCLUDE = {
  client:       { include: { client: true } },
  professional: true,
  service:      true,
} satisfies Prisma.AppointmentInclude

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>

function detailsOf(a: AppointmentRow) {
  return {
    allergies:        a.allergies ?? null,
    accompanied:      a.accompanied ?? false,
    companionName:    a.companionName ?? null,
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
    cancelReason:      a.cancelReason,
    paymentStatus:     a.paymentStatus,
    comboGroupId:      a.comboGroupId,
    rescheduleNoticePending: a.rescheduleNoticePending,
    previousDate:            a.previousDate ?? null,
    previousTime:            a.previousTime ?? null,
    selectedZones:     (a.selectedZones ?? []) as unknown as { name: string; price: number; duration: number }[],
    selectedPackages:  (a.selectedPackages ?? []) as unknown as { name: string; price: number; duration: number }[],
    details:           detailsOf(a),
  }
}

function toProfessionalView(a: AppointmentRow, peers: ComboPeer[] | null = null) {
  return {
    id:            a.id,
    comboGroupId:  a.comboGroupId,
    client: {
      id:        a.client.id,
      name:      a.client.name,
      phone:     a.client.phone ?? '',
      email:     a.client.email,
      photo:     null as string | null,
      allergies: a.client.client?.allergies ?? '',
      notes:     a.client.client?.notes ?? '',
    },
    serviceName:    a.service.name,
    servicePrice:   Number(a.servicePrice),
    duration:       a.duration,
    date:           a.date,
    time:           a.time,
    status:         a.status,
    cancelReason:   a.cancelReason,
    paymentStatus:  a.paymentStatus,
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
    title:            a.client.name,
    clientName:       a.client.name,
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
    cancelReason:      a.cancelReason,
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

async function afterCreate(a: AppointmentRow) {
  await activityService.log({
    action: 'Nuevo turno', module: 'appointments',
    detail: `${a.service.name} — ${a.client.name} con ${a.professional.name} el ${a.date} ${a.time}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'new_appointment',
    title: 'Nuevo turno',
    body:  `${a.client.name} reservó ${a.service.name} para el ${a.date} a las ${a.time}.`,
  })
  mailProvider.send(
    a.professional.email,
    'Nuevo turno agendado — Nexa',
    loadTemplate('appointmentCreated', {
      PROFESSIONAL_NAME: a.professional.name,
      CLIENT_NAME:        a.client.name,
      SERVICE_NAME:        a.service.name,
      DATE:                formatDate(a.date),
      TIME:                a.time,
    }),
  ).catch(err => console.error('[mail] error notificando nuevo turno:', err.message))
}

async function afterCancel(a: AppointmentRow, emailClient: boolean) {
  await activityService.log({
    action: 'Turno cancelado', module: 'appointments',
    detail: `${a.service.name} — ${a.client.name} con ${a.professional.name} el ${a.date} ${a.time}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'cancelled_appointment',
    title: 'Turno cancelado',
    body:  `El turno de ${a.client.name} (${a.service.name}, ${a.date} ${a.time}) fue cancelado.`,
  })
  if (emailClient) {
    mailProvider.send(
      a.client.email,
      'Tu turno fue cancelado — Nexa',
      loadTemplate('appointmentCancelled', {
        CLIENT_NAME:  a.client.name,
        SERVICE_NAME: a.service.name,
        DATE:         formatDate(a.date),
        TIME:         a.time,
      }),
    ).catch(err => console.error('[mail] error notificando cancelación:', err.message))
  }
}

async function afterReschedule(a: AppointmentRow) {
  await activityService.log({
    action: 'Turno reprogramado', module: 'appointments',
    detail: `${a.service.name} — ${a.client.name} con ${a.professional.name} → ${a.date} ${a.time}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'rescheduled_appointment',
    title: 'Turno reprogramado',
    body:  `${a.client.name} reprogramó ${a.service.name} para el ${a.date} a las ${a.time}.`,
  })
  mailProvider.send(
    a.professional.email,
    'Turno reprogramado — Nexa',
    loadTemplate('appointmentRescheduled', {
      PROFESSIONAL_NAME: a.professional.name,
      CLIENT_NAME:        a.client.name,
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
    action: 'Turno reprogramado', module: 'appointments',
    detail: `${a.service.name} — ${a.client.name} con ${a.professional.name}: ${previousDate} ${previousTime} → ${a.date} ${a.time}`,
  })
  await notificationService.notify(a.professionalId, {
    type:  'rescheduled_appointment',
    title: 'Turno reprogramado',
    body:  `El turno de ${a.client.name} (${a.service.name}) se reprogramó para el ${a.date} a las ${a.time}.`,
  })
  mailProvider.send(
    a.client.email,
    'Tu turno fue reprogramado — Nexa',
    loadTemplate('appointmentRescheduledByStaff', {
      CLIENT_NAME:    a.client.name,
      SERVICE_NAME:   a.service.name,
      PREVIOUS_DATE:  formatDate(previousDate),
      PREVIOUS_TIME:  previousTime,
      DATE:           formatDate(a.date),
      TIME:           a.time,
    }),
  ).catch(err => console.error('[mail] error notificando reprogramación (staff):', err.message))
}

// Cancelar un turno que forma parte de un combo cancela todo el grupo (comboGroupId):
// las patas de un combo se reservan y viven juntas, así que dejar una activa mientras el
// resto se cancela dejaría al cliente con una experiencia incompleta. Cada pata calcula su
// propio reembolso de forma independiente (según su propia fecha/hora vs. la política de
// cancelación), ya que un combo secuencial puede tener patas en fechas distintas.
async function cancelWithGroup(appointment: AppointmentRow, emailClient: boolean, reason: string = 'user_cancelled'): Promise<AppointmentRow[]> {
  const paymentSettings = await settingsService.getPaymentSettings()

  const group = appointment.comboGroupId
    ? await prisma.appointment.findMany({
        where:   { comboGroupId: appointment.comboGroupId, status: { not: 'cancelled' } },
        include: APPOINTMENT_INCLUDE,
      })
    : [appointment]

  const updatedList: AppointmentRow[] = []
  for (const a of group) {
    const apptDateTime = new Date(`${a.date}T${a.time}:00`)
    const hoursUntil    = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
    const eligible      = hoursUntil >= paymentSettings.cancellationHours
    const refunded      = eligible && paymentSettings.refundPolicy !== 'none'

    const updated = await prisma.appointment.update({
      where: { id: a.id },
      data: {
        status:        'cancelled',
        cancelledAt:   new Date(),
        cancelReason:  reason,
        paymentStatus: refunded ? 'refunded' : a.paymentStatus,
      },
      include: APPOINTMENT_INCLUDE,
    })
    await afterCancel(updated, emailClient)
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
  const trimmedEmail = email.trim()
  if (trimmedEmail) {
    const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } })
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

// "Cualquiera" — resuelve al profesional activo con el servicio asignado que tenga
// menos turnos activos (no cancelados) en total. Con un solo candidato no hace falta
// contar nada. `excludeIds` saca profesionales ya asignados a otro servicio del
// mismo combo simultáneo (no puede hacer dos a la vez).
async function resolveProfessionalId(
  serviceId: string,
  requestedProfessionalId: string,
  excludeIds: string[] = [],
  allowedIds?: string[],
): Promise<string> {
  if (requestedProfessionalId !== ANY_PROFESSIONAL_SENTINEL) return requestedProfessionalId

  const candidates = await prisma.user.findMany({
    where: {
      role:   { in: ['professional', 'admin'] },
      active: true,
      id:     allowedIds && allowedIds.length > 0 ? { in: allowedIds, notIn: excludeIds } : excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      professional: { services: { some: { serviceId, active: true } } },
    },
    select: { id: true },
  })
  if (candidates.length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, 'No hay profesionales disponibles para este servicio', 'NO_PROFESSIONAL_AVAILABLE')
  }
  if (candidates.length === 1) return candidates[0].id

  const counts = await prisma.appointment.groupBy({
    by:     ['professionalId'],
    where:  { professionalId: { in: candidates.map(c => c.id) }, status: { notIn: ['cancelled'] } },
    _count: { id: true },
  })
  const countMap = new Map(counts.map(c => [c.professionalId, c._count.id]))
  candidates.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0))
  return candidates[0].id
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

export const appointmentService = {

  // ── Cliente ──────────────────────────────────────────────────────

  createForClient: async (
    clientId: string,
    input: { serviceId: string; professionalId: string; date: string; time: string; termsAccepted: boolean },
  ) => {
    await assertClientNotBlocked(clientId)

    // RF-06.01 — (re)graba la aceptación de Términos/Política al confirmar la
    // reserva. Cubre tanto el registro reciente como cuentas viejas sin este dato.
    await prisma.user.update({ where: { id: clientId }, data: { termsAcceptedAt: new Date() } })

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } })
    if (!service || service.status !== 'active') {
      throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
    }

    const professionalId = await resolveProfessionalId(input.serviceId, input.professionalId)
    const professional = await prisma.user.findUnique({ where: { id: professionalId } })
    if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
      throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
    }

    const paymentSettings = await settingsService.getPaymentSettings()
    const price   = Number(service.price)
    const deposit = computeDeposit(price, paymentSettings)

    let appointment: AppointmentRow
    try {
      appointment = await prisma.appointment.create({
        data: {
          clientId,
          professionalId,
          serviceId:      input.serviceId,
          date:           input.date,
          time:           input.time,
          duration:       service.duration,
          servicePrice:   price,
          depositAmount:  deposit,
          status:         'confirmed',
          // Arranca en 'pending' — solo pasa a 'partial' cuando llega el
          // webhook de Mercado Pago confirmando que la seña se pagó de verdad.
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
    const resolvedComponents: { serviceId: string; professionalId: string; date: string; time: string }[] = []
    for (const component of input.components) {
      const excludeIds = input.simultaneous ? resolvedComponents.map(c => c.professionalId) : []
      const allowedIds = comboProfessionals[component.serviceId]
      if (
        component.professionalId !== ANY_PROFESSIONAL_SENTINEL &&
        allowedIds && allowedIds.length > 0 &&
        !allowedIds.includes(component.professionalId)
      ) {
        throw new AppError(HTTP.BAD_REQUEST, 'Esa profesional no está habilitada para ese servicio en este turno simultáneo', 'PROFESSIONAL_NOT_ALLOWED')
      }
      const professionalId = await resolveProfessionalId(component.serviceId, component.professionalId, excludeIds, allowedIds)
      resolvedComponents.push({ ...component, professionalId })
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
      for (const leg of created) await afterCreate(leg)
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
    if (found) await appointmentService.applyGroupPaymentResult(comboGroupId, found.id, found.status)

    const fresh = await prisma.appointment.findFirst({
      where:  { comboGroupId, status: { not: 'cancelled' } },
      select: { paymentStatus: true },
    })
    return { paymentStatus: fresh?.paymentStatus ?? 'pending' }
  },

  // Aplica el resultado del pago de la seña de un combo a TODAS sus patas.
  // Idempotente (webhook + polling). Al aprobarse, se le avisa a cada profesional.
  applyGroupPaymentResult: async (comboGroupId: string, mpPaymentId: string, status: string) => {
    const legs = await prisma.appointment.findMany({
      where:   { comboGroupId, status: { not: 'cancelled' } },
      include: APPOINTMENT_INCLUDE,
    })
    if (legs.length === 0) {
      console.warn(`[mercadopago] Webhook para combo inexistente: ${comboGroupId}`)
      return
    }
    if (legs.every(l => l.paymentStatus === 'partial')) return // ya aplicado

    const paymentStatus = status === 'approved' ? 'partial' : status
    await prisma.appointment.updateMany({
      where: { comboGroupId, status: { not: 'cancelled' } },
      data:  { paymentStatus, mpPaymentId },
    })

    await activityService.log({
      action: 'Pago de seña recibido', module: 'payments',
      detail: `Combo ${comboGroupId} — Mercado Pago informó estado "${status}"`,
    })

    if (status === 'approved') {
      for (const leg of legs) {
        await afterCreate({ ...leg, paymentStatus })
      }
    }
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
            paymentStatus:  'partial',
            selectedZones:    zonesSnapshot    as unknown as Prisma.InputJsonValue,
            selectedPackages: packagesSnapshot as unknown as Prisma.InputJsonValue,
          },
          include: APPOINTMENT_INCLUDE,
        })

        const updatedSlots = slots.map((s, i) =>
          i === slotIndex ? { ...s, appointmentId: created.id, clientName: created.client.name } : s
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
      await appointmentService.applyPaymentResult(id, found.id, found.status)
    }

    const fresh = await prisma.appointment.findUnique({ where: { id }, select: { paymentStatus: true } })
    return { paymentStatus: fresh?.paymentStatus ?? appointment.paymentStatus }
  },

  // Llamado desde el webhook de Mercado Pago y desde verifyPayment — el estado
  // 'status' ya viene verificado contra la API de Mercado Pago, no confiado del
  // webhook en crudo.
  applyPaymentResult: async (id: string, mpPaymentId: string, status: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment) {
      console.warn(`[mercadopago] Webhook para turno inexistente: ${id}`)
      return
    }

    // Idempotencia — el webhook y el polling pueden llegar los dos. Si la seña
    // ya estaba paga, no re-notificamos al profesional ni re-logueamos.
    if (appointment.paymentStatus === 'partial') return

    const paymentStatus = status === 'approved' ? 'partial' : status // 'partial' = seña pagada
    const updated = await prisma.appointment.update({
      where:   { id },
      data:    { paymentStatus, mpPaymentId },
      include: APPOINTMENT_INCLUDE,
    })

    await activityService.log({
      action: 'Pago de seña recibido', module: 'payments',
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

    // Combo simultáneo: se cancela SOLO esta pata; las demás quedan igual (mismo
    // día, hora y profesional). NO se reembolsa nada, salvo que esta sea la
    // última pata activa — ahí se canceló el combo entero y aplica la política
    // de reembolso normal sobre la seña del grupo.
    if (appointment.comboGroupId) {
      const activeSiblings = await prisma.appointment.count({
        where: { comboGroupId: appointment.comboGroupId, status: { not: 'cancelled' }, id: { not: id } },
      })
      const isLastLeg = activeSiblings === 0

      let refunded = false
      if (isLastLeg) {
        const settings   = await settingsService.getPaymentSettings()
        const dt         = new Date(`${appointment.date}T${appointment.time}:00`)
        const hoursUntil  = (dt.getTime() - Date.now()) / (1000 * 60 * 60)
        refunded = hoursUntil >= settings.cancellationHours && settings.refundPolicy !== 'none'
      }

      const updated = await prisma.appointment.update({
        where: { id },
        data: {
          status:        'cancelled',
          cancelledAt:   new Date(),
          cancelReason:  'user_cancelled',
          paymentStatus: refunded ? 'refunded' : appointment.paymentStatus,
        },
        include: APPOINTMENT_INCLUDE,
      })
      // Si se reembolsa (última pata), marcamos todo el grupo como reembolsado
      // para que el admin lo vea claro.
      if (refunded) {
        await prisma.appointment.updateMany({
          where: { comboGroupId: appointment.comboGroupId },
          data:  { paymentStatus: 'refunded' },
        })
      }
      await afterCancel(updated, false)

      return { appointment: toClientView(updated), refunded, partialCombo: !isLastLeg }
    }

    // Turno suelto — cancelación normal.
    const updatedList = await cancelWithGroup(appointment, false)
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

    const paymentSettings = await settingsService.getPaymentSettings()
    const price   = Number(service.price)
    const deposit = computeDeposit(price, paymentSettings)

    let updated: AppointmentRow
    try {
      updated = await prisma.appointment.update({
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
        },
        include: APPOINTMENT_INCLUDE,
      })
    } catch (err: any) {
      if (isSlotConflict(err)) {
        throw new AppError(HTTP.CONFLICT, 'Ese horario ya no está disponible para este profesional. Elegí otro horario.', 'PROFESSIONAL_SLOT_TAKEN')
      }
      throw err
    }

    await afterReschedule(updated)
    return toClientView(updated)
  },

  updateDetailsForClient: async (
    clientId: string,
    id: string,
    data: {
      allergies?:     string | null
      accompanied?:   boolean
      companionName?: string | null
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
        accompanied:   data.accompanied ?? false,
        companionName: data.accompanied ? (data.companionName ?? null) : null,
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
    return rows.map(a => toProfessionalView(a, a.comboGroupId ? peersByGroup.get(a.comboGroupId) ?? null : null))
  },

  // Turno manual cargado por el propio profesional (walk-in, teléfono) — mismo
  // cuerpo que el del admin, pero el profesional siempre es el autenticado.
  createForProfessional: async (professionalId: string, data: {
    clientName: string; clientPhone: string; clientEmail: string
    serviceId: string; date: string; time: string
  }) => {
    const appointment = await createManualAppointment(professionalId, data)
    return toProfessionalView(appointment, null)
  },

  updateForProfessional: async (
    professionalId: string,
    id: string,
    data: { status?: string; internalNotes?: string; date?: string; time?: string },
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

    if (cancelling) {
      if (data.internalNotes !== undefined) {
        await prisma.appointment.update({ where: { id }, data: { internalNotes: data.internalNotes } })
      }
      const updatedList = await cancelWithGroup(appointment, true)
      const target = updatedList.find(a => a.id === id)!
      const peers = target.comboGroupId ? (await comboGroupPeers([target.comboGroupId])).get(target.comboGroupId) ?? null : null
      return toProfessionalView(target, peers)
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.status        !== undefined ? { status: data.status } : {}),
        ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
        ...(data.date           !== undefined ? { date: data.date }                   : {}),
        ...(data.time           !== undefined ? { time: data.time }                   : {}),
        ...(rescheduling ? {
          rescheduleNoticePending: true,
          previousDate: appointment.date,
          previousTime: appointment.time,
        } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    })
    if (rescheduling) await afterStaffReschedule(updated, appointment.date, appointment.time)
    const peers = updated.comboGroupId ? (await comboGroupPeers([updated.comboGroupId])).get(updated.comboGroupId) ?? null : null
    return toProfessionalView(updated, peers)
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

    const today = new Date().toISOString().slice(0, 10)

    return Array.from(byClient.values()).map(list => {
      const first = list[0]
      const next = list.find(a => a.date >= today && ['pending', 'confirmed'].includes(a.status))
      return {
        id:            first.client.id,
        name:          first.client.name,
        email:         first.client.email,
        phone:         first.client.phone ?? '',
        photo:         null as string | null,
        allergies:     first.client.client?.allergies ?? '',
        preferences:   first.client.client?.preferences ?? '',
        observations:  first.client.client?.observations ?? '',
        visits: list.map(a => ({
          id:            a.id,
          date:          a.date,
          serviceName:   a.service.name,
          price:         Number(a.servicePrice),
          notes:         a.internalNotes ?? '',
          status:        a.status,
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
      client:  a.client.name,
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
  }) => {
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
      } : {}),
    }

    if (cancelling) {
      if (Object.keys(otherFields).length > 0) {
        await prisma.appointment.update({ where: { id }, data: otherFields })
      }
      const updatedList = await cancelWithGroup(appointment, true)
      const target = updatedList.find(a => a.id === id)!
      const peers = target.comboGroupId ? (await comboGroupPeers([target.comboGroupId])).get(target.comboGroupId) ?? null : null
      return toAdminView(target, peers)
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...otherFields,
      },
      include: APPOINTMENT_INCLUDE,
    })
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
}

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
import { notificationService } from '../professionals/notification.service'
import { mailProvider } from '../auth/providers/mail.provider'
import { bcryptProvider } from '../auth/providers/bcrypt.provider'

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
    paymentStatus:     a.paymentStatus,
    comboGroupId:      a.comboGroupId,
    rescheduleNoticePending: a.rescheduleNoticePending,
    previousDate:            a.previousDate ?? null,
    previousTime:            a.previousTime ?? null,
    details:           detailsOf(a),
  }
}

function toProfessionalView(a: AppointmentRow, isSimultaneous = false) {
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
    paymentStatus:  a.paymentStatus,
    internalNotes:  a.internalNotes ?? '',
    details:        detailsOf(a),
    isSimultaneous,
  }
}

function toAdminView(a: AppointmentRow) {
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
    clientNotes:       a.clientNotes ?? '',
    professionalNotes: a.internalNotes ?? '',
    details:           detailsOf(a),
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
async function cancelWithGroup(appointment: AppointmentRow, emailClient: boolean): Promise<AppointmentRow[]> {
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
        paymentStatus: refunded ? 'refunded' : a.paymentStatus,
      },
      include: APPOINTMENT_INCLUDE,
    })
    await afterCancel(updated, emailClient)
    updatedList.push(updated)
  }
  return updatedList
}

// Un combo es "simultáneo" cuando todas sus patas comparten fecha y hora — se recalcula
// a partir de los datos reales en vez de guardar un flag aparte, así nunca queda
// desincronizado si alguna pata cambia. Devuelve el subconjunto de ids que sí lo son.
async function simultaneousComboGroups(comboGroupIds: (string | null)[]): Promise<Set<string>> {
  const ids = [...new Set(comboGroupIds.filter((id): id is string => id !== null))]
  const result = new Set<string>()
  if (ids.length === 0) return result

  const rows = await prisma.appointment.findMany({
    where:  { comboGroupId: { in: ids } },
    select: { comboGroupId: true, date: true, time: true },
  })
  const byGroup = new Map<string, { date: string; time: string }[]>()
  for (const r of rows) {
    const list = byGroup.get(r.comboGroupId!) ?? []
    list.push({ date: r.date, time: r.time })
    byGroup.set(r.comboGroupId!, list)
  }
  for (const [groupId, entries] of byGroup) {
    if (entries.length > 1 && entries.every(e => e.date === entries[0].date && e.time === entries[0].time)) {
      result.add(groupId)
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
// contar nada.
async function resolveProfessionalId(serviceId: string, requestedProfessionalId: string): Promise<string> {
  if (requestedProfessionalId !== ANY_PROFESSIONAL_SENTINEL) return requestedProfessionalId

  const candidates = await prisma.user.findMany({
    where: {
      role:   { in: ['professional', 'admin'] },
      active: true,
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
    input: { serviceId: string; professionalId: string; date: string; time: string },
  ) => {
    await assertClientNotBlocked(clientId)

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
          paymentStatus:  'partial',
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
    return toClientView(appointment)
  },

  // Reserva un combo: crea un turno por cada servicio componente, todos con el mismo
  // comboGroupId. La seña se calcula individualmente por turno (igual que una reserva
  // suelta, sobre el precio de su propio servicio) — no hay una seña combinada a nivel
  // de grupo, así el reembolso al cancelar sigue funcionando igual que siempre por turno.
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

    // "Cualquiera" se resuelve antes de entrar a la transacción — cada componente
    // se resuelve en orden, así que un combo con el mismo servicio repetido igual
    // obtiene profesionales distintos si hay más de uno disponible.
    const resolvedComponents: { serviceId: string; professionalId: string; date: string; time: string }[] = []
    for (const component of input.components) {
      const professionalId = await resolveProfessionalId(component.serviceId, component.professionalId)
      resolvedComponents.push({ ...component, professionalId })
    }

    if (input.simultaneous) {
      const [first, ...rest] = resolvedComponents
      const allSame = rest.every(c => c.date === first.date && c.time === first.time)
      if (!allSame) {
        throw new AppError(HTTP.BAD_REQUEST, 'Los turnos simultáneos deben tener la misma fecha y hora', 'COMBO_NOT_SIMULTANEOUS')
      }
    }

    const paymentSettings = await settingsService.getPaymentSettings()
    const comboGroupId    = randomUUID()

    let created: AppointmentRow[]
    try {
      created = await prisma.$transaction(async (tx) => {
        const rows: AppointmentRow[] = []
        for (const component of resolvedComponents) {
          const service = await tx.service.findUnique({ where: { id: component.serviceId } })
          if (!service || service.status !== 'active') {
            throw new AppError(HTTP.BAD_REQUEST, 'Servicio no disponible', 'SERVICE_NOT_FOUND')
          }
          const professional = await tx.user.findUnique({ where: { id: component.professionalId } })
          if (!professional || !['professional', 'admin'].includes(professional.role) || !professional.active) {
            throw new AppError(HTTP.BAD_REQUEST, 'Profesional no disponible', 'PROFESSIONAL_NOT_FOUND')
          }

          const price   = Number(service.price)
          const deposit = computeDeposit(price, paymentSettings)

          const appointment = await tx.appointment.create({
            data: {
              clientId,
              professionalId: component.professionalId,
              serviceId:      component.serviceId,
              date:           component.date,
              time:           component.time,
              duration:       service.duration,
              servicePrice:   price,
              depositAmount:  deposit,
              status:         'confirmed',
              paymentStatus:  'partial',
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

    for (const appointment of created) {
      await afterCreate(appointment)
    }

    return created.map(toClientView)
  },

  listForClient: async (clientId: string) => {
    const rows = await prisma.appointment.findMany({
      where:   { clientId },
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })
    return rows.map(toClientView)
  },

  cancelForClient: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.status === 'cancelled') {
      throw new AppError(HTTP.BAD_REQUEST, 'El turno ya está cancelado', 'ALREADY_CANCELLED')
    }

    // El cliente ya sabe que canceló — no se le manda mail a sí mismo.
    // Si el turno es parte de un combo, esto cancela todo el grupo (ver cancelWithGroup).
    const updatedList = await cancelWithGroup(appointment, false)
    const target       = updatedList.find(a => a.id === id)!
    const refunded      = target.paymentStatus === 'refunded'

    return {
      appointment: toClientView(target),
      refunded,
      ...(appointment.comboGroupId ? { appointments: updatedList.map(toClientView) } : {}),
    }
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
    },
  ) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }

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
    const simultaneousGroups = await simultaneousComboGroups(rows.map(r => r.comboGroupId))
    return rows.map(a => toProfessionalView(a, a.comboGroupId ? simultaneousGroups.has(a.comboGroupId) : false))
  },

  // Turno manual cargado por el propio profesional (walk-in, teléfono) — mismo
  // cuerpo que el del admin, pero el profesional siempre es el autenticado.
  createForProfessional: async (professionalId: string, data: {
    clientName: string; clientPhone: string; clientEmail: string
    serviceId: string; date: string; time: string
  }) => {
    const appointment = await createManualAppointment(professionalId, data)
    return toProfessionalView(appointment, false)
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
      const isSimultaneous = target.comboGroupId ? (await simultaneousComboGroups([target.comboGroupId])).has(target.comboGroupId) : false
      return toProfessionalView(target, isSimultaneous)
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
    const isSimultaneous = updated.comboGroupId ? (await simultaneousComboGroups([updated.comboGroupId])).has(updated.comboGroupId) : false
    return toProfessionalView(updated, isSimultaneous)
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
    return rows.map(toAdminView)
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
      return toAdminView(target)
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
    return toAdminView(updated)
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

// src/modules/appointments/appointment.service.ts
import type { Prisma } from '@prisma/client'
import fs   from 'fs'
import path from 'path'
import { prisma }        from '../../app/database/prisma'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'
import { settingsService, computeDeposit } from '../settings/settings.service'
import { activityService } from '../activity/activity.service'
import { notificationService } from '../professionals/notification.service'
import { mailProvider } from '../auth/providers/mail.provider'

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

function toClientView(a: AppointmentRow) {
  return {
    id:               a.id,
    serviceId:        a.serviceId,
    serviceName:      a.service.name,
    professionalId:   a.professionalId,
    professionalName: a.professional.name,
    date:             a.date,
    time:             a.time,
    duration:         a.duration,
    price:            Number(a.servicePrice),
    depositAmount:    Number(a.depositAmount),
    status:           a.status,
    paymentStatus:    a.paymentStatus,
  }
}

function toProfessionalView(a: AppointmentRow) {
  return {
    id:            a.id,
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
    isSimultaneous: false,
  }
}

function toAdminView(a: AppointmentRow) {
  const start = `${a.date}T${a.time}:00`
  const end   = new Date(new Date(start).getTime() + a.duration * 60000).toISOString()
  return {
    id:               a.id,
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

export const appointmentService = {

  // ── Cliente ──────────────────────────────────────────────────────

  createForClient: async (
    clientId: string,
    input: { serviceId: string; professionalId: string; date: string; time: string },
  ) => {
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

    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        professionalId: input.professionalId,
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

  cancelForClient: async (clientId: string, id: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.status === 'cancelled') {
      throw new AppError(HTTP.BAD_REQUEST, 'El turno ya está cancelado', 'ALREADY_CANCELLED')
    }

    const paymentSettings = await settingsService.getPaymentSettings()
    const apptDateTime = new Date(`${appointment.date}T${appointment.time}:00`)
    const hoursUntil    = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
    const eligible      = hoursUntil >= paymentSettings.cancellationHours
    const refunded      = eligible && paymentSettings.refundPolicy !== 'none'

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status:        'cancelled',
        cancelledAt:   new Date(),
        paymentStatus: refunded ? 'refunded' : appointment.paymentStatus,
      },
      include: APPOINTMENT_INCLUDE,
    })

    // El cliente ya sabe que canceló — no se le manda mail a sí mismo.
    await afterCancel(updated, false)
    return { appointment: toClientView(updated), refunded }
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

    const updated = await prisma.appointment.update({
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
      },
      include: APPOINTMENT_INCLUDE,
    })

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
    return rows.map(toProfessionalView)
  },

  updateForProfessional: async (
    professionalId: string,
    id: string,
    data: { status?: string; internalNotes?: string },
  ) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment || appointment.professionalId !== professionalId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (data.status !== undefined) assertValidStatus(data.status)
    const cancelling = data.status === 'cancelled' && appointment.status !== 'cancelled'

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.status        !== undefined ? { status: data.status } : {}),
        ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
        ...(cancelling ? { cancelledAt: new Date() } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    })

    if (cancelling) await afterCancel(updated, true)
    return toProfessionalView(updated)
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
          id:          a.id,
          date:        a.date,
          serviceName: a.service.name,
          price:       Number(a.servicePrice),
          notes:       a.internalNotes ?? '',
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
  }) => {
    const appointment = await prisma.appointment.findUnique({ where: { id } })
    if (!appointment) throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')

    if (data.status !== undefined) assertValidStatus(data.status)

    if (data.professionalId !== undefined) {
      const professional = await prisma.user.findUnique({ where: { id: data.professionalId } })
      if (!professional || !['professional', 'admin'].includes(professional.role)) {
        throw new AppError(HTTP.BAD_REQUEST, 'Profesional no válido', 'PROFESSIONAL_NOT_FOUND')
      }
    }

    const cancelling = data.status === 'cancelled' && appointment.status !== 'cancelled'

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(data.status         !== undefined ? { status: data.status }               : {}),
        ...(data.professionalId !== undefined ? { professionalId: data.professionalId } : {}),
        ...(data.date           !== undefined ? { date: data.date }                   : {}),
        ...(data.time           !== undefined ? { time: data.time }                   : {}),
        ...(data.duration       !== undefined ? { duration: data.duration }           : {}),
        ...(data.servicePrice   !== undefined ? { servicePrice: data.servicePrice }   : {}),
        ...(data.internalNotes  !== undefined ? { internalNotes: data.internalNotes } : {}),
        ...(data.clientNotes    !== undefined ? { clientNotes: data.clientNotes }     : {}),
        ...(cancelling ? { cancelledAt: new Date() } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    })

    if (cancelling) await afterCancel(updated, true)
    return toAdminView(updated)
  },
}

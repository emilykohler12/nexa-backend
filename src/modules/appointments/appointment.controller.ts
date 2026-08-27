// src/modules/appointments/appointment.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { appointmentService, APPOINTMENT_STATUSES } from './appointment.service'
import { AppError }           from '../../app/middlewares/errorHandler'
import { HTTP }               from '../../app/constants/http'
import { dateSchema, timeSchema } from '../../app/validators/datetime'

function getId(req: Request): string {
  const { id } = req.params
  if (!id || Array.isArray(id)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
  return id
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
  }
  return parsed.data
}

// "any" ("Cualquiera") deja que el backend elija el profesional con menos turnos.
const professionalIdSchema = z.union([
  z.literal('any'),
  z.string().uuid('ID de profesional inválido'),
])

const bookingSchema = z.object({
  serviceId:      z.string().uuid('ID de servicio inválido'),
  professionalId: professionalIdSchema,
  date:           dateSchema,
  time:           timeSchema,
})

const comboBookingSchema = z.object({
  comboServiceId: z.string().uuid('ID de combo inválido'),
  simultaneous:   z.boolean(),
  components: z.array(z.object({
    serviceId:      z.string().uuid('ID de servicio inválido'),
    professionalId: professionalIdSchema,
    date:           dateSchema,
    time:           timeSchema,
  })).min(1, 'El combo necesita al menos un servicio'),
})

const detailsSchema = z.object({
  allergies:     z.string().max(2000).nullable().optional(),
  accompanied:   z.boolean().optional(),
  companionName: z.string().max(150).nullable().optional(),
  designPreference: z.object({
    type:  z.enum(['image', 'text']),
    value: z.string().nullable(),
  }).nullable().optional(),
  hasOtherSalonPolish:     z.boolean().nullable().optional(),
  isNailReconstruction:    z.boolean().nullable().optional(),
  nailReconstructionCount: z.coerce.number().int().min(0).nullable().optional(),
  hairLength:              z.string().max(20).nullable().optional(),
  wantsExtensions:         z.boolean().nullable().optional(),
  skinType:                z.string().max(20).nullable().optional(),
})

const adminUpdateAppointmentSchema = z.object({
  status:         z.enum(APPOINTMENT_STATUSES).optional(),
  professionalId: z.string().uuid('ID de profesional inválido').optional(),
  date:           dateSchema.optional(),
  time:           timeSchema.optional(),
  // El modal de edición del admin reprograma mandando start/end (ISO) en vez de date/time sueltos.
  start:            z.string().datetime('Fecha/hora de inicio inválida').optional(),
  end:              z.string().datetime('Fecha/hora de fin inválida').optional(),
  duration:         z.coerce.number().int().min(5, 'Duración mínima: 5 minutos').max(480).optional(),
  serviceDuration:  z.coerce.number().int().min(5, 'Duración mínima: 5 minutos').max(480).optional(),
  servicePrice:     z.coerce.number().min(0, 'El precio no puede ser negativo').optional(),
  internalNotes:     z.string().max(2000).optional(),
  professionalNotes: z.string().max(2000).optional(),
  clientNotes:       z.string().max(2000).optional(),
  clientName:        z.string().trim().min(1).max(150).optional(),
  clientPhone:       z.string().max(30).optional(),
  clientEmail:       z.string().email('Email inválido').optional(),
})

const adminCreateAppointmentSchema = z.object({
  clientName:     z.string().trim().min(1, 'El nombre del cliente es obligatorio').max(150),
  clientPhone:    z.string().max(30).optional().default(''),
  clientEmail:    z.string().trim().max(255).optional().default(''),
  serviceId:      z.string().uuid('ID de servicio inválido'),
  professionalId: z.string().uuid('ID de profesional inválido'),
  date:           dateSchema,
  time:           timeSchema,
})

const professionalCreateAppointmentSchema = z.object({
  clientName:  z.string().trim().min(1, 'El nombre del cliente es obligatorio').max(150),
  clientPhone: z.string().max(30).optional().default(''),
  clientEmail: z.string().trim().max(255).optional().default(''),
  serviceId:   z.string().uuid('ID de servicio inválido'),
  date:        dateSchema,
  time:        timeSchema,
})

function pad2(n: number): string { return String(n).padStart(2, '0') }

// El modal de edición manda start/end en ISO (hora local codificada en UTC) — se
// convierten a los mismos date/time locales 'YYYY-MM-DD'/'HH:mm' que usa el resto
// del sistema, igual que toAdminView arma start/end a partir de esos mismos campos.
function normalizeAdminUpdateInput(input: z.infer<typeof adminUpdateAppointmentSchema>) {
  const { start, end, serviceDuration, professionalNotes, ...rest } = input
  const out: Record<string, unknown> = { ...rest }

  if (start) {
    const d = new Date(start)
    out.date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    out.time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  if (out.duration === undefined && serviceDuration !== undefined) {
    out.duration = serviceDuration
  } else if (out.duration === undefined && start && end) {
    out.duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  }
  if (out.internalNotes === undefined && professionalNotes !== undefined) {
    out.internalNotes = professionalNotes
  }

  return out as {
    status?: string; professionalId?: string
    date?: string; time?: string
    duration?: number; servicePrice?: number
    internalNotes?: string; clientNotes?: string
    clientName?: string; clientPhone?: string; clientEmail?: string
  }
}

export const appointmentController = {

  // Cliente
  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(bookingSchema, req.body)
      const appointment = await appointmentService.createForClient(req.user!.id, input)
      res.status(HTTP.CREATED).json({ appointment })
    } catch (err) { next(err) }
  },

  createCombo: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(comboBookingSchema, req.body)
      const appointments = await appointmentService.createComboForClient(req.user!.id, input)
      res.status(HTTP.CREATED).json({ appointments })
    } catch (err) { next(err) }
  },

  listMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointments = await appointmentService.listForClient(req.user!.id)
      res.json({ appointments })
    } catch (err) { next(err) }
  },

  cancelMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await appointmentService.cancelForClient(req.user!.id, getId(req))
      res.json(result)
    } catch (err) { next(err) }
  },

  rescheduleMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(bookingSchema, req.body)
      const appointment = await appointmentService.rescheduleForClient(req.user!.id, getId(req), input)
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  updateDetailsMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(detailsSchema, req.body)
      const appointment = await appointmentService.updateDetailsForClient(req.user!.id, getId(req), input)
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  acknowledgeReschedule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointment = await appointmentService.acknowledgeReschedule(req.user!.id, getId(req))
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  // Profesional
  listForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointments = await appointmentService.listForProfessional(req.user!.id)
      res.json({ appointments })
    } catch (err) { next(err) }
  },

  updateForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointment = await appointmentService.updateForProfessional(req.user!.id, getId(req), req.body)
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  createForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(professionalCreateAppointmentSchema, req.body)
      const appointment = await appointmentService.createForProfessional(req.user!.id, input)
      res.status(HTTP.CREATED).json({ appointment })
    } catch (err) { next(err) }
  },

  listClientsForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clients = await appointmentService.listClientsForProfessional(req.user!.id)
      res.json({ clients })
    } catch (err) { next(err) }
  },

  // Admin
  listForAdmin: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointments = await appointmentService.listForAdmin()
      res.json({ appointments })
    } catch (err) { next(err) }
  },

  updateForAdmin: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = parseBody(adminUpdateAppointmentSchema, req.body)
      const input  = normalizeAdminUpdateInput(parsed)
      const appointment = await appointmentService.updateForAdmin(getId(req), input)
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  createForAdmin: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(adminCreateAppointmentSchema, req.body)
      const appointment = await appointmentService.createForAdmin(input)
      res.status(HTTP.CREATED).json({ appointment })
    } catch (err) { next(err) }
  },

  getHistoryForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const history = await appointmentService.getHistoryForProfessional(getId(req))
      res.json({ history })
    } catch (err) { next(err) }
  },
}

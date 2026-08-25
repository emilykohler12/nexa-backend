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

const bookingSchema = z.object({
  serviceId:      z.string().uuid('ID de servicio inválido'),
  professionalId: z.string().uuid('ID de profesional inválido'),
  date:           dateSchema,
  time:           timeSchema,
})

const detailsSchema = z.object({
  allergies:     z.string().max(2000).nullable().optional(),
  accompanied:   z.boolean().optional(),
  companionName: z.string().max(150).nullable().optional(),
  designPreference: z.object({
    type:  z.enum(['image', 'text']),
    value: z.string().nullable(),
  }).nullable().optional(),
})

const adminUpdateAppointmentSchema = z.object({
  status:         z.enum(APPOINTMENT_STATUSES).optional(),
  professionalId: z.string().uuid('ID de profesional inválido').optional(),
  date:           dateSchema.optional(),
  time:           timeSchema.optional(),
  duration:       z.coerce.number().int().min(5, 'Duración mínima: 5 minutos').max(480).optional(),
  servicePrice:   z.coerce.number().min(0, 'El precio no puede ser negativo').optional(),
  internalNotes:  z.string().max(2000).optional(),
  clientNotes:    z.string().max(2000).optional(),
})

export const appointmentController = {

  // Cliente
  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(bookingSchema, req.body)
      const appointment = await appointmentService.createForClient(req.user!.id, input)
      res.status(HTTP.CREATED).json({ appointment })
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
      const input = parseBody(adminUpdateAppointmentSchema, req.body)
      const appointment = await appointmentService.updateForAdmin(getId(req), input)
      res.json({ appointment })
    } catch (err) { next(err) }
  },

  getHistoryForProfessional: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const history = await appointmentService.getHistoryForProfessional(getId(req))
      res.json({ history })
    } catch (err) { next(err) }
  },
}

// src/modules/settings/settings.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { settingsService } from './settings.service'
import { AppError }        from '../../app/middlewares/errorHandler'
import { HTTP }            from '../../app/constants/http'
import { dateSchema, timeSchema } from '../../app/validators/datetime'

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const scheduleDaySchema = z.object({
  day:    z.enum(WEEK_DAYS),
  isOpen: z.boolean(),
  open:   timeSchema,
  close:  timeSchema,
})

const holidaySchema = z.object({
  date:        dateSchema,
  description: z.string().trim().min(1, 'La descripción del feriado es obligatoria').max(255),
})

const updateScheduleSchema = z.object({
  schedule: z.array(scheduleDaySchema),
  holidays: z.array(holidaySchema),
})

// Seña y cancelaciones. refundPolicy admite solo 'full' o 'none' (el sistema solo marca la seña como devuelta).
// Si la seña es un porcentaje, no puede superar 100 (el servicio lo verifica contra el valor guardado).
const updatePaymentSettingsSchema = z.object({
  depositAmount:     z.coerce.number('El monto de la seña tiene que ser un número').min(0, 'La seña no puede ser negativa').max(999999),
  depositPercent:    z.boolean('depositPercent tiene que ser verdadero o falso'),
  cancellationHours: z.coerce.number('Las horas de cancelación tienen que ser un número').int('Las horas de cancelación tienen que ser un número entero').min(0, 'Las horas de cancelación no pueden ser negativas').max(720, 'Las horas de cancelación no pueden superar 720'),
  refundPolicy:      z.enum(['full', 'none'], { message: 'La política de devolución tiene que ser "full" o "none"' }),
}).partial()

const polishRemovalRuleSchema = z.object({
  id:    z.string().min(1),
  label: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  price: z.coerce.number().min(0).max(999999),
})
const updatePolishRemovalRulesSchema = z.object({ rules: z.array(polishRemovalRuleSchema) })

export const settingsController = {

  getBusiness: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await settingsService.getBusinessSettings()
      res.json({ settings })
    } catch (err) { next(err) }
  },

  updateBusiness: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await settingsService.updateBusinessSettings(req.body)
      res.json({ settings })
    } catch (err) { next(err) }
  },

  getPublicBusiness: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const business = await settingsService.getPublicBusiness()
      res.json({ business })
    } catch (err) { next(err) }
  },

  getSchedule: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await settingsService.getSchedule()
      res.json(result)
    } catch (err) { next(err) }
  },

  updateSchedule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateScheduleSchema.safeParse({
        schedule: req.body.schedule ?? [],
        holidays: req.body.holidays ?? [],
      })
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const result = await settingsService.updateSchedule(parsed.data.schedule, parsed.data.holidays)
      res.json(result)
    } catch (err) { next(err) }
  },

  getPublicSchedule: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schedule } = await settingsService.getSchedule()
      res.json({ schedule })
    } catch (err) { next(err) }
  },

  getPayments: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await settingsService.getPaymentSettings()
      res.json({ settings })
    } catch (err) { next(err) }
  },

  updatePayments: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updatePaymentSettingsSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const settings = await settingsService.updatePaymentSettings(parsed.data)
      res.json({ settings })
    } catch (err) { next(err) }
  },

  getPublicPayments: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await settingsService.getPublicPaymentSettings()
      res.json({ settings })
    } catch (err) { next(err) }
  },

  getPublicStats: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await settingsService.getPublicStats()
      res.json(stats)
    } catch (err) { next(err) }
  },

  getPolishRemovalRules: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rules = await settingsService.getPolishRemovalRules()
      res.json({ rules })
    } catch (err) { next(err) }
  },

  updatePolishRemovalRules: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updatePolishRemovalRulesSchema.safeParse({ rules: req.body.rules ?? [] })
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const rules = await settingsService.updatePolishRemovalRules(parsed.data.rules)
      res.json({ rules })
    } catch (err) { next(err) }
  },
}

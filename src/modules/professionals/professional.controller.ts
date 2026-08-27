// src/modules/professionals/professional.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { professionalService } from './professional.service'
import { statisticsService }   from './statistics.service'
import { notificationService } from './notification.service'
import { AppError }            from '../../app/middlewares/errorHandler'
import { HTTP }                from '../../app/constants/http'
import type { AuthUser }       from '../auth/types/auth.types'

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  if (!value || Array.isArray(value)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
  return value
}

export const professionalsController = {

  getAllPublic: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeAdmin = req.query.includeAdmin === 'true'
      const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined
      const professionals = await professionalService.getAllPublic(includeAdmin, serviceId)
      res.json({ professionals })
    } catch (err) { next(err) }
  },

  getPublicAvailability: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) {
        throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      }
      const date = typeof req.query.date === 'string' ? req.query.date : undefined
      const { availability, bookedTimes } = await professionalService.getPublicAvailability(id, date)
      res.json({ availability, bookedTimes })
    } catch (err) { next(err) }
  },

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const professionals = await professionalService.getAll()
      res.json({ professionals })
    } catch (err) { next(err) }
  },

  getById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) {
        throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      }
      const professional = await professionalService.getById(id)
      res.json({ professional })
    } catch (err) { next(err) }
  },

  updateById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) {
        throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      }
      const professional = await professionalService.updateById(id, req.body)
      res.json({ professional })
    } catch (err) { next(err) }
  },

  toggleActive: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) {
        throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      }
      await professionalService.toggleActive(id)
      res.json({ message: 'Estado actualizado' })
    } catch (err) { next(err) }
  },

  toggleRole: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) {
        throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      }
      const actor = (req as Request & { user?: AuthUser }).user
      if (actor?.id === id) {
        throw new AppError(HTTP.FORBIDDEN, 'No podés cambiar tu propio rol', 'SELF_ROLE_CHANGE')
      }
      await professionalService.toggleRole(id)
      res.json({ message: 'Rol actualizado' })
    } catch (err) { next(err) }
  },

  // ── Self-service — profesional autenticado ─────────────────────────

  getMyProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await professionalService.getMyProfile(req.user!.id)
      res.json({ profile })
    } catch (err) { next(err) }
  },

  updateMyProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await professionalService.updateMyProfile(req.user!.id, req.body)
      res.json({ profile })
    } catch (err) { next(err) }
  },

  getMyServices: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await professionalService.getMyServices(req.user!.id)
      res.json({ services })
    } catch (err) { next(err) }
  },

  updateMyServices: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await professionalService.updateMyServices(req.user!.id, req.body.services ?? [])
      res.json({ services })
    } catch (err) { next(err) }
  },

  updateMySchedule: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await professionalService.updateMySchedule(req.user!.id, req.body.availability ?? {})
      res.json(result)
    } catch (err) { next(err) }
  },

  submitOnboarding: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await professionalService.saveOnboarding(req.user!.id, req.body)
      res.json({ message: 'Perfil completado' })
    } catch (err) { next(err) }
  },

  onboardingStatus: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await professionalService.getOnboardingStatus(req.user!.id)
      res.json(status)
    } catch (err) { next(err) }
  },

  getMyStatistics: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawPeriod = req.query.period
      const period = (typeof rawPeriod === 'string' && ['day', 'week', 'month', 'year'].includes(rawPeriod))
        ? rawPeriod as 'day' | 'week' | 'month' | 'year'
        : 'month'
      const statistics = await statisticsService.getForProfessional(req.user!.id, period)
      res.json({ statistics })
    } catch (err) { next(err) }
  },

  getMyNotifications: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notifications = await notificationService.getMine(req.user!.id)
      res.json({ notifications })
    } catch (err) { next(err) }
  },

  markAllNotificationsRead: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await notificationService.markAllRead(req.user!.id)
      res.json({ message: 'Notificaciones marcadas como leídas' })
    } catch (err) { next(err) }
  },

  markNotificationRead: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await notificationService.markRead(req.user!.id, getParam(req, 'id'))
      res.json({ message: 'Notificación marcada como leída' })
    } catch (err) { next(err) }
  },
}

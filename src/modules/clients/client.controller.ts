// src/modules/clients/client.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { clientService } from './client.service'
import { clientNotificationService } from './client-notification.service'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'

export const clientController = {

  getProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError(HTTP.UNAUTHORIZED, 'No autenticado')
      const profile = await clientService.getProfile(req.user.id)
      res.json({ user: profile })
    } catch (err) { next(err) }
  },

  updateProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError(HTTP.UNAUTHORIZED, 'No autenticado')
      const updated = await clientService.updateProfile(req.user.id, req.body)
      res.json({ user: updated })
    } catch (err) { next(err) }
  },

  getMyNotifications: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notifications = await clientNotificationService.getMine(req.user!.id)
      res.json({ notifications })
    } catch (err) { next(err) }
  },

  markAllNotificationsRead: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await clientNotificationService.markAllRead(req.user!.id)
      res.json({ message: 'Notificaciones marcadas como leídas' })
    } catch (err) { next(err) }
  },

  markNotificationRead: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params
      if (!id || Array.isArray(id)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
      await clientNotificationService.markRead(req.user!.id, id)
      res.json({ message: 'Notificación marcada como leída' })
    } catch (err) { next(err) }
  },
}
// src/modules/clients/client.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { clientService } from './client.service'
import { clientNotificationService } from './client-notification.service'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'

// La base guarda el nombre en VarChar(100) y el teléfono en VarChar(20): un valor más largo daba
// un error 500, y un valor que no era texto se aceptaba o se descartaba sin avisar.
const updateProfileSchema = z.object({
  name:  z.string('El nombre debe ser texto').trim().min(1, 'El nombre es obligatorio').max(100, 'El nombre es demasiado largo (máximo 100 caracteres)').optional(),
  phone: z.string('El teléfono debe ser texto').trim().max(20, 'El teléfono es demasiado largo (máximo 20 caracteres)').nullable().optional(),
})

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
      // Solo nombre y teléfono, con los largos de la base (100 y 20); cualquier otro campo
      // (email, rol, active, blocked) se ignora.
      const parsed = updateProfileSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0]?.message ?? 'Datos inválidos', 'VALIDATION_ERROR')
      }
      const updated = await clientService.updateProfile(req.user.id, parsed.data)
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
// src/modules/clients/client.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { clientService } from './client.service'
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
}
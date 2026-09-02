// src/modules/admin/admin.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { adminService }     from './admin.service'
import { activityService }  from '../activity/activity.service'
import { dashboardService, type PeriodFilter } from './dashboard.service'
import { AppError }         from '../../app/middlewares/errorHandler'
import { HTTP }             from '../../app/constants/http'

function getId(req: Request): string {
  const { id } = req.params
  if (!id || Array.isArray(id)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
  return id
}

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  if (!value || Array.isArray(value)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
  return value
}

export const adminController = {

  getClients: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clients = await adminService.getAllClients()
      res.json({ clients })
    } catch (err) { next(err) }
  },

  getClientHistory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const history = await adminService.getClientHistory(getId(req))
      res.json({ history })
    } catch (err) { next(err) }
  },

  createClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await adminService.createClient(req.body)
      res.status(HTTP.CREATED).json({ client })
    } catch (err) { next(err) }
  },

  updateClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await adminService.updateClient(getId(req), req.body)
      res.json({ client })
    } catch (err) { next(err) }
  },

  setClientBlocked: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (typeof req.body?.blocked !== 'boolean') {
        throw new AppError(HTTP.BAD_REQUEST, 'blocked debe ser true o false', 'VALIDATION_ERROR')
      }
      const client = await adminService.setClientBlocked(getId(req), req.body.blocked)
      res.json({ client })
    } catch (err) { next(err) }
  },

  getClientGallery: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const photos = await adminService.getClientGallery(getId(req))
      res.json({ photos })
    } catch (err) { next(err) }
  },

  addClientGalleryPhoto: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const photo = await adminService.addClientGalleryPhoto(getId(req), req.body)
      res.status(HTTP.CREATED).json({ photo })
    } catch (err) { next(err) }
  },

  updateClientGalleryPhoto: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const photo = await adminService.updateClientGalleryPhoto(getId(req), getParam(req, 'photoId'), req.body)
      res.json({ photo })
    } catch (err) { next(err) }
  },

  deleteClientGalleryPhoto: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await adminService.deleteClientGalleryPhoto(getId(req), getParam(req, 'photoId'))
      res.json({ success: true })
    } catch (err) { next(err) }
  },

  anonymizeClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await adminService.anonymizeClient(getId(req), req.user?.email ?? 'Admin')
      res.json({ client })
    } catch (err) { next(err) }
  },

  getActivity: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const logs = await activityService.getAll()
      res.json({ logs })
    } catch (err) { next(err) }
  },

  getDashboard: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = (['day', 'week', 'month', 'year'].includes(req.query.period as string)
        ? req.query.period
        : 'month') as PeriodFilter
      const dashboard = await dashboardService.compute(period)
      res.json({ dashboard })
    } catch (err) { next(err) }
  },
}

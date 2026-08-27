// src/modules/services/service.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { serviceModel } from './service.model'
import { AppError }     from '../../app/middlewares/errorHandler'
import { HTTP }         from '../../app/constants/http'
import { z }            from 'zod'

const serviceSchema = z.object({
  name:        z.string().trim().min(2,  'El nombre debe tener al menos 2 caracteres').max(150),
  categoryId:  z.string().trim().min(1,  'Seleccioná una categoría'),
  description: z.string().trim().min(5,  'Agregá una descripción breve').max(1000),
  duration:    z.coerce.number().int().min(5,  'Mínimo 5 minutos').max(480),
  price:       z.coerce.number().min(0,  'El precio no puede ser negativo').max(999999),
  image:       z.string().url('URL de imagen inválida').nullable().optional(),
  status:      z.enum(['active', 'inactive']).default('active'),
  isCombo:     z.coerce.boolean().default(false),
  comboServiceIds: z.array(z.string().uuid()).default([]),
  simultaneous:    z.coerce.boolean().default(false),
})

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

export const serviceController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await serviceModel.findAll()
      res.json({ services })
    } catch (err) { next(err) }
  },

  getActive: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await serviceModel.findActive()
      res.json({ services })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = serviceSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const service = await serviceModel.create({
        ...parsed.data,
        image: parsed.data.image ?? null,
      })
      res.status(HTTP.CREATED).json({ service })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = serviceSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const service = await serviceModel.update(id, parsed.data)
      res.json({ service })
    } catch (err) { next(err) }
  },

  toggleStatus: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id      = getId(req)
      const service = await serviceModel.toggleStatus(id)
      if (!service) throw new AppError(HTTP.NOT_FOUND, 'Servicio no encontrado')
      res.json({ service })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      const result = await serviceModel.delete(id)
      res.json({
        success:     true,
        deactivated: !result.deleted,
        message:     result.deleted
          ? undefined
          : 'El servicio tiene turnos registrados, así que se desactivó en vez de eliminarse para no perder el historial.',
      })
    } catch (err) { next(err) }
  },
}
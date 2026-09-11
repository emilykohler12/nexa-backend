// src/modules/products/inventoryMovement.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { inventoryMovementModel } from './inventoryMovement.model'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import { dateSchema } from '../../app/validators/datetime'

const movementSchema = z.object({
  productId: z.string().uuid('Producto inválido'),
  type:      z.enum(['entry', 'exit']),
  quantity:  z.coerce.number().int().min(1, 'La cantidad mínima es 1'),
  note:      z.string().trim().max(500).optional().default(''),
  date:      dateSchema,
})

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

export const inventoryMovementController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const movements = await inventoryMovementModel.findAll()
      res.json({ movements })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = movementSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const movement = await inventoryMovementModel.create(parsed.data)
      res.status(HTTP.CREATED).json({ movement })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = movementSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const movement = await inventoryMovementModel.update(id, parsed.data)
      res.json({ movement })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      await inventoryMovementModel.delete(id)
      res.json({ success: true })
    } catch (err) { next(err) }
  },
}

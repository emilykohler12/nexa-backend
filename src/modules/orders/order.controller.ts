// src/modules/orders/order.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { orderService } from './order.service'
import { AppError }     from '../../app/middlewares/errorHandler'
import { HTTP }         from '../../app/constants/http'

const createOrderSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  quantity:  z.coerce.number().int().min(1, 'La cantidad mínima es 1'),
})

export const orderController = {

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const order = await orderService.createForClient(req.user!.id, parsed.data)
      res.status(HTTP.CREATED).json({ order })
    } catch (err) { next(err) }
  },
}

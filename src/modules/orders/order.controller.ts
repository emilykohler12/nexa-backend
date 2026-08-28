// src/modules/orders/order.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { orderService } from './order.service'
import { AppError }     from '../../app/middlewares/errorHandler'
import { HTTP }         from '../../app/constants/http'

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId:   z.string().uuid('ID de producto inválido'),
    quantity:    z.coerce.number().int().min(1, 'La cantidad mínima es 1'),
    promotionId: z.string().uuid('ID de promoción inválido').nullable().optional(),
  })).min(1, 'El pedido necesita al menos un producto'),
  delivery: z.object({
    type:    z.enum(['pickup', 'delivery']),
    address: z.string().max(500).nullable().optional(),
  }),
  phone:         z.string().max(30).nullable().optional(),
  notes:         z.string().max(1000).nullable().optional(),
  paymentMethod: z.enum(['qr', 'link', 'card']).nullable().optional(),
})

export const orderController = {

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createOrderSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      if (parsed.data.delivery.type === 'delivery' && !parsed.data.delivery.address?.trim()) {
        throw new AppError(HTTP.BAD_REQUEST, 'La dirección es obligatoria para envío a domicilio', 'VALIDATION_ERROR')
      }
      const order = await orderService.createForClient(req.user!.id, parsed.data)
      res.status(HTTP.CREATED).json({ order })
    } catch (err) { next(err) }
  },

  listMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await orderService.listForClient(req.user!.id)
      res.json({ orders })
    } catch (err) { next(err) }
  },
}

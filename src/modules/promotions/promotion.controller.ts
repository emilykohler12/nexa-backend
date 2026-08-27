// src/modules/promotions/promotion.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { promotionModel } from './promotion.model'
import { AppError }       from '../../app/middlewares/errorHandler'
import { HTTP }           from '../../app/constants/http'
import { dateSchema }     from '../../app/validators/datetime'

const promotionItemSchema = z.object({
  id:    z.string().min(1, 'ID de ítem inválido'),
  name:  z.string().min(1, 'Nombre de ítem inválido'),
  price: z.coerce.number().min(0),
})

const promotionSchema = z.object({
  type:          z.enum(['service', 'product']),
  kind:          z.enum(['discount', 'bundle', 'buy_x_pay_y']).default('discount'),
  title:         z.string().trim().min(2, 'El título debe tener al menos 2 caracteres').max(150),
  description:   z.string().trim().max(2000).optional().default(''),
  image:         z.string().url('URL de imagen inválida').nullable().optional(),
  price:         z.coerce.number().min(0, 'El precio no puede ser negativo').max(999999),
  originalPrice: z.coerce.number().min(0).max(999999).nullable().optional(),
  status:        z.enum(['active', 'inactive']).default('active'),
  // Servicios o productos reales vinculados — obligatorio, así "Reservar"/"Comprar"
  // siempre apunta a algo que existe de verdad.
  items:         z.array(promotionItemSchema).min(1, 'La promoción necesita al menos un ítem vinculado'),
  buyQty:        z.coerce.number().int().min(1).nullable().optional(),
  payQty:        z.coerce.number().int().min(1).nullable().optional(),
  startDate:     dateSchema.nullable().optional(),
  endDate:       dateSchema.nullable().optional(),
})

// Reglas cruzadas que Zod solo no puede expresar bien (dependen de más de un campo).
function assertKindRules(kind: string, items: { id: string }[], buyQty?: number | null, payQty?: number | null) {
  if (kind === 'bundle' && items.length < 2) {
    throw new AppError(HTTP.BAD_REQUEST, 'Un combo necesita al menos 2 ítems vinculados', 'VALIDATION_ERROR')
  }
  if (kind === 'buy_x_pay_y' && (buyQty == null || payQty == null)) {
    throw new AppError(HTTP.BAD_REQUEST, 'La oferta necesita cantidad a llevar y a pagar', 'VALIDATION_ERROR')
  }
}

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

function toResponse(p: {
  id: string; type: string; kind: string; title: string; description: string; image: string | null
  price: { toString(): string }; originalPrice: { toString(): string } | null; status: string
  items: unknown; buyQty: number | null; payQty: number | null
  startDate: string | null; endDate: string | null
}) {
  return {
    id:            p.id,
    type:          p.type as 'service' | 'product',
    kind:          p.kind as 'discount' | 'bundle' | 'buy_x_pay_y',
    title:         p.title,
    description:   p.description,
    image:         p.image,
    price:         Number(p.price),
    originalPrice: p.originalPrice !== null ? Number(p.originalPrice) : null,
    status:        p.status as 'active' | 'inactive',
    items:         (p.items ?? []) as { id: string; name: string; price: number }[],
    buyQty:        p.buyQty,
    payQty:        p.payQty,
    startDate:     p.startDate,
    endDate:       p.endDate,
  }
}

export const promotionController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const promotions = await promotionModel.findAll()
      res.json({ promotions: promotions.map(toResponse) })
    } catch (err) { next(err) }
  },

  getActive: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const promotions = await promotionModel.findActive()
      res.json({ promotions: promotions.map(toResponse) })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = promotionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      assertKindRules(parsed.data.kind, parsed.data.items, parsed.data.buyQty, parsed.data.payQty)

      const promotion = await promotionModel.create({
        ...parsed.data,
        image:         parsed.data.image ?? null,
        originalPrice: parsed.data.originalPrice ?? null,
        buyQty:        parsed.data.buyQty ?? null,
        payQty:        parsed.data.payQty ?? null,
        startDate:     parsed.data.startDate ?? null,
        endDate:       parsed.data.endDate   ?? null,
      })
      res.status(HTTP.CREATED).json({ promotion: toResponse(promotion) })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = promotionSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      if (parsed.data.kind !== undefined && parsed.data.items !== undefined) {
        assertKindRules(parsed.data.kind, parsed.data.items, parsed.data.buyQty, parsed.data.payQty)
      }

      const promotion = await promotionModel.update(id, parsed.data)
      res.json({ promotion: toResponse(promotion) })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      await promotionModel.delete(id)
      res.json({ success: true })
    } catch (err) { next(err) }
  },
}

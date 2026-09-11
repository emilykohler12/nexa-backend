// src/modules/promotions/autoPromotion.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { autoPromotionModel } from './autoPromotion.model'
import type { AutoPromotionData } from './autoPromotion.model'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

const autoPromotionSchema = z.object({
  name:          z.string().trim().min(2, 'Ponele un nombre a la campaña').max(150),
  trigger:       z.enum(['birthday', 'appointment_milestone']),
  triggerConfig: z.record(z.string(), z.coerce.number()),
  discountType:  z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().min(0, 'El descuento no puede ser negativo').max(999999),
  message:       z.string().trim().max(500).optional().default(''),
  audienceType:  z.enum(['all', 'manual', 'category']).default('all'),
  audienceClientIds:  z.array(z.string().uuid()).default([]),
  audienceCategoryId: z.string().trim().max(50).nullable().optional(),
  active:        z.coerce.boolean().default(true),
})

// Reglas cruzadas que Zod solo no puede expresar (dependen de más de un campo).
function assertRules(data: {
  trigger: string; triggerConfig: Record<string, number>
  audienceType: string; audienceClientIds: string[]; audienceCategoryId?: string | null
}) {
  if (data.trigger === 'birthday') {
    const daysBefore = data.triggerConfig.daysBefore
    if (daysBefore === undefined || daysBefore < 0 || daysBefore > 60) {
      throw new AppError(HTTP.BAD_REQUEST, 'Elegí con cuántos días de anticipación se manda (0 a 60)', 'VALIDATION_ERROR')
    }
  }
  if (data.trigger === 'appointment_milestone') {
    const count = data.triggerConfig.count
    if (!count || count < 1) {
      throw new AppError(HTTP.BAD_REQUEST, 'Elegí a qué turno número del cliente dispara la campaña', 'VALIDATION_ERROR')
    }
  }
  if (data.audienceType === 'manual' && data.audienceClientIds.length === 0) {
    throw new AppError(HTTP.BAD_REQUEST, 'Elegí al menos un cliente para esta campaña', 'VALIDATION_ERROR')
  }
  if (data.audienceType === 'category' && !data.audienceCategoryId) {
    throw new AppError(HTTP.BAD_REQUEST, 'Elegí una categoría de servicio', 'VALIDATION_ERROR')
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
  id: string; name: string; trigger: string; triggerConfig: unknown
  discountType: string; discountValue: { toString(): string }; message: string
  audienceType: string; audienceClientIds: string[]; audienceCategoryId: string | null
  active: boolean; createdAt: Date
}) {
  return {
    id:                 p.id,
    name:               p.name,
    trigger:            p.trigger as 'birthday' | 'appointment_milestone',
    triggerConfig:      (p.triggerConfig ?? {}) as Record<string, number>,
    discountType:       p.discountType as 'percent' | 'fixed',
    discountValue:      Number(p.discountValue),
    message:            p.message,
    audienceType:       p.audienceType as 'all' | 'manual' | 'category',
    audienceClientIds:  p.audienceClientIds,
    audienceCategoryId: p.audienceCategoryId,
    active:             p.active,
    createdAt:          p.createdAt.toISOString(),
  }
}

export const autoPromotionController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await autoPromotionModel.findAll()
      res.json({ autoPromotions: items.map(toResponse) })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = autoPromotionSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      assertRules(parsed.data)

      const data: AutoPromotionData = {
        ...parsed.data,
        audienceCategoryId: parsed.data.audienceCategoryId ?? null,
      }
      const created = await autoPromotionModel.create(data)
      res.status(HTTP.CREATED).json({ autoPromotion: toResponse(created) })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = autoPromotionSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      if (parsed.data.trigger !== undefined || parsed.data.audienceType !== undefined) {
        const existing = await autoPromotionModel.findById(id)
        if (!existing) throw new AppError(HTTP.NOT_FOUND, 'Campaña no encontrada', 'NOT_FOUND')
        assertRules({
          trigger:            parsed.data.trigger ?? existing.trigger,
          triggerConfig:      (parsed.data.triggerConfig ?? existing.triggerConfig) as Record<string, number>,
          audienceType:       parsed.data.audienceType ?? existing.audienceType,
          audienceClientIds:  parsed.data.audienceClientIds ?? existing.audienceClientIds,
          audienceCategoryId: parsed.data.audienceCategoryId !== undefined ? parsed.data.audienceCategoryId : existing.audienceCategoryId,
        })
      }

      const updated = await autoPromotionModel.update(id, parsed.data)
      res.json({ autoPromotion: toResponse(updated) })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      await autoPromotionModel.delete(id)
      res.json({ success: true })
    } catch (err) { next(err) }
  },

  // Campañas activas que le aplican a un cliente puntual — para mostrar en su ficha.
  getForClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = getId(req)
      const items = await autoPromotionModel.findApplicableForClient(clientId)
      res.json({ autoPromotions: items.map(toResponse) })
    } catch (err) { next(err) }
  },
}

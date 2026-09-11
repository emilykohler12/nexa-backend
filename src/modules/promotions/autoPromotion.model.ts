// src/modules/promotions/autoPromotion.model.ts
//
// Campañas automáticas (cumpleaños, turno N, etc.) — distintas de Promotion:
// nunca se muestran en el home, son reglas que evalúa un job diario por cliente
// (ver src/jobs/autoPromotions.job.ts).
import { prisma } from '../../app/database/prisma'

export type AutoPromotionTrigger     = 'birthday' | 'appointment_milestone'
export type AutoPromotionDiscount    = 'percent' | 'fixed'
export type AutoPromotionAudience    = 'all' | 'manual' | 'category'

export interface AutoPromotionData {
  name:               string
  trigger:            AutoPromotionTrigger
  triggerConfig:      Record<string, number>
  discountType:       AutoPromotionDiscount
  discountValue:      number
  message:            string
  audienceType:       AutoPromotionAudience
  audienceClientIds:  string[]
  audienceCategoryId: string | null
  active:             boolean
}

export const autoPromotionModel = {

  findAll: () =>
    prisma.autoPromotion.findMany({ orderBy: { createdAt: 'desc' } }),

  findActive: () =>
    prisma.autoPromotion.findMany({ where: { active: true } }),

  findById: (id: string) =>
    prisma.autoPromotion.findUnique({ where: { id } }),

  create: (data: AutoPromotionData) =>
    prisma.autoPromotion.create({ data }),

  update: (id: string, data: Partial<AutoPromotionData>) =>
    prisma.autoPromotion.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.autoPromotion.delete({ where: { id } }),
}

// src/modules/promotions/promotion.model.ts
import type { Prisma } from '@prisma/client'
import { prisma } from '../../app/database/prisma'

export type PromotionType   = 'service' | 'product'
export type PromotionStatus = 'active' | 'inactive'
export type PromotionKind   = 'discount' | 'bundle' | 'buy_x_pay_y'

export interface PromotionItem {
  id:    string
  name:  string
  price: number
}

export interface PromotionData {
  type:          PromotionType
  kind:          PromotionKind
  title:         string
  description:   string
  image:         string | null
  price:         number
  originalPrice: number | null
  status:        PromotionStatus
  items:         PromotionItem[]
  buyQty:        number | null
  payQty:        number | null
  startDate:     string | null
  endDate:       string | null
}

function pad(n: number) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const promotionModel = {

  findAll: () =>
    prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } }),

  // Además de status: 'active', respeta la ventana de vigencia (startDate/endDate) —
  // una promo con status activo pero fuera de fecha no debe aparecer en el home.
  findActive: () => {
    const today = todayStr()
    return prisma.promotion.findMany({
      where: {
        status: 'active',
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: today } }] },
          { OR: [{ endDate: null },   { endDate:   { gte: today } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findById: (id: string) =>
    prisma.promotion.findUnique({ where: { id } }),

  create: (data: PromotionData) =>
    prisma.promotion.create({
      data: { ...data, items: data.items as unknown as Prisma.InputJsonValue },
    }),

  update: (id: string, data: Partial<PromotionData>) =>
    prisma.promotion.update({
      where: { id },
      data:  { ...data, items: data.items as unknown as Prisma.InputJsonValue | undefined },
    }),

  delete: (id: string) =>
    prisma.promotion.delete({ where: { id } }),
}

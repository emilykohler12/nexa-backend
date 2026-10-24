// src/modules/specialEvents/specialEvent.model.ts
//
// Evento especial destacado en el home (ver comentario del modelo en schema.prisma).
import { prisma } from '../../app/database/prisma'
import { todayArgentinaStr } from '../../app/utils/argentinaTime'

export interface SpecialEventData {
  serviceId:      string
  professionalId: string
  date:           string
  title:          string | null
  description:    string | null
  active:         boolean
}

// "Hoy" en hora de Argentina, no la del servidor (ver argentinaTime.ts).
const todayStr = todayArgentinaStr

const withDisplayInfo = {
  service: { select: { id: true, name: true, description: true, price: true, duration: true, image: true } },
  professional: {
    select: {
      id: true, name: true,
      professional: { select: { photo: true, specialty: true } },
    },
  },
} as const

export const specialEventModel = {

  findAll: () =>
    prisma.specialEvent.findMany({ orderBy: { createdAt: 'desc' }, include: withDisplayInfo }),

  // Solo eventos activos y cuya fecha no pasó todavía — así el admin no tiene
  // que acordarse de apagarlos manualmente al día siguiente.
  findActive: () =>
    prisma.specialEvent.findMany({
      where:   { active: true, date: { gte: todayStr() } },
      orderBy: { date: 'asc' },
      include: withDisplayInfo,
    }),

  findById: (id: string) =>
    prisma.specialEvent.findUnique({ where: { id } }),

  create: (data: SpecialEventData) =>
    prisma.specialEvent.create({ data, include: withDisplayInfo }),

  update: (id: string, data: Partial<SpecialEventData>) =>
    prisma.specialEvent.update({ where: { id }, data, include: withDisplayInfo }),

  delete: (id: string) =>
    prisma.specialEvent.delete({ where: { id } }),
}

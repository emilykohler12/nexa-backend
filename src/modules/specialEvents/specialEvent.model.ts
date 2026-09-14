// src/modules/specialEvents/specialEvent.model.ts
//
// Evento especial destacado en el home (ver comentario del modelo en schema.prisma).
import { prisma } from '../../app/database/prisma'

export interface SpecialEventData {
  serviceId:      string
  professionalId: string
  date:           string
  title:          string | null
  description:    string | null
  active:         boolean
}

function pad(n: number) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

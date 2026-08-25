// src/modules/services/service.model.ts
import { prisma } from '../../app/database/prisma'

export type ServiceStatus = 'active' | 'inactive'

export interface ServiceData {
  name:        string
  categoryId:  string
  description: string
  duration:    number
  price:       number
  image:       string | null
  status:      ServiceStatus
  isCombo:     boolean
}

export const serviceModel = {

  findAll: () =>
    prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
    }),

  findActive: () =>
    prisma.service.findMany({
      where:   { status: 'active' },
      orderBy: { name: 'asc' },
    }),

  findById: (id: string) =>
    prisma.service.findUnique({ where: { id } }),

  create: (data: ServiceData) =>
    prisma.service.create({ data }),

  update: (id: string, data: Partial<ServiceData>) =>
    prisma.service.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.service.delete({ where: { id } }),

  toggleStatus: async (id: string) => {
    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) return null
    return prisma.service.update({
      where: { id },
      data:  { status: service.status === 'active' ? 'inactive' : 'active' },
    })
  },
}
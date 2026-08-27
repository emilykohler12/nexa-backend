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
  comboServiceIds: string[]
  simultaneous:    boolean
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

  delete: async (id: string): Promise<{ deleted: boolean }> => {
    try {
      await prisma.service.delete({ where: { id } })
      return { deleted: true }
    } catch (err: any) {
      // El servicio tiene turnos o asignaciones a profesionales (RESTRICT) —
      // no se puede borrar sin perder ese historial, así que se desactiva en su lugar.
      const isForeignKeyRestrict = err?.code === 'P2003' || String(err?.message ?? '').includes('foreign key constraint')
      if (isForeignKeyRestrict) {
        await prisma.service.update({ where: { id }, data: { status: 'inactive' } })
        return { deleted: false }
      }
      throw err
    }
  },

  toggleStatus: async (id: string) => {
    const service = await prisma.service.findUnique({ where: { id } })
    if (!service) return null
    return prisma.service.update({
      where: { id },
      data:  { status: service.status === 'active' ? 'inactive' : 'active' },
    })
  },
}
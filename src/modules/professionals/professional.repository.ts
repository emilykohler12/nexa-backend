// src/modules/professionals/professional.repository.ts
import { prisma } from '../../app/database/prisma'

export const professionalsRepository = {

  findAll: () =>
    prisma.user.findMany({
      where:   { role: { in: ['professional', 'admin'] }, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, active: true, profileComplete: true, createdAt: true,
      },
    }),

  findById: (id: string) =>
    prisma.user.findUnique({
      where:  { id, active: true },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, active: true, profileComplete: true, createdAt: true,
      },
    }),

  updateActive: (id: string, active: boolean) =>
    prisma.user.update({ where: { id }, data: { active } }),

  updateRole: (id: string, role: 'professional' | 'admin') =>
    prisma.user.update({ where: { id }, data: { role: role as any } }),
}
// src/modules/invitations/invitation.repository.ts
import { prisma } from '../../app/database/prisma'

export const invitationRepository = {

  create: (data: { email: string; token: string; sentById?: string; expiresAt?: Date }) =>
    prisma.invitation.create({
      data: {
        email:     data.email,
        token:     data.token,
        sentById:  data.sentById ?? null,
        expiresAt: data.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),

  findByToken: (token: string) =>
    prisma.invitation.findUnique({ where: { token } }),

  // Marca la invitación como usada de forma atómica. Devuelve false si otro pedido la usó
  // antes, así dos registros simultáneos con el mismo link no crean dos cuentas.
  consume: async (token: string): Promise<boolean> => {
    const result = await prisma.invitation.updateMany({ where: { token, used: false }, data: { used: true } })
    return result.count === 1
  },

  findByEmail: (email: string) =>
    prisma.invitation.findFirst({
      where: { email, used: false },
      orderBy: { createdAt: 'desc' },
    }),

  // Invalida todas las invitaciones activas para ese email antes de crear una nueva
  invalidatePrevious: (email: string) =>
    prisma.invitation.updateMany({
      where: { email, used: false },
      data:  { used: true },
    }),
}
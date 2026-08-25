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

  markUsed: (token: string) =>
    prisma.invitation.update({ where: { token }, data: { used: true } }),

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
// src/modules/auth/auth.repository.ts
import { prisma } from '../../app/database/prisma'
import type { UserRole } from './types/auth.types'

export const authRepository = {

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email, active: true } }),

  findById: (id: string) =>
    prisma.user.findUnique({ where: { id, active: true } }),

  findPhoto: async (userId: string, role: string): Promise<string | null> => {
    if (role === 'professional') {
      const p = await prisma.professional.findUnique({ where: { userId }, select: { photo: true } })
      return p?.photo ?? null
    }
    // Los clientes no tienen foto de perfil — no se pide en el registro.
    return null
  },

  findByRefreshToken: (token: string) =>
    prisma.user.findFirst({ where: { refreshToken: token, active: true } }),

  findByVerificationToken: (token: string) =>
    prisma.user.findFirst({ where: { verificationToken: token, active: true } }),

  create: (data: {
    name: string
    email: string
    passwordHash: string
    role: UserRole
    phone?: string | null
    gender?: string | null
    verificationToken?: string
    termsAcceptedAt?: Date
  }) =>
    prisma.user.create({
      data: {
        name:              data.name,
        email:             data.email,
        passwordHash:      data.passwordHash,
        role:              data.role as any,
        phone:             data.phone ?? null,
        gender:            data.gender as any ?? null,
        verificationToken: data.verificationToken ?? null,
        termsAcceptedAt:   data.termsAcceptedAt ?? null,
      },
    }),

  // Crea un usuario ya verificado (para profesionales registrados por invitación)
  createVerified: (data: {
    name: string
    email: string
    passwordHash: string
    role: UserRole
    phone?: string | null
    gender?: string | null
  }) =>
    prisma.user.create({
      data: {
        name:          data.name,
        email:         data.email,
        passwordHash:  data.passwordHash,
        role:          data.role as any,
        phone:         data.phone ?? null,
        gender:        data.gender as any ?? null,
        emailVerified: true,
      },
    }),

  emailExists: async (email: string): Promise<boolean> => {
    const count = await prisma.user.count({ where: { email } })
    return count > 0
  },

  saveRefreshToken: (userId: string, token: string) =>
    prisma.user.update({ where: { id: userId }, data: { refreshToken: token } }),

  clearRefreshToken: (userId: string) =>
    prisma.user.update({ where: { id: userId }, data: { refreshToken: null } }),

  verifyEmail: (userId: string) =>
    prisma.user.update({
      where: { id: userId },
      data:  { emailVerified: true, verificationToken: null },
    }),

  updateRole: (userId: string, role: UserRole) =>
    prisma.user.update({
      where: { id: userId },
      data:  { role: role as any },
    }),

  savePasswordReset: async (userId: string, token: string, expiresAt: Date) => {
    await prisma.passwordReset.updateMany({
      where: { userId, used: false },
      data:  { used: true },
    })
    return prisma.passwordReset.create({ data: { userId, token, expiresAt } })
  },

  findPasswordReset: (token: string) =>
    prisma.passwordReset.findUnique({ where: { token } }),

  markPasswordResetUsed: (token: string) =>
    prisma.passwordReset.update({ where: { token }, data: { used: true } }),

  updatePassword: (userId: string, passwordHash: string) =>
    prisma.user.update({
      where: { id: userId },
      data:  { passwordHash, refreshToken: null },
    }),
}
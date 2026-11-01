// src/modules/auth/auth.repository.ts
import { prisma } from '../../app/database/prisma'
import type { UserRole } from './types/auth.types'
import { hashRefreshToken } from './utils/hashToken'

export const authRepository = {

  findByEmail: (email: string) =>
    prisma.user.findUnique({ where: { email, active: true } }),

  // Busca una cuenta por email SIN filtrar por activa y sin distinguir mayúsculas: sirve para
  // detectar una cuenta desactivada o guardada con otras mayúsculas antes de crear otra.
  findAnyByEmail: (email: string) =>
    prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } }),

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

  findByVerificationToken: (token: string) =>
    prisma.user.findFirst({ where: { verificationToken: token, active: true } }),

  create: (data: {
    name: string
    lastName?: string | null
    email: string
    passwordHash: string
    role: UserRole
    phone?: string | null
    gender?: string | null
    verificationToken?: string
    termsAcceptedAt?: Date
    termsVersion?: string
  }) =>
    prisma.user.create({
      data: {
        name:              data.name,
        lastName:          data.lastName ?? null,
        email:             data.email,
        passwordHash:      data.passwordHash,
        role:              data.role as any,
        phone:             data.phone ?? null,
        gender:            data.gender as any ?? null,
        verificationToken: data.verificationToken ?? null,
        termsAcceptedAt:   data.termsAcceptedAt ?? null,
        termsVersion:      data.termsVersion ?? null,
        emailVerified:     false,
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

  // ── Sesiones por dispositivo (refresh_sessions) ───────────────────────────────────────────────
  createSession: (data: { id: string; userId: string; refreshToken: string; expiresAt: Date }) =>
    prisma.refreshSession.create({
      data: { id: data.id, userId: data.userId, tokenHash: hashRefreshToken(data.refreshToken), expiresAt: data.expiresAt },
    }),

  findSession: (id: string) =>
    prisma.refreshSession.findUnique({ where: { id } }),

  // Reemplaza el token de la sesión SOLO si sigue siendo el que se leyó (control optimista): si
  // otro pedido con la misma cookie renovó antes, devuelve false. El hash anterior queda
  // aceptado hasta previousValidUntil.
  rotateSession: async (opts: {
    id: string; currentHash: string; newRefreshToken: string; previousValidUntil: Date; expiresAt: Date
  }): Promise<boolean> => {
    const result = await prisma.refreshSession.updateMany({
      where: { id: opts.id, tokenHash: opts.currentHash },
      data:  {
        tokenHash:          hashRefreshToken(opts.newRefreshToken),
        previousTokenHash:  opts.currentHash,
        previousValidUntil: opts.previousValidUntil,
        lastUsedAt:         new Date(),
        expiresAt:          opts.expiresAt,
      },
    })
    return result.count === 1
  },

  deleteSession: (id: string) =>
    prisma.refreshSession.deleteMany({ where: { id } }),

  deleteSessionsOf: (userId: string) =>
    prisma.refreshSession.deleteMany({ where: { userId } }),

  // Borra las vencidas y deja como máximo `keep` sesiones (las más recientes).
  pruneSessions: async (userId: string, keep: number): Promise<void> => {
    await prisma.refreshSession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    const surplus = await prisma.refreshSession.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      skip:    keep,
      select:  { id: true },
    })
    if (surplus.length > 0) {
      await prisma.refreshSession.deleteMany({ where: { id: { in: surplus.map(s => s.id) } } })
    }
  },

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

  // Busca el código DE ESA usuaria: el mismo código de otra cuenta no cuenta.
  findPasswordReset: (userId: string, token: string) =>
    prisma.passwordReset.findFirst({ where: { userId, token } }),

  // Marca el código como usado de forma atómica. Devuelve false si otro pedido lo usó antes,
  // así dos pedidos simultáneos con el mismo código no pueden cambiar la contraseña los dos.
  consumePasswordReset: async (id: string): Promise<boolean> => {
    const result = await prisma.passwordReset.updateMany({ where: { id, used: false }, data: { used: true } })
    return result.count === 1
  },

  // Cambiar la contraseña cierra la sesión en TODOS los dispositivos.
  updatePassword: async (userId: string, passwordHash: string) => {
    const [user] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.refreshSession.deleteMany({ where: { userId } }),
    ])
    return user
  },
}
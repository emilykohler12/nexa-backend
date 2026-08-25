// src/modules/clients/client.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import type { AuthUser } from '../auth/types/auth.types'

export const clientService = {

  getProfile: async (userId: string): Promise<AuthUser> => {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, role: true, phone: true, profileComplete: true, createdAt: true },
    })
    if (!user) throw new AppError(HTTP.NOT_FOUND, 'Usuario no encontrado')

    return {
      id:              user.id,
      name:            user.name,
      email:           user.email,
      role:            user.role as AuthUser['role'],
      phone:           user.phone ?? null,
      profileComplete: user.profileComplete,
      createdAt:       user.createdAt.toISOString(),
    }
  },

  updateProfile: async (
    userId: string,
    data: { name?: string; phone?: string | null; photo?: string | null }
  ): Promise<AuthUser> => {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name:  data.name  ?? undefined,
        phone: data.phone ?? undefined,
      },
      select: { id: true, name: true, email: true, role: true, phone: true, profileComplete: true, createdAt: true },
    })

    return {
      id:              user.id,
      name:            user.name,
      email:           user.email,
      role:            user.role as AuthUser['role'],
      phone:           user.phone ?? null,
      profileComplete: user.profileComplete,
      createdAt:       user.createdAt.toISOString(),
    }
  },
}
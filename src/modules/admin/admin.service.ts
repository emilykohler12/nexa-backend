// src/modules/admin/admin.service.ts
import crypto from 'node:crypto'
import { prisma }         from '../../app/database/prisma'
import { AppError }       from '../../app/middlewares/errorHandler'
import { HTTP }           from '../../app/constants/http'
import { bcryptProvider } from '../auth/providers/bcrypt.provider'
import { activityService } from '../activity/activity.service'

async function computeLoyalty(userId: string) {
  const appointments = await prisma.appointment.findMany({ where: { clientId: userId } })
  const counted = appointments.filter(a => a.status !== 'cancelled')
  const totalVisits = counted.length
  const totalSpent  = counted.reduce((sum, a) => sum + Number(a.servicePrice), 0)
  const lastVisit   = counted.length
    ? counted.reduce((latest, a) => (a.date > latest ? a.date : latest), counted[0].date)
    : null
  return { totalVisits, totalSpent, lastVisit }
}

function mapAdminClient(
  user: { id: string; name: string; email: string; phone: string | null; gender: string | null; createdAt: Date },
  client: {
    birthDate: Date | null
    allergies: string | null; preferences: string | null; observations: string | null
    loyaltyPoints: number
    blocked: boolean
  } | null,
  loyalty: { totalVisits: number; totalSpent: number; lastVisit: string | null },
) {
  return {
    id:        user.id,
    name:      user.name,
    photo:     null as string | null,
    phone:     user.phone ?? '',
    email:     user.email,
    birthDate: client?.birthDate ? client.birthDate.toISOString().slice(0, 10) : null,
    gender:    user.gender ?? null,
    clinical: {
      allergies:    client?.allergies    ?? '',
      preferences:  client?.preferences  ?? '',
      observations: client?.observations ?? '',
    },
    loyalty: {
      totalVisits:     loyalty.totalVisits,
      totalSpent:      loyalty.totalSpent,
      lastVisit:       loyalty.lastVisit,
      points:          client?.loyaltyPoints ?? 0,
      availablePromos: [] as string[],
    },
    blocked:   client?.blocked ?? false,
    createdAt: user.createdAt.toISOString(),
  }
}

async function getByIdInternal(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { client: true } })
  if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')
  const loyalty = await computeLoyalty(id)
  return mapAdminClient(user, user.client, loyalty)
}

export const adminService = {

  getAllClients: async () => {
    const users = await prisma.user.findMany({
      where:   { role: 'client' },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(users.map(async u => mapAdminClient(u, u.client, await computeLoyalty(u.id))))
  },

  getClientById: (id: string) => getByIdInternal(id),

  getClientHistory: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    const rows = await prisma.appointment.findMany({
      where:   { clientId: id, status: { in: ['finished', 'cancelled', 'no_show'] } },
      include: { professional: true, service: true },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    })

    return rows.map(a => ({
      id:           a.id,
      clientId:     a.clientId,
      service:      a.service.name,
      professional: a.professional.name,
      date:         a.date,
      time:         a.time,
      price:        Number(a.servicePrice),
      status:       a.status,
    }))
  },

  createClient: async (data: any) => {
    if (!data.email || !data.name) {
      throw new AppError(HTTP.BAD_REQUEST, 'Nombre y email son obligatorios', 'VALIDATION_ERROR')
    }
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) throw new AppError(HTTP.CONFLICT, 'Ese email ya está en uso', 'EMAIL_TAKEN')

    const password = typeof data.password === 'string' && data.password.length >= 8
      ? data.password
      : crypto.randomBytes(6).toString('hex')
    const passwordHash = await bcryptProvider.hash(password)

    const user = await prisma.user.create({
      data: {
        name:          data.name,
        email:         data.email,
        passwordHash,
        role:          'client',
        phone:         data.phone ?? null,
        gender:        data.gender ?? null,
        emailVerified: true,
      },
    })

    await prisma.client.create({
      data: {
        userId:       user.id,
        birthDate:    data.birthDate ? new Date(data.birthDate) : null,
        allergies:    data.clinical?.allergies    ?? null,
        preferences:  data.clinical?.preferences  ?? null,
        observations: data.clinical?.observations ?? null,
      },
    })

    return getByIdInternal(user.id)
  },

  updateClient: async (id: string, data: any) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    const userUpdate: Record<string, unknown> = {}
    if (data.name   !== undefined) userUpdate.name   = data.name
    if (data.email  !== undefined) userUpdate.email  = data.email
    if (data.phone  !== undefined) userUpdate.phone  = data.phone
    if (data.gender !== undefined) userUpdate.gender = data.gender

    if (Object.keys(userUpdate).length > 0) {
      try {
        await prisma.user.update({ where: { id }, data: userUpdate })
      } catch (err: any) {
        if (err?.code === 'P2002') throw new AppError(HTTP.CONFLICT, 'Ese email ya está en uso', 'EMAIL_TAKEN')
        throw err
      }
    }

    await prisma.client.upsert({
      where:  { userId: id },
      create: {
        userId:       id,
        birthDate:    data.birthDate ? new Date(data.birthDate) : null,
        allergies:    data.clinical?.allergies    ?? null,
        preferences:  data.clinical?.preferences  ?? null,
        observations: data.clinical?.observations ?? null,
        loyaltyPoints: data.loyalty?.points ?? 0,
      },
      update: {
        ...(data.birthDate !== undefined ? { birthDate: data.birthDate ? new Date(data.birthDate) : null } : {}),
        ...(data.clinical?.allergies    !== undefined ? { allergies: data.clinical.allergies }       : {}),
        ...(data.clinical?.preferences  !== undefined ? { preferences: data.clinical.preferences }   : {}),
        ...(data.clinical?.observations !== undefined ? { observations: data.clinical.observations } : {}),
        ...(data.loyalty?.points !== undefined ? { loyaltyPoints: data.loyalty.points } : {}),
      },
    })

    return getByIdInternal(id)
  },

  setClientBlocked: async (id: string, blocked: boolean) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    await prisma.client.upsert({
      where:  { userId: id },
      create: { userId: id, blocked },
      update: { blocked },
    })

    return getByIdInternal(id)
  },

  // RF-06.03 — supresión de datos personales a pedido del cliente (derecho de
  // supresión, Ley 25.326). No borra la fila: mantiene los turnos y totales
  // contables intactos, pero anonimiza los datos identificatorios y desactiva
  // la cuenta (no puede volver a loguearse con el email anonimizado, y se
  // invalida cualquier sesión activa). Deliberadamente NO toca alergias/
  // preferencias/observaciones — esa decisión queda para cuando se resuelva
  // si el sistema realmente necesita seguir guardando ese dato clínico o no
  // (ver dictamen, apartado 10).
  anonymizeClient: async (id: string, adminName: string) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    await prisma.user.update({
      where: { id },
      data: {
        name:         'Usuario Anónimo',
        email:        `anonimo_${id}@borrado.com`,
        phone:        null,
        active:       false,
        refreshToken: null,
      },
    })

    await activityService.log({
      userName: adminName,
      action:   'Anonimizó los datos de un cliente a pedido suyo',
      module:   'clients',
      level:    'warning',
      detail:   `Cliente ${id}`,
    })

    return getByIdInternal(id)
  },

  // ── Galería de fotos (antes/después) ────────────────────────────────

  getClientGallery: async (clientId: string) => {
    const user = await prisma.user.findUnique({ where: { id: clientId } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    const photos = await prisma.clientGalleryPhoto.findMany({
      where:   { clientId },
      orderBy: { createdAt: 'desc' },
    })
    return photos.map(p => ({
      id: p.id, url: p.url, category: p.category as 'before' | 'after',
      showOnHome: p.showOnHome, createdAt: p.createdAt.toISOString(),
    }))
  },

  addClientGalleryPhoto: async (clientId: string, data: { url: string; category: string; showOnHome?: boolean }) => {
    const user = await prisma.user.findUnique({ where: { id: clientId } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')
    if (!data.url) throw new AppError(HTTP.BAD_REQUEST, 'La URL de la foto es obligatoria', 'VALIDATION_ERROR')
    if (!['before', 'after'].includes(data.category)) {
      throw new AppError(HTTP.BAD_REQUEST, 'Categoría inválida', 'VALIDATION_ERROR')
    }

    const photo = await prisma.clientGalleryPhoto.create({
      data: { clientId, url: data.url, category: data.category, showOnHome: data.showOnHome ?? false },
    })
    return { id: photo.id, url: photo.url, category: photo.category as 'before' | 'after', showOnHome: photo.showOnHome, createdAt: photo.createdAt.toISOString() }
  },

  updateClientGalleryPhoto: async (clientId: string, photoId: string, data: { showOnHome?: boolean; category?: string }) => {
    const photo = await prisma.clientGalleryPhoto.findUnique({ where: { id: photoId } })
    if (!photo || photo.clientId !== clientId) throw new AppError(HTTP.NOT_FOUND, 'Foto no encontrada', 'NOT_FOUND')

    const updated = await prisma.clientGalleryPhoto.update({
      where: { id: photoId },
      data: {
        ...(data.showOnHome !== undefined ? { showOnHome: data.showOnHome } : {}),
        ...(data.category   !== undefined ? { category: data.category }   : {}),
      },
    })
    return { id: updated.id, url: updated.url, category: updated.category as 'before' | 'after', showOnHome: updated.showOnHome, createdAt: updated.createdAt.toISOString() }
  },

  deleteClientGalleryPhoto: async (clientId: string, photoId: string) => {
    const photo = await prisma.clientGalleryPhoto.findUnique({ where: { id: photoId } })
    if (!photo || photo.clientId !== clientId) throw new AppError(HTTP.NOT_FOUND, 'Foto no encontrada', 'NOT_FOUND')
    await prisma.clientGalleryPhoto.delete({ where: { id: photoId } })
  },
}

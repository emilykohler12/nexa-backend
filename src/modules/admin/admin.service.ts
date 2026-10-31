// src/modules/admin/admin.service.ts
import crypto from 'node:crypto'
import { prisma }         from '../../app/database/prisma'
import { AppError }       from '../../app/middlewares/errorHandler'
import { HTTP }           from '../../app/constants/http'
import { bcryptProvider } from '../auth/providers/bcrypt.provider'
import { activityService } from '../activity/activity.service'
import { fullName } from '../../app/utils/fullName'

// Resumen de visitas de la clienta: solo cuentan los turnos finalizados. No hay puntos ni
// beneficios (se eliminaron con la fidelización): es un dato informativo para el panel.
async function computeVisits(userId: string) {
  const finished = await prisma.appointment.findMany({ where: { clientId: userId, status: 'finished' } })
  const totalVisits = finished.length
  const totalSpent  = finished.reduce((sum, a) => sum + Number(a.servicePrice), 0)
  const lastVisit   = finished.length
    ? finished.reduce((latest, a) => (a.date > latest ? a.date : latest), finished[0].date)
    : null
  return { totalVisits, totalSpent, lastVisit }
}

function mapAdminClient(
  user: { id: string; name: string; lastName?: string | null; email: string; phone: string | null; gender: string | null; createdAt: Date },
  client: {
    allergies: string | null; preferences: string | null; observations: string | null
    blocked: boolean
  } | null,
  visits: { totalVisits: number; totalSpent: number; lastVisit: string | null },
) {
  return {
    id:        user.id,
    name:      fullName(user),
    photo:     null as string | null,
    phone:     user.phone ?? '',
    email:     user.email,
    gender:    user.gender ?? null,
    clinical: {
      allergies:    client?.allergies    ?? '',
      preferences:  client?.preferences  ?? '',
      observations: client?.observations ?? '',
    },
    visits: {
      totalVisits: visits.totalVisits,
      totalSpent:  visits.totalSpent,
      lastVisit:   visits.lastVisit,
    },
    blocked:   client?.blocked ?? false,
    createdAt: user.createdAt.toISOString(),
  }
}

// RF-07 — las alergias son un dato de salud y solo las carga la propia clienta, con su
// consentimiento, al reservar (`PATCH /api/client/appointments/:id/details`). Ni el admin
// ni las profesionales pueden cargarlas ni editarlas. El formulario del admin reenvía
// siempre todo el bloque `clinical`, así que se acepta el mismo valor que ya está guardado
// (o vacío si no hay ninguno) y se rechaza cualquier cambio.
function assertAllergiesUnchanged(data: any, current: string | null | undefined): void {
  const incoming = data.clinical?.allergies
  if (incoming === undefined || incoming === null) return
  const unchanged = typeof incoming === 'string' && incoming.trim() === (current ?? '').trim()
  if (!unchanged) {
    throw new AppError(
      HTTP.BAD_REQUEST,
      'Las alergias solo las puede cargar la clienta al reservar',
      'VALIDATION_ERROR',
    )
  }
}

async function getByIdInternal(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { client: true } })
  if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')
  const visits = await computeVisits(id)
  return mapAdminClient(user, user.client, visits)
}

export const adminService = {

  getAllClients: async () => {
    const users = await prisma.user.findMany({
      where:   { role: 'client' },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(users.map(async u => mapAdminClient(u, u.client, await computeVisits(u.id))))
  },

  getClientById: (id: string) => getByIdInternal(id),

  getClientHistory: async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    const rows = await prisma.appointment.findMany({
      where:   { clientId: id, status: { in: ['finished', 'cancelled', 'cancelled_no_show', 'no_show_auto'] } },
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
      cancelReason: a.cancelReason,
    }))
  },

  createClient: async (data: any) => {
    if (typeof data.email !== 'string' || !data.email.trim() || typeof data.name !== 'string' || !data.name.trim()) {
      throw new AppError(HTTP.BAD_REQUEST, 'Nombre y email son obligatorios', 'VALIDATION_ERROR')
    }
    assertAllergiesUnchanged(data, null)
    // El login pasa el email a minúsculas: si se guardara con mayúsculas, la clienta no podría entrar.
    const email = data.email.trim().toLowerCase()
    // Insensible a mayúsculas, para detectar también cuentas viejas guardadas con otras mayúsculas.
    const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    if (exists) throw new AppError(HTTP.CONFLICT, 'Ese email ya está en uso', 'EMAIL_TAKEN')

    const password = typeof data.password === 'string' && data.password.length >= 8
      ? data.password
      : crypto.randomBytes(6).toString('hex')
    const passwordHash = await bcryptProvider.hash(password)

    const user = await prisma.user.create({
      data: {
        name:          data.name.trim(),
        email,
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
        preferences:  data.clinical?.preferences  ?? null,
        observations: data.clinical?.observations ?? null,
      },
    })

    return getByIdInternal(user.id)
  },

  updateClient: async (id: string, data: any) => {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'client') throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')

    const profile = await prisma.client.findUnique({ where: { userId: id } })
    assertAllergiesUnchanged(data, profile?.allergies)

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
        preferences:  data.clinical?.preferences  ?? null,
        observations: data.clinical?.observations ?? null,
      },
      update: {
        ...(data.clinical?.preferences  !== undefined ? { preferences: data.clinical.preferences }   : {}),
        ...(data.clinical?.observations !== undefined ? { observations: data.clinical.observations } : {}),
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
        name:         'Cliente eliminado',
        lastName:     null,
        email:        `anonimo_${id}@borrado.com`,
        phone:        null,
        active:       false,
      },
    })
    // y se cierra la sesión en todos sus dispositivos
    await prisma.refreshSession.deleteMany({ where: { userId: id } })

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

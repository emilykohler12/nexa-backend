// src/modules/clients/client-notification.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

export type ClientNotificationType =
  | 'new_service' | 'new_product' | 'new_promotion' | 'special_service'
  | 'appointment_reminder' | 'system'

function mapNotification(n: {
  id: string; type: string; title: string; body: string
  read: boolean; createdAt: Date; link: string | null
}) {
  return {
    id:        n.id,
    type:      n.type as ClientNotificationType,
    title:     n.title,
    body:      n.body,
    read:      n.read,
    createdAt: n.createdAt.toISOString(),
    link:      n.link,
  }
}

export const clientNotificationService = {

  // Avisa a UN cliente puntual (ej. algo específico de su cuenta).
  notify: async (clientId: string, data: { type: ClientNotificationType; title: string; body: string; link?: string | null }) => {
    try {
      await prisma.clientNotification.create({
        data: { clientId, type: data.type, title: data.title, body: data.body, link: data.link ?? null },
      })
    } catch (err) {
      console.error('[client-notifications] no se pudo crear la notificación:', err)
    }
  },

  // Avisa a TODOS los clientes activos de una — nuevo servicio/producto/promo/
  // servicio especial activado. Un solo INSERT masivo (createMany), no un loop
  // de creates por cliente: así es rápido incluso con miles de clientes y no
  // hace falta un job/cola aparte para esto. El caller la llama sin awaitear
  // (fire-and-forget, mismo patrón que el resto de los efectos secundarios de
  // esta app) para no bloquear la respuesta del guardado del admin.
  broadcast: async (data: { type: ClientNotificationType; title: string; body: string; link?: string | null }) => {
    try {
      const clients = await prisma.user.findMany({
        where:  { role: 'client', active: true },
        select: { id: true },
      })
      if (clients.length === 0) return
      await prisma.clientNotification.createMany({
        data: clients.map(c => ({
          clientId: c.id, type: data.type, title: data.title, body: data.body, link: data.link ?? null,
        })),
      })
    } catch (err) {
      console.error('[client-notifications] no se pudo broadcastear:', err)
    }
  },

  getMine: async (clientId: string) => {
    const rows = await prisma.clientNotification.findMany({
      where:   { clientId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapNotification)
  },

  markAllRead: async (clientId: string) => {
    await prisma.clientNotification.updateMany({
      where: { clientId, read: false },
      data:  { read: true },
    })
  },

  markRead: async (clientId: string, id: string) => {
    const notif = await prisma.clientNotification.findUnique({ where: { id } })
    if (!notif || notif.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Notificación no encontrada', 'NOT_FOUND')
    }
    await prisma.clientNotification.update({ where: { id }, data: { read: true } })
  },
}

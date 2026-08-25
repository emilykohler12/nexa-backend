// src/modules/professionals/notification.service.ts
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'

export type NotificationType =
  | 'new_appointment' | 'cancelled_appointment' | 'rescheduled_appointment'
  | 'new_message' | 'payment_confirmed' | 'reminder' | 'admin_change' | 'system'

function mapNotification(n: {
  id: string; type: string; title: string; body: string
  read: boolean; createdAt: Date; link: string | null
}) {
  return {
    id:        n.id,
    type:      n.type as NotificationType,
    title:     n.title,
    body:      n.body,
    read:      n.read,
    createdAt: n.createdAt.toISOString(),
    link:      n.link,
  }
}

export const notificationService = {

  notify: async (professionalId: string, data: { type: NotificationType; title: string; body: string; link?: string | null }) => {
    try {
      await prisma.professionalNotification.create({
        data: {
          professionalId,
          type:  data.type,
          title: data.title,
          body:  data.body,
          link:  data.link ?? null,
        },
      })
    } catch (err) {
      console.error('[notifications] no se pudo crear la notificación:', err)
    }
  },

  getMine: async (professionalId: string) => {
    const rows = await prisma.professionalNotification.findMany({
      where:   { professionalId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapNotification)
  },

  markAllRead: async (professionalId: string) => {
    await prisma.professionalNotification.updateMany({
      where: { professionalId, read: false },
      data:  { read: true },
    })
  },

  markRead: async (professionalId: string, id: string) => {
    const notif = await prisma.professionalNotification.findUnique({ where: { id } })
    if (!notif || notif.professionalId !== professionalId) {
      throw new AppError(HTTP.NOT_FOUND, 'Notificación no encontrada', 'NOT_FOUND')
    }
    await prisma.professionalNotification.update({ where: { id }, data: { read: true } })
  },
}

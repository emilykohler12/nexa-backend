// src/modules/reviews/review.service.ts
import type { Prisma } from '@prisma/client'
import { prisma }   from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP }     from '../../app/constants/http'
import { activityService } from '../activity/activity.service'

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

const REVIEW_INCLUDE = {
  client:      true,
  appointment: { include: { service: true } },
} satisfies Prisma.ReviewInclude

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>

function toReviewView(r: ReviewRow) {
  return {
    id:            r.id,
    clientId:      r.clientId,
    clientName:    r.client.name,
    appointmentId: r.appointmentId,
    serviceName:   r.appointment.service.name,
    rating:        r.rating,
    message:       r.message,
    status:        r.status as ReviewStatus,
    createdAt:     r.createdAt.toISOString(),
  }
}

export const reviewService = {

  // ── Cliente ──────────────────────────────────────────────────────

  getPendingForClient: async (clientId: string) => {
    const rows = await prisma.appointment.findMany({
      where: {
        clientId,
        status:          'finished',
        reviewDismissed: false,
        review:          null,
      },
      include: { service: true },
      orderBy: [{ date: 'desc' }],
    })
    return rows.map(a => ({ appointmentId: a.id, serviceName: a.service.name }))
  },

  createForClient: async (clientId: string, data: { appointmentId: string; rating: number; message: string | null }) => {
    const appointment = await prisma.appointment.findUnique({
      where:   { id: data.appointmentId },
      include: { service: true, client: true },
    })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    if (appointment.status !== 'finished') {
      throw new AppError(HTTP.BAD_REQUEST, 'Solo se puede reseñar un turno ya finalizado', 'VALIDATION_ERROR')
    }

    // El rating siempre cuenta para el promedio público apenas se crea. Sin
    // mensaje no hay nada que un admin tenga que aprobar, así que nace
    // 'approved' directamente; con mensaje, nace 'pending'.
    const message = data.message?.trim() || null
    const status: ReviewStatus = message ? 'pending' : 'approved'

    let review: ReviewRow
    try {
      review = await prisma.review.create({
        data: { clientId, appointmentId: data.appointmentId, rating: data.rating, message, status },
        include: REVIEW_INCLUDE,
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new AppError(HTTP.CONFLICT, 'Ya dejaste una reseña para este turno', 'ALREADY_REVIEWED')
      }
      throw err
    }

    // Una reseña sin comentario no tiene nada para que el admin apruebe o
    // rechace — no genera entrada en Actividad.
    if (message) {
      await activityService.log({
        action:   'Nueva reseña con comentario',
        module:   'reviews',
        detail:   `${appointment.client.name} calificó "${appointment.service.name}" con ${data.rating} estrellas: "${message}"`,
        reviewId: review.id,
      })
    }

    return toReviewView(review)
  },

  dismissForClient: async (clientId: string, appointmentId: string) => {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    if (!appointment || appointment.clientId !== clientId) {
      throw new AppError(HTTP.NOT_FOUND, 'Turno no encontrado', 'NOT_FOUND')
    }
    await prisma.appointment.update({ where: { id: appointmentId }, data: { reviewDismissed: true } })
  },

  getMineForClient: async (clientId: string) => {
    const rows = await prisma.review.findMany({
      where:   { clientId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toReviewView)
  },

  // ── Admin ────────────────────────────────────────────────────────

  getForAdminClient: async (clientId: string) => {
    const user = await prisma.user.findUnique({ where: { id: clientId } })
    if (!user || user.role !== 'client') {
      throw new AppError(HTTP.NOT_FOUND, 'Cliente no encontrado', 'NOT_FOUND')
    }
    const rows = await prisma.review.findMany({
      where:   { clientId },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toReviewView)
  },

  setStatus: async (id: string, status: 'approved' | 'rejected') => {
    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) throw new AppError(HTTP.NOT_FOUND, 'Reseña no encontrada', 'NOT_FOUND')
    const updated = await prisma.review.update({ where: { id }, data: { status }, include: REVIEW_INCLUDE })
    return toReviewView(updated)
  },

  // ── Pública ──────────────────────────────────────────────────────

  // Todos los ratings cuentan, sin importar el status del mensaje — el
  // puntaje nunca necesitó aprobación.
  getPublicSummary: async () => {
    const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: { rating: true } })
    return {
      average: agg._avg.rating ? Number(agg._avg.rating) : 0,
      count:   agg._count.rating,
    }
  },

  getPublicList: async () => {
    const rows = await prisma.review.findMany({
      where:   { status: 'approved', message: { not: null } },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows
      .filter(r => r.message && r.message.trim().length > 0)
      .map(r => ({ id: r.id, clientName: r.client.name, rating: r.rating, message: r.message as string }))
  },
}

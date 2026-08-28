// src/modules/activity/activity.service.ts
import { prisma } from '../../app/database/prisma'

export type ActivityModule =
  | 'appointments' | 'clients' | 'professionals' | 'services'
  | 'store' | 'payments' | 'config' | 'auth' | 'chatbot' | 'system' | 'jobs' | 'reviews'
export type ActivityLevel = 'info' | 'warning' | 'error' | 'success'

export const activityService = {

  log: async (data: {
    userName?: string
    action:    string
    module:    ActivityModule
    level?:    ActivityLevel
    detail?:   string
    // Solo para module: 'reviews' — permite aprobar/rechazar el comentario
    // desde Actividad. No se duplica el status acá: getAll() lo lee en vivo
    // de Review.status al listar, así nunca queda desincronizado.
    reviewId?: string
  }) => {
    try {
      await prisma.activityLog.create({
        data: {
          userName: data.userName ?? 'Sistema',
          action:   data.action,
          module:   data.module,
          level:    data.level ?? 'info',
          detail:   data.detail ?? null,
          reviewId: data.reviewId ?? null,
        },
      })
    } catch (err) {
      console.error('[activity] no se pudo registrar el log:', err)
    }
  },

  getAll: async () => {
    const rows = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' } })

    const reviewIds = [...new Set(rows.map(r => r.reviewId).filter((id): id is string => id !== null))]
    const statusByReviewId = new Map<string, string>()
    if (reviewIds.length > 0) {
      const reviews = await prisma.review.findMany({
        where:  { id: { in: reviewIds } },
        select: { id: true, status: true },
      })
      for (const r of reviews) statusByReviewId.set(r.id, r.status)
    }

    return rows.map(r => ({
      id:        r.id,
      timestamp: r.createdAt.toISOString(),
      user:      r.userName,
      action:    r.action,
      module:    r.module as ActivityModule,
      level:     r.level as ActivityLevel,
      detail:    r.detail ?? undefined,
      reviewId:     r.reviewId ?? undefined,
      reviewStatus: r.reviewId ? (statusByReviewId.get(r.reviewId) as 'pending' | 'approved' | 'rejected' | undefined) : undefined,
    }))
  },
}

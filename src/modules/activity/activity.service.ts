// src/modules/activity/activity.service.ts
import { prisma } from '../../app/database/prisma'
import { fullName } from '../../app/utils/fullName'

// Nombre que deja la anonimización de una clienta (adminService.anonymizeClient).
export const ANONYMIZED_NAME = 'Cliente eliminado'

export type ActivityModule =
  | 'appointments' | 'clients' | 'professionals' | 'services'
  | 'store' | 'payments' | 'config' | 'auth' | 'chatbot' | 'system' | 'jobs' | 'reviews'
export type ActivityLevel = 'info' | 'warning' | 'error' | 'success'

// Nombre de la clienta en el registro: en vez del texto guardado se escribe una marca con su id, y al listar se reemplaza por el
// nombre de ese momento. Así, si la clienta se anonimiza, el registro pasa solo a decir «Cliente eliminado» (ver getAll).
const CLIENT_TOKEN_RE = /\{\{c:([0-9a-f-]{36})\}\}/g
const clientToken = (id: string) => `{{c:${id}}}`

// Reemplaza, en `text`, el nombre completo de la clienta por su marca. Si no se puede resolver (turno borrado, error de
// lectura), el texto queda como vino: registrar la actividad nunca debe fallar por esto.
async function tokenizeClientName(clientId: string | undefined, appointmentId: string | undefined, texts: string[]): Promise<string[]> {
  try {
    let id = clientId
    if (!id && appointmentId) {
      id = (await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { clientId: true } }))?.clientId
    }
    if (!id) return texts
    const user = await prisma.user.findUnique({ where: { id }, select: { name: true, lastName: true } })
    if (!user) return texts
    const name = fullName(user)
    if (!name || name === ANONYMIZED_NAME) return texts
    return texts.map(t => t.split(name).join(clientToken(id!)))
  } catch {
    return texts
  }
}

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
    // Turno al que se refiere la entrada (columna appointment_id, sin FK). Lo traen todas las entradas
    // que tocan un turno, para poder reconstruir su historial.
    appointmentId?: string
    // Clienta a la que se refiere la entrada cuando no hay turno (pedido, reseña…). Con el turno alcanza: de ahí se saca.
    clientId?: string
  }) => {
    try {
      const [userName, detail] = await tokenizeClientName(
        data.clientId, data.appointmentId, [data.userName ?? 'Sistema', data.detail ?? ''],
      )
      await prisma.activityLog.create({
        data: {
          userName,
          action:   data.action,
          module:   data.module,
          level:    data.level ?? 'info',
          detail:   data.detail === undefined ? null : detail,
          reviewId: data.reviewId ?? null,
          appointmentId: data.appointmentId ?? null,
        },
      })
    } catch (err) {
      console.error('[activity] no se pudo registrar el log:', err)
    }
  },

  getAll: async () => {
    const rawRows = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' } })

    // Se reemplazan las marcas de clienta por su nombre actual (una anonimizada figura como «Cliente eliminado»).
    const clientIds = new Set<string>()
    for (const r of rawRows) {
      for (const text of [r.userName, r.detail ?? '']) {
        for (const m of text.matchAll(CLIENT_TOKEN_RE)) clientIds.add(m[1])
      }
    }
    const nameById = new Map<string, string>()
    if (clientIds.size > 0) {
      const users = await prisma.user.findMany({ where: { id: { in: [...clientIds] } }, select: { id: true, name: true, lastName: true } })
      for (const u of users) nameById.set(u.id, fullName(u))
    }
    const resolve = (text: string) => text.replace(CLIENT_TOKEN_RE, (_m, id: string) => nameById.get(id) ?? ANONYMIZED_NAME)
    const rows = rawRows.map(r => ({ ...r, userName: resolve(r.userName), detail: r.detail === null ? null : resolve(r.detail) }))

    const reviewIds = [...new Set(rows.map(r => r.reviewId).filter((id): id is string => id !== null))]
    const statusByReviewId = new Map<string, string>()
    if (reviewIds.length > 0) {
      const reviews = await prisma.review.findMany({
        where:  { id: { in: reviewIds } },
        select: { id: true, status: true },
      })
      for (const r of reviews) statusByReviewId.set(r.id, r.status)
    }

    // Entradas «…seña por coordinar por WhatsApp»: se lee en vivo si el turno sigue esperando la seña, igual que el
    // estado de las reseñas, para que el botón desaparezca apenas se marca paga (o se cancela el turno).
    const whatsappIds = [...new Set(rows
      .filter(r => r.appointmentId && r.action.includes('seña por coordinar por WhatsApp'))
      .map(r => r.appointmentId as string))]
    const pendingDeposit = new Set<string>()
    if (whatsappIds.length > 0) {
      const appts = await prisma.appointment.findMany({
        where:  { id: { in: whatsappIds }, depositMethod: 'whatsapp', paymentStatus: 'pending', status: { in: ['pending', 'confirmed'] } },
        select: { id: true },
      })
      for (const a of appts) pendingDeposit.add(a.id)
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
      appointmentId: r.appointmentId ?? undefined,
      pendingWhatsappDeposit: r.appointmentId && r.action.includes('seña por coordinar por WhatsApp') ? pendingDeposit.has(r.appointmentId) : undefined,
      reviewStatus: r.reviewId ? (statusByReviewId.get(r.reviewId) as 'pending' | 'approved' | 'rejected' | undefined) : undefined,
    }))
  },
}

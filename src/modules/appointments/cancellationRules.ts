// src/modules/appointments/cancellationRules.ts
//
// Reglas de cancelación y devolución de la seña (AE4, fase 3; confirmadas por escrito por la propietaria el
// 30/10/2026). El sistema solo MARCA la seña como devuelta (paymentStatus 'refunded'): no ejecuta ninguna
// devolución en Mercado Pago.
//
//  - Cancela la clienta desde la app (turno pending o confirmed, también ya empezado): se cuentan las horas entre
//    ahora y el inicio del turno. Con `cancellationHours` o más (12 por defecto) y la seña paga (partial o paid),
//    paymentStatus pasa a 'refunded'; con menos, la seña queda retenida. Si no estaba paga, no se marca nada.
//  - Cancela el estudio: la seña paga se marca 'refunded' sin mirar la hora (no depende de la política).
//  - Cancela el personal por aviso de la clienta ('client'): las horas de aviso son inicio del turno menos la hora
//    en que avisó la clienta (por defecto, ahora). Mismo corte que arriba. La hora de aviso no puede ser futura; si
//    es posterior al inicio del turno se acepta y no se devuelve. La profesional puede cargar un aviso de hasta 48
//    horas atrás; uno más antiguo solo el administrador.
//  - refundPolicy 'none': la seña de una cancelación de la clienta siempre queda retenida.
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'
import { argentinaParts } from '../../app/utils/argentinaTime'

export const CANCELLED_BY = ['client', 'studio'] as const
export type CancelledBy = typeof CANCELLED_BY[number]

export const NOTICE_CHANNELS = ['whatsapp', 'call', 'in_person', 'other'] as const
export type NoticeChannel = typeof NOTICE_CHANNELS[number]

export const NOTICE_NOTE_MAX_LENGTH = 200
export const PROFESSIONAL_NOTICE_MAX_HOURS = 48

const HOUR_MS = 60 * 60 * 1000

export type RefundSettings = { cancellationHours: number; refundPolicy: string }

export type StaffActor = { id: string | null; name: string; role: 'professional' | 'admin' }

export type CancellationNotice = {
  at:           Date
  channel:      NoticeChannel | null
  note:         string | null
  loadedById:   string | null
  loadedByName: string
  loadedAt:     Date
}

// La seña está paga cuando Mercado Pago (o el administrador, si se coordinó por WhatsApp) la confirmó:
// 'partial' (seña paga) o 'paid' (todo cobrado).
export function isDepositPaid(a: { paymentStatus: string }): boolean {
  return a.paymentStatus === 'partial' || a.paymentStatus === 'paid'
}

// Horas entre el aviso (o la cancelación) y el inicio del turno. Negativa si el aviso es posterior al inicio.
export function noticeHoursBetween(start: Date, noticeAt: Date): number {
  return (start.getTime() - noticeAt.getTime()) / HOUR_MS
}

// ¿Se marca la seña como devuelta? Una sola regla para la clienta, el personal y los combos.
export function decideRefund(p: {
  settings:     RefundSettings
  cancelledBy:  CancelledBy
  paid:         boolean
  noticeHours?: number
}): boolean {
  if (!p.paid) return false
  if (p.cancelledBy === 'studio') return true
  if (p.settings.refundPolicy === 'none') return false
  return (p.noticeHours ?? -Infinity) >= p.settings.cancellationHours
}

// Hora de aviso que carga el personal: por defecto ahora; no puede ser futura; la profesional puede cargar hasta
// 48 horas atrás (inclusive) y el administrador cualquier hora pasada.
export function resolveNoticeTime(p: { role: StaffActor['role']; clientNoticeAt?: string; now: Date }): Date {
  const at = p.clientNoticeAt ? new Date(p.clientNoticeAt) : p.now
  if (Number.isNaN(at.getTime())) {
    throw new AppError(HTTP.BAD_REQUEST, 'La hora de aviso es inválida', 'VALIDATION_ERROR')
  }
  if (at.getTime() > p.now.getTime()) {
    throw new AppError(HTTP.BAD_REQUEST, 'La hora de aviso de la clienta no puede ser futura', 'INVALID_NOTICE_TIME')
  }
  if (p.role === 'professional' && p.now.getTime() - at.getTime() > PROFESSIONAL_NOTICE_MAX_HOURS * HOUR_MS) {
    throw new AppError(
      HTTP.FORBIDDEN,
      `Un aviso de hace más de ${PROFESSIONAL_NOTICE_MAX_HOURS} horas solo lo puede cargar el administrador`,
      'NOTICE_TOO_OLD',
    )
  }
  return at
}

// Quién cancela y, si fue la clienta avisando al personal, el aviso completo. `cancelledBy` es obligatorio.
export function buildStaffCancellation(
  data: { cancelledBy?: CancelledBy; clientNoticeAt?: string; noticeChannel?: NoticeChannel; noticeNote?: string },
  actor: StaffActor,
  now: Date,
): { cancelledBy: CancelledBy; notice?: CancellationNotice } {
  if (!data.cancelledBy) {
    throw new AppError(HTTP.BAD_REQUEST, 'Indicá quién cancela el turno (cancelledBy: "client" o "studio")', 'VALIDATION_ERROR')
  }
  if (data.cancelledBy === 'studio') return { cancelledBy: 'studio' }
  return {
    cancelledBy: 'client',
    notice: {
      at:           resolveNoticeTime({ role: actor.role, clientNoticeAt: data.clientNoticeAt, now }),
      channel:      data.noticeChannel ?? null,
      note:         data.noticeNote?.trim() || null,
      loadedById:   actor.id,
      loadedByName: actor.name,
      loadedAt:     now,
    },
  }
}

// Fecha y hora de Argentina para el registro de actividad ("2026-11-03 13:00").
export function formatArgentina(at: Date): string {
  const { date, time } = argentinaParts(at)
  return `${date} ${time}`
}

const CHANNEL_LABELS: Record<NoticeChannel, string> = {
  whatsapp: 'WhatsApp', call: 'llamada', in_person: 'en persona', other: 'otro medio',
}

// Texto para el registro de actividad: quién canceló, qué pasó con la seña y, si hubo aviso, todo el aviso.
export function describeCancellation(p: {
  cancelledBy: CancelledBy | 'system'
  hadPaidDeposit: boolean
  refunded: boolean
  notice?: CancellationNotice
  noticeHours?: number
}): string {
  const who = p.cancelledBy === 'client' ? 'la clienta' : p.cancelledBy === 'studio' ? 'el estudio' : 'el sistema'
  const deposit = !p.hadPaidDeposit
    ? 'sin seña paga'
    : p.refunded ? 'seña marcada como devuelta' : 'seña retenida'
  let text = ` — cancela ${who}; ${deposit}`
  if (p.noticeHours !== undefined) text += `; ${p.noticeHours.toFixed(1)} h de aviso`
  if (p.notice) {
    text += `; aviso de la clienta: ${formatArgentina(p.notice.at)}`
    if (p.notice.channel) text += ` por ${CHANNEL_LABELS[p.notice.channel]}`
    if (p.notice.note)    text += `, nota: "${p.notice.note}"`
    text += `; cargado por ${p.notice.loadedByName} el ${formatArgentina(p.notice.loadedAt)}`
  }
  return text
}

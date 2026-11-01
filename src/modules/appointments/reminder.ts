// src/modules/appointments/reminder.ts
//
// Fase 3b de la AE4: recordatorio de turno por mail. Decisión de la autora del sistema (Emily), a partir de la
// regla que le confirmó la propietaria. Acá vive la regla (cuándo corresponde mandarlo) y el armado del mail; el
// job appointmentReminder.job.ts busca los turnos, marca el envío y manda.
//
//  - Un mail por turno (o por grupo de combo) cuando faltan 5 horas o menos para la hora de inicio.
//  - Solo turnos 'confirmed' con la seña paga o sin seña requerida.
//  - No se manda si la reserva se hizo con menos de 5 horas de anticipación, si el correo de la clienta no está
//    verificado, si la cuenta está desactivada o anonimizada, o si la clienta está bloqueada.
//  - Si el envío falla se reintenta en cada corrida, pero solo hasta 1 hora antes del turno.
//
// Los botones del mail son enlaces a la web (FRONTEND_URL/mis-turnos?turno=<id>&accion=ver|reprogramar|cancelar):
// no ejecutan nada, la web exige iniciar sesión y confirmar. En el enlace solo va el id del turno.
//
// Toda hora se evalúa como instante real (hora de Argentina, ver argentinaTime.ts).
import { env } from '../../app/config/env'
import { fullName } from '../../app/utils/fullName'
import { loadTemplate, formatDate } from './appointment.service'
import { isDepositPaid, type RefundSettings } from './cancellationRules'
import { startInstant } from './reopenedSlots'

const HOUR_MS = 60 * 60 * 1000

export const REMINDER_HOURS_BEFORE        = 5
export const REMINDER_RETRY_UNTIL_HOURS   = 1
export const REMINDER_MIN_BOOKING_HOURS   = 5

export const REMINDER_ACTIONS = ['ver', 'reprogramar', 'cancelar'] as const
export type ReminderAction = typeof REMINDER_ACTIONS[number]

export type ReminderCandidate = {
  id:            string
  status:        string
  date:          string
  time:          string
  duration:      number
  servicePrice:  { toString(): string } | number
  depositAmount: { toString(): string } | number
  paymentStatus: string
  createdAt:     Date
  reminderSentAt: Date | null
  comboGroupId:  string | null
  client: {
    name: string; lastName?: string | null; email: string; emailVerified: boolean; active: boolean
    client?: { blocked: boolean } | null
  }
  professional: { name: string }
  service:      { name: string }
}

// ¿Corresponde mandar el recordatorio de este turno en este instante?
export function isReminderDue(a: ReminderCandidate, now: Date): boolean {
  if (a.status !== 'confirmed' || a.reminderSentAt) return false

  const start = startInstant(a).getTime()
  const hoursLeft = (start - now.getTime()) / HOUR_MS
  if (hoursLeft > REMINDER_HOURS_BEFORE) return false
  if (hoursLeft < REMINDER_RETRY_UNTIL_HOURS) return false

  // Reserva hecha con menos de 5 horas de anticipación: la clienta ya sabe que el turno es en el día.
  if ((start - a.createdAt.getTime()) / HOUR_MS < REMINDER_MIN_BOOKING_HOURS) return false

  // Seña paga, o turno sin seña requerida.
  if (Number(a.depositAmount) > 0 && !isDepositPaid(a)) return false

  const c = a.client
  if (!c.emailVerified || !c.active || c.client?.blocked) return false
  return true
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function money(value: number): string {
  return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

function hoursLabel(hours: number): string {
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
}

export function reminderLink(appointmentId: string, action: ReminderAction): string {
  return `${env.FRONTEND_URL}/mis-turnos?turno=${encodeURIComponent(appointmentId)}&accion=${action}`
}

// Aviso sobre la seña. Es el texto de la regla cuando el turno está dentro de la ventana de cancelación sin
// devolución; si la configuración tiene una ventana más corta que el tiempo que falta, o la política es
// "no devolver", dice lo que realmente pasaría para no prometer algo falso.
export function depositNotice(hoursLeft: number, settings: RefundSettings): string {
  if (settings.refundPolicy === 'none') return 'Si cancelás, la seña no se devuelve.'
  const limit = hoursLabel(settings.cancellationHours)
  if (hoursLeft < settings.cancellationHours) {
    return `Si cancelás ahora (con menos de ${limit}), la seña no se devuelve.`
  }
  return `Si cancelás con menos de ${limit} de anticipación, la seña no se devuelve.`
}

// Armado del mail de UN turno o de UN grupo de combo (todas las patas con la misma fecha y hora).
export function buildReminderEmail(legs: ReminderCandidate[], opts: {
  now: Date; settings: RefundSettings; address?: string | null
}): { subject: string; html: string } {
  const lead = legs[0]
  const hoursLeft = (startInstant(lead).getTime() - opts.now.getTime()) / HOUR_MS

  const total = legs.reduce((sum, l) => sum + Number(l.servicePrice), 0)
  // Lo ya pagado: la seña ('partial') o todo el precio ('paid').
  const paid = legs.reduce((sum, l) => {
    if (l.paymentStatus === 'paid') return sum + Number(l.servicePrice)
    return sum + (isDepositPaid(l) ? Number(l.depositAmount) : 0)
  }, 0)
  const depositPaid = legs.reduce((sum, l) => sum + (isDepositPaid(l) ? Number(l.depositAmount) : 0), 0)
  const balance = Math.max(total - paid, 0)

  const services = legs.map(l => `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;border:1px solid #eee;border-radius:12px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0 0 4px;color:#1a1a1a;font-size:15px;font-weight:700;">${escapeHtml(l.service.name)}</p>
                  <p style="margin:0;color:#777;font-size:13px;line-height:1.6;">
                    con ${escapeHtml(l.professional.name)} · ${l.duration} min · ${money(Number(l.servicePrice))}
                  </p>
                </td>
              </tr>
            </table>`).join('')

  const priceRow = (label: string, value: string, strong = false) => `
              <tr>
                <td style="padding:4px 0;color:#888;font-size:13px;">${label}</td>
                <td align="right" style="padding:4px 0;color:#1a1a1a;font-size:${strong ? 16 : 14}px;${strong ? 'font-weight:700;' : ''}">${value}</td>
              </tr>`
  const priceRows = [
    priceRow('Precio total', money(total)),
    depositPaid > 0 ? priceRow('Seña ya paga', money(depositPaid)) : '',
    priceRow('Saldo a pagar en el local', money(balance), true),
  ].join('')

  const notice = depositPaid > 0
    ? `<p style="margin:0 0 24px;padding:14px 18px;background:#fff8e6;border:1px solid #f3dfa2;border-radius:12px;color:#7a5b00;font-size:14px;line-height:1.5;">${escapeHtml(depositNotice(hoursLeft, opts.settings))}</p>`
    : ''

  const address = opts.address?.trim()
  const addressRow = address
    ? `<tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Dirección</td>
                      <td style="padding:6px 0;color:#1a1a1a;font-size:15px;">${escapeHtml(address)}</td>
                    </tr>`
    : ''

  const html = loadTemplate('appointmentReminder', {
    CLIENT_NAME:     escapeHtml(fullName(lead.client)),
    DATE:            formatDate(lead.date),
    TIME:            lead.time,
    ADDRESS_ROW:     addressRow,
    SERVICES:        services,
    PRICE_ROWS:      priceRows,
    NOTICE:          notice,
    LINK_VIEW:       escapeHtml(reminderLink(lead.id, 'ver')),
    LINK_RESCHEDULE: escapeHtml(reminderLink(lead.id, 'reprogramar')),
    LINK_CANCEL:     escapeHtml(reminderLink(lead.id, 'cancelar')),
  })

  return { subject: 'Recordatorio de tu turno — Nexa', html }
}

// src/modules/payments/paymentRecord.ts
//
// Registro de TODOS los pagos de Mercado Pago (tabla payment_records) y qué hacer con cada resultado:
//
//  - Pago correcto (la seña exacta): se registra y sigue el flujo normal.
//  - Pagó de más: se acepta y la seña y el saldo se siguen calculando igual; se guarda lo realmente cobrado para avisarle al
//    administrador, que en el local le cobra de menos por la diferencia.
//  - Pagó de menos o en otra moneda: NO se reserva nada. La clienta pagó, así que el administrador tiene que devolverle la
//    plata: queda en el tablero («Pagos para devolver») y le llega un mail.
//  - Pago que llega tarde (el turno ya se liberó): igual, hay que devolverlo.
//  - Pago rechazado (tarjeta, fondos…): no hay plata que devolver; queda el motivo y un aviso en Actividad.
//
// Cada resultado deja una entrada en Actividad; el mail al administrador sale SOLO cuando hay plata para devolver. Mercado
// Pago reintenta los avisos: la fila se identifica por el id del pago, así que repetir el mismo aviso no duplica ni vuelve
// a avisar.
import { prisma } from '../../app/database/prisma'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'
import { fullName } from '../../app/utils/fullName'
import { formatDateDMY } from '../../app/utils/dateFormat'
import { activityService } from '../activity/activity.service'
import { mailProvider } from '../auth/providers/mail.provider'
import { resolveStudioEmail } from '../contact/contact.service'
import { PAYMENT_CURRENCY, type PaidInfo } from './paidAmount'
import { rejectionNote } from './paymentReasons'

export type PaymentKind    = 'appointment' | 'combo' | 'order'
export type PaymentOutcome = 'accepted' | 'overpaid' | 'pending' | 'rejected' | 'underpaid' | 'wrong_currency' | 'late'

const money = (n: number | null | undefined) => `$${Number(n ?? 0).toLocaleString('es-AR')}`

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export interface PaymentContext {
  kind:        PaymentKind
  // Id del turno, del grupo de combo o del pedido.
  refId:       string
  mpPaymentId: string
  status:      string
  expected:    number
  paid?:       PaidInfo
  // Texto para el administrador: «Manos — Ana Pérez con Loren el 25/11/2026 14:00».
  describe:    string
  // Para enlazar la entrada de Actividad con el turno (o con la clienta, en un pedido).
  appointmentId?: string
  clientId?:      string
}

export type PaymentVerdict =
  // El pago se puede aplicar. `paidOver` = total cobrado cuando superó lo esperado (null si fue exacto o no se verificó).
  // `note` = motivo corto cuando el pago fue rechazado.
  | { accept: true;  paidOver: number | null; note: string | null }
  // El pago NO se aplica (pagó de menos o en otra moneda); `note` es la frase corta para la clienta.
  | { accept: false; note: string }

interface RecordData {
  ctx:         PaymentContext
  outcome:     PaymentOutcome
  reason:      string
  needsRefund: boolean
}

// Crea o actualiza la fila del pago. Devuelve true si es nueva o si cambió su resultado (para avisar una sola vez).
async function upsertRecord({ ctx, outcome, reason, needsRefund }: RecordData): Promise<boolean> {
  const paidAmount = typeof ctx.paid?.amount === 'number' && Number.isFinite(ctx.paid.amount) ? ctx.paid.amount : null
  const data = {
    kind:           ctx.kind,
    refId:          ctx.refId,
    mpStatus:       ctx.status.slice(0, 30),
    statusDetail:   ctx.paid?.statusDetail?.slice(0, 80) ?? null,
    outcome,
    reason:         reason.slice(0, 160),
    expectedAmount: ctx.expected,
    paidAmount,
    currency:       ctx.paid?.currency?.slice(0, 10) ?? null,
    needsRefund,
  }
  const existing = await prisma.paymentRecord.findUnique({ where: { mpPaymentId: ctx.mpPaymentId } })
  if (!existing) {
    try {
      await prisma.paymentRecord.create({ data: { mpPaymentId: ctx.mpPaymentId, ...data } })
      return true
    } catch (err: any) {
      if (err?.code === 'P2002') return false // otro aviso del mismo pago la creó justo antes
      throw err
    }
  }
  if (existing.outcome === outcome && existing.mpStatus === data.mpStatus) return false
  // Una devolución ya hecha no se vuelve a abrir.
  await prisma.paymentRecord.update({ where: { id: existing.id }, data })
  return existing.outcome !== outcome
}

// Mail al administrador: solo cuando la clienta pagó y no se reservó nada (hay plata para devolver). Un fallo del mail no
// puede romper el webhook: la fila y la entrada de Actividad ya quedaron.
async function mailAdminToRefund(ctx: PaymentContext, reason: string): Promise<void> {
  try {
    const to = await resolveStudioEmail()
    const amount = typeof ctx.paid?.amount === 'number' ? `${money(ctx.paid.amount)} ${ctx.paid.currency ?? ''}`.trim() : 'un monto no informado'
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;color:#1a1a1a;">Hay un pago para devolver</h2>
        <p style="color:#444;font-size:15px;line-height:1.5;">Una clienta pagó por Mercado Pago pero <strong>no se reservó el turno</strong>, así que hay que devolverle el dinero.</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:6px 12px 6px 0;color:#666;">Detalle</td><td style="padding:6px 0;color:#1a1a1a;">${escapeHtml(ctx.describe)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;">Motivo</td><td style="padding:6px 0;color:#1a1a1a;">${escapeHtml(reason)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;">Pagó</td><td style="padding:6px 0;color:#1a1a1a;">${escapeHtml(amount)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;">Pago en Mercado Pago</td><td style="padding:6px 0;color:#1a1a1a;">${escapeHtml(ctx.mpPaymentId)}</td></tr>
        </table>
        <p style="color:#666;font-size:14px;line-height:1.5;">Devolvelo desde Mercado Pago y después marcalo como devuelto en el tablero de Nexa («Pagos para devolver»).</p>
      </div>`
    await mailProvider.send(to, 'Hay un pago para devolver — Nexa', html)
  } catch (err: any) {
    console.error('[mail] ❌ No se pudo avisar al administrador de un pago para devolver:', err?.message)
  }
}

// Evalúa un pago de Mercado Pago ya verificado contra su API, lo registra y avisa lo que corresponda. Un pago sin `paid`
// (seña confirmada a mano por WhatsApp) no pasa por Mercado Pago: no se registra y se acepta.
export async function evaluatePayment(ctx: PaymentContext): Promise<PaymentVerdict> {
  const { paid, status, expected } = ctx
  if (!paid) return { accept: true, paidOver: null, note: null }

  const logBase = { module: 'payments' as const, appointmentId: ctx.appointmentId, clientId: ctx.clientId }
  const target  = ctx.kind === 'order' ? 'al total del pedido' : 'a la seña'

  if (status === 'approved') {
    const amount      = typeof paid.amount === 'number' && Number.isFinite(paid.amount) ? paid.amount : null
    const wrongCurr   = paid.currency !== PAYMENT_CURRENCY
    const underpaid   = amount === null || amount + 0.005 < expected

    if (wrongCurr || underpaid) {
      const outcome: PaymentOutcome = wrongCurr ? 'wrong_currency' : 'underpaid'
      const reason = wrongCurr
        ? 'Pago en otra moneda (no en pesos argentinos)'
        : amount === null ? 'Mercado Pago no informó el monto' : `Monto menor ${target}`
      const note = wrongCurr ? 'Pago rechazado: moneda distinta a pesos' : amount === null ? 'Pago rechazado: no se pudo verificar el monto' : `Pago rechazado: monto menor ${target}`
      if (await upsertRecord({ ctx, outcome, reason, needsRefund: true })) {
        await activityService.log({
          ...logBase,
          action: 'Pago con monto distinto al esperado',
          level:  'error',
          detail: `${ctx.describe}: ${reason}. Mercado Pago informó ${amount === null ? 'sin monto' : money(amount)} ${paid.currency ?? 'sin moneda'} `
                + `y se esperaba ${money(expected)} ${PAYMENT_CURRENCY} (pago ${ctx.mpPaymentId}). No se reservó nada: devolvé el dinero en Mercado Pago `
                + 'y marcalo como devuelto en el tablero.',
        })
        await mailAdminToRefund(ctx, reason)
      }
      return { accept: false, note }
    }

    const over = amount! - expected > 0.005
    const changed = await upsertRecord({
      ctx, outcome: over ? 'overpaid' : 'accepted', needsRefund: false,
      reason: over ? `Pagó ${money(amount)}; ${target} es de ${money(expected)}` : 'Pago correcto',
    })
    if (over && changed) {
      await activityService.log({
        ...logBase,
        action: 'Seña pagada de más',
        level:  'warning',
        detail: `${ctx.describe}: el pago fue de ${money(amount)} y la seña es de ${money(expected)} (pago ${ctx.mpPaymentId}). `
              + `En el local cobrale ${money(amount! - expected)} menos. El turno sigue mostrando la seña de ${money(expected)}.`,
      })
    }
    return { accept: true, paidOver: over ? amount : null, note: null }
  }

  if (status === 'rejected' || status === 'cancelled') {
    const note = rejectionNote(status, paid.statusDetail)
    if (await upsertRecord({ ctx, outcome: 'rejected', reason: note, needsRefund: false })) {
      await activityService.log({
        ...logBase,
        action: 'Pago rechazado',
        level:  'warning',
        detail: `${ctx.describe}: ${note.toLowerCase()} (pago ${ctx.mpPaymentId}). No hay dinero para devolver.`,
      })
    }
    return { accept: true, paidOver: null, note }
  }

  // pendiente / en proceso / otros estados: solo se deja el registro.
  await upsertRecord({ ctx, outcome: 'pending', reason: `Mercado Pago informó «${status}»`, needsRefund: false })
  return { accept: true, paidOver: null, note: null }
}

// Pago aprobado que llega cuando el turno (o el combo) ya se canceló o liberó: la clienta pagó pero no tiene turno.
export async function recordLatePayment(ctx: PaymentContext): Promise<void> {
  if (ctx.status !== 'approved' || !ctx.paid) return
  const reason = 'Llegó después de que se liberó el turno'
  if (await upsertRecord({ ctx, outcome: 'late', reason, needsRefund: true })) {
    await activityService.log({
      module: 'payments', appointmentId: ctx.appointmentId, clientId: ctx.clientId,
      action: 'Pago recibido después de liberarse el turno',
      level:  'error',
      detail: `${ctx.describe}: ${reason}. Mercado Pago informó ${money(ctx.paid.amount)} ${ctx.paid.currency ?? ''} (pago ${ctx.mpPaymentId}). `
            + 'El turno no se reactivó: devolvé el dinero en Mercado Pago y marcalo como devuelto en el tablero.',
    })
    await mailAdminToRefund(ctx, reason)
  }
}

// ── Tablero del administrador ──────────────────────────────────────────────────────────────────

interface RefContext {
  clientId:   string
  clientName: string
  label:      string
  date:       string | null
  time:       string | null
  appointmentId: string | null
}

// De quién y de qué es un pago (se lee al mostrar: si la clienta se anonimizó, el nombre ya sale «Cliente eliminado»).
async function loadRefContext(kind: string, refId: string): Promise<RefContext | null> {
  if (kind === 'order') {
    const order = await prisma.order.findUnique({ where: { id: refId }, include: { client: true } })
    if (!order) return null
    return { clientId: order.clientId, clientName: fullName(order.client), label: 'Pedido de la tienda', date: null, time: null, appointmentId: null }
  }
  const appt = await prisma.appointment.findFirst({
    where:   kind === 'combo' ? { comboGroupId: refId } : { id: refId },
    orderBy: { createdAt: 'asc' },
    include: { client: true, service: true },
  })
  if (!appt) return null
  return {
    clientId: appt.clientId, clientName: fullName(appt.client),
    label: kind === 'combo' ? `${appt.service.name} (combo)` : appt.service.name,
    date: appt.date, time: appt.time, appointmentId: appt.id,
  }
}

// «Pagos para devolver»: la clienta pagó y no se reservó nada (monto menor, otra moneda o pago tarde).
export async function listPaymentsToRefund() {
  const rows = await prisma.paymentRecord.findMany({
    where:   { needsRefund: true, refundedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  return Promise.all(rows.map(async r => {
    const ref = await loadRefContext(r.kind, r.refId)
    return {
      id:            r.id,
      kind:          r.kind as PaymentKind,
      outcome:       r.outcome as PaymentOutcome,
      reason:        r.reason,
      paidAmount:    r.paidAmount === null ? null : Number(r.paidAmount),
      expectedAmount: r.expectedAmount === null ? null : Number(r.expectedAmount),
      currency:      r.currency,
      mpPaymentId:   r.mpPaymentId,
      receivedAt:    r.createdAt.toISOString(),
      clientName:    ref?.clientName ?? null,
      label:         ref?.label ?? null,
      date:          ref?.date ?? null,
      time:          ref?.time ?? null,
      appointmentId: ref?.appointmentId ?? null,
    }
  }))
}

// El administrador avisa que ya devolvió el dinero en Mercado Pago. Idempotente: si ya estaba marcado no cambia la fecha.
export async function markPaymentRefunded(id: string, actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true, lastName: true } })
  const actorName = actor ? fullName(actor) : 'Administrador'
  const record = await prisma.paymentRecord.findUnique({ where: { id } })
  if (!record) throw new AppError(HTTP.NOT_FOUND, 'Pago no encontrado', 'NOT_FOUND')
  if (!record.needsRefund) throw new AppError(HTTP.BAD_REQUEST, 'Este pago no está pendiente de devolver', 'NO_REFUND_PENDING')
  if (record.refundedAt) return { id, refundedAt: record.refundedAt.toISOString() }

  const claimed = await prisma.paymentRecord.updateMany({ where: { id, refundedAt: null }, data: { refundedAt: new Date() } })
  if (claimed.count > 0) {
    const ref = await loadRefContext(record.kind, record.refId)
    await activityService.log({
      userName: actorName, module: 'payments', action: 'Pago devuelto en Mercado Pago',
      appointmentId: ref?.appointmentId ?? undefined, clientId: ref?.clientId,
      detail: `${ref ? `${ref.label} — ${ref.clientName}${ref.date ? ` el ${formatDateDMY(ref.date)} ${ref.time}` : ''}: ` : ''}`
            + `${money(record.paidAmount === null ? null : Number(record.paidAmount))} devueltos (${record.reason}; pago ${record.mpPaymentId})`,
    })
  }
  const fresh = await prisma.paymentRecord.findUniqueOrThrow({ where: { id } })
  return { id, refundedAt: fresh.refundedAt!.toISOString() }
}

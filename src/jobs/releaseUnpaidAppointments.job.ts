// src/jobs/releaseUnpaidAppointments.job.ts
//
// Corre cada pocos minutos (ver scheduler.ts). Libera los turnos que un cliente
// dejó a medias: reservó, se le abrió el checkout de Mercado Pago y nunca pagó
// la seña. Esos turnos quedan status 'confirmed' + paymentStatus 'pending' y
// siguen ocupando el horario (el índice único parcial solo excluye 'cancelled'
// y 'no_show'), así que hay que cancelarlos pasado el tiempo de reserva.
//
// Libera cuando:
//  - nunca se intentó pagar (paymentStatus 'pending' y sin mpPaymentId), o
//  - el pago fue rechazado / cancelado (paymentStatus 'rejected' | 'cancelled').
//
// Qué NO toca:
//  - Turnos manuales / walk-in del admin o profesional: se crean con
//    depositAmount 0 (no pasan por el flujo de pago), por eso el filtro exige
//    depositAmount > 0.
//  - Pagos en efectivo (Rapipago/Pago Fácil) que Mercado Pago informa como
//    'pending': esos ya tienen mpPaymentId, así que no entran en la rama
//    'pending' del filtro (que exige mpPaymentId null).
//  - Señas ya pagas ('partial') o reembolsadas ('refunded').
//  - Combos: la seña vive en la primera pata; si esa pata queda impaga, se
//    cancela TODO el grupo (no se puede dejar medio combo en pie).
import { prisma }          from '../app/database/prisma'
import { activityService } from '../modules/activity/activity.service'

// 15 min es la ventana que ve el cliente en PaymentStep (HOLD_MINUTES). Le
// sumamos unos minutos de gracia para no cancelar un turno justo mientras el
// webhook de Mercado Pago está en camino.
const EXPIRE_AFTER_MINUTES = 20

export async function runReleaseUnpaidAppointmentsJob(): Promise<{ released: number }> {
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000)

  const staleFilter = {
    status:        'confirmed' as const,
    depositAmount: { gt: 0 },
    createdAt:     { lt: cutoff },
    OR: [
      { paymentStatus: 'pending', mpPaymentId: null },
      { paymentStatus: { in: ['rejected', 'cancelled'] } },
    ],
  }

  // Turnos sueltos.
  const single = await prisma.appointment.updateMany({
    where: { ...staleFilter, comboGroupId: null },
    data:  { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'unpaid_expired' },
  })

  // Combos: la pata que lleva la seña (depositAmount > 0) quedó impaga → se
  // cancela el grupo entero.
  const staleGroups = await prisma.appointment.findMany({
    where:  { ...staleFilter, comboGroupId: { not: null } },
    select: { comboGroupId: true },
    distinct: ['comboGroupId'],
  })
  const groupIds = staleGroups.map(g => g.comboGroupId!).filter(Boolean)
  let comboLegs = 0
  if (groupIds.length > 0) {
    const res = await prisma.appointment.updateMany({
      where: { comboGroupId: { in: groupIds }, status: { not: 'cancelled' } },
      data:  { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'unpaid_expired' },
    })
    comboLegs = res.count
  }

  const released = single.count + comboLegs
  if (released > 0) {
    await activityService.log({
      action: `Turnos liberados por falta de pago: ${released}`,
      module: 'system',
      detail: `Se cancelaron ${released} turno${released !== 1 ? 's' : ''} sin seña paga tras ${EXPIRE_AFTER_MINUTES} minutos.`,
    })
  }

  return { released }
}

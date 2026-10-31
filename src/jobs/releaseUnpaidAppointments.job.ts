// src/jobs/releaseUnpaidAppointments.job.ts
//
// Corre cada pocos minutos (ver scheduler.ts). Libera los turnos que un cliente
// dejó a medias: reservó, se le abrió el checkout de Mercado Pago y nunca pagó
// la seña. Esos turnos quedan status 'confirmed' + paymentStatus 'pending' y
// siguen ocupando el horario (el índice único parcial solo excluye 'cancelled'
// y 'cancelled_no_show'), así que hay que cancelarlos pasado el tiempo de reserva.
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
//  - Señas coordinadas por WhatsApp (depositMethod 'whatsapp'): no pasan por
//    Mercado Pago, así que se quedan en 'pending' hasta que el admin las marca
//    pagas a mano — no hay "tiempo límite" que valga acá.
import { prisma }          from '../app/database/prisma'
import { activityService } from '../modules/activity/activity.service'
import { hasStarted, openReopenedSlot } from '../modules/appointments/reopenedSlots'

// 15 min es la ventana que ve el cliente en PaymentStep (HOLD_MINUTES). Le
// sumamos unos minutos de gracia para no cancelar un turno justo mientras el
// webhook de Mercado Pago está en camino.
const EXPIRE_AFTER_MINUTES = 20

export async function runReleaseUnpaidAppointmentsJob(): Promise<{ released: number }> {
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000)

  // OJO: "depositMethod: { not: 'whatsapp' }" NO alcanza para excluir esos
  // turnos — en SQL, `<> 'whatsapp'` es NULL (no true) cuando la columna es
  // NULL (el caso normal, turnos por Mercado Pago), así que ese filtro solo
  // dejaría pasar turnos que EXPLÍCITAMENTE tengan 'whatsapp'... al revés de
  // lo que queremos. Por eso el OR explícito con `null` incluido.
  const staleFilter = {
    status:        'confirmed' as const,
    depositAmount: { gt: 0 },
    createdAt:     { lt: cutoff },
    AND: [
      { OR: [{ depositMethod: null }, { depositMethod: { not: 'whatsapp' } }] },
      { OR: [
          { paymentStatus: 'pending', mpPaymentId: null },
          { paymentStatus: { in: ['rejected', 'cancelled'] } },
        ] },
    ],
  }

  // Cada turno se libera en su propia transacción. Uno impago que ya empezó al liberarse deja su horario ORIGINAL
  // bloqueado (slot_locked) y, si pasaron hasta 40 minutos desde su inicio, abre un horario reabierto (igual que
  // cualquier otra cancelación). Los que todavía no empezaron liberan el horario enseguida.
  const now = new Date()
  async function release(row: { id: string; professionalId: string; date: string; time: string }, extraWhere: object): Promise<number> {
    const started = hasStarted(row, now)
    return prisma.$transaction(async (tx) => {
      const res = await tx.appointment.updateMany({
        where: { id: row.id, ...extraWhere },
        data:  { status: 'cancelled', cancelledAt: now, cancelReason: 'unpaid_expired', cancelledBy: 'system', slotLocked: started },
      })
      if (res.count === 1 && started) await openReopenedSlot(tx, row, now)
      return res.count
    })
  }

  // Turnos sueltos.
  const singles = await prisma.appointment.findMany({
    where:  { ...staleFilter, comboGroupId: null },
    select: { id: true, professionalId: true, date: true, time: true },
  })
  let single = 0
  for (const row of singles) single += await release(row, { ...staleFilter, comboGroupId: null })

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
    const legs = await prisma.appointment.findMany({
      where:  { comboGroupId: { in: groupIds }, status: { in: ['pending', 'confirmed'] } },
      select: { id: true, professionalId: true, date: true, time: true },
    })
    for (const leg of legs) comboLegs += await release(leg, { status: { in: ['pending', 'confirmed'] } })
  }

  const released = single + comboLegs
  if (released > 0) {
    await activityService.log({
      action: `Turnos liberados por falta de pago: ${released}`,
      module: 'system',
      detail: `Se cancelaron ${released} turno${released !== 1 ? 's' : ''} sin seña paga tras ${EXPIRE_AFTER_MINUTES} minutos.`,
    })
  }

  return { released }
}

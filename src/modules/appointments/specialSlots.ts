// src/modules/appointments/specialSlots.ts
//
// Un servicio especial guarda sus horarios en services.special_slots (JSON). Al reservar, el horario
// queda ocupado con el id del turno (appointmentId). Cuando ese turno se cancela, el horario tiene que
// volver a quedar libre: si no, el único lugar del día se pierde aunque la clienta nunca haya pagado.
import type { Prisma } from '@prisma/client'
import type { SpecialSlot } from '../services/service.model'

// Se llama dentro de la transacción que cancela el turno. Toma el mismo lock de fila sobre el servicio
// (FOR UPDATE) que usa la reserva (createSpecialForClient) y en el mismo orden (primero el servicio, después el
// turno), así una reserva y una cancelación simultáneas no se pisan ni se traban.
export async function releaseSpecialSlot(
  tx: Prisma.TransactionClient,
  appointment: { id: string; serviceId: string },
): Promise<boolean> {
  const locked = await tx.$queryRaw<{ is_special: boolean; special_slots: unknown }[]>`
    SELECT is_special, special_slots FROM services WHERE id = ${appointment.serviceId}::uuid FOR UPDATE
  `
  const row = locked[0]
  if (!row?.is_special) return false

  const slots = (row.special_slots as SpecialSlot[]) ?? []
  if (!slots.some(s => s.appointmentId === appointment.id)) return false

  const freed = slots.map(s => s.appointmentId === appointment.id ? { ...s, appointmentId: null, clientName: null } : s)
  await tx.service.update({
    where: { id: appointment.serviceId },
    data:  { specialSlots: freed as unknown as Prisma.InputJsonValue },
  })
  return true
}

// src/jobs/autoNoShow.job.ts
//
// Corre cada pocos minutos (ver scheduler.ts). Si pasaron más de 20 minutos
// desde la hora pactada de un turno 'confirmed' y nadie registró la llegada
// de la clienta (ni ella desde la app, ni el profesional/admin por ella —
// ver markArrivalFor* en appointment.service.ts), se marca el turno como
// 'cancelled_no_show'.
//
// El índice único parcial que impide doble reserva por profesional/fecha/hora
// solo excluye 'cancelled' y 'cancelled_no_show' (ver releaseUnpaidAppointments.job.ts),
// así que este cambio de estado ya libera el horario para reasignar — no hace
// falta ningún paso extra.
import { prisma }          from '../app/database/prisma'
import { activityService } from '../modules/activity/activity.service'
import { fullName } from '../app/utils/fullName'
import { todayArgentinaStr, appointmentInstant } from '../app/utils/argentinaTime'

const GRACE_MINUTES = 20

export async function runAutoNoShowJob(): Promise<{ marked: number }> {
  // Solo turnos de hoy o de días anteriores (por si el job estuvo caído) —
  // uno de fecha futura nunca puede cumplir la condición de los 20 minutos.
  const candidates = await prisma.appointment.findMany({
    where: {
      status:    'confirmed',
      arrivedAt: null,
      date:      { lte: todayArgentinaStr() },
    },
    include: { client: true, professional: true, service: true },
  })

  const now = Date.now()
  let marked = 0

  for (const a of candidates) {
    const scheduled    = appointmentInstant(a.date, a.time)
    const minutesLate  = (now - scheduled.getTime()) / (60 * 1000)
    if (minutesLate < GRACE_MINUTES) continue

    await prisma.appointment.update({ where: { id: a.id }, data: { status: 'cancelled_no_show' } })
    await activityService.log({
      action: 'Turno cancelado por inasistencia (automático)',
      module: 'appointments',
      detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}: sin registro de llegada tras ${GRACE_MINUTES} minutos de la hora pactada.`,
    })
    marked += 1
  }

  return { marked }
}

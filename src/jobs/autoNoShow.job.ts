// src/jobs/autoNoShow.job.ts
//
// Corre cada 5 minutos (ver scheduler.ts). Si pasaron MÁS de 30 minutos desde la hora de inicio de un turno
// 'confirmed' y nadie registró la llegada de la clienta (ni ella desde la app, ni el profesional/admin por
// ella — ver markArrivalFor* en appointment.service.ts), el turno pasa a 'no_show_auto'
// («No asistió (automático)»). Con 30 minutos exactos todavía no se marca.
//
// 'no_show_auto' NO libera el horario: el índice único parcial de R-01 solo excluye 'cancelled' y
// 'cancelled_no_show', así que nadie puede reservar ni reprogramar hacia ese horario. Tampoco suma a la
// carga semanal de R-04. La seña no se toca (paymentStatus queda como estaba) y la clienta no puede
// cancelarlo desde la app. El personal lo resuelve después (marcar "No asistió", finalizar o confirmar).
//
// Una entrada de actividad por turno marcado.
import { prisma }          from '../app/database/prisma'
import { activityService } from '../modules/activity/activity.service'
import { fullName } from '../app/utils/fullName'
import { todayArgentinaStr } from '../app/utils/argentinaTime'
import { NO_SHOW_AUTO_AFTER_MINUTES, startInstant } from '../modules/appointments/reopenedSlots'

export async function runAutoNoShowJob(now: Date = new Date()): Promise<{ marked: number }> {
  // Solo turnos de hoy o de días anteriores (por si el job estuvo caído) —
  // uno de fecha futura nunca puede cumplir la condición de los 30 minutos.
  const candidates = await prisma.appointment.findMany({
    where: {
      status:    'confirmed',
      arrivedAt: null,
      date:      { lte: todayArgentinaStr(now) },
    },
    include: { client: true, professional: true, service: true },
  })

  let marked = 0

  for (const a of candidates) {
    const minutesLate = (now.getTime() - startInstant(a).getTime()) / (60 * 1000)
    if (minutesLate <= NO_SHOW_AUTO_AFTER_MINUTES) continue

    // Escritura condicional: si el personal o la clienta tocaron el turno mientras corría el job
    // (llegada registrada, otro estado), no se pisa.
    const claimed = await prisma.appointment.updateMany({
      where: { id: a.id, status: 'confirmed', arrivedAt: null },
      data:  { status: 'no_show_auto' },
    })
    if (claimed.count === 0) continue

    await activityService.log({
      action: 'Turno marcado como no asistido (automático)',
      module: 'appointments',
      appointmentId: a.id,
      detail: `${a.service.name} — ${fullName(a.client)} con ${a.professional.name} el ${a.date} ${a.time}: "confirmed" → "no_show_auto"; sin registro de llegada tras más de ${NO_SHOW_AUTO_AFTER_MINUTES} minutos de la hora de inicio. El horario sigue ocupado y la seña no cambia.`,
    })
    marked += 1
  }

  return { marked }
}

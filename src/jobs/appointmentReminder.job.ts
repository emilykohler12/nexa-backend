// src/jobs/appointmentReminder.job.ts
//
// Corre cada 5 minutos (ver scheduler.ts). Manda UN mail de recordatorio por turno (o por grupo de combo) cuando
// faltan 5 horas o menos para la hora de inicio y hasta 1 hora antes. La regla de cuándo corresponde y el armado
// del mail están en modules/appointments/reminder.ts.
//
// No se reenvía nunca: antes de mandar se marca appointments.reminder_sent_at con una escritura condicional
// (reminder_sent_at IS NULL), así dos corridas que se pisen no mandan dos mails. Si el envío falla la marca se
// deshace y la próxima corrida vuelve a intentar (hasta 1 hora antes del turno). Si el proceso se cae justo entre
// la marca y el envío, ese recordatorio se pierde: es preferible a mandarlo dos veces.
//
// Cada envío deja una entrada de actividad con appointment_id. Un fallo no corta el job.
import { prisma }          from '../app/database/prisma'
import { activityService } from '../modules/activity/activity.service'
import { settingsService } from '../modules/settings/settings.service'
import { mailProvider }    from '../modules/auth/providers/mail.provider'
import { fullName }        from '../app/utils/fullName'
import { todayArgentinaStr } from '../app/utils/argentinaTime'
import {
  REMINDER_HOURS_BEFORE, buildReminderEmail, isReminderDue, type ReminderCandidate,
} from '../modules/appointments/reminder'

const HOUR_MS = 60 * 60 * 1000

const FAILURE_ACTION = 'No se pudo enviar el recordatorio del turno'

function summaryOf(legs: ReminderCandidate[]): string {
  const lead = legs[0]
  const services = legs.map(l => `${l.service.name} con ${l.professional.name}`).join(', ')
  return `${services} — ${fullName(lead.client)} el ${lead.date} ${lead.time}`
}

export async function runAppointmentReminderJob(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  // La ventana de 5 horas puede cruzar la medianoche: se miran la fecha de hoy y la de dentro de 5 horas.
  const dates = [...new Set([
    todayArgentinaStr(now),
    todayArgentinaStr(new Date(now.getTime() + REMINDER_HOURS_BEFORE * HOUR_MS)),
  ])]

  const rows = await prisma.appointment.findMany({
    where: { status: 'confirmed', reminderSentAt: null, date: { in: dates } },
    include: { client: { include: { client: true } }, professional: true, service: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  // Un solo mail por grupo de combo, con todos los servicios.
  const groups = new Map<string, ReminderCandidate[]>()
  for (const row of rows) {
    if (!isReminderDue(row, now)) continue
    const key = row.comboGroupId ?? row.id
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  if (groups.size === 0) return { sent: 0, failed: 0 }

  const [refundSettings, business] = await Promise.all([
    settingsService.getPaymentSettings(),
    prisma.businessSettings.findFirst(),
  ])

  let sent = 0
  let failed = 0

  for (const legs of groups.values()) {
    const ids = legs.map(l => l.id)
    const lead = legs[0]

    // Marca condicional ANTES de enviar. Si alguna pata cambió mientras corría el job (cancelada, ya marcada),
    // se deshace y se vuelve a evaluar completo en la corrida siguiente.
    const claimed = await prisma.appointment.updateMany({
      where: { id: { in: ids }, status: 'confirmed', reminderSentAt: null },
      data:  { reminderSentAt: now },
    })
    const release = () => prisma.appointment.updateMany({
      where: { id: { in: ids }, reminderSentAt: now },
      data:  { reminderSentAt: null },
    })
    if (claimed.count !== ids.length) {
      if (claimed.count > 0) await release()
      continue
    }

    try {
      const { subject, html } = buildReminderEmail(legs, {
        now,
        settings: refundSettings,
        address:  business?.address,
      })
      await mailProvider.send(lead.client.email, subject, html)
    } catch (err: any) {
      await release()
      failed += 1
      console.error('[jobs] recordatorio de turno: no se pudo enviar:', err?.message)

      // Una sola entrada de error por turno: con el mail caído el job reintenta cada 5 minutos y llenaría la actividad.
      const previous = await prisma.activityLog.count({ where: { appointmentId: lead.id, action: FAILURE_ACTION } })
      if (previous === 0) {
        await activityService.log({
          action: FAILURE_ACTION, module: 'appointments', level: 'warning', appointmentId: lead.id,
          detail: `${summaryOf(legs)}: ${err?.message ?? 'error desconocido'}. Se reintenta en cada corrida hasta 1 hora antes del turno.`,
        })
      }
      continue
    }

    sent += 1
    await activityService.log({
      action: 'Recordatorio de turno enviado', module: 'appointments', level: 'info', appointmentId: lead.id,
      detail: `${summaryOf(legs)}: mail de recordatorio enviado a la clienta${legs.length > 1 ? ' (un solo mail para el combo)' : ''}.`,
    })
  }

  return { sent, failed }
}

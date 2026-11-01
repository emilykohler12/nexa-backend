// src/jobs/scheduler.ts
import cron from 'node-cron'
import { runReleaseUnpaidAppointmentsJob } from './releaseUnpaidAppointments.job'
import { runAutoNoShowJob } from './autoNoShow.job'
import { runAppointmentReminderJob } from './appointmentReminder.job'
import { ARGENTINA_TIME_ZONE } from '../app/utils/argentinaTime'

// Los horarios de abajo son hora de Argentina aunque el servidor (Render) corra en UTC.
const CRON_OPTIONS = { timezone: ARGENTINA_TIME_ZONE }

// Los trabajos programados vigentes son tres. Las campañas automáticas y el recordatorio
// de inactividad se eliminaron (ver bitácora, entrada 70). El único mail que el sistema manda
// a las clientas por iniciativa propia es el recordatorio del turno (Fase 3b, entrada 75).
export function startScheduledJobs(): void {
  // Cada 5 minutos — libera turnos cuya seña nunca se pagó (checkout de Mercado
  // Pago abandonado). Barato: la mayoría de las corridas no encuentra nada.
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runReleaseUnpaidAppointmentsJob()
      if (result.released > 0) {
        console.log(`[jobs] release-unpaid: ${result.released} turno(s) liberado(s)`)
      }
    } catch (err) {
      console.error('[jobs] error corriendo release-unpaid:', err)
    }
  }, CRON_OPTIONS)

  // Cada 5 minutos — marca 'no_show_auto' los turnos confirmados cuya hora pactada
  // pasó hace más de 30 minutos sin que se haya registrado la llegada.
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runAutoNoShowJob()
      if (result.marked > 0) {
        console.log(`[jobs] auto-no-show: ${result.marked} turno(s) marcado(s)`)
      }
    } catch (err) {
      console.error('[jobs] error corriendo auto-no-show:', err)
    }
  }, CRON_OPTIONS)

  // Cada 5 minutos — manda el recordatorio por mail de los turnos que empiezan en 5 horas o menos (un mail por
  // turno o grupo de combo, nunca repetido). noOverlap: si el mail tarda, la corrida siguiente espera.
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runAppointmentReminderJob()
      if (result.sent > 0 || result.failed > 0) {
        console.log(`[jobs] appointment-reminder: ${result.sent} enviado(s), ${result.failed} con error`)
      }
    } catch (err) {
      console.error('[jobs] error corriendo appointment-reminder:', err)
    }
  }, { ...CRON_OPTIONS, noOverlap: true })

  console.log('[jobs] scheduler iniciado (hora de Argentina) — release-unpaid (cada 5 min) + auto-no-show (cada 5 min) + appointment-reminder (cada 5 min)')
}

// src/jobs/scheduler.ts
import cron from 'node-cron'
import { runInactivityReminderJob } from './inactivityReminder.job'
import { runReleaseUnpaidAppointmentsJob } from './releaseUnpaidAppointments.job'
import { runAutoPromotionsJob } from './autoPromotions.job'

export function startScheduledJobs(): void {
  // Todos los días a las 9:00 (hora del servidor) — horario razonable para un
  // mail de "te extrañamos", ni de madrugada ni tarde en la noche.
  cron.schedule('0 9 * * *', async () => {
    console.log('[jobs] corriendo inactivity-reminder...')
    try {
      const result = await runInactivityReminderJob()
      console.log(`[jobs] inactivity-reminder: ${result.sent} enviados, ${result.failed} con error, ${result.eligible} elegibles`)
    } catch (err) {
      console.error('[jobs] error corriendo inactivity-reminder:', err)
    }
  })

  // Todos los días a las 9:15 — campañas automáticas (cumpleaños, turno N, etc.).
  cron.schedule('15 9 * * *', async () => {
    console.log('[jobs] corriendo auto-promotions...')
    try {
      const result = await runAutoPromotionsJob()
      console.log(`[jobs] auto-promotions: ${result.sent} enviados, ${result.failed} con error, ${result.rules} campaña(s) activa(s)`)
    } catch (err) {
      console.error('[jobs] error corriendo auto-promotions:', err)
    }
  })

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
  })

  console.log('[jobs] scheduler iniciado — inactivity-reminder (diario 9:00) + auto-promotions (diario 9:15) + release-unpaid (cada 5 min)')
}

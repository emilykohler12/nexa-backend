// src/jobs/scheduler.ts
import cron from 'node-cron'
import { runInactivityReminderJob } from './inactivityReminder.job'

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

  console.log('[jobs] scheduler iniciado — inactivity-reminder corre todos los días a las 9:00')
}

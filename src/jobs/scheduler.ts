// src/jobs/scheduler.ts
import cron from 'node-cron'
import { runReleaseUnpaidAppointmentsJob } from './releaseUnpaidAppointments.job'
import { runAutoNoShowJob } from './autoNoShow.job'
import { ARGENTINA_TIME_ZONE } from '../app/utils/argentinaTime'

// Los horarios de abajo son hora de Argentina aunque el servidor (Render) corra en UTC.
const CRON_OPTIONS = { timezone: ARGENTINA_TIME_ZONE }

// Los únicos trabajos programados que quedan. Las campañas automáticas y el recordatorio
// de inactividad se eliminaron (ver bitácora, entrada 70): el sistema ya no manda mails
// a las clientas por iniciativa propia.
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

  // Cada 5 minutos — marca 'cancelled_no_show' los turnos confirmados cuya hora pactada
  // pasó hace más de 20 minutos sin que se haya registrado la llegada.
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

  console.log('[jobs] scheduler iniciado (hora de Argentina) — release-unpaid (cada 5 min) + auto-no-show (cada 5 min)')
}

import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import cron from 'node-cron'

// El scheduler solo puede tener los trabajos vigentes. Los jobs se reemplazan por espías para
// comprobar CUÁL se registró en cada cron sin tocar la base.
vi.mock('../../src/jobs/releaseUnpaidAppointments.job', () => ({
  runReleaseUnpaidAppointmentsJob: vi.fn().mockResolvedValue({ released: 0 }),
}))
vi.mock('../../src/jobs/autoNoShow.job', () => ({
  runAutoNoShowJob: vi.fn().mockResolvedValue({ marked: 0 }),
}))
vi.mock('../../src/jobs/appointmentReminder.job', () => ({
  runAppointmentReminderJob: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}))

import { startScheduledJobs } from '../../src/jobs/scheduler'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import { runAppointmentReminderJob } from '../../src/jobs/appointmentReminder.job'

afterEach(() => { vi.restoreAllMocks() })

function registered() {
  const schedule = vi.spyOn(cron, 'schedule').mockReturnValue({} as any)
  startScheduledJobs()
  return schedule.mock.calls as unknown as [string, () => Promise<void>, { timezone: string }][]
}

describe('scheduler', () => {
  it('registra solo tres trabajos, todos cada 5 minutos y en hora de Argentina', () => {
    const calls = registered()

    expect(calls).toHaveLength(3)
    for (const [expression, , options] of calls) {
      expect(expression).toBe('*/5 * * * *')
      expect(options).toMatchObject({ timezone: 'America/Argentina/Buenos_Aires' })
    }
  })

  it('los tres trabajos son la liberación por falta de pago, la inasistencia y el recordatorio del turno', async () => {
    const calls = registered()
    for (const [, callback] of calls) await callback()

    expect(runReleaseUnpaidAppointmentsJob).toHaveBeenCalledTimes(1)
    expect(runAutoNoShowJob).toHaveBeenCalledTimes(1)
    expect(runAppointmentReminderJob).toHaveBeenCalledTimes(1)
  })

  it('el recordatorio no se superpone consigo mismo si una corrida tarda', () => {
    const calls = registered()

    const withNoOverlap = calls.filter(([, , options]) => (options as any).noOverlap === true)
    expect(withNoOverlap).toHaveLength(1)
  })

  it('no quedan los archivos de las campañas ni del recordatorio de inactividad', () => {
    const root = path.resolve(__dirname, '../../src')
    for (const file of [
      'jobs/autoPromotions.job.ts',
      'jobs/inactivityReminder.job.ts',
      'jobs/templates/autoPromotion.html',
      'jobs/templates/inactivityReminder.html',
      'modules/promotions/autoPromotion.model.ts',
      'modules/promotions/autoPromotion.controller.ts',
    ]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(false)
    }
  })
})

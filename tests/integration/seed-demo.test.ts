import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import { appointmentInstant } from '../../src/app/utils/argentinaTime'
import { seedDemo, DEMO } from '../../scripts/seed-demo'

// Fase 8 de la AE4: el seed de demostración carga un escenario coherente con las reglas nuevas
// (un turno confirmado, uno no_show_auto, uno cancelado y una promoción vigente, con datos inventados).
// El reloj se fija en hora de Argentina (UTC-3).

const MONDAY_NOON = new Date('2026-11-02T15:00:00Z') // lunes 02/11, 12:00 en Argentina
const FRIDAY_NOON = new Date('2026-11-06T15:00:00Z') // viernes 06/11, 12:00 en Argentina

afterEach(() => { vi.useRealTimers() })

function fixClock(at: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
}

// dayOfWeek de professional_availability: 0 = lunes … 6 = domingo.
const availabilityDay = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7

describe('seed de demostración (fase 8)', () => {
  it('carga un turno de cada estado y una promoción vigente, y correrlo dos veces no duplica nada', async () => {
    fixClock(MONDAY_NOON)
    await seedDemo()
    const seeded = await seedDemo()

    const client = await prisma.user.findUniqueOrThrow({ where: { email: DEMO.clientEmail } })
    const appts  = await prisma.appointment.findMany({ where: { clientId: client.id } })
    expect(appts.map(a => a.status).sort()).toEqual(['cancelled', 'confirmed', 'no_show_auto'])
    expect(await prisma.user.count({ where: { email: { in: [DEMO.clientEmail, DEMO.proEmail] } } })).toBe(2)
    expect(await prisma.promotion.count({ where: { title: DEMO.promotionTitle } })).toBe(1)
    expect(await prisma.professionalAvailability.count({ where: { professionalId: (await prisma.professional.findUniqueOrThrow({ where: { userId: seeded.professionalUserId } })).id } })).toBe(6)

    // Las cuentas de demo usan dominios .local: nada de datos reales.
    expect(DEMO.clientEmail.endsWith('@nexa.local') && DEMO.proEmail.endsWith('@nexa.local')).toBe(true)
  })

  it('el turno confirmado es futuro, dentro de la franja de la profesional y con la seña paga', async () => {
    fixClock(MONDAY_NOON)
    const { confirmed, professionalUserId } = await seedDemo()

    expect(confirmed.date).toBe('2026-11-04')
    expect(appointmentInstant(confirmed.date, confirmed.time).getTime()).toBeGreaterThan(MONDAY_NOON.getTime())
    const pro = await prisma.professional.findUniqueOrThrow({ where: { userId: professionalUserId } })
    const slot = await prisma.professionalAvailability.findFirst({
      where: { professionalId: pro.id, dayOfWeek: availabilityDay(confirmed.date) },
    })
    expect(slot).not.toBeNull()
    expect(confirmed.time >= slot!.startTime && confirmed.time < slot!.endTime).toBe(true)
    expect(confirmed.paymentStatus).toBe('partial')
    expect(confirmed.reminderSentAt).toBeNull()
  })

  it('el no_show_auto pasó hace más de 30 minutos, no tiene llegada, retiene la seña y sigue ocupando el horario', async () => {
    fixClock(MONDAY_NOON)
    const { noShowAuto } = await seedDemo()

    expect(noShowAuto.date).toBe('2026-10-31') // el domingo no se trabaja: va al sábado anterior
    const start = appointmentInstant(noShowAuto.date, noShowAuto.time).getTime()
    expect(MONDAY_NOON.getTime() - start).toBeGreaterThan(30 * 60 * 1000)
    expect(noShowAuto.arrivedAt).toBeNull()
    expect(noShowAuto.paymentStatus).toBe('partial')
    expect(noShowAuto.createdAt.getTime()).toBeLessThan(start)

    // El índice único parcial lo cuenta como activo: otro turno en el mismo horario choca.
    await expect(prisma.appointment.create({
      data: {
        clientId: noShowAuto.clientId, professionalId: noShowAuto.professionalId, serviceId: noShowAuto.serviceId,
        date: noShowAuto.date, time: noShowAuto.time, duration: 60, servicePrice: 15000,
      },
    })).rejects.toMatchObject({ code: 'P2002' })
  })

  it('el cancelado lo canceló la clienta con más de 12 horas de aviso: seña devuelta y horario libre', async () => {
    fixClock(MONDAY_NOON)
    const { cancelled } = await seedDemo()

    expect(cancelled.cancelledBy).toBe('client')
    expect(cancelled.cancelReason).toBe('user_cancelled')
    expect(cancelled.paymentStatus).toBe('refunded')
    expect(cancelled.slotLocked).toBe(false)
    const noticeHours = (appointmentInstant(cancelled.date, cancelled.time).getTime() - cancelled.cancelledAt!.getTime()) / 3_600_000
    expect(noticeHours).toBeGreaterThanOrEqual(12)

    // Cancelado antes del inicio: el horario se puede volver a reservar.
    await expect(prisma.appointment.create({
      data: {
        clientId: cancelled.clientId, professionalId: cancelled.professionalId, serviceId: cancelled.serviceId,
        date: cancelled.date, time: cancelled.time, duration: 60, servicePrice: 15000,
      },
    })).resolves.toBeTruthy()
  })

  it('la promoción es vigente y sale en la lista pública', async () => {
    fixClock(MONDAY_NOON)
    const { promotion } = await seedDemo()

    expect(promotion.startDate).toBe('2026-11-02')
    expect(promotion.endDate).toBe('2026-12-02')
    const res = await request(app).get('/api/promotions/public')
    expect(res.status).toBe(200)
    expect(res.body.promotions.map((p: { title: string }) => p.title)).toContain(DEMO.promotionTitle)
  })

  it('el job de inasistencia no cambia nada del escenario recién cargado', async () => {
    fixClock(MONDAY_NOON)
    await seedDemo()
    expect(await runAutoNoShowJob(MONDAY_NOON)).toEqual({ marked: 0 })
  })

  it('un viernes, el confirmado y el cancelado saltan el domingo', async () => {
    fixClock(FRIDAY_NOON)
    const { confirmed, cancelled, noShowAuto } = await seedDemo()

    expect(confirmed.date).toBe('2026-11-09')  // viernes + 2 = domingo → lunes
    expect(cancelled.date).toBe('2026-11-09')  // viernes + 3 = lunes
    expect(cancelled.time).not.toBe(confirmed.time)
    expect(noShowAuto.date).toBe('2026-11-05')
  })
})

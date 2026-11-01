import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import cron from 'node-cron'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import { startScheduledJobs } from '../../src/jobs/scheduler'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Los turnos se guardan en hora de Argentina (ART, UTC-3, sin horario de verano) como
// texto: date "YYYY-MM-DD" y time "HH:mm". El servidor de producción corre en UTC
// (vitest.config.mts fija TZ=UTC para reproducirlo). Estos tests fijan "ahora" con un
// instante UTC concreto y comprueban las reglas contra la hora real de Argentina.

afterEach(() => { vi.useRealTimers() })

// Congela solo Date (los timers de la base de datos siguen funcionando).
function setNow(isoUtc: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(isoUtc))
}

async function confirmedAppointment(date: string, time: string, extra: Record<string, unknown> = {}) {
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 10000 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date, time, ...extra,
  })
  return { client, pro, svc, appt }
}

describe('no-show automático en hora de Argentina', () => {
  it('no marca ausente a una clienta antes de que pasen 20 minutos de la hora del turno', async () => {
    const { appt } = await confirmedAppointment('2026-10-24', '10:00')

    setNow('2026-10-24T13:10:00Z') // 10:10 en Argentina, 10 minutos después del turno
    const result = await runAutoNoShowJob()

    expect(result.marked).toBe(0)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('no marca ausente un turno que todavía no empezó', async () => {
    const { appt } = await confirmedAppointment('2026-10-24', '10:00')

    setNow('2026-10-24T11:00:00Z') // 08:00 en Argentina, 2 horas antes del turno
    const result = await runAutoNoShowJob()

    expect(result.marked).toBe(0)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('marca ausente pasados los 30 minutos de la hora del turno, no antes', async () => {
    const { appt } = await confirmedAppointment('2026-10-24', '10:00')

    setNow('2026-10-24T13:30:00Z') // 10:30 en Argentina: 30 minutos exactos, todavía no
    expect((await runAutoNoShowJob()).marked).toBe(0)

    setNow('2026-10-24T13:35:00Z') // 10:35 en Argentina
    const result = await runAutoNoShowJob()

    expect(result.marked).toBe(1)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('no_show_auto')
  })

  it('un turno nocturno se evalúa con la fecha de Argentina (22:30 ART ya es el día siguiente en UTC)', async () => {
    const { appt } = await confirmedAppointment('2026-10-24', '22:00')

    setNow('2026-10-25T01:10:00Z') // 22:10 del 24 en Argentina
    expect((await runAutoNoShowJob()).marked).toBe(0)

    setNow('2026-10-25T01:35:00Z') // 22:35 del 24 en Argentina (más de 30 minutos)
    expect((await runAutoNoShowJob()).marked).toBe(1)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('no_show_auto')
  })
})

describe('cancelación y reembolso en hora de Argentina (corte de 12 horas)', () => {
  it('reembolsa si faltan 12 horas y media reales para el turno', async () => {
    setNow('2026-10-24T22:30:00Z') // 19:30 en Argentina
    const { client, appt } = await confirmedAppointment('2026-10-25', '08:00', { paymentStatus: 'partial', depositAmount: 5000 })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(true)
    expect(res.body.appointment.paymentStatus).toBe('refunded')
  })

  it('no reembolsa si faltan menos de 12 horas reales', async () => {
    setNow('2026-10-25T00:30:00Z') // 21:30 en Argentina, 10 horas y media antes
    const { client, appt } = await confirmedAppointment('2026-10-25', '08:00', { paymentStatus: 'partial', depositAmount: 5000 })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(false)
    expect(res.body.appointment.paymentStatus).toBe('partial')
  })
})

describe('"hoy" en hora de Argentina', () => {
  it('la clienta puede registrar su llegada a un turno de las 22:00 a las 22:30 (ya es el día siguiente en UTC)', async () => {
    setNow('2026-10-25T01:30:00Z') // 22:30 del 24 en Argentina
    const { client, appt } = await confirmedAppointment('2026-10-24', '22:00')

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).arrivedAt).not.toBeNull()
  })

  it('un evento especial de hoy sigue publicado a las 22:30', async () => {
    setNow('2026-10-25T01:30:00Z') // 22:30 del 24 en Argentina
    const pro = await createProfessionalUser()
    const svc = await createService({ price: 10000 })
    const event = await prisma.specialEvent.create({
      data: { serviceId: svc.id, professionalId: pro.id, date: '2026-10-24', title: 'Evento de hoy', active: true },
    })

    const res = await request(app).get('/api/special-events/public')

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).toContain(event.id)
  })
})

describe('cron en hora de Argentina', () => {
  it('todos los jobs programados usan la zona America/Argentina/Buenos_Aires', () => {
    const schedule = vi.spyOn(cron, 'schedule').mockReturnValue({} as any)
    try {
      startScheduledJobs()
      expect(schedule).toHaveBeenCalledTimes(3)
      for (const call of schedule.mock.calls) {
        expect(call[2]).toMatchObject({ timezone: 'America/Argentina/Buenos_Aires' })
      }
    } finally {
      schedule.mockRestore()
    }
  })
})

// ── Dashboards: "hoy" en hora de Argentina ─────────────────────────────────
// A las 22:30 de Argentina el servidor (UTC) ya está en el día siguiente.


const NIGHT_ART = '2026-10-25T01:30:00Z' // 22:30 del sábado 24 en Argentina

describe('dashboards en hora de Argentina', () => {
  it('el dashboard del admin cuenta como de "hoy" un turno de las 22:00 a las 22:30', async () => {
    setNow(NIGHT_ART)
    const admin = await createAdminUser()
    await confirmedAppointment('2026-10-24', '22:00', { status: 'finished', servicePrice: 8000 })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.dashboard.attendedAppointments).toBe(1)
  })

  it('el dashboard de la profesional cuenta lo de "hoy" a las 22:30', async () => {
    setNow(NIGHT_ART)
    const { pro } = await confirmedAppointment('2026-10-24', '22:00', { status: 'finished', servicePrice: 8000 })

    const res = await request(app).get('/api/professional/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(pro))

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body.dashboard)).toContain('8000')
  })

  it('las estadísticas de la profesional incluyen el turno de "hoy" a las 22:30', async () => {
    setNow(NIGHT_ART)
    const { pro } = await confirmedAppointment('2026-10-24', '22:00', { status: 'finished', servicePrice: 8000 })

    const res = await request(app).get('/api/professional/statistics').query({ period: 'day' }).set('Cookie', cookieFor(pro))

    expect(res.status).toBe(200)
    expect(res.body.statistics.monthServices).toBe(1)
  })
})

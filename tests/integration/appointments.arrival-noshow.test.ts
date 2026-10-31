import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, minutesAgo, hoursFromNow, todayStr, linkProfessionalService, futureWeekDay,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('registro de llegada', () => {
  afterEach(() => { vi.useRealTimers() })

  it('la clienta registra su propia llegada en un turno confirmado de hoy', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    // Turno de hoy a una hora fija: "ahora + 10 minutos" cruzaba la medianoche de Argentina si el
    // test corría entre las 23:50 y las 00:00 (en CI, 02:50 a 03:00 UTC) y daba NOT_TODAY.
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '12:00',
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/arrival`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('anda también a las 23:57 de Argentina, cuando el servidor (UTC) ya está en el día siguiente', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-31T02:57:00Z')) // 23:57 del 30/10 en Argentina
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2026-10-30', time: '23:59',
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/arrival`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('es idempotente — llamarlo dos veces no falla ni pisa el primer arrivedAt', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const first  = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    const second = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.appointment.arrivedAt).toBe(first.body.appointment.arrivedAt)
  })

  it('rechaza registrar llegada en un turno no confirmado (pending)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00', status: 'pending',
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS')
  })

  it('rechaza registrar llegada en un turno que no es de hoy', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const future = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: future.date, time: future.time,
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_TODAY')
  })

  it('rechaza registrar la llegada del turno de otra clienta', async () => {
    const owner    = await createClientUser()
    const intruder = await createClientUser()
    const pro      = await createProfessionalUser()
    const svc      = await createService()
    const appt     = await createAppointmentDirect({
      clientId: owner.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(intruder))
    expect(res.status).toBe(404)
  })

  it('la profesional puede registrar la llegada por la clienta', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(pro))
    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('el admin puede registrar la llegada de cualquier turno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/admin/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('una profesional no puede registrar la llegada de un turno ajeno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const otherPro = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(otherPro))
    expect(res.status).toBe(404)
  })
})

// Inasistencia automática (AE4, regla 2.1): MÁS de 30 minutos después de la hora de inicio, sin llegada
// registrada, el turno confirmado pasa a 'no_show_auto'. Con 30 exactos todavía no. El reloj se fija en
// hora de Argentina; la fecha del turno es un martes cualquiera (2026-11-03).
describe('job de inasistencia automática (no_show_auto)', () => {
  const DAY = '2026-11-03'
  afterEach(() => { vi.useRealTimers() })
  const setNowArt = (hhmm: string, seconds = '00') => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${DAY}T${hhmm}:${seconds}-03:00`))
  }
  async function confirmedAt(time: string, extra: Record<string, unknown> = {}) {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time, ...extra })
    return { client, pro, svc, appt }
  }

  it('a los 29 minutos de la hora de inicio todavía no marca', async () => {
    const { appt } = await confirmedAt('16:00')
    setNowArt('16:29')

    expect((await runAutoNoShowJob()).marked).toBe(0)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('a los 30 minutos exactos todavía no marca (tiene que pasar MÁS de 30)', async () => {
    const { appt } = await confirmedAt('16:00')
    setNowArt('16:30')

    expect((await runAutoNoShowJob()).marked).toBe(0)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('a los 31 minutos pasa a no_show_auto y la seña no cambia', async () => {
    const { appt } = await confirmedAt('16:00', { paymentStatus: 'partial', depositAmount: 5000 })
    setNowArt('16:31')

    expect((await runAutoNoShowJob()).marked).toBe(1)

    const fresh = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(fresh.status).toBe('no_show_auto')
    expect(fresh.paymentStatus).toBe('partial')
    expect(Number(fresh.depositAmount)).toBe(5000)
    expect(fresh.slotLocked).toBe(false)
  })

  it('NO marca un turno que ya registró la llegada', async () => {
    const { appt } = await confirmedAt('16:00', { arrivedAt: new Date() })
    setNowArt('17:00')

    expect((await runAutoNoShowJob()).marked).toBe(0)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('no vuelve a marcar un turno que ya está en no_show_auto (corridas repetidas)', async () => {
    const { appt } = await confirmedAt('16:00')
    setNowArt('16:35')

    expect((await runAutoNoShowJob()).marked).toBe(1)
    expect((await runAutoNoShowJob()).marked).toBe(0)

    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id } })
    expect(logs).toHaveLength(1)
  })

  it('deja UNA entrada de actividad por turno, con el id del turno y el cambio de estado', async () => {
    const first  = await confirmedAt('16:00')
    const second = await confirmedAt('15:00')
    setNowArt('16:40')

    expect((await runAutoNoShowJob()).marked).toBe(2)

    for (const { appt } of [first, second]) {
      const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id } })
      expect(logs).toHaveLength(1)
      expect(logs[0].module).toBe('appointments')
      expect(logs[0].detail).toContain('"confirmed" → "no_show_auto"')
    }
  })

  it('no_show_auto ocupa el horario aunque la reserva todavía esté dentro de la tolerancia de 15 minutos', async () => {
    // Turno de las 16:00 marcado a mano como no_show_auto (como si el job ya hubiera corrido) y reserva a las 16:10.
    const { pro, svc } = await confirmedAt('16:00', { status: 'no_show_auto' })
    setNowArt('16:10')
    const other = await createClientUser()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(other))
      .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:00', termsAccepted: true })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('tampoco se puede reprogramar otro turno hacia un horario ocupado por un no_show_auto', async () => {
    const { pro, svc } = await confirmedAt('16:00', { status: 'no_show_auto' })
    const other = await createClientUser()
    const mine  = await createAppointmentDirect({ clientId: other.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '18:00' })
    setNowArt('16:10')

    const res = await request(app)
      .patch(`/api/client/appointments/${mine.id}/reschedule`)
      .set('Cookie', cookieFor(other))
      .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:00' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('la clienta no puede cancelar un turno no_show_auto, ni uno finalizado ni uno no asistido', async () => {
    for (const status of ['no_show_auto', 'finished', 'cancelled_no_show']) {
      const { client, appt } = await confirmedAt('16:00', { status })

      const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

      expect(res.status, status).toBe(400)
      expect(res.body.code, status).toBe('NOT_CANCELLABLE')
      expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe(status)
    }
  })

  it('la clienta no puede reprogramar un turno no_show_auto', async () => {
    const { client, svc, pro, appt } = await confirmedAt('16:00', { status: 'no_show_auto' })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '18:00' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_RESCHEDULABLE')
  })

  it('un no_show_auto no suma a la carga semanal de la asignación "cualquiera"', async () => {
    const a   = await createProfessionalUser({ name: 'Antigua' })
    const b   = await createProfessionalUser({ name: 'Nueva' })
    const svc = await createService()
    await linkProfessionalService(a.id, svc.id)
    await linkProfessionalService(b.id, svc.id)
    await prisma.professional.update({ where: { userId: a.id }, data: { createdAt: new Date('2025-01-01T00:00:00Z') } })
    await prisma.professional.update({ where: { userId: b.id }, data: { createdAt: new Date('2026-01-01T00:00:00Z') } })
    const other = await createClientUser()
    // "Antigua" tiene un no_show_auto esa semana. Si contara como carga, ganaría "Nueva"; como no cuenta, hay
    // empate en 0 y gana la más antigua.
    await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(1), time: '09:00', status: 'no_show_auto' })
    const client = await createClientUser()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: 'any', date: futureWeekDay(2), time: '12:00', termsAccepted: true })

    expect(res.status).toBe(201)
    expect(res.body.appointment.professionalId).toBe(a.id)
  })

  it('un no_show_auto cuenta como inasistencia en el panel del administrador', async () => {
    const admin = await createAdminUser()
    await confirmedAt('09:00', { status: 'no_show_auto', date: todayStr() })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.dashboard.noShowAppointments).toBe(1)
  })
})

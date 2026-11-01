import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { activityService } from '../../src/modules/activity/activity.service'
import { createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-26: contenido del historial de la clienta y de la profesional. RF-27: registro de actividad del administrador.
// RF-34: un caso de los indicadores del panel (la definición de cada uno está en docs/cambios-y-decisiones.md).

const DAY = '2026-11-03' // martes

afterEach(() => { vi.useRealTimers() })

function setNowArt(day: string, hhmm: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${day}T${hhmm}:00-03:00`))
}

async function history() {
  const client = await createClientUser({ name: 'Clienta Historial' })
  const pro    = await createProfessionalUser({ name: 'Profesional Historial' })
  const other  = await createProfessionalUser({ name: 'Otra Profesional' })
  const svc    = await createService({ name: 'Alisado', price: 25000 })
  const base   = { clientId: client.id, serviceId: svc.id }
  const finished  = await createAppointmentDirect({ ...base, professionalId: pro.id, date: '2026-10-10', time: '10:00', status: 'finished' })
  const cancelled = await createAppointmentDirect({ ...base, professionalId: pro.id, date: '2026-10-12', time: '11:00', status: 'cancelled' })
  await prisma.appointment.update({ where: { id: cancelled.id }, data: { cancelReason: 'Cancelado por la clienta' } })
  const noShow    = await createAppointmentDirect({ ...base, professionalId: other.id, date: '2026-10-15', time: '12:00', status: 'cancelled_no_show' })
  const upcoming  = await createAppointmentDirect({ ...base, professionalId: pro.id, date: '2027-01-20', time: '09:00', status: 'confirmed' })
  const otherClient = await createClientUser()
  const foreign   = await createAppointmentDirect({ clientId: otherClient.id, serviceId: svc.id, professionalId: pro.id, date: '2026-10-11', time: '10:00', status: 'finished' })
  return { client, pro, other, svc, finished, cancelled, noShow, upcoming, foreign }
}

describe('RF-26: historial', () => {
  it('historial de la clienta (administrador): turnos finalizados, cancelados y no asistidos, del más nuevo al más viejo', async () => {
    const admin = await createAdminUser()
    const h = await history()

    const res = await request(app).get(`/api/admin/clients/${h.client.id}/history`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.history).toEqual([
      { id: h.noShow.id, clientId: h.client.id, service: 'Alisado', professional: 'Otra Profesional', date: '2026-10-15', time: '12:00', price: 25000, status: 'cancelled_no_show', cancelReason: null },
      { id: h.cancelled.id, clientId: h.client.id, service: 'Alisado', professional: 'Profesional Historial', date: '2026-10-12', time: '11:00', price: 25000, status: 'cancelled', cancelReason: 'Cancelado por la clienta' },
      { id: h.finished.id, clientId: h.client.id, service: 'Alisado', professional: 'Profesional Historial', date: '2026-10-10', time: '10:00', price: 25000, status: 'finished', cancelReason: null },
    ])
  })

  it('la clienta ve todos sus turnos (también los próximos) y ninguno ajeno', async () => {
    const h = await history()

    const res = await request(app).get('/api/client/appointments').set('Cookie', cookieFor(h.client))

    expect(res.status).toBe(200)
    expect(res.body.appointments.map((a: { id: string }) => a.id)).toEqual([h.upcoming.id, h.noShow.id, h.cancelled.id, h.finished.id])
    expect(res.body.appointments[0]).toMatchObject({
      serviceName: 'Alisado', professionalName: 'Profesional Historial', date: '2027-01-20', time: '09:00', price: 25000, status: 'confirmed',
    })
  })

  it('historial de la profesional (administrador): solo sus turnos finalizados, con la clienta y el precio', async () => {
    const admin = await createAdminUser()
    const h = await history()

    const res = await request(app).get(`/api/professionals/${h.pro.id}/history`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.history).toEqual([
      { id: h.foreign.id, service: 'Alisado', client: 'Clienta Test', date: '2026-10-11', time: '10:00', price: 25000, status: 'finished' },
      { id: h.finished.id, service: 'Alisado', client: 'Clienta Historial', date: '2026-10-10', time: '10:00', price: 25000, status: 'finished' },
    ])
  })

  it('los historiales del administrador no los ve una clienta ni una profesional', async () => {
    const h = await history()

    expect((await request(app).get(`/api/admin/clients/${h.client.id}/history`).set('Cookie', cookieFor(h.pro))).status).toBe(403)
    expect((await request(app).get(`/api/professionals/${h.pro.id}/history`).set('Cookie', cookieFor(h.client))).status).toBe(403)
    expect((await request(app).get(`/api/professionals/${h.pro.id}/history`).set('Cookie', cookieFor(h.other))).status).toBe(403)
  })
})

describe('RF-27: GET /admin/activity', () => {
  it('devuelve las entradas de la más nueva a la más vieja, con módulo, nivel, detalle y turno', async () => {
    const admin = await createAdminUser()
    await activityService.log({ action: 'Primera', module: 'config', detail: 'Cambio de configuración', userName: 'Admin Test' })
    await prisma.activityLog.updateMany({ data: { createdAt: new Date(Date.now() - 60_000) } })
    const appointmentId = '00000000-0000-4000-8000-000000000001'
    await activityService.log({ action: 'Segunda', module: 'appointments', level: 'warning', appointmentId })

    const res = await request(app).get('/api/admin/activity').set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.logs.map((l: { action: string }) => l.action)).toEqual(['Segunda', 'Primera'])
    expect(res.body.logs[0]).toMatchObject({ module: 'appointments', level: 'warning', user: 'Sistema', appointmentId })
    expect(res.body.logs[1]).toMatchObject({ module: 'config', level: 'info', user: 'Admin Test', detail: 'Cambio de configuración' })
    expect(typeof res.body.logs[0].timestamp).toBe('string')
  })

  it('una entrada de reseña trae el estado vigente del comentario', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2026-10-10', time: '10:00', status: 'finished' })
    const created = await request(app).post('/api/client/reviews').set('Cookie', cookieFor(client)).send({ appointmentId: appt.id, rating: 5, message: 'Muy bien' })
    await request(app).patch(`/api/admin/reviews/${created.body.review.id}/approve`).set('Cookie', cookieFor(admin))

    const res = await request(app).get('/api/admin/activity').set('Cookie', cookieFor(admin))

    const entry = res.body.logs.find((l: { module: string }) => l.module === 'reviews')
    expect(entry).toMatchObject({ reviewId: created.body.review.id, reviewStatus: 'approved' })
  })

  it('es solo del administrador', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    expect((await request(app).get('/api/admin/activity').set('Cookie', cookieFor(client))).status).toBe(403)
    expect((await request(app).get('/api/admin/activity').set('Cookie', cookieFor(pro))).status).toBe(403)
    expect((await request(app).get('/api/admin/activity')).status).toBe(401)
  })
})

describe('RF-34: indicadores del panel del administrador (período "day")', () => {
  it('calcula seña cobrada, atendidos, inasistencias, señas devueltas, saldo pendiente, ocupación y clientas nuevas', async () => {
    setNowArt(DAY, '20:00')
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const silent = await createClientUser() // se registra hoy pero nunca reserva: no es "nueva"
    const pro    = await createProfessionalUser({ name: 'Profesional Panel' }) // franja 00:00 a 24:00 = 1440 minutos
    const svc    = await createService({ price: 10000, duration: 60 })
    const registered = new Date(`${DAY}T09:00:00-03:00`)
    await prisma.user.updateMany({ where: { id: { in: [client.id, silent.id] } }, data: { createdAt: registered } })
    const base = { clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY }
    await createAppointmentDirect({ ...base, time: '09:00', status: 'finished', paymentStatus: 'partial', depositAmount: 3000 })
    await createAppointmentDirect({ ...base, time: '11:00', status: 'confirmed', paymentStatus: 'paid', depositAmount: 2000, servicePrice: 8000 })
    await createAppointmentDirect({ ...base, time: '13:00', status: 'cancelled', paymentStatus: 'refunded', depositAmount: 2000 })
    await createAppointmentDirect({ ...base, time: '15:00', status: 'cancelled_no_show', paymentStatus: 'partial', depositAmount: 1000 })
    // Fuera del período: no cuenta para nada.
    await createAppointmentDirect({ ...base, date: '2026-11-04', time: '09:00', status: 'confirmed', paymentStatus: 'paid', depositAmount: 9999 })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.dashboard).toMatchObject({
      depositRevenueTotal:  6000,  // 3000 + 2000 + 1000: señas pagas no devueltas, también de la inasistencia
      attendedAppointments: 1,     // solo el finalizado
      noShowAppointments:   1,
      refundedDeposits:     1,
      pendingBalance:       7000,  // precio menos seña del finalizado con seña parcial
      occupancyPercent:     12.5,  // 180 minutos ocupados (todo menos el cancelado) sobre 1440 disponibles
      newClients:           1,
      returningClients:     1,     // la clienta nueva volvió a agendar dentro de los 30 días
    })
    expect(res.body.dashboard.professionalPerformance).toEqual([
      { name: 'Profesional Panel', attended: 1, hoursWorked: 1, revenue: 10000, cancelled: 1 },
    ])
    expect(res.body.dashboard.heatmap[1]).toEqual({ day: 'Martes', morning: 2, afternoon: 1, evening: 0 })
  })
})

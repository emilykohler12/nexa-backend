import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
  setAvailability, futureWeekDay, todayStr, tomorrowStr, minutesAgo,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

const period = (admin: { id: string }, p: 'day' | 'week' | 'month' | 'year' = 'year') =>
  request(app).get('/api/admin/dashboard').query({ period: p }).set('Cookie', cookieFor(admin as never))

// ── Clientes nuevos: reservaron un turno por primera vez en el período ────────────────────────────────────────────
describe('KPI «Clientes nuevos»: primer turno dentro del período elegido', () => {
  it('cuenta a la clienta cuyo primer turno cae en el período y no a la que ya había reservado antes', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const first = await createClientUser()
    const old   = await createClientUser()
    await createClientUser() // se registró pero nunca reservó
    await createAppointmentDirect({ clientId: first.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00' })
    // «old» ya había reservado el año pasado: hoy no es su primera vez
    await createAppointmentDirect({ clientId: old.id, professionalId: pro.id, serviceId: svc.id, date: '2020-01-10', time: '10:00', status: 'finished' })
    await createAppointmentDirect({ clientId: old.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '09:00' })

    const res = await period(admin, 'day')

    expect(res.body.dashboard.newClients).toBe(1)
  })

  it('un turno cancelado no cuenta como primera reserva', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const client = await createClientUser()
    await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00', status: 'cancelled' })

    expect((await period(admin, 'day')).body.dashboard.newClients).toBe(0)
  })

  it('la primera reserva futura de otra semana no entra en «Hoy» pero sí en el año', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const client = await createClientUser()
    await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00' })

    expect((await period(admin, 'day')).body.dashboard.newClients).toBe(1)
    expect((await period(admin, 'year')).body.dashboard.newClients).toBe(1)
  })
})

// ── Turnos no asistidos: el sistema automático y la profesional ───────────────────────────────────────────────────
describe('KPI «Turnos no asistidos»', () => {
  it('suma los que marca el sistema (automático) y los que marca el personal, y ningún otro estado', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const mk = (time: string, status: string) =>
      createClientUser().then(c => createAppointmentDirect({ clientId: c.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time, status }))
    await mk('08:00', 'no_show_auto')
    await mk('09:00', 'cancelled_no_show')
    await mk('10:00', 'cancelled')
    await mk('11:00', 'finished')

    expect((await period(admin, 'day')).body.dashboard.noShowAppointments).toBe(2)
  })
})

// ── Profesional en el admin: solo turnos finalizados ya realizados ────────────────────────────────────────────────
describe('Profesional en el admin: turnos, clientes, facturación y rendimiento solo con finalizados ya realizados', () => {
  it('no cuenta turnos confirmados ni finalizados con fecha futura', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService({ price: 10000 })
    const [done, pending, future] = await Promise.all([createClientUser(), createClientUser(), createClientUser()])
    await createAppointmentDirect({ clientId: done.id, professionalId: pro.id, serviceId: svc.id, date: '2020-02-03', time: '10:00', status: 'finished' })
    await createAppointmentDirect({ clientId: pending.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '23:00', status: 'confirmed' })
    await createAppointmentDirect({ clientId: future.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(5), time: '10:00', status: 'finished' })

    const list = await request(app).get('/api/professionals').set('Cookie', cookieFor(admin))
    const mine = (list.body.professionals ?? []).find((p: { id: string }) => p.id === pro.id)
    const history = await request(app).get(`/api/professionals/${pro.id}/history`).set('Cookie', cookieFor(admin))

    expect(mine.metrics).toMatchObject({ totalAppointments: 1, totalClients: 1, totalRevenue: 10000 })
    expect(history.body.history).toHaveLength(1)
    expect(history.body.history[0].date).toBe('2020-02-03')
  })
})

// ── Turno manual con día y hora pasados ────────────────────────────────────────────────────────────────────────────
describe('turno manual con día y hora que ya pasaron: nace finalizado', () => {
  const body = (proId: string, svcId: string, date: string, time: string) =>
    ({ clientName: 'Walk In', clientPhone: '', clientEmail: '', serviceId: svcId, professionalId: proId, date, time })

  it('el administrador: pasado → finished, futuro → confirmed', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const past = minutesAgo(180)

    const a = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin)).send(body(pro.id, svc.id, past.date, past.time))
    const b = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin)).send(body(pro.id, svc.id, futureWeekDay(2), '10:00'))

    expect(a.status).toBe(201)
    expect(a.body.appointment.status).toBe('finished')
    expect(b.status).toBe(201)
    expect(b.body.appointment.status).toBe('confirmed')
  })

  it('la profesional también, y no recibe aviso de «turno nuevo» por uno ya realizado', async () => {
    const pro = await createProfessionalUser()
    const svc = await createService()
    await setAvailability(pro.id)
    const past = minutesAgo(180)

    const res = await request(app).post('/api/professional/appointments').set('Cookie', cookieFor(pro))
      .send({ clientName: 'Walk In', clientPhone: '', clientEmail: '', serviceId: svc.id, date: past.date, time: past.time })

    expect(res.status).toBe(201)
    expect(res.body.appointment.status).toBe('finished')
    expect(await prisma.professionalNotification.count({ where: { professionalId: pro.id, type: 'new_appointment' } })).toBe(0)
  })

  it('crear el turno manual no depende de la franja de la profesional ni de que tenga horarios cargados', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser() // sin disponibilidad cargada
    const svc   = await createService()

    const res = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin)).send(body(pro.id, svc.id, futureWeekDay(3), '22:30'))

    expect(res.status).toBe(201)
  })
})

// ── Actividad: quién reprograma o cancela ──────────────────────────────────────────────────────────────────────────
describe('Actividad: quién cancela o reprograma un turno', () => {
  async function scenario() {
    const client = await createClientUser({ name: 'Clara', lastName: 'Gómez' } as never)
    const pro    = await createProfessionalUser({ name: 'Paula Pro' } as never)
    await setAvailability(pro.id)
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: futureWeekDay(2), time: '10:00' })
    return { client, pro, svc, appt }
  }
  const lastLog = (appointmentId: string, action: string) =>
    prisma.activityLog.findFirstOrThrow({ where: { appointmentId, action }, orderBy: { createdAt: 'desc' } })

  it('la clienta cancela: figura su nombre', async () => {
    const { client, appt } = await scenario()
    await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

    const log = await lastLog(appt.id, 'Turno cancelado')
    expect(log.userName).toContain('Clara')
    expect(log.detail).toContain('la clienta')
  })

  it('la clienta reprograma: figura su nombre', async () => {
    const { client, pro, svc, appt } = await scenario()
    const res = await request(app).patch(`/api/client/appointments/${appt.id}/reschedule`).set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(3), time: '11:00' })
    expect(res.status).toBe(200)

    const log = await lastLog(appt.id, 'Turno reprogramado')
    expect(log.userName).toContain('Clara')
    expect(log.detail).toContain('la clienta')
  })

  it('la profesional cancela y reprograma: figura su nombre', async () => {
    const { pro, appt } = await scenario()
    const re = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro)).send({ date: futureWeekDay(3), time: '12:00' })
    expect(re.status).toBe(200)
    const rlog = await lastLog(appt.id, 'Turno reprogramado')
    expect(rlog.userName).toBe('Paula Pro')
    expect(rlog.detail).toContain('la profesional')

    const ca = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro)).send({ status: 'cancelled', cancelledBy: 'studio' })
    expect(ca.status).toBe(200)
    const clog = await lastLog(appt.id, 'Turno cancelado')
    expect(clog.userName).toBe('Paula Pro')
    expect(clog.detail).toContain('la profesional')
  })

  it('el administrador cancela y reprograma: figura su nombre', async () => {
    const admin = await createAdminUser({ name: 'Ada Admin' })
    const { appt } = await scenario()
    const re = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin)).send({ date: futureWeekDay(3), time: '12:00' })
    expect(re.status).toBe(200)
    const rlog = await lastLog(appt.id, 'Turno reprogramado')
    expect(rlog.userName).toContain('Ada Admin')
    expect(rlog.detail).toContain('el administrador')

    const ca = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin)).send({ status: 'cancelled', cancelledBy: 'studio' })
    expect(ca.status).toBe(200)
    const clog = await lastLog(appt.id, 'Turno cancelado')
    expect(clog.userName).toContain('Ada Admin')
    expect(clog.detail).toContain('el administrador')
  })
})

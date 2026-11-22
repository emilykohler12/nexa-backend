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

// ── Actividad: aviso cuando una profesional completa el formulario del enlace ─────────────────────────────────────
describe('Actividad: la profesional completa su alta con el enlace', () => {
  const submit = (pro: { id: string }) =>
    request(app).post('/api/professional/onboarding').set('Cookie', cookieFor(pro as never)).send({
      personal: { name: 'Pro Nueva', phone: '3764123456' }, work: { specialty: 'Uñas' },
    })

  it('deja UNA entrada en el módulo Profesionales, solo la primera vez', async () => {
    const pro = await createProfessionalUser()
    await prisma.user.update({ where: { id: pro.id }, data: { profileComplete: false } })

    expect((await submit(pro)).status).toBe(200)
    expect((await submit(pro)).status).toBe(200)

    const logs = await prisma.activityLog.findMany({ where: { module: 'professionals', action: 'Profesional completó su alta' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].userName).toBe('Pro Nueva')
    expect(logs[0].detail).toContain('completó el formulario de bienvenida')
  })
})

// ── Buscador de clientas del turno manual ───────────────────────────────────────────────────────────────────────────
describe('turno manual: buscar si la clienta ya tiene cuenta', () => {
  const search = (admin: { id: string }, q: string) =>
    request(app).get('/api/admin/clients/search').query({ q }).set('Cookie', cookieFor(admin as never))

  it('encuentra por nombre o correo, sin distinguir mayúsculas, y devuelve solo lo necesario', async () => {
    const admin = await createAdminUser()
    const ana   = await createClientUser({ name: 'Ana María', email: 'ana.maria@test.local', phone: '3764111111' })
    await createClientUser({ name: 'Otra Persona' })

    const byName  = await search(admin, 'ana ma')
    const byEmail = await search(admin, 'ANA.MARIA@')

    expect(byName.status).toBe(200)
    expect(byName.body.clients).toEqual([{ id: ana.id, name: 'Ana María', email: 'ana.maria@test.local', phone: '3764111111' }])
    expect(byEmail.body.clients.map((c: { id: string }) => c.id)).toEqual([ana.id])
  })

  it('con menos de 2 letras no busca, y no ofrece cuentas walk-in ni de otro rol', async () => {
    const admin = await createAdminUser()
    await createClientUser({ name: 'Zoe Walkin', email: 'walkin-123@nexa.local' })
    await createProfessionalUser({ name: 'Zoe Profesional' })

    expect((await search(admin, 'z')).body.clients).toEqual([])
    expect((await search(admin, 'zoe')).body.clients).toEqual([])
  })

  it('solo el administrador puede buscar', async () => {
    const pro = await createProfessionalUser()
    expect((await search(pro, 'ana')).status).toBe(403)
  })
})

// ── Seña pagada desde el detalle de la profesional ──────────────────────────────────────────────────────────────────
describe('la profesional marca pagada la seña coordinada por WhatsApp de un turno suyo', () => {
  async function whatsappAppt(extra: { depositMethod?: string | null } = {}) {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: futureWeekDay(2), time: '10:00',
      depositAmount: 3000, depositMethod: extra.depositMethod === undefined ? 'whatsapp' : extra.depositMethod,
    })
    return { pro, appt }
  }
  const markPaid = (pro: { id: string }, id: string) =>
    request(app).patch(`/api/professional/appointments/${id}/deposit-paid`).set('Cookie', cookieFor(pro as never))

  it('queda con la seña pagada y el turno confirmado', async () => {
    const { pro, appt } = await whatsappAppt()

    const res = await markPaid(pro, appt.id)

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.paymentStatus).toBe('partial')
    expect(row.status).toBe('confirmed')
    expect(row.depositPaidAt).not.toBeNull()
  })

  it('no puede marcar el turno de otra profesional ni una seña que no es de WhatsApp', async () => {
    const { appt } = await whatsappAppt()
    const other = await createProfessionalUser()
    expect((await markPaid(other, appt.id)).status).toBe(404)

    const mp = await whatsappAppt({ depositMethod: null })
    const res = await markPaid(mp.pro, mp.appt.id)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_WHATSAPP_DEPOSIT')
  })
})

// ── El precio del catálogo público sale como número ─────────────────────────────────────────────────────────────────
describe('GET /api/services: el precio es un número, no un texto', () => {
  it('«20000» llegaba como string y rompía el formato y el formulario de la profesional', async () => {
    await createService({ name: 'Capping Manos', price: 20000 })

    const res = await request(app).get('/api/services')

    const svc = res.body.services.find((s: { name: string }) => s.name === 'Capping Manos')
    expect(typeof svc.price).toBe('number')
    expect(svc.price).toBe(20000)
  })
})

// ── Clientas de la profesional: solo con turno finalizado ───────────────────────────────────────────────────────────
describe('Profesional: la sección Clientes solo tiene clientas con turno finalizado', () => {
  it('no lista a quien solo tiene turnos futuros, cancelados o no asistidos, y el historial trae solo finalizados', async () => {
    const pro = await createProfessionalUser()
    const svc = await createService({ price: 10000 })
    const [attended, onlyFuture, onlyCancelled] = await Promise.all([createClientUser({ name: 'Atendida' }), createClientUser({ name: 'Futura' }), createClientUser({ name: 'Cancelada' })])
    await createAppointmentDirect({ clientId: attended.id, professionalId: pro.id, serviceId: svc.id, date: '2020-03-01', time: '10:00', status: 'finished' })
    await createAppointmentDirect({ clientId: attended.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(3), time: '10:00', status: 'confirmed' })
    await createAppointmentDirect({ clientId: attended.id, professionalId: pro.id, serviceId: svc.id, date: '2020-03-05', time: '10:00', status: 'cancelled' })
    await createAppointmentDirect({ clientId: onlyFuture.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(2), time: '11:00', status: 'confirmed' })
    await createAppointmentDirect({ clientId: onlyCancelled.id, professionalId: pro.id, serviceId: svc.id, date: '2020-03-02', time: '12:00', status: 'cancelled' })

    const res = await request(app).get('/api/professional/clients').set('Cookie', cookieFor(pro))

    expect(res.body.clients.map((c: { name: string }) => c.name)).toEqual(['Atendida'])
    expect(res.body.clients[0].visits).toHaveLength(1)
    expect(res.body.clients[0].visits[0].status).toBe('finished')
    expect(res.body.clients[0]).not.toHaveProperty('cancellations')
    expect(res.body.clients[0]).not.toHaveProperty('nextAppointment')
  })
})

// ── Turno manual sin correo: queda en blanco, sin direcciones inventadas a la vista ─────────────────────────────────
describe('turno manual sin correo: el correo queda en blanco', () => {
  const manual = (admin: { id: string }, proId: string, svcId: string) =>
    request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin as never)).send({
      clientName: 'Sin Correo', clientPhone: '', clientEmail: '', serviceId: svcId, professionalId: proId, date: futureWeekDay(2), time: '10:00',
    })

  it('el administrador y la profesional ven el correo vacío, no la dirección interna', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const created = await manual(admin, pro.id, svc.id)
    expect(created.status).toBe(201)
    expect(created.body.appointment.clientEmail).toBe('')

    const list = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))
    expect(list.body.appointments[0].client.email).toBe('')
    const row = await prisma.user.findFirstOrThrow({ where: { name: 'Sin Correo' } })
    expect(row.email).toMatch(/^walkin-/) // internamente la base exige un correo único
  })

  it('guardar la edición del administrador con el correo en blanco no lo pisa', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const created = await manual(admin, pro.id, svc.id)
    const before = (await prisma.user.findFirstOrThrow({ where: { name: 'Sin Correo' } })).email

    const res = await request(app).patch(`/api/admin/appointments/${created.body.appointment.id}`).set('Cookie', cookieFor(admin)).send({ clientEmail: '', internalNotes: 'x' })

    expect(res.status).toBe(200)
    expect((await prisma.user.findFirstOrThrow({ where: { name: 'Sin Correo' } })).email).toBe(before)
  })

  it('la dirección interna se reconoce como tal y un correo real no', async () => {
    const { makePlaceholderEmail, isPlaceholderEmail, visibleEmail } = await import('../../src/app/utils/placeholderEmail')
    const internal = makePlaceholderEmail()
    expect(isPlaceholderEmail(internal)).toBe(true)
    expect(visibleEmail(internal)).toBe('')
    expect(isPlaceholderEmail('ana@gmail.com')).toBe(false)
    expect(visibleEmail('ana@gmail.com')).toBe('ana@gmail.com')
    expect(visibleEmail(null)).toBe('')
  })
})

// ── Cobro del saldo: corregir el monto (más o menos) ────────────────────────────────────────────────────────────────
describe('cobro del saldo en el local: se puede corregir el monto', () => {
  async function paidTurn() {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 50000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2020-04-01', time: '10:00',
      status: 'confirmed', paymentStatus: 'partial', depositAmount: 5000,
    })
    return { pro, appt }
  }
  const adminFix = (admin: { id: string }, id: string, body: object) =>
    request(app).patch(`/api/admin/appointments/${id}/balance-payment`).set('Cookie', cookieFor(admin as never)).send(body)
  const proFix = (pro: { id: string }, id: string, body: object) =>
    request(app).patch(`/api/professional/appointments/${id}/balance-payment`).set('Cookie', cookieFor(pro as never)).send(body)

  it('la profesional cobra, corrige a menos (vuelve a «seña pagada») y a más (queda pagado)', async () => {
    const { pro, appt } = await paidTurn()
    expect((await proFix(pro, appt.id, { method: 'cash', amount: 45000 })).status).toBe(200)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).paymentStatus).toBe('paid')

    const less = await proFix(pro, appt.id, { method: 'cash', amount: 30000, replace: true })
    expect(less.status).toBe(200)
    let row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(Number(row.balancePaidAmount)).toBe(30000)
    expect(row.paymentStatus).toBe('partial')

    const more = await proFix(pro, appt.id, { method: 'transfer', amount: 52000, replace: true })
    expect(more.status).toBe(200)
    row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(Number(row.balancePaidAmount)).toBe(52000)
    expect(row.paymentStatus).toBe('paid')
    expect(row.balancePaymentMethod).toBe('transfer')
    expect(await prisma.activityLog.count({ where: { appointmentId: appt.id, action: 'Cobro de saldo corregido' } })).toBe(2)
  })

  it('el administrador corrige cualquier turno; una profesional solo los suyos', async () => {
    const admin = await createAdminUser()
    const { pro, appt } = await paidTurn()
    await proFix(pro, appt.id, { method: 'cash', amount: 45000 })
    const other = await createProfessionalUser()

    expect((await proFix(other, appt.id, { method: 'cash', amount: 1000, replace: true })).status).toBe(404)
    expect((await adminFix(admin, appt.id, { method: 'card', amount: 44000, replace: true })).status).toBe(200)
  })

  it('no se puede corregir un cobro que no existe', async () => {
    const { pro, appt } = await paidTurn()

    const res = await proFix(pro, appt.id, { method: 'cash', amount: 1000, replace: true })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_BALANCE_TO_CORRECT')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, linkProfessionalService,
  createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Ajustes del 13/11/2026: avisos de los turnos coordinados por WhatsApp, avisos a la clienta cuando el personal
// cambia su turno, vacaciones visibles en la disponibilidad pública y registro sin mail de verificación.

beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

const mailsTo = (email: string) => vi.mocked(mailProvider.send).mock.calls.filter(([to]) => to === email)

describe('turno con la seña coordinada por WhatsApp', () => {
  it('al agendar avisa a la profesional (aviso + mail) y deja la entrada en Actividad; marcarla paga no repite el aviso', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser({ email: 'pro-wp@test.local' })
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 20000 })
    await linkProfessionalService(pro.id, svc.id)

    const res = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true, depositMethod: 'whatsapp' })
    expect(res.status).toBe(201)
    const id = res.body.appointment.id

    // La profesional ya sabe del turno, sin esperar a que el administrador cobre la seña.
    expect(await prisma.professionalNotification.count({ where: { professionalId: pro.id, type: 'new_appointment' } })).toBe(1)
    expect(mailsTo('pro-wp@test.local')).toHaveLength(1)

    // Actividad: la entrada trae el turno y el botón «Marcar seña pagada» depende de que siga por cobrar.
    const before = await request(app).get('/api/admin/activity').set('Cookie', cookieFor(admin))
    const entry = before.body.logs.find((l: { appointmentId?: string; action: string }) => l.appointmentId === id && l.action.includes('seña por coordinar por WhatsApp'))
    expect(entry).toBeDefined()
    expect(entry.pendingWhatsappDeposit).toBe(true)

    const paid = await request(app).patch(`/api/admin/appointments/${id}/deposit-paid`).set('Cookie', cookieFor(admin))
    expect(paid.status).toBe(200)
    expect(paid.body.appointment.paymentStatus).toBe('partial')

    // Sin segundo aviso ni segundo mail.
    expect(await prisma.professionalNotification.count({ where: { professionalId: pro.id, type: 'new_appointment' } })).toBe(1)
    expect(mailsTo('pro-wp@test.local')).toHaveLength(1)
    const after = await request(app).get('/api/admin/activity').set('Cookie', cookieFor(admin))
    const entryAfter = after.body.logs.find((l: { id: string }) => l.id === entry.id)
    expect(entryAfter.pendingWhatsappDeposit).toBe(false)
  })

  it('con Mercado Pago el aviso sigue esperando al pago (no se avisa al agendar)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    await linkProfessionalService(pro.id, svc.id)

    const res = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '11:00', termsAccepted: true })
    expect(res.status).toBe(201)
    expect(await prisma.professionalNotification.count({ where: { professionalId: pro.id } })).toBe(0)
  })
})

describe('cuando el personal cambia un turno, la clienta recibe un aviso para mostrar al entrar', () => {
  it('cancelación del personal: aviso en la app y mail', async () => {
    const client = await createClientUser({ email: 'clienta-aviso@test.local' })
    const pro    = await createProfessionalUser()
    const svc    = await createService({ name: 'Manicura' })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000, paymentStatus: 'partial',
    })

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro))
      .send({ status: 'cancelled', cancelledBy: 'studio' })
    expect(res.status).toBe(200)

    const notifs = await prisma.clientNotification.findMany({ where: { clientId: client.id } })
    expect(notifs.map(n => n.type)).toEqual(['appointment_cancelled'])
    expect(notifs[0].read).toBe(false)
    expect(notifs[0].body).toContain('Manicura')
    expect(mailsTo('clienta-aviso@test.local')).toHaveLength(1)

    // La clienta lo ve en su bandeja.
    const mine = await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))
    expect(mine.body.notifications.map((n: { type: string }) => n.type)).toContain('appointment_cancelled')
  })

  it('cuando cancela la propia clienta no se le manda aviso ni mail', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00' })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(200)
    expect(await prisma.clientNotification.count({ where: { clientId: client.id } })).toBe(0)
  })

  it('reprogramación del personal: aviso en la app', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00' })

    const res = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin))
      .send({ date: tomorrowStr(2), time: '15:00' })
    expect(res.status).toBe(200)
    const notifs = await prisma.clientNotification.findMany({ where: { clientId: client.id } })
    expect(notifs.map(n => n.type)).toEqual(['appointment_rescheduled'])
  })

  it('cambio de profesional en un combo: aviso en la app y mail a la clienta, con los nombres escapados', async () => {
    const client = await createClientUser({ email: 'clienta-combo@test.local' })
    const pro1   = await createProfessionalUser({ name: 'Pro Uno' })
    const pro2   = await createProfessionalUser({ name: 'Pro Dos' })
    const pro3   = await createProfessionalUser({ name: 'Pro <b>Tres</b>', email: 'pro3-combo@test.local' })
    const admin  = await createAdminUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    for (const p of [pro1, pro2, pro3]) { await linkProfessionalService(p.id, svc1.id); await linkProfessionalService(p.id, svc2.id) }
    const date = tomorrowStr(); const groupId = randomUUID()
    await createAppointmentDirect({ clientId: client.id, professionalId: pro1.id, serviceId: svc1.id, date, time: '10:00', depositAmount: 5000, paymentStatus: 'partial', comboGroupId: groupId })
    const leg2 = await createAppointmentDirect({ clientId: client.id, professionalId: pro2.id, serviceId: svc2.id, date, time: '10:00', depositAmount: 0, comboGroupId: groupId })

    const res = await request(app).patch(`/api/admin/appointments/${leg2.id}`).set('Cookie', cookieFor(admin)).send({ professionalId: pro3.id })
    expect(res.status).toBe(200)

    const notifs = await prisma.clientNotification.findMany({ where: { clientId: client.id } })
    expect(notifs.map(n => n.type)).toEqual(['professional_changed'])
    expect(notifs[0].body).toContain('Pedicura')

    const mails = mailsTo('clienta-combo@test.local')
    expect(mails).toHaveLength(1)
    expect(mails[0][1]).toBe('Cambió la profesional de tu turno — Nexa')
    expect(String(mails[0][2])).toContain('Pro &lt;b&gt;Tres&lt;/b&gt;')
    expect(String(mails[0][2])).not.toContain('<b>Tres</b>')
  })
})

describe('vacaciones de la profesional', () => {
  it('la disponibilidad pública informa las vacaciones y si la fecha consultada cae adentro', async () => {
    const pro = await createProfessionalUser()
    await prisma.professional.update({
      where: { userId: pro.id },
      data:  { vacationFrom: new Date('2030-03-10T00:00:00.000Z'), vacationTo: new Date('2030-03-14T00:00:00.000Z') },
    })

    const inside = await request(app).get(`/api/professional/${pro.id}/availability`).query({ date: '2030-03-12' })
    expect(inside.status).toBe(200)
    expect(inside.body).toMatchObject({ vacationFrom: '2030-03-10', vacationTo: '2030-03-14', onVacation: true })

    const outside = await request(app).get(`/api/professional/${pro.id}/availability`).query({ date: '2030-03-15' })
    expect(outside.body).toMatchObject({ vacationFrom: '2030-03-10', vacationTo: '2030-03-14', onVacation: false })
  })

  it('reservar en vacaciones dice que está de vacaciones (y no «fuera de la disponibilidad»)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    await linkProfessionalService(pro.id, svc.id)
    await prisma.professional.update({
      where: { userId: pro.id },
      data:  { vacationFrom: new Date(`${tomorrowStr()}T00:00:00.000Z`), vacationTo: new Date(`${tomorrowStr(3)}T00:00:00.000Z`) },
    })

    const res = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
    expect(res.body.error).toContain('vacaciones')
  })
})

describe('registro de la clienta', () => {
  it('no manda mail de verificación y la cuenta nace verificada', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sin', lastName: 'Verificar', phone: '1155550000', email: 'sin-verificar@test.local', password: 'Password123', termsAccepted: true,
    })
    expect(res.status).toBe(201)
    expect(mailsTo('sin-verificar@test.local')).toHaveLength(0)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'sin-verificar@test.local' } })
    expect(user.emailVerified).toBe(true)
    expect(user.verificationToken).toBeNull()
  })
})

describe('combo: precio de lista de cada servicio', () => {
  it('los servicios simultáneos que ve el administrador traen el precio de lista, no el repartido', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc1   = await createService({ name: 'Capping', price: 22000 })
    const svc2   = await createService({ name: 'Extensiones', price: 24000 })
    const date = tomorrowStr(); const groupId = randomUUID()
    const leg1 = await createAppointmentDirect({ clientId: client.id, professionalId: pro1.id, serviceId: svc1.id, date, time: '10:00', depositAmount: 5000, paymentStatus: 'partial', servicePrice: 20087, comboGroupId: groupId })
    await createAppointmentDirect({ clientId: client.id, professionalId: pro2.id, serviceId: svc2.id, date, time: '10:00', depositAmount: 0, servicePrice: 21913, comboGroupId: groupId })

    const res = await request(app).get('/api/admin/appointments').set('Cookie', cookieFor(admin))
    const first = res.body.appointments.find((a: { id: string }) => a.id === leg1.id)
    expect(first.serviceListPrice).toBe(22000)
    expect(first.servicePrice).toBe(20087)
    expect(first.simultaneousWith[0].price).toBe(24000)
  })
})

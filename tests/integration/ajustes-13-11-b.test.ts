import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
  linkProfessionalService, tomorrowStr, todayStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

const dashboard = async (admin: { id: string; email: string; role: string }, period: 'day' | 'week' | 'month') =>
  (await request(app).get('/api/admin/dashboard').query({ period }).set('Cookie', cookieFor(admin))).body.dashboard

describe('tablero: ingresos por señas confirmadas, por el día del pago', () => {
  it('una seña pagada hoy por un turno de otro día suma en «Hoy»', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(10), time: '10:00',
      depositAmount: 5000, paymentStatus: 'pending', depositMethod: 'whatsapp',
    })

    expect((await dashboard(admin, 'day')).depositRevenueTotal).toBe(0)

    const paid = await request(app).patch(`/api/admin/appointments/${appt.id}/deposit-paid`).set('Cookie', cookieFor(admin))
    expect(paid.status).toBe(200)
    const fresh = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(fresh.depositPaidAt).not.toBeNull()

    expect((await dashboard(admin, 'day')).depositRevenueTotal).toBe(5000)
    expect((await dashboard(admin, 'month')).depositRevenueTotal).toBeGreaterThanOrEqual(5000)
  })

  it('una seña con fecha de pago de otro día no suma hoy aunque el turno sea hoy', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      depositAmount: 5000, paymentStatus: 'partial',
    })
    await prisma.appointment.update({ where: { id: appt.id }, data: { depositPaidAt: new Date(Date.now() - 5 * 86_400_000) } })

    expect((await dashboard(admin, 'day')).depositRevenueTotal).toBe(0)
  })

  it('sin fecha de pago (turnos anteriores a la columna) se sigue contando por la fecha del turno', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      depositAmount: 5000, paymentStatus: 'partial',
    })

    expect((await dashboard(admin, 'day')).depositRevenueTotal).toBe(5000)
  })

  it('al aprobarse el pago de Mercado Pago de un turno se guarda cuándo se confirmó la seña', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    await linkProfessionalService(pro.id, svc.id)
    const appt = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00', depositAmount: 5000,
    })

    const { appointmentService } = await import('../../src/modules/appointments/appointment.service')
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 5000, currency: 'ARS' })

    const fresh = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(fresh.paymentStatus).toBe('partial')
    expect(fresh.depositPaidAt).not.toBeNull()
  })
})

describe('invitación de profesional: vence siempre a los 7 días', () => {
  it('ignora una fecha de vencimiento que mande el cliente', async () => {
    const admin = await createAdminUser()
    const farAway = new Date(Date.now() + 90 * 86_400_000).toISOString()

    const res = await request(app).post('/api/invitations').set('Cookie', cookieFor(admin))
      .send({ email: 'nueva-profesional@test.local', expiresAt: farAway })

    expect(res.status).toBe(201)
    const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })
})

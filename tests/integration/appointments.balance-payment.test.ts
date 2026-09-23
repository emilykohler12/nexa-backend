import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, todayStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Lo completa el admin, no la profesional — es quien concilia el efectivo/
// tarjeta recibido en el local, la información no la reporta sola cada
// profesional. La ruta de profesional para esto ni siquiera existe.
describe('cobro del saldo en el local (solo admin)', () => {
  it('el admin registra el cobro en efectivo y queda el detalle completo', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser({ name: 'Admin Test' })
    const svc    = await createService({ price: 10000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'partial', depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'cash', amount: 5000 })

    expect(res.status).toBe(200)
    expect(res.body.appointment.balancePayment).toMatchObject({
      method: 'cash', amount: 5000, collectedByName: 'Admin Test',
    })
  })

  it('al cubrir el precio total, paymentStatus pasa a "paid"', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 10000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'partial', depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'transfer', amount: 5000 })

    expect(res.body.appointment.paymentStatus).toBe('paid')

    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(fresh?.paymentStatus).toBe('paid')
    expect(fresh?.balancePaymentMethod).toBe('transfer')
    expect(Number(fresh?.balancePaidAmount)).toBe(5000)
    expect(fresh?.balanceCollectedById).toBe(admin.id)
  })

  it('un turno sin seña (walk-in) también puede cerrar su cobro completo', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 8000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'pending', depositAmount: 0,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'card', amount: 8000 })

    expect(res.body.appointment.paymentStatus).toBe('paid')
  })

  it('un cobro parcial (menor al precio total) mantiene el turno en "partial"', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 10000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'partial', depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'cash', amount: 2000 })

    expect(res.body.appointment.paymentStatus).toBe('partial')
  })

  it('deja constancia en el log de actividad', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser({ name: 'Quien Cobra' })
    const svc    = await createService({ price: 10000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'partial', depositAmount: 5000,
    })

    await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'cash', amount: 5000 })

    const logs = await prisma.activityLog.findMany({ where: { module: 'payments' } })
    const entry = logs.find(l => l.action === 'Cobro de saldo registrado')
    expect(entry).toBeDefined()
    expect(entry!.userName).toBe('Quien Cobra')
    expect(entry!.detail).toContain('efectivo')
  })

  it('rechaza un monto negativo o cero', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'cash', amount: 0 })

    expect(res.status).toBe(400)
  })

  it('rechaza un método de pago inválido', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'bitcoin', amount: 5000 })

    expect(res.status).toBe(400)
  })

  it('rechaza registrar un cobro sobre un turno cancelado', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00', status: 'cancelled',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(admin))
      .send({ method: 'cash', amount: 5000 })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS')
  })

  it('una profesional no puede registrar cobros — la ruta es admin-only', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(pro))
      .send({ method: 'cash', amount: 5000 })

    expect(res.status).toBe(403)
  })

  it('ya no existe ninguna ruta de profesional para registrar cobros', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}/balance-payment`)
      .set('Cookie', cookieFor(pro))
      .send({ method: 'cash', amount: 5000 })

    expect(res.status).toBe(404)
  })
})

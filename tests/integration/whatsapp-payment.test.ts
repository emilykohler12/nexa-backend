import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, linkProfessionalService, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('seña de turno coordinada por WhatsApp (en vez de Mercado Pago)', () => {
  it('el cliente reserva y el turno queda guardado con depositMethod whatsapp, sin pasar por Mercado Pago', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    await linkProfessionalService(pro.id, svc.id)

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({
        serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00',
        termsAccepted: true, depositMethod: 'whatsapp',
      })

    expect(res.status).toBe(201)
    const appt = await prisma.appointment.findUnique({ where: { id: res.body.appointment.id } })
    expect(appt?.depositMethod).toBe('whatsapp')
    expect(appt?.paymentStatus).toBe('pending')
    expect(appt?.status).toBe('confirmed')
  })

  it('pedir el checkout de Mercado Pago para una seña coordinada por WhatsApp falla', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000, depositMethod: 'whatsapp',
    })

    const res = await request(app)
      .post(`/api/client/appointments/${appt.id}/payment`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('WHATSAPP_DEPOSIT')
  })

  it('el admin marca la seña como paga y el turno pasa a partial (y notifica a la profesional)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000, depositMethod: 'whatsapp',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/deposit-paid`)
      .set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.appointment.paymentStatus).toBe('partial')

    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(fresh?.paymentStatus).toBe('partial')

    const notif = await prisma.professionalNotification.findMany({ where: { professionalId: pro.id } })
    expect(notif.length).toBeGreaterThan(0)
  })

  it('es idempotente — marcarla paga dos veces no falla ni duplica notificaciones', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000, depositMethod: 'whatsapp',
    })

    await request(app).patch(`/api/admin/appointments/${appt.id}/deposit-paid`).set('Cookie', cookieFor(admin))
    const second = await request(app).patch(`/api/admin/appointments/${appt.id}/deposit-paid`).set('Cookie', cookieFor(admin))

    expect(second.status).toBe(200)
    const notif = await prisma.professionalNotification.findMany({ where: { professionalId: pro.id } })
    expect(notif).toHaveLength(1)
  })

  it('rechaza marcar como paga una seña que en realidad es de Mercado Pago', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/deposit-paid`)
      .set('Cookie', cookieFor(admin))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_WHATSAPP_DEPOSIT')
  })

  it('en un combo, marcar la seña de UNA pata como paga confirma TODAS las patas', async () => {
    const client  = await createClientUser()
    const pro1    = await createProfessionalUser()
    const pro2    = await createProfessionalUser()
    const admin   = await createAdminUser()
    const svc     = await createService()
    const groupId = randomUUID()

    const leg1 = await createAppointmentDirect({
      clientId: client.id, professionalId: pro1.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 5000, depositMethod: 'whatsapp', comboGroupId: groupId,
    })
    const leg2 = await createAppointmentDirect({
      clientId: client.id, professionalId: pro2.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
      depositAmount: 0, comboGroupId: groupId,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${leg2.id}/deposit-paid`)
      .set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    const [fresh1, fresh2] = await Promise.all([
      prisma.appointment.findUnique({ where: { id: leg1.id } }),
      prisma.appointment.findUnique({ where: { id: leg2.id } }),
    ])
    expect(fresh1?.paymentStatus).toBe('partial')
    expect(fresh2?.paymentStatus).toBe('partial')
  })
})

describe('pago de un pedido de tienda coordinado por WhatsApp', () => {
  async function createProduct(overrides: Partial<{ price: number; stock: number }> = {}) {
    return prisma.product.create({
      data: { name: 'Esmalte Test', price: overrides.price ?? 5000, stock: overrides.stock ?? 10, status: 'active' },
    })
  }

  it('el cliente hace el pedido con paymentMethod whatsapp y queda pendiente sin descontar stock', async () => {
    const client  = await createClientUser()
    const product = await createProduct({ stock: 10 })

    const res = await request(app)
      .post('/api/client/orders')
      .set('Cookie', cookieFor(client))
      .send({
        items: [{ productId: product.id, quantity: 2 }],
        delivery: { type: 'pickup' },
        paymentMethod: 'whatsapp',
      })

    expect(res.status).toBe(201)
    expect(res.body.order.paymentMethod).toBe('whatsapp')
    expect(res.body.order.paymentStatus).toBe('pending')

    const freshProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(freshProduct?.stock).toBe(10)
  })

  it('el admin lo marca pago, descuenta stock y queda idempotente', async () => {
    const client  = await createClientUser()
    const admin   = await createAdminUser()
    const product = await createProduct({ stock: 10 })

    const created = await request(app)
      .post('/api/client/orders')
      .set('Cookie', cookieFor(client))
      .send({ items: [{ productId: product.id, quantity: 3 }], delivery: { type: 'pickup' }, paymentMethod: 'whatsapp' })
    const orderId = created.body.order.id

    const res = await request(app)
      .patch(`/api/admin/orders/${orderId}`)
      .set('Cookie', cookieFor(admin))
      .send({ paymentStatus: 'paid' })

    expect(res.status).toBe(200)
    expect(res.body.paymentStatus).toBe('paid')

    const freshProduct = await prisma.product.findUnique({ where: { id: product.id } })
    expect(freshProduct?.stock).toBe(7)

    // Segunda vez: no vuelve a descontar stock.
    await request(app).patch(`/api/admin/orders/${orderId}`).set('Cookie', cookieFor(admin)).send({ paymentStatus: 'paid' })
    const freshProduct2 = await prisma.product.findUnique({ where: { id: product.id } })
    expect(freshProduct2?.stock).toBe(7)
  })

  it('rechaza marcar como pago un pedido que en realidad es de Mercado Pago', async () => {
    const client  = await createClientUser()
    const admin   = await createAdminUser()
    const product = await createProduct()

    const created = await request(app)
      .post('/api/client/orders')
      .set('Cookie', cookieFor(client))
      .send({ items: [{ productId: product.id, quantity: 1 }], delivery: { type: 'pickup' }, paymentMethod: 'mercadopago' })

    const res = await request(app)
      .patch(`/api/admin/orders/${created.body.order.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ paymentStatus: 'paid' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_WHATSAPP_PAYMENT')
  })

  it('el admin puede listar los pedidos', async () => {
    const client  = await createClientUser()
    const admin   = await createAdminUser()
    const product = await createProduct()

    await request(app)
      .post('/api/client/orders')
      .set('Cookie', cookieFor(client))
      .send({ items: [{ productId: product.id, quantity: 1 }], delivery: { type: 'pickup' }, paymentMethod: 'whatsapp' })

    const res = await request(app).get('/api/admin/orders').set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    expect(res.body.orders.length).toBeGreaterThan(0)
  })
})

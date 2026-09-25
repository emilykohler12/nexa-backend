import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createPromotion,
  linkProfessionalService, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('reserva de turnos', () => {
  it('crea un turno confirmado con el precio de catálogo del servicio', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 12000 })

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(201)
    expect(res.body.appointment.status).toBe('confirmed')
    expect(res.body.appointment.price).toBe(12000)
    expect(res.body.appointment.paymentStatus).toBe('pending')
  })

  it('rechaza reservar un servicio inactivo', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ status: 'inactive' })

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(400)
  })

  it('rechaza reservar con una profesional inactiva', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser({ active: false })
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(400)
  })

  it('rechaza reservar sin aceptar términos', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: false })

    expect(res.status).toBe(400)
  })

  it('rechaza reservar el mismo horario dos veces con la misma profesional (slot conflict)', async () => {
    const client1 = await createClientUser()
    const client2 = await createClientUser()
    const pro     = await createProfessionalUser()
    const svc     = await createService()
    const date    = tomorrowStr()

    const first = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client1))
      .send({ serviceId: svc.id, professionalId: pro.id, date, time: '11:00', termsAccepted: true })
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client2))
      .send({ serviceId: svc.id, professionalId: pro.id, date, time: '11:00', termsAccepted: true })
    expect(second.status).toBe(409)
    expect(second.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('permite la misma hora con OTRA profesional (el conflicto es por profesional, no global)', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const svc    = await createService()
    const date   = tomorrowStr()

    const first = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro1.id, date, time: '11:00', termsAccepted: true })
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro2.id, date, time: '11:00', termsAccepted: true })
    expect(second.status).toBe(201)
  })

  it('con profesional "any" asigna a quien tiene menos turnos activos', async () => {
    const client = await createClientUser()
    const busy    = await createProfessionalUser({ name: 'Ocupada' })
    const free    = await createProfessionalUser({ name: 'Libre' })
    const svc     = await createService()
    await linkProfessionalService(busy.id, svc.id)
    await linkProfessionalService(free.id, svc.id)

    // La "ocupada" ya tiene 2 turnos activos con otra clienta.
    const other = await createClientUser()
    for (const time of ['09:00', '10:00']) {
      const r = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(other))
        .send({ serviceId: svc.id, professionalId: busy.id, date: tomorrowStr(), time, termsAccepted: true })
      expect(r.status).toBe(201)
    }

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: 'any', date: tomorrowStr(2), time: '12:00', termsAccepted: true })

    expect(res.status).toBe(201)
    expect(res.body.appointment.professionalId).toBe(free.id)
  })

  it('preferred-professional muestra a quien menos carga tiene, sin necesitar login', async () => {
    const busy = await createProfessionalUser({ name: 'Ocupada' })
    const free = await createProfessionalUser({ name: 'Libre' })
    const svc  = await createService()
    await linkProfessionalService(busy.id, svc.id)
    await linkProfessionalService(free.id, svc.id)

    const other = await createClientUser()
    await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(other))
      .send({ serviceId: svc.id, professionalId: busy.id, date: tomorrowStr(), time: '09:00', termsAccepted: true })

    const res = await request(app).get(`/api/services/${svc.id}/preferred-professional`)
    expect(res.status).toBe(200)
    expect(res.body.professionalId).toBe(free.id)
    expect(res.body.professionalName).toBe('Libre')
  })

  it('rechaza reservar si la clienta está bloqueada', async () => {
    const client = await createClientUser({ blocked: true })
    const pro    = await createProfessionalUser()
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(403)
  })

  describe('promociones', () => {
    it('aplica el precio de la promoción, no el de catálogo (el bug real que se arregló)', async () => {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const svc    = await createService({ price: 10000 })
      const promo  = await createPromotion({
        price: 6000, items: [{ id: svc.id, name: svc.name, price: 6000 }],
      })

      const res = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(client))
        .send({
          serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00',
          termsAccepted: true, promotionId: promo.id,
        })

      expect(res.status).toBe(201)
      expect(res.body.appointment.price).toBe(6000)

      const stored = await prisma.appointment.findUnique({ where: { id: res.body.appointment.id } })
      expect(stored?.promotionId).toBe(promo.id)
      expect(Number(stored?.servicePrice)).toBe(6000)
    })

    it('nunca confía en un precio mandado por el cliente — ignora cualquier price/deposit del body', async () => {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const svc    = await createService({ price: 10000 })

      const res = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(client))
        .send({
          serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00',
          termsAccepted: true, price: 1, depositAmount: 1,
        } as any)

      expect(res.status).toBe(201)
      expect(res.body.appointment.price).toBe(10000)
    })

    it('rechaza una promoción vencida', async () => {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const svc    = await createService({ price: 10000 })
      const promo  = await createPromotion({
        price: 6000, items: [{ id: svc.id, name: svc.name, price: 6000 }],
        endDate: '2020-01-01',
      })

      const res = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(client))
        .send({
          serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00',
          termsAccepted: true, promotionId: promo.id,
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('PROMOTION_NOT_AVAILABLE')
    })

    it('rechaza una promoción que no corresponde a ese servicio', async () => {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const svc    = await createService({ price: 10000 })
      const otroSvc = await createService({ name: 'Otro servicio' })
      const promo  = await createPromotion({
        price: 6000, items: [{ id: otroSvc.id, name: otroSvc.name, price: 6000 }],
      })

      const res = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(client))
        .send({
          serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00',
          termsAccepted: true, promotionId: promo.id,
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('PROMOTION_MISMATCH')
    })
  })
})

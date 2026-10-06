import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createPromotion,
  linkProfessionalService, tomorrowStr, setAvailability, futureWeekDay, createAppointmentDirect,
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

  // RF-02 — "pendiente de seña": el estado sigue siendo 'confirmed' (bloquea el
  // horario), pero la API expone la etiqueta derivada mientras la seña no se pagó.
  it('un turno con seña sin pagar se expone como pending_deposit; sin seña, como confirmed', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 12000 })
    await prisma.paymentSettings.deleteMany()
    await prisma.paymentSettings.create({ data: { depositAmount: 2000, depositPercent: false } })

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '11:00', termsAccepted: true })
    expect(res.status).toBe(201)
    expect(res.body.appointment.status).toBe('confirmed')
    expect(res.body.appointment.displayStatus).toBe('pending_deposit')

    await prisma.paymentSettings.updateMany({ data: { depositAmount: 0 } })
    const free = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '12:00', termsAccepted: true })
    expect(free.status).toBe(201)
    expect(free.body.appointment.displayStatus).toBe('confirmed')
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

  // R-04 (RF-06) — asignación automática con "any".
  describe('asignación automática (R-04)', () => {
    async function twoPros(svcOverrides: Parameters<typeof createService>[0] = {}) {
      const a   = await createProfessionalUser({ name: 'Antigua' })
      const b   = await createProfessionalUser({ name: 'Nueva' })
      const svc = await createService(svcOverrides)
      await linkProfessionalService(a.id, svc.id)
      await linkProfessionalService(b.id, svc.id)
      await setAvailability(a.id)
      await setAvailability(b.id)
      // Antigüedad explícita: "Antigua" entró antes que "Nueva".
      await prisma.professional.update({ where: { userId: a.id }, data: { createdAt: new Date('2025-01-01T00:00:00Z') } })
      await prisma.professional.update({ where: { userId: b.id }, data: { createdAt: new Date('2026-01-01T00:00:00Z') } })
      return { a, b, svc }
    }

    async function bookAny(serviceId: string, date: string, time: string) {
      const client = await createClientUser()
      return request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(client))
        .send({ serviceId, professionalId: 'any', date, time, termsAccepted: true })
    }

    it('elige a la de menor carga de esa semana', async () => {
      const { a, b, svc } = await twoPros()
      const other = await createClientUser()
      // "Antigua" tiene 2 turnos esa semana; "Nueva", ninguno.
      for (const time of ['09:00', '10:00']) {
        await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(1), time })
      }

      const res = await bookAny(svc.id, futureWeekDay(2), '12:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(b.id)
    })

    it('la carga es solo de la semana pedida (lunes a domingo), no de toda la historia', async () => {
      const { a, b, svc } = await twoPros()
      const other = await createClientUser()
      // "Antigua" tiene 3 turnos la semana ANTERIOR (no cuentan); "Nueva", 1 en la semana pedida.
      for (const time of ['09:00', '10:00', '11:00']) {
        await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(-1), time })
      }
      await createAppointmentDirect({ clientId: other.id, professionalId: b.id, serviceId: svc.id, date: futureWeekDay(6), time: '09:00' })

      const res = await bookAny(svc.id, futureWeekDay(0), '12:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(a.id)
    })

    it('los turnos cancelados y no_show no suman carga', async () => {
      const { a, svc } = await twoPros()
      const other = await createClientUser()
      await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(1), time: '09:00', status: 'cancelled' })
      await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(1), time: '10:00', status: 'no_show' })

      // Empate en 0 → gana la de mayor antigüedad.
      const res = await bookAny(svc.id, futureWeekDay(2), '12:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(a.id)
    })

    it('a igual carga desempata por antigüedad (Professional.createdAt ascendente)', async () => {
      const { a, svc } = await twoPros()
      const res = await bookAny(svc.id, futureWeekDay(2), '12:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(a.id)
    })

    it('descarta a quien no tiene disponibilidad ese día y hora', async () => {
      const { a, b, svc } = await twoPros()
      // "Antigua" solo trabaja martes (1) de 14 a 18.
      await setAvailability(a.id, [{ dayOfWeek: 1, startTime: '14:00', endTime: '18:00' }])

      const res = await bookAny(svc.id, futureWeekDay(1), '10:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(b.id)
    })

    it('descarta a quien ya tiene un turno activo a esa hora de inicio', async () => {
      const { a, b, svc } = await twoPros()
      const other = await createClientUser()
      await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(3), time: '12:00' })
      await createAppointmentDirect({ clientId: other.id, professionalId: b.id, serviceId: svc.id, date: futureWeekDay(3), time: '09:00' })
      await createAppointmentDirect({ clientId: other.id, professionalId: b.id, serviceId: svc.id, date: futureWeekDay(3), time: '10:00' })

      // "Nueva" tiene más carga, pero "Antigua" está ocupada justo a las 12:00.
      const res = await bookAny(svc.id, futureWeekDay(3), '12:00')
      expect(res.status).toBe(201)
      expect(res.body.appointment.professionalId).toBe(b.id)
    })

    it('si ninguna está libre a esa hora responde 409 con un error claro', async () => {
      const { a, b, svc } = await twoPros()
      const other = await createClientUser()
      for (const pro of [a, b]) {
        await createAppointmentDirect({ clientId: other.id, professionalId: pro.id, serviceId: svc.id, date: futureWeekDay(4), time: '12:00' })
      }

      const res = await bookAny(svc.id, futureWeekDay(4), '12:00')
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('NO_PROFESSIONAL_FREE')
    })

    it('preferred-professional aplica el mismo criterio para el día y hora elegidos, sin login', async () => {
      const { a, b, svc } = await twoPros()
      const other = await createClientUser()
      await createAppointmentDirect({ clientId: other.id, professionalId: a.id, serviceId: svc.id, date: futureWeekDay(1), time: '09:00' })

      const res = await request(app)
        .get(`/api/services/${svc.id}/preferred-professional`)
        .query({ date: futureWeekDay(2), time: '12:00' })
      expect(res.status).toBe(200)
      expect(res.body.professionalId).toBe(b.id)
      expect(res.body.professionalName).toBe('Nueva')
    })

    it('preferred-professional exige día y hora', async () => {
      const { svc } = await twoPros()
      const res = await request(app).get(`/api/services/${svc.id}/preferred-professional`)
      expect(res.status).toBe(400)
    })
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

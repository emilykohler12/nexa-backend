import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createAdminUser, createService, createPromotion } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-20: alta, edición y baja de promociones, GET /promotions/public y promociones aplicadas en pedidos.
// RF-23: alta, edición y baja de eventos especiales y su listado público.
// "Hoy" se fija en hora de Argentina para que las vigencias no dependan del día en que corre la suite.

type U = { id: string; email: string; role: string }
const TODAY = '2026-11-03'

afterEach(() => { vi.useRealTimers() })

function setToday() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00-03:00`))
}

const promoBody = (items: { id: string; name: string; price: number }[], over: object = {}) => ({
  type: 'product', kind: 'discount', title: 'Shampoo a mitad de precio', description: 'Solo esta semana',
  image: null, price: 2500, originalPrice: 5000, status: 'active', items,
  buyQty: null, payQty: null, startDate: null, endDate: null,
  ...over,
})

async function shampoo(stock = 10) {
  return prisma.product.create({ data: { name: 'Shampoo de prueba', price: 5000, stock } })
}

describe('RF-20: promociones', () => {
  it('el administrador da de alta, edita y da de baja una promoción', async () => {
    setToday()
    const admin   = await createAdminUser()
    const product = await shampoo()
    const items   = [{ id: product.id, name: product.name, price: 5000 }]

    const created = await request(app).post('/api/admin/promotions').set('Cookie', cookieFor(admin)).send(promoBody(items))
    expect(created.status).toBe(201)
    expect(created.body.promotion).toMatchObject({ title: 'Shampoo a mitad de precio', price: 2500, originalPrice: 5000, status: 'active' })

    const id = created.body.promotion.id
    const edited = await request(app).put(`/api/admin/promotions/${id}`).set('Cookie', cookieFor(admin))
      .send(promoBody(items, { title: 'Shampoo al 60 %', price: 3000, status: 'inactive' }))
    expect(edited.status).toBe(200)
    expect(edited.body.promotion).toMatchObject({ title: 'Shampoo al 60 %', price: 3000, status: 'inactive' })

    const removed = await request(app).delete(`/api/admin/promotions/${id}`).set('Cookie', cookieFor(admin))
    expect(removed.status).toBe(200)
    expect(await prisma.promotion.count()).toBe(0)
  })

  it('el alta valida el cuerpo: sin ítems, combo con un solo ítem, precio negativo', async () => {
    const admin   = await createAdminUser()
    const product = await shampoo()
    const items   = [{ id: product.id, name: product.name, price: 5000 }]

    for (const body of [promoBody([]), promoBody(items, { kind: 'bundle' }), promoBody(items, { price: -1 }), promoBody(items, { kind: 'buy_x_pay_y' })]) {
      const res = await request(app).post('/api/admin/promotions').set('Cookie', cookieFor(admin)).send(body)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect(await prisma.promotion.count()).toBe(0)
  })

  it('la gestión de promociones es solo del administrador', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const promo  = await createPromotion()

    for (const user of [client, pro]) {
      expect((await request(app).get('/api/admin/promotions').set('Cookie', cookieFor(user))).status).toBe(403)
      expect((await request(app).delete(`/api/admin/promotions/${promo.id}`).set('Cookie', cookieFor(user))).status).toBe(403)
    }
    expect(await prisma.promotion.count()).toBe(1)
  })

  it('GET /promotions/public lista solo las activas y vigentes hoy, sin sesión', async () => {
    setToday()
    await createPromotion({ title: 'Vigente sin fechas' })
    await createPromotion({ title: 'Vigente con fechas', startDate: '2026-11-01', endDate: '2026-11-03' })
    await createPromotion({ title: 'Inactiva', status: 'inactive' })
    await createPromotion({ title: 'Vencida', endDate: '2026-11-02' })
    await createPromotion({ title: 'Futura', startDate: '2026-11-04' })

    const res = await request(app).get('/api/promotions/public')

    expect(res.status).toBe(200)
    expect(res.body.promotions.map((p: { title: string }) => p.title).sort()).toEqual(['Vigente con fechas', 'Vigente sin fechas'])
  })

  describe('promociones en pedidos', () => {
    const order = (client: U, items: object[]) =>
      request(app).post('/api/client/orders').set('Cookie', cookieFor(client)).send({ items, delivery: { type: 'pickup' } })

    it('el pedido cobra el precio de la promoción, no el de lista ni el que mande el navegador', async () => {
      setToday()
      const client  = await createClientUser()
      const product = await shampoo()
      const promo   = await createPromotion({ price: 2500, items: [{ id: product.id, name: product.name, price: 5000 }] })
      await prisma.promotion.update({ where: { id: promo.id }, data: { type: 'product' } })

      const res = await order(client, [{ productId: product.id, quantity: 2, promotionId: promo.id, unitPrice: 1 }])

      expect(res.status).toBe(201)
      expect(res.body.order.items[0]).toMatchObject({ unitPrice: 2500, quantity: 2, totalPrice: 5000 })
      expect(Number((await prisma.order.findFirstOrThrow()).totalPrice)).toBe(5000)
    })

    it('una promoción inactiva o vencida se rechaza con PROMOTION_NOT_AVAILABLE', async () => {
      setToday()
      const client  = await createClientUser()
      const product = await shampoo()
      const items   = [{ id: product.id, name: product.name, price: 5000 }]
      const inactive = await createPromotion({ status: 'inactive', items })
      const expired  = await createPromotion({ endDate: '2026-11-02', items })

      for (const promo of [inactive, expired]) {
        const res = await order(client, [{ productId: product.id, quantity: 1, promotionId: promo.id }])
        expect(res.status).toBe(400)
        expect(res.body.code).toBe('PROMOTION_NOT_AVAILABLE')
      }
      expect(await prisma.order.count()).toBe(0)
    })

    it('un producto que no es el de la promoción se rechaza con PROMOTION_MISMATCH', async () => {
      setToday()
      const client  = await createClientUser()
      const product = await shampoo()
      const other   = await prisma.product.create({ data: { name: 'Acondicionador de prueba', price: 6000, stock: 5 } })
      const promo   = await createPromotion({ items: [{ id: product.id, name: product.name, price: 5000 }] })

      const res = await order(client, [{ productId: other.id, quantity: 1, promotionId: promo.id }])

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('PROMOTION_MISMATCH')
    })
  })
})

describe('RF-23: eventos especiales', () => {
  const eventBody = (serviceId: string, professionalId: string, over: object = {}) => ({
    serviceId, professionalId, date: '2026-11-20', title: 'Jornada de depilación', description: 'Cupos limitados', active: true, ...over,
  })

  it('el administrador da de alta, edita y da de baja un evento especial', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser({ name: 'Profesional Evento' })
    const svc   = await createService({ name: 'Depilación definitiva' })

    const created = await request(app).post('/api/admin/special-events').set('Cookie', cookieFor(admin)).send(eventBody(svc.id, pro.id))
    expect(created.status).toBe(201)
    expect(created.body.specialEvent).toMatchObject({
      date: '2026-11-20', title: 'Jornada de depilación', active: true,
      service: { id: svc.id, name: 'Depilación definitiva' }, professional: { id: pro.id, name: 'Profesional Evento' },
    })

    const id = created.body.specialEvent.id
    const edited = await request(app).put(`/api/admin/special-events/${id}`).set('Cookie', cookieFor(admin))
      .send(eventBody(svc.id, pro.id, { date: '2026-11-27', title: 'Jornada reprogramada', active: false }))
    expect(edited.status).toBe(200)
    expect(edited.body.specialEvent).toMatchObject({ date: '2026-11-27', title: 'Jornada reprogramada', active: false })

    const toggled = await request(app).put(`/api/admin/special-events/${id}`).set('Cookie', cookieFor(admin)).send({ active: true })
    expect(toggled.body.specialEvent).toMatchObject({ active: true, title: 'Jornada reprogramada' })

    const removed = await request(app).delete(`/api/admin/special-events/${id}`).set('Cookie', cookieFor(admin))
    expect(removed.status).toBe(200)
    expect(await prisma.specialEvent.count()).toBe(0)
  })

  it('el alta valida el servicio, la profesional y la fecha', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()

    for (const over of [{ serviceId: 'x' }, { professionalId: 'x' }, { date: '20/11/2026' }]) {
      const res = await request(app).post('/api/admin/special-events').set('Cookie', cookieFor(admin)).send(eventBody(svc.id, pro.id, over))
      expect(res.status, JSON.stringify(over)).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
  })

  it('el listado público muestra solo los activos desde hoy, ordenados por fecha; la gestión es del administrador', async () => {
    setToday()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const base   = { serviceId: svc.id, professionalId: pro.id }
    await prisma.specialEvent.createMany({
      data: [
        { ...base, date: '2026-11-10', title: 'Más adelante' },
        { ...base, date: TODAY, title: 'Hoy' },
        { ...base, date: '2026-11-02', title: 'Ayer' },
        { ...base, date: '2026-11-15', title: 'Inactivo', active: false },
      ],
    })

    const res = await request(app).get('/api/special-events/public')

    expect(res.status).toBe(200)
    expect(res.body.specialEvents.map((e: { title: string }) => e.title)).toEqual(['Hoy', 'Más adelante'])
    expect((await request(app).post('/api/admin/special-events').set('Cookie', cookieFor(client)).send(eventBody(svc.id, pro.id))).status).toBe(403)
  })
})

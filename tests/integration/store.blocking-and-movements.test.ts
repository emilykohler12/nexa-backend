import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createAdminUser, createService } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-18: una clienta bloqueada no puede comprar ni reservar; el administrador la bloquea y la desbloquea.
// RF-21: libro de inventario: entradas, salidas, salida que dejaría el stock negativo, edición y borrado.

type U = { id: string; email: string; role: string }

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock

async function product(stock = 10) {
  return prisma.product.create({ data: { name: 'Crema de manos de prueba', price: 3000, stock } })
}

describe('RF-18: clienta bloqueada', () => {
  const setBlocked = (admin: U, clientId: string, blocked: unknown) =>
    request(app).patch(`/api/admin/clients/${clientId}/block`).set('Cookie', cookieFor(admin)).send({ blocked })
  const order = (client: U, productId: string) =>
    request(app).post('/api/client/orders').set('Cookie', cookieFor(client))
      .send({ items: [{ productId, quantity: 1 }], delivery: { type: 'pickup' } })

  it('una clienta bloqueada no puede comprar (403 CLIENT_BLOCKED) ni reservar; el stock no se toca', async () => {
    const client = await createClientUser({ blocked: true })
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const item   = await product(5)

    const buy  = await order(client, item.id)
    const book = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: '2027-03-02', time: '10:00', termsAccepted: true })

    expect(buy.status).toBe(403)
    expect(buy.body.code).toBe('CLIENT_BLOCKED')
    expect(book.status).toBe(403)
    expect(book.body.code).toBe('CLIENT_BLOCKED')
    expect(await prisma.order.count()).toBe(0)
    expect(await prisma.appointment.count()).toBe(0)
    expect(await stockOf(item.id)).toBe(5)
  })

  it('el administrador la bloquea y la desbloquea; después del desbloqueo puede comprar', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const item   = await product()

    const blocked = await setBlocked(admin, client.id, true)
    expect(blocked.status).toBe(200)
    expect(blocked.body.client.blocked).toBe(true)
    expect((await order(client, item.id)).status).toBe(403)

    const unblocked = await setBlocked(admin, client.id, false)
    expect(unblocked.body.client.blocked).toBe(false)
    expect((await order(client, item.id)).status).toBe(201)
  })

  it('el endpoint valida el cuerpo, exige una clienta y es solo del administrador', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()

    const invalid = await setBlocked(admin, client.id, 'si')
    expect(invalid.status).toBe(400)
    expect(invalid.body.code).toBe('VALIDATION_ERROR')
    expect((await setBlocked(admin, pro.id, true)).status).toBe(404)
    expect((await setBlocked(pro, client.id, true)).status).toBe(403)
    expect((await setBlocked(client, client.id, false)).status).toBe(403)
    expect((await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })).blocked).toBe(false)
  })
})

describe('RF-21: libro de inventario', () => {
  const create = (admin: U, body: object) => request(app).post('/api/store/movements').set('Cookie', cookieFor(admin)).send(body)

  it('una entrada suma stock y una salida lo resta; ambas quedan en el libro con el nombre del producto', async () => {
    const admin = await createAdminUser()
    const item  = await product(10)

    const entry = await create(admin, { productId: item.id, type: 'entry', quantity: 6, note: 'Reposición', date: '2026-11-03' })
    const exit  = await create(admin, { productId: item.id, type: 'exit', quantity: 4, note: 'Uso en el salón', date: '2026-11-04' })

    expect(entry.status).toBe(201)
    expect(entry.body.affectedProducts).toEqual([{ id: item.id, stock: 16 }])
    expect(exit.body.affectedProducts).toEqual([{ id: item.id, stock: 12 }])
    expect(await stockOf(item.id)).toBe(12)

    const list = await request(app).get('/api/store/movements').set('Cookie', cookieFor(admin))
    expect(list.body.movements).toHaveLength(2)
    expect(list.body.movements.every((m: { productName: string }) => m.productName === 'Crema de manos de prueba')).toBe(true)
  })

  it('una salida mayor al stock se rechaza (400 INSUFFICIENT_STOCK) y el stock no queda negativo', async () => {
    const admin = await createAdminUser()
    const item  = await product(3)

    const res = await create(admin, { productId: item.id, type: 'exit', quantity: 4, date: '2026-11-03' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_STOCK')
    expect(await stockOf(item.id)).toBe(3)
    expect(await prisma.inventoryMovement.count()).toBe(0)
  })

  it('valida el cuerpo: tipo, cantidad, fecha y producto', async () => {
    const admin = await createAdminUser()
    const item  = await product()

    for (const body of [
      { productId: item.id, type: 'ajuste', quantity: 1, date: '2026-11-03' },
      { productId: item.id, type: 'entry', quantity: 0, date: '2026-11-03' },
      { productId: item.id, type: 'entry', quantity: 1, date: '03/11/2026' },
      { productId: 'no-es-un-id', type: 'entry', quantity: 1, date: '2026-11-03' },
    ]) {
      const res = await create(admin, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect(await stockOf(item.id)).toBe(10)
  })

  it('editar un movimiento deshace el efecto anterior y aplica el nuevo (también al cambiar de producto)', async () => {
    const admin = await createAdminUser()
    const a     = await product(10)
    const b     = await prisma.product.create({ data: { name: 'Esmalte de prueba', price: 2000, stock: 2 } })
    const mov   = (await create(admin, { productId: a.id, type: 'entry', quantity: 5, date: '2026-11-03' })).body.movement

    const toExit = await request(app).put(`/api/store/movements/${mov.id}`).set('Cookie', cookieFor(admin)).send({ type: 'exit', quantity: 3 })
    expect(toExit.status).toBe(200)
    expect(await stockOf(a.id)).toBe(7) // 15 - 5 (se deshace la entrada) - 3 (salida)

    const tooBig = await request(app).put(`/api/store/movements/${mov.id}`).set('Cookie', cookieFor(admin)).send({ quantity: 11 })
    expect(tooBig.status).toBe(400)
    expect(tooBig.body.code).toBe('INSUFFICIENT_STOCK')
    expect(await stockOf(a.id)).toBe(7)

    const moved = await request(app).put(`/api/store/movements/${mov.id}`).set('Cookie', cookieFor(admin)).send({ productId: b.id, type: 'entry', quantity: 4 })
    expect(moved.status).toBe(200)
    expect(await stockOf(a.id)).toBe(10)
    expect(await stockOf(b.id)).toBe(6)
    expect(moved.body.movement.productName).toBe('Esmalte de prueba')
    expect(moved.body.affectedProducts).toEqual(expect.arrayContaining([{ id: a.id, stock: 10 }, { id: b.id, stock: 6 }]))
  })

  it('borrar un movimiento devuelve el stock y lo saca del libro', async () => {
    const admin = await createAdminUser()
    const item  = await product(10)
    const exit  = (await create(admin, { productId: item.id, type: 'exit', quantity: 4, date: '2026-11-03' })).body.movement

    const res = await request(app).delete(`/api/store/movements/${exit.id}`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.affectedProducts).toEqual([{ id: item.id, stock: 10 }])
    expect(await prisma.inventoryMovement.count()).toBe(0)
    expect((await request(app).delete(`/api/store/movements/${exit.id}`).set('Cookie', cookieFor(admin))).status).toBe(404)
  })

  it('el libro es solo del administrador', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const item   = await product()

    for (const user of [client, pro]) {
      expect((await request(app).get('/api/store/movements').set('Cookie', cookieFor(user))).status).toBe(403)
      expect((await create(user, { productId: item.id, type: 'entry', quantity: 1, date: '2026-11-03' })).status).toBe(403)
    }
    expect(await stockOf(item.id)).toBe(10)
  })
})

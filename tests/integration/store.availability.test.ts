import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { orderService } from '../../src/modules/orders/order.service'
import { todayArgentinaStr } from '../../src/app/utils/argentinaTime'
import { createClientUser, createAdminUser } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Tienda: la lista pública muestra solo lo que se puede comprar y no filtra datos internos
// (stock, stock mínimo); el administrador ve todo por su propia ruta; el pedido no confía en
// lo que mande el navegador; y cada venta pagada deja su salida en el libro de inventario.

const ARS = 'ARS'

function newProduct(over: Partial<{ name: string; stock: number; minStock: number; status: string; price: number }> = {}) {
  return prisma.product.create({
    data: { name: over.name ?? 'Producto Test', price: over.price ?? 1000, stock: over.stock ?? 10, minStock: over.minStock ?? 3, status: over.status ?? 'active' },
  })
}

async function placeOrder(clientUser: { id: string; email: string; role: string }, items: { productId: string; quantity: number }[]) {
  return request(app)
    .post('/api/client/orders')
    .set('Cookie', cookieFor(clientUser))
    .send({ items, delivery: { type: 'pickup' }, paymentMethod: 'mercadopago' })
}

describe('GET /api/store/products (pública)', () => {
  it('no devuelve productos inactivos, sin stock ni "sin stock" y se ve sin iniciar sesión', async () => {
    const ok       = await newProduct({ name: 'Disponible', stock: 5 })
    await newProduct({ name: 'Inactivo', stock: 5, status: 'inactive' })
    await newProduct({ name: 'Stock cero', stock: 0 })
    await newProduct({ name: 'Marcado sin stock', stock: 5, status: 'out_of_stock' })

    const res = await request(app).get('/api/store/products')

    expect(res.status).toBe(200)
    expect(res.body.products.map((p: { id: string }) => p.id)).toEqual([ok.id])
  })

  it('no expone stock ni stock mínimo, solo un indicador de disponibilidad', async () => {
    await newProduct({ stock: 5, minStock: 2 })

    const res = await request(app).get('/api/store/products')

    expect(res.body.products).toHaveLength(1)
    const p = res.body.products[0]
    expect(p).not.toHaveProperty('stock')
    expect(p).not.toHaveProperty('minStock')
    expect(p.available).toBe(true)
    expect(p).toMatchObject({ name: 'Producto Test', price: '1000' })
  })
})

describe('GET /api/admin/store/products (solo administrador)', () => {
  it('devuelve todos los productos con stock y stock mínimo', async () => {
    const admin = await createAdminUser()
    await newProduct({ name: 'Disponible', stock: 5 })
    await newProduct({ name: 'Inactivo', stock: 5, status: 'inactive' })
    await newProduct({ name: 'Stock cero', stock: 0, minStock: 4 })

    const res = await request(app).get('/api/admin/store/products').set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(3)
    const zero = res.body.products.find((p: { name: string }) => p.name === 'Stock cero')
    expect(zero).toMatchObject({ stock: 0, minStock: 4, status: 'active' })
  })

  it('una clienta recibe 403 y una visitante 401', async () => {
    const client = await createClientUser()

    const asClient = await request(app).get('/api/admin/store/products').set('Cookie', cookieFor(client))
    const anon     = await request(app).get('/api/admin/store/products')

    expect(asClient.status).toBe(403)
    expect(anon.status).toBe(401)
  })

  it('el alta, la edición y la baja de productos siguen funcionando', async () => {
    const admin = await createAdminUser()
    const cookie = cookieFor(admin)

    const created = await request(app).post('/api/store/products').set('Cookie', cookie)
      .send({ name: 'Crema nueva', price: 2500, stock: 4, minStock: 1 })
    expect(created.status).toBe(201)
    const id = created.body.product.id

    const updated = await request(app).put(`/api/store/products/${id}`).set('Cookie', cookie).send({ stock: 9 })
    expect(updated.status).toBe(200)
    expect(updated.body.product.stock).toBe(9)

    const removed = await request(app).delete(`/api/store/products/${id}`).set('Cookie', cookie)
    expect(removed.status).toBe(200)
    expect(await prisma.product.findUnique({ where: { id } })).toBeNull()
  })

  it('el alta, la edición y la baja siguen cerradas para una clienta', async () => {
    const client = await createClientUser()
    const product = await newProduct()
    const cookie = cookieFor(client)

    expect((await request(app).post('/api/store/products').set('Cookie', cookie).send({ name: 'Crema', price: 1 })).status).toBe(403)
    expect((await request(app).put(`/api/store/products/${product.id}`).set('Cookie', cookie).send({ stock: 99 })).status).toBe(403)
    expect((await request(app).delete(`/api/store/products/${product.id}`).set('Cookie', cookie)).status).toBe(403)
  })
})

describe('POST /api/client/orders: el pedido valida el producto aunque el navegador lo envíe', () => {
  it('rechaza un producto inactivo', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ status: 'inactive' })

    const res = await placeOrder(client, [{ productId: product.id, quantity: 1 }])

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    expect(await prisma.order.count()).toBe(0)
  })

  it('rechaza un producto marcado "sin stock" aunque tenga unidades', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ status: 'out_of_stock', stock: 5 })

    const res = await placeOrder(client, [{ productId: product.id, quantity: 1 }])

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('rechaza un producto con stock 0', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ stock: 0 })

    const res = await placeOrder(client, [{ productId: product.id, quantity: 1 }])

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_STOCK')
    expect(await prisma.order.count()).toBe(0)
  })

  it('rechaza una cantidad mayor al stock, también sumando varias líneas del mismo producto', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ stock: 3 })

    const tooMany = await placeOrder(client, [{ productId: product.id, quantity: 4 }])
    const split   = await placeOrder(client, [{ productId: product.id, quantity: 2 }, { productId: product.id, quantity: 2 }])

    expect(tooMany.status).toBe(400)
    expect(tooMany.body.code).toBe('INSUFFICIENT_STOCK')
    expect(split.status).toBe(400)
    expect(split.body.code).toBe('INSUFFICIENT_STOCK')
  })

  it('rechaza el pedido entero si uno solo de los productos no se puede vender', async () => {
    const client = await createClientUser()
    const ok     = await newProduct({ name: 'Bien' })
    const bad    = await newProduct({ name: 'Inactivo', status: 'inactive' })

    const res = await placeOrder(client, [{ productId: ok.id, quantity: 1 }, { productId: bad.id, quantity: 1 }])

    expect(res.status).toBe(400)
    expect(await prisma.order.count()).toBe(0)
  })

  it('un producto que no existe se rechaza', async () => {
    const client = await createClientUser()

    const res = await placeOrder(client, [{ productId: randomUUID(), quantity: 1 }])

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('un pedido válido se crea sin tocar el stock todavía', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ stock: 5, price: 1500 })

    const res = await placeOrder(client, [{ productId: product.id, quantity: 2 }])

    expect(res.status).toBe(201)
    expect(res.body.order.totalPrice).toBe(3000)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5)
    expect(await prisma.inventoryMovement.count()).toBe(0)
  })
})

describe('pago aprobado: descuenta el stock y registra la salida en el libro', () => {
  it('descuenta el stock y crea un movimiento de salida con el nombre, la cantidad y la fecha', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ name: 'Shampoo', stock: 5, price: 1000 })
    const created = await placeOrder(client, [{ productId: product.id, quantity: 2 }])
    const orderId = created.body.order.id

    await orderService.applyPaymentResult(orderId, 'mp-1', 'approved', { amount: 2000, currency: ARS })

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3)
    const movements = await prisma.inventoryMovement.findMany()
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      productId: product.id, productName: 'Shampoo', type: 'exit', quantity: 2, date: todayArgentinaStr(),
    })
    expect(movements[0].note).toContain(orderId)
  })

  it('suma las líneas de un mismo producto en un solo movimiento y crea uno por producto', async () => {
    const client = await createClientUser()
    const a = await newProduct({ name: 'A', stock: 10 })
    const b = await newProduct({ name: 'B', stock: 10 })
    const created = await placeOrder(client, [
      { productId: a.id, quantity: 1 }, { productId: a.id, quantity: 2 }, { productId: b.id, quantity: 4 },
    ])

    await orderService.applyPaymentResult(created.body.order.id, 'mp-1', 'approved', { amount: 7000, currency: ARS })

    const movements = await prisma.inventoryMovement.findMany({ orderBy: { productName: 'asc' } })
    expect(movements.map(m => [m.productName, m.quantity])).toEqual([['A', 3], ['B', 4]])
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(7)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(6)
  })

  it('el aviso repetido de Mercado Pago no descuenta ni registra de nuevo', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ stock: 5 })
    const created = await placeOrder(client, [{ productId: product.id, quantity: 2 }])
    const orderId = created.body.order.id

    await orderService.applyPaymentResult(orderId, 'mp-1', 'approved', { amount: 2000, currency: ARS })
    await orderService.applyPaymentResult(orderId, 'mp-1', 'approved', { amount: 2000, currency: ARS })

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3)
    expect(await prisma.inventoryMovement.count()).toBe(1)
  })

  it('un pago rechazado o por menos del total no descuenta ni registra nada', async () => {
    const client  = await createClientUser()
    const product = await newProduct({ stock: 5 })
    const created = await placeOrder(client, [{ productId: product.id, quantity: 2 }])
    const orderId = created.body.order.id

    await orderService.applyPaymentResult(orderId, 'mp-1', 'rejected', { amount: 2000, currency: ARS })
    await orderService.applyPaymentResult(orderId, 'mp-2', 'approved', { amount: 100, currency: ARS })

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5)
    expect(await prisma.inventoryMovement.count()).toBe(0)
  })

  it('el pago coordinado por WhatsApp que confirma el administrador también deja la salida', async () => {
    const admin   = await createAdminUser()
    const client  = await createClientUser()
    const product = await newProduct({ stock: 5 })
    const created = await request(app)
      .post('/api/client/orders').set('Cookie', cookieFor(client))
      .send({ items: [{ productId: product.id, quantity: 1 }], delivery: { type: 'pickup' }, paymentMethod: 'whatsapp' })

    const res = await request(app)
      .patch(`/api/admin/orders/${created.body.order.id}`).set('Cookie', cookieFor(admin))
      .send({ paymentStatus: 'paid' })

    expect(res.status).toBe(200)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4)
    const movements = await prisma.inventoryMovement.findMany()
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ type: 'exit', quantity: 1 })
  })

  it('el movimiento de la venta se ve en el libro del administrador', async () => {
    const admin   = await createAdminUser()
    const client  = await createClientUser()
    const product = await newProduct({ stock: 5 })
    const created = await placeOrder(client, [{ productId: product.id, quantity: 1 }])
    await orderService.applyPaymentResult(created.body.order.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })

    const res = await request(app).get('/api/store/movements').set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.movements).toHaveLength(1)
    expect(res.body.movements[0].type).toBe('exit')
  })
})

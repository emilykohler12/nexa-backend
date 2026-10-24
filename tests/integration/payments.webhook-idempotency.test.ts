import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../../src/app/database/prisma'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import { orderService } from '../../src/modules/orders/order.service'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'

// Mercado Pago manda varios avisos del mismo pago (payment.created y payment.updated
// llegan casi juntos, y además reintenta), y la clienta puede estar consultando el
// estado a la vez (verify-payment). Aplicar el mismo pago varias veces, incluso al
// mismo tiempo, no debe duplicar notificaciones, logs ni descuentos de stock.

const COPIES = 5

const logsOf = (action: string) => prisma.activityLog.count({ where: { action } })

describe('idempotencia al aplicar el resultado de un pago', () => {
  it('turno: avisos simultáneos del mismo pago notifican y registran una sola vez', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000,
    })

    await Promise.all(Array.from({ length: COPIES }, () =>
      appointmentService.applyPaymentResult(appt.id, 'mp-123', 'approved')))

    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(after.paymentStatus).toBe('partial')
    expect(after.mpPaymentId).toBe('mp-123')
    expect(await logsOf('Pago de seña recibido')).toBe(1)
    expect(await logsOf('Nuevo turno')).toBe(1)
  })

  it('turno: aplicar el mismo aviso uno detrás de otro tampoco duplica nada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000,
    })

    for (let i = 0; i < 3; i++) await appointmentService.applyPaymentResult(appt.id, 'mp-123', 'approved')

    expect(await logsOf('Pago de seña recibido')).toBe(1)
    expect(await logsOf('Nuevo turno')).toBe(1)
  })

  it('turno: un aviso tardío de rechazo no pisa una seña ya paga', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000,
    })

    await appointmentService.applyPaymentResult(appt.id, 'mp-123', 'approved')
    await appointmentService.applyPaymentResult(appt.id, 'mp-999', 'rejected')

    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(after.paymentStatus).toBe('partial')
    expect(after.mpPaymentId).toBe('mp-123')
  })

  it('combo: avisos simultáneos avisan una sola vez al grupo', async () => {
    const client = await createClientUser()
    const proA   = await createProfessionalUser()
    const proB   = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const groupId = randomUUID()
    const base = { clientId: client.id, serviceId: svc.id, date: tomorrowStr(), time: '11:00', depositAmount: 5000, comboGroupId: groupId }
    await createAppointmentDirect({ ...base, professionalId: proA.id })
    await createAppointmentDirect({ ...base, professionalId: proB.id })

    await Promise.all(Array.from({ length: COPIES }, () =>
      appointmentService.applyGroupPaymentResult(groupId, 'mp-456', 'approved')))

    const legs = await prisma.appointment.findMany({ where: { comboGroupId: groupId } })
    expect(legs.every(l => l.paymentStatus === 'partial')).toBe(true)
    expect(await logsOf('Pago de seña recibido')).toBe(1)
    expect(await logsOf('Nuevo turno simultáneo')).toBe(1)
  })

  async function orderWith(stock: number, quantity: number) {
    const client  = await createClientUser()
    const product = await prisma.product.create({ data: { name: 'Shampoo Test', price: 1000, stock } })
    const order   = await prisma.order.create({
      data: {
        clientId: client.id, deliveryType: 'pickup', totalPrice: 1000 * quantity,
        items: { create: [{ clientId: client.id, productId: product.id, quantity, unitPrice: 1000, totalPrice: 1000 * quantity }] },
      },
    })
    return { order, product }
  }

  it('pedido: avisos simultáneos descuentan el stock una sola vez', async () => {
    const { order, product } = await orderWith(10, 3)

    await Promise.all(Array.from({ length: COPIES }, () =>
      orderService.applyPaymentResult(order.id, 'mp-789', 'approved')))

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.paymentStatus).toBe('paid')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7)
    expect(await logsOf('Pago de pedido recibido')).toBe(1)
  })

  it('pedido: repetir el aviso uno detrás de otro no vuelve a descontar stock', async () => {
    const { order, product } = await orderWith(10, 3)

    for (let i = 0; i < 3; i++) await orderService.applyPaymentResult(order.id, 'mp-789', 'approved')

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7)
  })

  it('pedido: un aviso tardío de rechazo no pisa un pedido ya pago', async () => {
    const { order } = await orderWith(10, 3)

    await orderService.applyPaymentResult(order.id, 'mp-789', 'approved')
    await orderService.applyPaymentResult(order.id, 'mp-000', 'rejected')

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(after.paymentStatus).toBe('paid')
    expect(after.mpPaymentId).toBe('mp-789')
  })
})

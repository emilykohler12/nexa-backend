import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import type { Request, Response } from 'express'
import { prisma } from '../../src/app/database/prisma'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import { orderService } from '../../src/modules/orders/order.service'
import { paymentService } from '../../src/modules/payments/payment.service'
import { recibirWebhookMercadoPago } from '../../src/modules/payments/payment.controller'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'

// Mercado Pago confirma "approved" por el monto que se cobró de verdad. Si no coincide con la
// seña o el pedido (otra moneda, un monto menor), no se marca como pagado: se deja registrado
// para revisarlo a mano. Y si el procesamiento falla, el webhook responde 500 para que
// Mercado Pago reintente, en vez de perder la confirmación.

const ARS = 'ARS'
const logsOf = (action: string) => prisma.activityLog.count({ where: { action } })
const MISMATCH_LOG = 'Pago con monto distinto al esperado'

async function depositAppointment(deposit = 5000) {
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 20000 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id,
    date: tomorrowStr(), time: '10:00', depositAmount: deposit,
  })
  return { client, pro, svc, appt }
}

async function pendingOrder(totalPrice = 3000, stock = 10, quantity = 3) {
  const client  = await createClientUser()
  const product = await prisma.product.create({ data: { name: 'Shampoo Test', price: 1000, stock } })
  const order   = await prisma.order.create({
    data: {
      clientId: client.id, deliveryType: 'pickup', totalPrice,
      items: { create: [{ clientId: client.id, productId: product.id, quantity, unitPrice: 1000, totalPrice }] },
    },
  })
  return { order, product }
}

const status = async (id: string) => (await prisma.appointment.findUniqueOrThrow({ where: { id } })).paymentStatus

describe('turno: se valida el monto y la moneda antes de marcar la seña como paga', () => {
  it('con el monto exacto en pesos registra la seña', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 5000, currency: ARS })
    expect(await status(appt.id)).toBe('partial')
    expect(await logsOf(MISMATCH_LOG)).toBe(0)
  })

  it('con un monto menor NO registra la seña y deja un aviso para revisar', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })
    expect(await status(appt.id)).toBe('pending')
    expect(await logsOf(MISMATCH_LOG)).toBe(1)
    expect(await logsOf('Nuevo turno')).toBe(0)
  })

  it('con otra moneda NO registra la seña', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 5000, currency: 'USD' })
    expect(await status(appt.id)).toBe('pending')
    expect(await logsOf(MISMATCH_LOG)).toBe(1)
  })

  it('si Mercado Pago no informa el monto, no se puede verificar y NO registra la seña', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: undefined, currency: ARS })
    expect(await status(appt.id)).toBe('pending')
  })

  it('con un monto mayor lo acepta', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 6000, currency: ARS })
    expect(await status(appt.id)).toBe('partial')
  })

  it('sin datos de pago (seña confirmada a mano por WhatsApp) sigue funcionando', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'whatsapp-manual-1', 'approved')
    expect(await status(appt.id)).toBe('partial')
  })

  it('un rechazo se registra aunque el monto no coincida (solo se valida lo aprobado)', async () => {
    const { appt } = await depositAppointment(5000)
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'rejected', { amount: 1, currency: ARS })
    expect(await status(appt.id)).toBe('rejected')
  })
})

describe('combo: la seña es la suma de las patas', () => {
  async function combo() {
    const client = await createClientUser()
    const proA   = await createProfessionalUser()
    const proB   = await createProfessionalUser()
    const svc    = await createService({ price: 20000 })
    const groupId = randomUUID()
    const base = { clientId: client.id, serviceId: svc.id, date: tomorrowStr(), time: '11:00', depositAmount: 3000, comboGroupId: groupId }
    await createAppointmentDirect({ ...base, professionalId: proA.id })
    await createAppointmentDirect({ ...base, professionalId: proB.id })
    return groupId
  }
  const paymentStatuses = async (groupId: string) =>
    (await prisma.appointment.findMany({ where: { comboGroupId: groupId } })).map(a => a.paymentStatus)

  it('pagando solo una pata (3000 de 6000) NO registra la seña', async () => {
    const groupId = await combo()
    await appointmentService.applyGroupPaymentResult(groupId, 'mp-1', 'approved', { amount: 3000, currency: ARS })
    expect(await paymentStatuses(groupId)).toEqual(['pending', 'pending'])
    expect(await logsOf(MISMATCH_LOG)).toBe(1)
  })

  it('pagando el total (6000) registra la seña de todas las patas', async () => {
    const groupId = await combo()
    await appointmentService.applyGroupPaymentResult(groupId, 'mp-1', 'approved', { amount: 6000, currency: ARS })
    expect(await paymentStatuses(groupId)).toEqual(['partial', 'partial'])
  })
})

describe('pedido: se valida el total antes de marcarlo pago y descontar stock', () => {
  it('con un monto menor NO lo marca pago ni descuenta stock', async () => {
    const { order, product } = await pendingOrder(3000)
    await orderService.applyPaymentResult(order.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pending')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10)
    expect(await logsOf(MISMATCH_LOG)).toBe(1)
  })

  it('con el total exacto lo marca pago y descuenta el stock', async () => {
    const { order, product } = await pendingOrder(3000)
    await orderService.applyPaymentResult(order.id, 'mp-1', 'approved', { amount: 3000, currency: ARS })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7)
  })
})

describe('verificación a demanda (polling): usa el monto que informa Mercado Pago', () => {
  it('un pago aprobado por menos de la seña no la registra', async () => {
    const { client, appt } = await depositAppointment(5000)
    vi.mocked(paymentService.findPaymentByReference).mockResolvedValueOnce(
      { id: 'mp-9', status: 'approved', amount: 100, currency: ARS } as never)

    const res = await appointmentService.verifyPayment(client.id, appt.id)

    expect(res.paymentStatus).toBe('pending')
  })

  it('un pago aprobado por la seña completa la registra', async () => {
    const { client, appt } = await depositAppointment(5000)
    vi.mocked(paymentService.findPaymentByReference).mockResolvedValueOnce(
      { id: 'mp-9', status: 'approved', amount: 5000, currency: ARS } as never)

    const res = await appointmentService.verifyPayment(client.id, appt.id)

    expect(res.paymentStatus).toBe('partial')
  })
})

describe('webhook de Mercado Pago: respuesta según el resultado', () => {
  function fakeRes() {
    return { sendStatus: vi.fn() } as unknown as Response & { sendStatus: ReturnType<typeof vi.fn> }
  }
  const webhook = (dataId?: unknown) =>
    ({ query: { type: 'payment', 'data.id': dataId } }) as unknown as Request

  beforeEach(() => {
    vi.mocked(paymentService.getPayment).mockReset().mockResolvedValue({} as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('registra la seña con el monto informado por Mercado Pago y responde 200', async () => {
    const { appt } = await depositAppointment(5000)
    vi.mocked(paymentService.getPayment).mockResolvedValue(
      { external_reference: `appointment:${appt.id}`, status: 'approved', transaction_amount: 5000, currency_id: ARS } as never)
    const res = fakeRes()

    await recibirWebhookMercadoPago(webhook('123'), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
    expect(await status(appt.id)).toBe('partial')
  })

  it('con un monto menor responde 200 (reintentar no cambiaría nada) pero no registra la seña', async () => {
    const { appt } = await depositAppointment(5000)
    vi.mocked(paymentService.getPayment).mockResolvedValue(
      { external_reference: `appointment:${appt.id}`, status: 'approved', transaction_amount: 10, currency_id: ARS } as never)
    const res = fakeRes()

    await recibirWebhookMercadoPago(webhook('123'), res)

    expect(res.sendStatus).toHaveBeenCalledWith(200)
    expect(await status(appt.id)).toBe('pending')
  })

  it('si Mercado Pago no responde responde 500 para que reintente', async () => {
    vi.mocked(paymentService.getPayment).mockRejectedValue(new Error('Mercado Pago caído'))
    const res = fakeRes()

    await recibirWebhookMercadoPago(webhook('123'), res)

    expect(res.sendStatus).toHaveBeenCalledWith(500)
    expect(res.sendStatus).not.toHaveBeenCalledWith(200)
  })

  it('si falla la base de datos al aplicar el pago responde 500 para que reintente', async () => {
    const { appt } = await depositAppointment(5000)
    vi.mocked(paymentService.getPayment).mockResolvedValue(
      { external_reference: `appointment:${appt.id}`, status: 'approved', transaction_amount: 5000, currency_id: ARS } as never)
    const spy = vi.spyOn(prisma.appointment, 'updateMany').mockRejectedValueOnce(new Error('base caída'))
    const res = fakeRes()

    await recibirWebhookMercadoPago(webhook('123'), res)
    spy.mockRestore()

    expect(res.sendStatus).toHaveBeenCalledWith(500)
    // y el reintento posterior sí registra la seña
    const retry = fakeRes()
    await recibirWebhookMercadoPago(webhook('123'), retry)
    expect(retry.sendStatus).toHaveBeenCalledWith(200)
    expect(await status(appt.id)).toBe('partial')
  })

  it('no vuelca el objeto de error completo en los logs', async () => {
    const secretish = Object.assign(new Error('falló'), { cause: { headers: { authorization: 'Bearer APP_USR-SECRETO' } } })
    vi.mocked(paymentService.getPayment).mockRejectedValue(secretish)
    const res = fakeRes()

    await recibirWebhookMercadoPago(webhook('123'), res)

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain('APP_USR-SECRETO')
    expect(logged).toContain('falló')
  })

  it('un aviso de otro tipo, o sin id, o con una referencia desconocida responde 200 sin hacer nada', async () => {
    for (const req of [
      { query: { type: 'merchant_order', 'data.id': '1' } },
      webhook(undefined),
      webhook(['1', '2']),
    ] as unknown as Request[]) {
      const res = fakeRes()
      await recibirWebhookMercadoPago(req, res)
      expect(res.sendStatus).toHaveBeenCalledWith(200)
    }
    vi.mocked(paymentService.getPayment).mockResolvedValue({ external_reference: 'cualquier-cosa', status: 'approved' } as never)
    const res = fakeRes()
    await recibirWebhookMercadoPago(webhook('123'), res)
    expect(res.sendStatus).toHaveBeenCalledWith(200)
  })
})

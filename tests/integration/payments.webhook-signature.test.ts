import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { env } from '../../src/app/config/env'
import { paymentService } from '../../src/modules/payments/payment.service'

// RNF-09: el webhook de Mercado Pago solo procesa avisos con la firma x-signature válida (HMAC-SHA256 de
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con la clave secreta del webhook). La clave es de prueba y
// se pone acá: no se llama a Mercado Pago (paymentService está mockeado en tests/setup.ts).

const SECRET = 'clave-secreta-de-prueba-del-webhook'
const DATA_ID = '123456789'
const REQUEST_ID = 'req-test-0001'
const TS = '1762000000'

const sign = (secret = SECRET, dataId = DATA_ID, requestId = REQUEST_ID, ts = TS) =>
  crypto.createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')

const webhook = () => request(app).post('/api/webhook/mercadopago').query({ type: 'payment', 'data.id': DATA_ID }).send({})

let previousSecret: string | undefined

beforeEach(() => {
  previousSecret = env.MERCADOPAGO_WEBHOOK_SECRET
  env.MERCADOPAGO_WEBHOOK_SECRET = SECRET
  vi.mocked(paymentService.getPayment).mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  env.MERCADOPAGO_WEBHOOK_SECRET = previousSecret
  vi.restoreAllMocks()
})

describe('RNF-09: firma del webhook de Mercado Pago', () => {
  it('con la firma válida procesa el aviso (consulta el pago a Mercado Pago) y responde 200', async () => {
    const res = await webhook().set('x-signature', `ts=${TS},v1=${sign()}`).set('x-request-id', REQUEST_ID)

    expect(res.status).toBe(200)
    expect(paymentService.getPayment).toHaveBeenCalledWith(DATA_ID)
  })

  it('con una firma inválida responde 401 y no procesa nada', async () => {
    const otraClave  = await webhook().set('x-signature', `ts=${TS},v1=${sign('otra-clave')}`).set('x-request-id', REQUEST_ID)
    const otroPago   = await webhook().set('x-signature', `ts=${TS},v1=${sign(SECRET, '999')}`).set('x-request-id', REQUEST_ID)
    const otroTs     = await webhook().set('x-signature', `ts=1700000000,v1=${sign()}`).set('x-request-id', REQUEST_ID)
    const cortada    = await webhook().set('x-signature', `ts=${TS},v1=abc`).set('x-request-id', REQUEST_ID)
    const sinV1      = await webhook().set('x-signature', `ts=${TS}`).set('x-request-id', REQUEST_ID)

    for (const res of [otraClave, otroPago, otroTs, cortada, sinV1]) expect(res.status).toBe(401)
    expect(paymentService.getPayment).not.toHaveBeenCalled()
  })

  it('sin la cabecera x-signature (o sin x-request-id) responde 401 y no procesa nada', async () => {
    const sinFirma     = await webhook().set('x-request-id', REQUEST_ID)
    const sinRequestId = await webhook().set('x-signature', `ts=${TS},v1=${sign()}`)

    expect(sinFirma.status).toBe(401)
    expect(sinRequestId.status).toBe(401)
    expect(paymentService.getPayment).not.toHaveBeenCalled()
  })

  it('si falta la clave secreta en el servidor responde 500 y no procesa nada', async () => {
    env.MERCADOPAGO_WEBHOOK_SECRET = undefined
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await webhook().set('x-signature', `ts=${TS},v1=${sign()}`).set('x-request-id', REQUEST_ID)

    expect(res.status).toBe(500)
    expect(paymentService.getPayment).not.toHaveBeenCalled()
  })
})

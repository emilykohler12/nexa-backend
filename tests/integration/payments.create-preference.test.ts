import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { env } from '../../src/app/config/env'

// Creación de preferencias de Checkout Pro (modo prueba). tests/setup.ts reemplaza paymentService por un mock
// para el resto de la suite; acá se carga el servicio REAL y se mockea el SDK de Mercado Pago, así que no sale
// ninguna llamada de red y el token es un valor falso.

const create = vi.fn()
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Preference: class { create = create },
  Payment: class {},
}))

const real = async () =>
  (await vi.importActual<typeof import('../../src/modules/payments/payment.service')>('../../src/modules/payments/payment.service')).paymentService

const saved = { ...env }
beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'pref-123', init_point: 'https://mp.test/real', sandbox_init_point: 'https://mp.test/sandbox' })
  env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token-falso-de-prueba'
  env.FRONTEND_URL = 'https://front.test'
  env.BACKEND_PUBLIC_URL = 'https://api.test'
})
afterEach(() => { Object.assign(env, saved) })

const opts = { title: 'Seña — Manicura', amount: 3000, externalReference: 'appointment:abc', payerEmail: 'clienta@test.local' }

describe('paymentService.createPreference', () => {
  it('arma la preferencia con el monto, la moneda, la referencia externa y la URL del webhook', async () => {
    const out = await (await real()).createPreference(opts)

    expect(out.preferenceId).toBe('pref-123')
    const body = create.mock.calls[0][0].body
    expect(body.items).toEqual([expect.objectContaining({ unit_price: 3000, quantity: 1, currency_id: 'ARS', title: 'Seña — Manicura' })])
    expect(body.external_reference).toBe('appointment:abc')
    expect(body.payer).toEqual({ email: 'clienta@test.local' })
    expect(body.notification_url).toBe('https://api.test/api/webhook/mercadopago')
    expect(body.back_urls.success).toBe('https://front.test/pago/resultado?estado=exito')
  })

  it('con el front en https pide auto_return; con el front en http (local) no lo manda', async () => {
    await (await real()).createPreference(opts)
    expect(create.mock.calls[0][0].body.auto_return).toBe('approved')

    env.FRONTEND_URL = 'http://localhost:5173'
    await (await real()).createPreference(opts)
    expect(create.mock.calls[1][0].body).not.toHaveProperty('auto_return')
  })

  it('fuera de producción devuelve la URL de sandbox', async () => {
    expect((await (await real()).createPreference(opts)).checkoutUrl).toBe('https://mp.test/sandbox')
  })

  it('sin MERCADOPAGO_ACCESS_TOKEN falla antes de llamar a Mercado Pago', async () => {
    env.MERCADOPAGO_ACCESS_TOKEN = undefined
    await expect((await real()).createPreference(opts)).rejects.toThrow('MERCADOPAGO_ACCESS_TOKEN')
    expect(create).not.toHaveBeenCalled()
  })

  it('si Mercado Pago no devuelve id o URL, falla', async () => {
    create.mockResolvedValueOnce({ init_point: 'https://mp.test/real' })
    await expect((await real()).createPreference(opts)).rejects.toThrow('id de preferencia')
    create.mockResolvedValueOnce({ id: 'x' })
    await expect((await real()).createPreference(opts)).rejects.toThrow('URL de checkout')
  })
})

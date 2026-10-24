import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/node'
import { scrubSensitiveData } from '../../src/sentry'

// Sentry no debe recibir sesión, cuerpos de pedido ni datos personales.
function sampleEvent(): ErrorEvent {
  return {
    type: undefined,
    message: 'fallo',
    request: {
      url: 'https://api.test/api/auth/verify-email?token=SECRETO',
      query_string: 'token=SECRETO',
      cookies: { access_token: 'jwt-de-sesion', refresh_token: 'jwt-de-refresh' },
      data: { email: 'clienta@test.local', password: 'Clave1234!' },
      headers: {
        Cookie: 'access_token=jwt-de-sesion',
        Authorization: 'Bearer abc',
        'x-signature': 'ts=1,v1=abc',
        'user-agent': 'vitest',
      },
    },
    user: { id: 'u-1', email: 'clienta@test.local', username: 'clienta', ip_address: '1.2.3.4' },
  } as ErrorEvent
}

describe('limpieza de datos sensibles antes de enviar a Sentry', () => {
  it('borra cookies y cuerpo del pedido', () => {
    const e = scrubSensitiveData(sampleEvent())
    expect(e.request?.cookies).toBeUndefined()
    expect(e.request?.data).toBeUndefined()
  })

  it('filtra las cabeceras sensibles y deja las demás', () => {
    const h = scrubSensitiveData(sampleEvent()).request?.headers as Record<string, string>
    expect(h.Cookie).toBe('[Filtrado]')
    expect(h.Authorization).toBe('[Filtrado]')
    expect(h['x-signature']).toBe('[Filtrado]')
    expect(h['user-agent']).toBe('vitest')
  })

  it('saca el query string de la URL y del evento', () => {
    const r = scrubSensitiveData(sampleEvent()).request!
    expect(r.query_string).toBe('[Filtrado]')
    expect(r.url).toBe('https://api.test/api/auth/verify-email')
    expect(JSON.stringify(r)).not.toContain('SECRETO')
  })

  it('conserva solo el id del usuario', () => {
    const u = scrubSensitiveData(sampleEvent()).user!
    expect(u).toEqual({ id: 'u-1' })
  })

  it('no rompe con un evento sin request ni usuario', () => {
    const e = scrubSensitiveData({ message: 'x' } as ErrorEvent)
    expect(e.message).toBe('x')
  })
})

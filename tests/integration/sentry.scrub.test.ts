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

  it('el mensaje de un error de Prisma no deja pasar los valores de la consulta (una alergia)', () => {
    const e = {
      exception: {
        values: [{
          type: 'PrismaClientValidationError',
          value: [
            '',
            'Invalid `prisma.user.update()` invocation in',
            '/app/src/modules/clients/client.service.ts:88:5',
            '',
            '  data: {',
            '    allergies: "penicilina y látex",',
            '    name: undefined',
            '  }',
            'Argument `name` must not be null.',
          ].join('\n'),
        }],
      },
    } as ErrorEvent
    const out = scrubSensitiveData(e)
    const value = out.exception!.values![0].value!
    expect(value).not.toContain('penicilina')
    expect(value).not.toContain('látex')
    expect(value).toContain('prisma.user.update()')
    expect(value).toContain('Argument `name` must not be null.')
    expect(out.exception!.values![0].type).toBe('PrismaClientValidationError')
  })

  it('tapa los emails en el mensaje del evento y de la excepción, y deja el resto del texto', () => {
    const e = {
      message: 'falló el mail a clienta@test.local',
      exception: { values: [{ type: 'Error', value: 'rebotó clienta@test.local por casilla llena' }] },
    } as ErrorEvent
    const out = scrubSensitiveData(e)
    expect(out.message).toBe('falló el mail a [email]')
    expect(out.exception!.values![0].value).toBe('rebotó [email] por casilla llena')
  })

  it('en los breadcrumbs tapa los emails y deja solo método, estado y URL sin query', () => {
    const e = {
      breadcrumbs: [
        { category: 'console', message: 'error con clienta@test.local', data: { arguments: [{ allergies: 'penicilina' }], logger: 'console' } },
        { category: 'http', data: { url: 'https://api.test/api/auth/verify-email?token=SECRETO', method: 'GET', status_code: 200, body: 'alergia: látex' } },
      ],
    } as unknown as ErrorEvent
    const crumbs = scrubSensitiveData(e).breadcrumbs!
    expect(crumbs[0].message).toBe('error con [email]')
    expect(crumbs[0].data).toEqual({})
    expect(crumbs[1].data).toEqual({ url: 'https://api.test/api/auth/verify-email', method: 'GET', status_code: 200 })
    expect(JSON.stringify(crumbs)).not.toMatch(/penicilina|látex|SECRETO/)
  })

  it('borra los campos extra y los contextos que no son del SDK, y deja los del SDK', () => {
    const e = {
      extra: { allergies: 'penicilina' },
      contexts: { runtime: { name: 'node' }, trace: { trace_id: 'abc' }, cliente: { allergies: 'látex' } },
    } as unknown as ErrorEvent
    const out = scrubSensitiveData(e)
    expect(out.extra).toBeUndefined()
    expect(out.contexts).toEqual({ runtime: { name: 'node' }, trace: { trace_id: 'abc' } })
  })

  it('saca las variables locales de los frames del stack', () => {
    const e = {
      exception: { values: [{ type: 'Error', value: 'x', stacktrace: { frames: [{ filename: 'a.ts', vars: { allergies: 'penicilina' } }] } }] },
    } as unknown as ErrorEvent
    const frame = scrubSensitiveData(e).exception!.values![0].stacktrace!.frames![0]
    expect(frame.vars).toBeUndefined()
    expect(frame.filename).toBe('a.ts')
  })

  it('no rompe con un evento sin request ni usuario', () => {
    const e = scrubSensitiveData({ message: 'x' } as ErrorEvent)
    expect(e.message).toBe('x')
  })
})

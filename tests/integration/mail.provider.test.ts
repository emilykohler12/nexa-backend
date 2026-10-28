import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { env } from '../../src/app/config/env'

// tests/setup.ts reemplaza el proveedor de mail por un mock; acá se prueba el de verdad.
// nodemailer también se simula: nunca sale un mail ni se abre una conexión.
const sendMail = vi.fn()
const verify   = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail, verify })) },
}))

type MailProvider = typeof import('../../src/modules/auth/providers/mail.provider').mailProvider
let mailProvider: MailProvider
beforeAll(async () => {
  const actual = await vi.importActual<typeof import('../../src/modules/auth/providers/mail.provider')>(
    '../../src/modules/auth/providers/mail.provider',
  )
  mailProvider = actual.mailProvider
})

const fetchMock = vi.fn()
const original = { key: env.BREVO_API_KEY, from: env.MAIL_FROM }

function brevoResponds(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
}

beforeEach(() => {
  fetchMock.mockReset()
  sendMail.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  env.MAIL_FROM = 'kologic6@gmail.com'
})

afterEach(() => {
  env.BREVO_API_KEY = original.key
  env.MAIL_FROM     = original.from
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('mailProvider con Brevo (BREVO_API_KEY configurada)', () => {
  beforeEach(() => { env.BREVO_API_KEY = 'clave-de-prueba' })

  it('envía por la API de Brevo con el remitente configurado y devuelve el id del mensaje', async () => {
    brevoResponds(201, { messageId: '<abc@brevo>' })

    const info = await mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>')

    expect(info.messageId).toBe('<abc@brevo>')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')
    expect(init.headers['api-key']).toBe('clave-de-prueba')
    expect(JSON.parse(init.body)).toEqual({
      sender:      { name: 'Nexa', email: 'kologic6@gmail.com' },
      to:          [{ email: 'clienta@test.local' }],
      subject:     'Asunto',
      htmlContent: '<p>Hola</p>',
    })
  })

  it('no usa SMTP', async () => {
    brevoResponds(201, { messageId: 'x' })

    await mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>')

    expect(sendMail).not.toHaveBeenCalled()
  })

  it('si Brevo rechaza el envío falla con su código y mensaje, sin incluir la clave', async () => {
    brevoResponds(400, { code: 'invalid_parameter', message: 'sender is not valid' })

    const err = await mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>').then(() => null, (e: unknown) => e as Error)

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toContain('400')
    expect(err!.message).toContain('invalid_parameter')
    expect(err!.message).toContain('sender is not valid')
    expect(err!.message).not.toContain('clave-de-prueba')
  })

  it('si no hay red falla (el que llama decide qué hacer con el error)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>')).rejects.toThrow('network down')
  })

  it('no escribe el email del destinatario completo en los logs', async () => {
    brevoResponds(201, { messageId: 'x' })

    await mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>')

    const logged = vi.mocked(console.log).mock.calls.flat().join(' ')
    expect(logged).not.toContain('clienta@test.local')
  })
})

describe('mailProvider sin BREVO_API_KEY (desarrollo local)', () => {
  beforeEach(() => { env.BREVO_API_KEY = undefined })

  it('usa SMTP con el mismo remitente y no llama a Brevo', async () => {
    sendMail.mockResolvedValue({ messageId: 'smtp-1' })

    const info = await mailProvider.send('clienta@test.local', 'Asunto', '<p>Hola</p>')

    expect(info.messageId).toBe('smtp-1')
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Nexa" <kologic6@gmail.com>', to: 'clienta@test.local', subject: 'Asunto', html: '<p>Hola</p>',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

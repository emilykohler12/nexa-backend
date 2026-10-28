import { describe, it, expect, vi, afterEach } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, TEST_PASSWORD } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'
import { generateVerificationCode } from '../../src/modules/auth/utils/generateCode'

// El código de recuperación de la contraseña tiene 6 dígitos (900.000 combinaciones). Para que
// no se pueda adivinar, el pedido lleva el email de la cuenta y los intentos fallidos se limitan.
// Cambiar la contraseña desde la sesión exige además la contraseña actual.

// Por defecto genera el código de verdad; un test puede forzar valores para provocar una colisión.
vi.mock('../../src/modules/auth/utils/generateCode', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/modules/auth/utils/generateCode')>()
  return { ...actual, generateVerificationCode: vi.fn(actual.generateVerificationCode) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(generateVerificationCode).mockClear()
})

const NEW_PASSWORD = 'ClaveNueva123'
const uniqueEmail = () => `reset.${randomUUID().slice(0, 8)}@test.local`

const passwordHashOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).passwordHash
const codeOf = async (userId: string) =>
  (await prisma.passwordReset.findFirstOrThrow({ where: { userId, used: false } })).token

async function requestCode(email: string) {
  const res = await request(app).post('/api/auth/forgot-password').send({ email })
  expect(res.status).toBe(200)
}

const reset = (body: Record<string, unknown>) => request(app).post('/api/auth/reset-password').send(body)

async function canLogin(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  return res.status === 200
}

describe('cambiar la contraseña desde la sesión', () => {
  it('exige la contraseña actual', async () => {
    const client = await createClientUser()
    const before = await passwordHashOf(client.id)

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .send({ password: NEW_PASSWORD })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await passwordHashOf(client.id)).toBe(before)
  })

  it('rechaza una contraseña actual incorrecta con 400 (un 401 desloguearía al usuario en el frontend)', async () => {
    const client = await createClientUser()
    const before = await passwordHashOf(client.id)

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .send({ currentPassword: 'NoEsLaClave1', password: NEW_PASSWORD })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD')
    expect(await passwordHashOf(client.id)).toBe(before)
  })

  it('con la contraseña actual correcta cambia la clave y cierra la renovación de la sesión', async () => {
    const client = await createClientUser()

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .send({ currentPassword: TEST_PASSWORD, password: NEW_PASSWORD })

    expect(res.status).toBe(200)
    expect(await canLogin(client.email, NEW_PASSWORD)).toBe(true)
    expect(await canLogin(client.email, TEST_PASSWORD)).toBe(false)
  })

  it('sin sesión devuelve 401', async () => {
    const res = await request(app).post('/api/auth/change-password').send({ currentPassword: TEST_PASSWORD, password: NEW_PASSWORD })
    expect(res.status).toBe(401)
  })
})

describe('recuperar la contraseña con el código', () => {
  it('con el email y el código correctos cambia la contraseña', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)

    const res = await reset({ email: client.email, token: await codeOf(client.id), password: NEW_PASSWORD })

    expect(res.status).toBe(200)
    expect(await canLogin(client.email, NEW_PASSWORD)).toBe(true)
  })

  it('el email puede venir con mayúsculas y espacios', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)

    const res = await reset({ email: `  ${client.email.toUpperCase()} `, token: await codeOf(client.id), password: NEW_PASSWORD })

    expect(res.status).toBe(200)
  })

  it('exige el email: el contrato anterior (solo código) ya no sirve', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const before = await passwordHashOf(client.id)

    const res = await reset({ token: await codeOf(client.id), password: NEW_PASSWORD })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await passwordHashOf(client.id)).toBe(before)
  })

  it('el código de otra usuaria no sirve para cambiar la contraseña de la víctima', async () => {
    const victim   = await createClientUser({ email: uniqueEmail() })
    const attacker = await createClientUser({ email: uniqueEmail() })
    await requestCode(victim.email)
    await requestCode(attacker.email)
    const before = await passwordHashOf(victim.id)

    // La atacante usa SU código válido con el email de la víctima.
    const res = await reset({ email: victim.email, token: await codeOf(attacker.id), password: NEW_PASSWORD })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_TOKEN')
    expect(await passwordHashOf(victim.id)).toBe(before)
    // y el código de la atacante sigue siendo suyo
    const own = await reset({ email: attacker.email, token: await codeOf(attacker.id), password: NEW_PASSWORD })
    expect(own.status).toBe(200)
  })

  it('un email inexistente da el mismo error que un código incorrecto (no revela qué cuentas existen)', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const code = await codeOf(client.id)

    const unknown = await reset({ email: uniqueEmail(), token: code, password: NEW_PASSWORD })
    const wrong   = await reset({ email: client.email, token: code === '111111' ? '222222' : '111111', password: NEW_PASSWORD })

    expect(unknown.status).toBe(400)
    expect(wrong.status).toBe(400)
    expect(unknown.body).toEqual(wrong.body)
  })

  it('un código usado no se puede reutilizar', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const code = await codeOf(client.id)
    await reset({ email: client.email, token: code, password: NEW_PASSWORD })

    const again = await reset({ email: client.email, token: code, password: 'OtraClave456' })

    expect(again.status).toBe(400)
    expect(await canLogin(client.email, NEW_PASSWORD)).toBe(true)
  })

  it('un código vencido (15 minutos) se rechaza', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'))
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const code = await codeOf(client.id)

    vi.setSystemTime(new Date('2026-10-24T12:16:00Z'))
    const res = await reset({ email: client.email, token: code, password: NEW_PASSWORD })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TOKEN_EXPIRED')
  })

  it('dos pedidos simultáneos con el mismo código: solo uno cambia la contraseña', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const code = await codeOf(client.id)

    const results = await Promise.all([
      reset({ email: client.email, token: code, password: 'ClaveUno12345' }),
      reset({ email: client.email, token: code, password: 'ClaveDos12345' }),
    ])

    expect(results.map(r => r.status).sort()).toEqual([200, 400])
  })

  it('tras 5 intentos fallidos con el mismo email bloquea los siguientes, incluso con el código correcto', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    await requestCode(client.email)
    const code = await codeOf(client.id)
    const wrong = code === '123456' ? '654321' : '123456'

    for (let i = 0; i < 5; i++) {
      const res = await reset({ email: client.email, token: wrong, password: NEW_PASSWORD })
      expect(res.status).toBe(400)
    }
    const blocked = await reset({ email: client.email, token: code, password: NEW_PASSWORD })

    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS')
    expect(await canLogin(client.email, NEW_PASSWORD)).toBe(false)
  })

  it('los intentos fallidos de un email no bloquean a otro', async () => {
    const a = await createClientUser({ email: uniqueEmail() })
    const b = await createClientUser({ email: uniqueEmail() })
    await requestCode(b.email)
    for (let i = 0; i < 5; i++) await reset({ email: a.email, token: '000000', password: NEW_PASSWORD })

    const res = await reset({ email: b.email, token: await codeOf(b.id), password: NEW_PASSWORD })

    expect(res.status).toBe(200)
  })

  it('los pedidos exitosos no cuentan para el límite', async () => {
    const client = await createClientUser({ email: uniqueEmail() })
    for (let i = 0; i < 6; i++) {
      await requestCode(client.email)
      const res = await reset({ email: client.email, token: await codeOf(client.id), password: `ClaveNueva${i}23` })
      expect(res.status).toBe(200)
    }
  })

  it('si el código sorteado ya lo tiene otra usuaria, se sortea otro en vez de fallar', async () => {
    const other  = await createClientUser({ email: uniqueEmail() })
    const client = await createClientUser({ email: uniqueEmail() })
    await prisma.passwordReset.create({ data: { userId: other.id, token: '123456', expiresAt: new Date(Date.now() + 600_000) } })
    vi.mocked(generateVerificationCode).mockReturnValueOnce('123456').mockReturnValueOnce('654321')

    await requestCode(client.email)

    expect(await codeOf(client.id)).toBe('654321')
    // el código de la otra usuaria sigue intacto
    expect(await codeOf(other.id)).toBe('123456')
  })
})

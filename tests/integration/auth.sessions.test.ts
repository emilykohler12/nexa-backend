import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { jwtProvider } from '../../src/modules/auth/providers/jwt.provider'
import { createClientUser, TEST_PASSWORD } from '../helpers/factories'

// Una usuaria puede tener la sesión abierta en varios dispositivos a la vez (celular y compu):
// cada uno tiene su propia sesión, que se renueva, se cierra y vence por separado. Cambiar o
// recuperar la contraseña cierra todas.

afterEach(() => { vi.useRealTimers() })

const HEX64 = /^[0-9a-f]{64}$/

function cookieValue(res: request.Response, name: string): string | undefined {
  const list = (res.headers['set-cookie'] ?? []) as unknown as string[]
  const line = list.find(c => c.startsWith(`${name}=`))
  return line?.split(';')[0].slice(name.length + 1)
}

// Un "dispositivo": inicia sesión y devuelve las cookies que guardaría su navegador.
async function login(user: { email: string }) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD })
  expect(res.status).toBe(200)
  return { access: cookieValue(res, 'access_token')!, refresh: cookieValue(res, 'refresh_token')! }
}

const refresh = (token: string) => request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${token}`)
const logout = (access: string) => request(app).post('/api/auth/logout').set('Cookie', `access_token=${access}`)
const sessions = (userId: string) => prisma.refreshSession.findMany({ where: { userId } })

describe('varios dispositivos a la vez', () => {
  it('iniciar sesión en un segundo dispositivo no cierra la renovación del primero', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)

    expect((await refresh(phone.refresh)).status).toBe(200)
    expect((await refresh(laptop.refresh)).status).toBe(200)
    expect(await sessions(client.id)).toHaveLength(2)
  })

  it('renovar en un dispositivo no afecta al otro, y cada uno puede seguir renovando', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)

    const phone2 = await refresh(phone.refresh)
    expect(phone2.status).toBe(200)
    expect((await refresh(laptop.refresh)).status).toBe(200)
    expect((await refresh(cookieValue(phone2, 'refresh_token')!)).status).toBe(200)
  })

  it('cerrar sesión en un dispositivo no cierra el otro', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)

    expect((await logout(phone.access)).status).toBe(200)

    expect((await refresh(phone.refresh)).status).toBe(401)
    expect((await refresh(laptop.refresh)).status).toBe(200)
    expect(await sessions(client.id)).toHaveLength(1)
  })

  it('cerrar sesión con el access token vencido cierra solo ese dispositivo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)

    vi.setSystemTime(new Date('2026-10-27T12:20:00Z')) // el access (15 min) venció
    expect((await logout(phone.access)).status).toBe(200)

    expect((await refresh(phone.refresh)).status).toBe(401)
    expect((await refresh(laptop.refresh)).status).toBe(200)
  })

  it('cambiar la contraseña cierra la sesión de todos los dispositivos', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)

    const res = await request(app).post('/api/auth/change-password')
      .set('Cookie', `access_token=${phone.access}`)
      .send({ currentPassword: TEST_PASSWORD, password: 'ClaveNueva123' })
    expect(res.status).toBe(200)

    expect((await refresh(phone.refresh)).status).toBe(401)
    expect((await refresh(laptop.refresh)).status).toBe(401)
    expect(await sessions(client.id)).toHaveLength(0)
  })

  it('recuperar la contraseña con el código cierra la sesión de todos los dispositivos', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    const laptop = await login(client)
    await request(app).post('/api/auth/forgot-password').send({ email: client.email })
    const code = (await prisma.passwordReset.findFirstOrThrow({ where: { userId: client.id, used: false } })).token

    const res = await request(app).post('/api/auth/reset-password').send({ email: client.email, token: code, password: 'ClaveNueva123' })
    expect(res.status).toBe(200)

    expect((await refresh(phone.refresh)).status).toBe(401)
    expect((await refresh(laptop.refresh)).status).toBe(401)
  })

  it('una usuaria desactivada no puede renovar ninguna sesión', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    await prisma.user.update({ where: { id: client.id }, data: { active: false } })

    expect((await refresh(phone.refresh)).status).toBe(401)
  })

  it('hasta 10 dispositivos: al abrir el undécimo se cierra el más antiguo', async () => {
    const client = await createClientUser()
    const devices = []
    for (let i = 0; i < 11; i++) devices.push(await login(client))

    expect(await sessions(client.id)).toHaveLength(10)
    expect((await refresh(devices[0].refresh)).status).toBe(401)
    expect((await refresh(devices[10].refresh)).status).toBe(200)
  })
})

describe('cómo se guarda y se renueva cada sesión', () => {
  it('se guarda el hash (SHA-256) del refresh token, nunca el token', async () => {
    const client = await createClientUser()
    const phone  = await login(client)

    const [session] = await sessions(client.id)
    expect(session.tokenHash).toMatch(HEX64)
    expect(session.tokenHash).not.toBe(phone.refresh)
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('el refresh token viejo deja de servir pasado el margen, y eso no cierra la sesión actual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
    const client = await createClientUser()
    const phone  = await login(client)

    const renewed = await refresh(phone.refresh)
    const current = cookieValue(renewed, 'refresh_token')!

    vi.setSystemTime(new Date('2026-10-27T12:01:00Z')) // 60 s después
    expect((await refresh(phone.refresh)).status).toBe(401)
    expect((await refresh(current)).status).toBe(200)
  })

  it('dos pestañas que renuevan a la vez con la misma cookie no se desloguean entre sí', async () => {
    const client = await createClientUser()
    const phone  = await login(client)

    const [a, b] = await Promise.all([refresh(phone.refresh), refresh(phone.refresh)])

    expect([a.status, b.status]).toEqual([200, 200])
    // una de las dos rotó el refresh token y la otra solo renovó el access: la cookie vigente sirve
    const rotated = cookieValue(a, 'refresh_token') ?? cookieValue(b, 'refresh_token')
    expect(rotated).toBeTruthy()
    expect((await refresh(rotated!)).status).toBe(200)
  })

  it('una sesión vencida en la base se rechaza', async () => {
    const client = await createClientUser()
    const phone  = await login(client)
    await prisma.refreshSession.updateMany({ where: { userId: client.id }, data: { expiresAt: new Date(Date.now() - 1000) } })

    expect((await refresh(phone.refresh)).status).toBe(401)
  })

  it('un token con una sesión que no existe se rechaza', async () => {
    const client = await createClientUser()
    const forged = jwtProvider.signRefresh({ sub: client.id, email: client.email, role: 'client', sid: '00000000-0000-4000-8000-000000000000' })

    const res = await refresh(forged)

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
  })
})

describe('token del formato anterior (sin sid)', () => {
  it('ya no se acepta y no crea ninguna sesión', async () => {
    const client = await createClientUser()
    const legacy = jwtProvider.signRefresh({ sub: client.id, email: client.email, role: 'client' })

    const res = await refresh(legacy)

    expect(res.status).toBe(401)
    expect(await sessions(client.id)).toHaveLength(0)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { env } from '../../src/app/config/env'
import { prisma } from '../../src/app/database/prisma'
import { jwtProvider } from '../../src/modules/auth/providers/jwt.provider'
import { createClientUser, createAdminUser, TEST_PASSWORD } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Las cookies de sesión viajan con SameSite=None en producción, así que un sitio ajeno
// puede hacer que el navegador de la usuaria mande un POST con su sesión. Estos tests
// reproducen ese ataque y comprueban el cierre de sesión y el guardado del refresh token.

const EVIL = 'https://sitio-malo.example'
const HEX64 = /^[0-9a-f]{64}$/

afterEach(() => { vi.useRealTimers() })

function cookieValue(res: request.Response, name: string): string | undefined {
  const list = (res.headers['set-cookie'] ?? []) as unknown as string[]
  const line = list.find(c => c.startsWith(`${name}=`))
  return line?.split(';')[0].slice(name.length + 1)
}

async function loginAs(user: { email: string }) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD })
  expect(res.status).toBe(200)
  return {
    access:  cookieValue(res, 'access_token')!,
    refresh: cookieValue(res, 'refresh_token')!,
    res,
  }
}

const dbToken = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).refreshToken

describe('CSRF: pedidos que cambian datos y vienen de otro sitio', () => {
  it('un formulario de otro sitio no puede cambiar la contraseña de una clienta logueada', async () => {
    const client = await createClientUser()
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: client.id } })).passwordHash

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .set('Origin', EVIL)
      .type('form')
      .send({ password: 'Atacante123' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN_ORIGIN')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: client.id } })).passwordHash).toBe(before)
  })

  it('un formulario de otro sitio no puede invitar a un profesional en nombre de una admin', async () => {
    const admin = await createAdminUser()

    const res = await request(app)
      .post('/api/invitations')
      .set('Cookie', cookieFor(admin))
      .set('Origin', EVIL)
      .type('form')
      .send({ email: 'atacante@test.local' })

    expect(res.status).toBe(403)
    expect(await prisma.invitation.count()).toBe(0)
  })

  it('un origen "null" (página sandbox o redirección) también se rechaza', async () => {
    const client = await createClientUser()
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookieFor(client)).set('Origin', 'null')
    expect(res.status).toBe(403)
  })

  it('el frontend (su origen exacto) sigue pudiendo cambiar la contraseña', async () => {
    const client = await createClientUser()
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .set('Origin', env.FRONTEND_URL)
      .send({ password: 'NuevaClave123' })
    expect(res.status).toBe(200)
  })

  it('un pedido sin cabecera Origin (webhook, curl, servidor a servidor) no se bloquea', async () => {
    const client = await createClientUser()
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieFor(client))
      .send({ password: 'NuevaClave123' })
    expect(res.status).toBe(200)
  })

  it('las lecturas (GET) no se bloquean: de eso se encarga CORS', async () => {
    const client = await createClientUser()
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor(client)).set('Origin', EVIL)
    expect(res.status).toBe(200)
  })

  it('la API ya no interpreta formularios (application/x-www-form-urlencoded)', async () => {
    const client = await createClientUser()

    const res = await request(app)
      .post('/api/auth/login')
      .type('form')
      .send({ email: client.email, password: TEST_PASSWORD })

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(cookieValue(res, 'access_token')).toBeUndefined()
  })
})

describe('cerrar sesión', () => {
  it('cierra la sesión aunque el access token ya haya vencido', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'))
    const client = await createClientUser()
    const { access } = await loginAs(client)
    expect(await dbToken(client.id)).not.toBeNull()

    vi.setSystemTime(new Date('2026-10-24T12:20:00Z')) // 20 minutos después: el access (15 min) venció
    const res = await request(app).post('/api/auth/logout').set('Cookie', `access_token=${access}`)

    expect(res.status).toBe(200)
    expect(await dbToken(client.id)).toBeNull()
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[]
    expect(cookies.some(c => c.startsWith('access_token=;'))).toBe(true)
    expect(cookies.some(c => c.startsWith('refresh_token=;'))).toBe(true)
  })

  it('cerrar sesión sin ninguna cookie responde 200 y deja las cookies limpias', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[]
    expect(cookies.some(c => c.startsWith('refresh_token=;'))).toBe(true)
  })

  it('con el access token vigente también cierra la sesión', async () => {
    const client = await createClientUser()
    const { access } = await loginAs(client)

    const res = await request(app).post('/api/auth/logout').set('Cookie', `access_token=${access}`)

    expect(res.status).toBe(200)
    expect(await dbToken(client.id)).toBeNull()
  })

  it('una cookie falsificada no cierra la sesión de nadie', async () => {
    const client = await createClientUser()
    await loginAs(client)
    const before = await dbToken(client.id)

    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma-falsa'
    const res = await request(app).post('/api/auth/logout').set('Cookie', `access_token=${forged}`)

    expect(res.status).toBe(200)
    expect(await dbToken(client.id)).toBe(before)
  })
})

describe('refresh token', () => {
  it('se guarda como hash (SHA-256) y no como el token que recibe el navegador', async () => {
    const client = await createClientUser()
    const { refresh } = await loginAs(client)

    const stored = await dbToken(client.id)
    expect(stored).toMatch(HEX64)
    expect(stored).not.toBe(refresh)
  })

  it('renueva la sesión con la cookie y rota el token', async () => {
    const client = await createClientUser()
    const { refresh } = await loginAs(client)
    const first = await dbToken(client.id)

    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`)

    expect(res.status).toBe(200)
    expect(cookieValue(res, 'access_token')).toBeTruthy()
    const next = cookieValue(res, 'refresh_token')!
    expect(next).not.toBe(refresh)
    expect(await dbToken(client.id)).toMatch(HEX64)
    expect(await dbToken(client.id)).not.toBe(first)
  })

  it('un refresh token ya usado deja de servir', async () => {
    const client = await createClientUser()
    const { refresh } = await loginAs(client)
    await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`)

    const again = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`)

    expect(again.status).toBe(401)
    expect(again.body.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('transición: un token guardado en texto plano (sesiones anteriores) todavía se acepta y se pasa a hash', async () => {
    const client = await createClientUser()
    const legacy = jwtProvider.signRefresh({ sub: client.id, email: client.email, role: 'client' })
    await prisma.user.update({ where: { id: client.id }, data: { refreshToken: legacy } })

    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${legacy}`)

    expect(res.status).toBe(200)
    expect(await dbToken(client.id)).toMatch(HEX64)
  })

  it('un token distinto del guardado se rechaza', async () => {
    const client = await createClientUser()
    await loginAs(client)
    const other = jwtProvider.signRefresh({ sub: client.id, email: client.email, role: 'client' })

    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${other}`)

    expect(res.status).toBe(401)
  })
})

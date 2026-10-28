import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { authRepository } from '../../src/modules/auth/auth.repository'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, futureWeekDay, TEST_PASSWORD,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Arreglos menores de auth y cuentas (TDD): emails en minúsculas, toggle de rol, invitaciones,
// limpieza de cookies en el refresh fallido y validación del perfil de la clienta.

const HEX64 = /^[0-9a-f]{64}$/

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] ?? []) as unknown as string[]
}

function cookieLine(res: request.Response, name: string): string | undefined {
  return setCookies(res).find(c => c.startsWith(`${name}=`))
}

async function canLogin(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  return res.status === 200
}

// ── 1. Emails en minúsculas ─────────────────────────────────────────

describe('emails en minúsculas al crear clientas', () => {
  const MIXED = '  Clienta.Mayus@Test.Local '
  const LOWER = 'clienta.mayus@test.local'

  it('el admin crea una clienta con mayúsculas: se guarda en minúsculas y puede iniciar sesión', async () => {
    const admin = await createAdminUser()

    const res = await request(app)
      .post('/api/admin/clients')
      .set('Cookie', cookieFor(admin))
      .send({ name: 'Clienta Mayus', email: MIXED, password: 'Clave12345' })

    expect(res.status).toBe(201)
    const users = await prisma.user.findMany({ where: { role: 'client' } })
    expect(users.map(u => u.email)).toEqual([LOWER])
    expect(await canLogin(LOWER, 'Clave12345')).toBe(true)
  })

  it('el admin no puede crear dos clientas con el mismo email que solo difiere en mayúsculas', async () => {
    const admin = await createAdminUser()
    await createClientUser({ email: LOWER })

    const res = await request(app)
      .post('/api/admin/clients')
      .set('Cookie', cookieFor(admin))
      .send({ name: 'Otra Clienta', email: 'CLIENTA.MAYUS@TEST.LOCAL' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EMAIL_TAKEN')
    expect(await prisma.user.count({ where: { role: 'client' } })).toBe(1)
  })

  it('turno manual del admin con una clienta nueva: guarda el email en minúsculas y reutiliza la cuenta aunque cambien las mayúsculas', async () => {
    const admin = await createAdminUser()
    const pro = await createProfessionalUser()
    const service = await createService()
    const date = futureWeekDay()
    const base = { clientName: 'Clienta Mayus', serviceId: service.id, professionalId: pro.id, date }

    const first = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin))
      .send({ ...base, clientEmail: MIXED, time: '10:00' })
    expect(first.status).toBe(201)

    const second = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin))
      .send({ ...base, clientEmail: 'CLIENTA.mayus@test.local', time: '12:00' })
    expect(second.status).toBe(201)

    const users = await prisma.user.findMany({ where: { role: 'client' } })
    expect(users.map(u => u.email)).toEqual([LOWER])
    expect(await prisma.appointment.count({ where: { clientId: users[0].id } })).toBe(2)
  })

  it('turno manual de la profesional: guarda el email en minúsculas y reutiliza la cuenta existente', async () => {
    const pro = await createProfessionalUser()
    const service = await createService()
    const existing = await createClientUser({ email: LOWER })

    const res = await request(app)
      .post('/api/professional/appointments')
      .set('Cookie', cookieFor(pro))
      .send({ clientName: 'Clienta Mayus', clientEmail: MIXED, serviceId: service.id, date: futureWeekDay(), time: '10:00' })

    expect(res.status).toBe(201)
    const users = await prisma.user.findMany({ where: { role: 'client' } })
    expect(users.map(u => u.id)).toEqual([existing.id])
    expect(await prisma.appointment.count({ where: { clientId: existing.id } })).toBe(1)
  })

  it('turno manual de la profesional con una clienta nueva: el email queda en minúsculas', async () => {
    const pro = await createProfessionalUser()
    const service = await createService()

    const res = await request(app)
      .post('/api/professional/appointments')
      .set('Cookie', cookieFor(pro))
      .send({ clientName: 'Clienta Mayus', clientEmail: MIXED, serviceId: service.id, date: futureWeekDay(), time: '10:00' })

    expect(res.status).toBe(201)
    const users = await prisma.user.findMany({ where: { role: 'client' } })
    expect(users.map(u => u.email)).toEqual([LOWER])
  })
})

// ── 2. toggleRole ───────────────────────────────────────────────────

describe('PATCH /api/professional/:id/toggle-role', () => {
  const toggle = (id: string, cookie?: string) => {
    const r = request(app).patch(`/api/professional/${id}/toggle-role`)
    return cookie ? r.set('Cookie', cookie) : r
  }
  const roleOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).role

  it('sobre una clienta responde 400 INVALID_ROLE_CHANGE y el rol no cambia', async () => {
    const admin = await createAdminUser()
    const client = await createClientUser()

    const res = await toggle(client.id, cookieFor(admin))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_ROLE_CHANGE')
    expect(await roleOf(client.id)).toBe('client')
  })

  it('una profesional pasa a admin', async () => {
    const admin = await createAdminUser()
    const pro = await createProfessionalUser()

    const res = await toggle(pro.id, cookieFor(admin))

    expect(res.status).toBe(200)
    expect(await roleOf(pro.id)).toBe('admin')
  })

  it('otra admin pasa a professional', async () => {
    const admin = await createAdminUser()
    const other = await createAdminUser()

    const res = await toggle(other.id, cookieFor(admin))

    expect(res.status).toBe(200)
    expect(await roleOf(other.id)).toBe('professional')
  })

  it('sobre uno mismo responde 403 SELF_ROLE_CHANGE', async () => {
    const admin = await createAdminUser()

    const res = await toggle(admin.id, cookieFor(admin))

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('SELF_ROLE_CHANGE')
    expect(await roleOf(admin.id)).toBe('admin')
  })

  it('una profesional (no admin) recibe 403 y nada cambia', async () => {
    const pro = await createProfessionalUser()
    const other = await createProfessionalUser()

    const res = await toggle(other.id, cookieFor(pro))

    expect(res.status).toBe(403)
    expect(await roleOf(other.id)).toBe('professional')
  })

  it('sin sesión responde 401', async () => {
    const pro = await createProfessionalUser()
    const res = await toggle(pro.id)
    expect(res.status).toBe(401)
    expect(await roleOf(pro.id)).toBe('professional')
  })

  it('una usuaria inexistente responde 404', async () => {
    const admin = await createAdminUser()
    const res = await toggle(randomUUID(), cookieFor(admin))
    expect(res.status).toBe(404)
  })
})

// ── 3. Invitaciones ─────────────────────────────────────────────────

describe('POST /api/invitations/register', () => {
  const INVITED = 'invitada@test.local'
  const NEW_PASSWORD = 'ClaveNueva123'

  async function invite(email: string): Promise<string> {
    const admin = await createAdminUser()
    const res = await request(app).post('/api/invitations').set('Cookie', cookieFor(admin)).send({ email })
    expect(res.status).toBe(201)
    return (await prisma.invitation.findFirstOrThrow({ where: { email } })).token
  }

  const register = (token: string, extra: Record<string, unknown> = {}) =>
    request(app).post('/api/invitations/register').send({
      token, name: 'Profesional Nueva', phone: '3764111111', gender: 'female', password: NEW_PASSWORD, ...extra,
    })

  it('si el email pertenece a una cuenta admin responde 409 ADMIN_ACCOUNT, no toca la cuenta y no gasta la invitación', async () => {
    const existing = await createAdminUser({ email: INVITED })
    const token = await invite(INVITED)
    const before = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })

    const res = await register(token)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ADMIN_ACCOUNT')
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })
    expect(after.role).toBe('admin')
    expect(after.passwordHash).toBe(before.passwordHash)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { token } })).used).toBe(false)
    expect(await canLogin(INVITED, TEST_PASSWORD)).toBe(true)
  })

  it('si el email pertenece a una cuenta inactiva responde 409 ACCOUNT_INACTIVE', async () => {
    const existing = await createClientUser({ email: INVITED, active: false })
    const token = await invite(INVITED)

    const res = await register(token)

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ACCOUNT_INACTIVE')
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })
    expect(after.role).toBe('client')
    expect(after.active).toBe(false)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { token } })).used).toBe(false)
  })

  it('si el email se ocupa justo antes de crear la cuenta responde 409 EMAIL_TAKEN y no gasta la invitación', async () => {
    const token = await invite(INVITED)
    // Simula la carrera: la consulta previa no ve la cuenta, pero existe cuando se hace el INSERT.
    await createClientUser({ email: INVITED })
    const spy = vi.spyOn(authRepository, 'findAnyByEmail').mockResolvedValueOnce(null)

    const res = await register(token)
    spy.mockRestore()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EMAIL_TAKEN')
    expect((await prisma.invitation.findUniqueOrThrow({ where: { token } })).used).toBe(false)
  })

  it('dos registros simultáneos con el mismo token: uno 201, el otro 400 TOKEN_USED y una sola cuenta', async () => {
    const token = await invite(INVITED)

    const results = await Promise.all([register(token), register(token)])

    expect(results.map(r => r.status).sort()).toEqual([201, 400])
    expect(results.find(r => r.status === 400)!.body.code).toBe('TOKEN_USED')
    expect(await prisma.user.count({ where: { email: INVITED } })).toBe(1)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { token } })).used).toBe(true)
  })

  it('un registro exitoso devuelve el usuario, no el accessToken en el cuerpo, y setea las dos cookies', async () => {
    const token = await invite(INVITED)

    const res = await register(token)

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe(INVITED)
    expect(res.body.user.role).toBe('professional')
    expect(res.body).not.toHaveProperty('accessToken')
    expect(cookieLine(res, 'access_token')).toBeTruthy()
    const refresh = cookieLine(res, 'refresh_token')!
    expect(refresh).toBeTruthy()
    expect(refresh).toContain('Path=/api/auth/refresh')
    expect(refresh).toContain('HttpOnly')

    // la sesión del dispositivo queda en refresh_sessions, con el hash del token (no el token)
    const invited = await prisma.user.findUniqueOrThrow({ where: { email: INVITED } })
    const [session] = await prisma.refreshSession.findMany({ where: { userId: invited.id } })
    expect(session.tokenHash).toMatch(HEX64)
    expect(session.tokenHash).not.toBe(refresh.split(';')[0].slice('refresh_token='.length))
  })

  it('el access_token de la cookie sirve para entrar a una ruta protegida', async () => {
    const token = await invite(INVITED)
    const res = await register(token)
    expect(res.status).toBe(201)
    const access = cookieLine(res, 'access_token')!.split(';')[0]

    const me = await request(app).get('/api/auth/me').set('Cookie', access)

    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(INVITED)
  })

  it('una clienta existente invitada pasa a professional con la contraseña nueva', async () => {
    const existing = await createClientUser({ email: INVITED })
    const token = await invite(INVITED)

    const res = await register(token)

    expect(res.status).toBe(201)
    const after = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })
    expect(after.role).toBe('professional')
    expect(await canLogin(INVITED, NEW_PASSWORD)).toBe(true)
    expect(await canLogin(INVITED, TEST_PASSWORD)).toBe(false)
    expect((await prisma.invitation.findUniqueOrThrow({ where: { token } })).used).toBe(true)
    expect(await prisma.user.count({ where: { email: INVITED } })).toBe(1)
  })
})

// ── 4. Refresh fallido limpia las cookies ───────────────────────────

describe('POST /api/auth/refresh fallido', () => {
  it('con un refresh token no guardado responde 401 INVALID_REFRESH_TOKEN y borra las dos cookies', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=token-que-no-existe')

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN')
    const access = cookieLine(res, 'access_token')
    const refresh = cookieLine(res, 'refresh_token')
    expect(access).toBeTruthy()
    expect(refresh).toBeTruthy()
    expect(access!.startsWith('access_token=;')).toBe(true)
    expect(refresh!.startsWith('refresh_token=;')).toBe(true)
    expect(refresh).toContain('Path=/api/auth/refresh')
  })

  it('sin cookie responde 401 NO_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/api/auth/refresh')

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('NO_REFRESH_TOKEN')
  })
})

// ── 5. Perfil de la clienta ─────────────────────────────────────────

describe('PATCH /api/client/profile', () => {
  const patch = (cookie: string, body: Record<string, unknown>) =>
    request(app).patch('/api/client/profile').set('Cookie', cookie).send(body)

  const snapshot = async (id: string) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, include: { client: true } })
    return { name: u.name, phone: u.phone, email: u.email, role: u.role, active: u.active, blocked: u.client?.blocked }
  }

  it('un nombre y un teléfono válidos actualizan y responden 200', async () => {
    const client = await createClientUser()

    const res = await patch(cookieFor(client), { name: 'Nombre Nuevo', phone: '3764999999' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Nombre Nuevo')
    const after = await snapshot(client.id)
    expect(after.name).toBe('Nombre Nuevo')
    expect(after.phone).toBe('3764999999')
  })

  it('acepta el largo máximo (nombre de 100 y teléfono de 20)', async () => {
    const client = await createClientUser()

    const res = await patch(cookieFor(client), { name: 'a'.repeat(100), phone: '1'.repeat(20) })

    expect(res.status).toBe(200)
    const after = await snapshot(client.id)
    expect(after.name).toHaveLength(100)
    expect(after.phone).toHaveLength(20)
  })

  it('un nombre de 101 caracteres responde 400 VALIDATION_ERROR y no modifica nada', async () => {
    const client = await createClientUser()
    const before = await snapshot(client.id)

    const res = await patch(cookieFor(client), { name: 'a'.repeat(101) })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await snapshot(client.id)).toEqual(before)
  })

  it('un teléfono de 21 caracteres responde 400 VALIDATION_ERROR y no modifica nada', async () => {
    const client = await createClientUser()
    const before = await snapshot(client.id)

    const res = await patch(cookieFor(client), { name: 'Nombre Nuevo', phone: '1'.repeat(21) })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await snapshot(client.id)).toEqual(before)
  })

  it.each([
    ['número',  123],
    ['objeto',  { a: 1 }],
    ['arreglo', ['x']],
  ])('un nombre que es %s responde 400 VALIDATION_ERROR y no modifica nada', async (_tipo, value) => {
    const client = await createClientUser()
    const before = await snapshot(client.id)

    const res = await patch(cookieFor(client), { name: value })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await snapshot(client.id)).toEqual(before)
  })

  it.each([
    ['número',  3764000000],
    ['objeto',  { a: 1 }],
    ['arreglo', ['3764']],
  ])('un teléfono que es %s responde 400 VALIDATION_ERROR y no modifica nada', async (_tipo, value) => {
    const client = await createClientUser()
    const before = await snapshot(client.id)

    const res = await patch(cookieFor(client), { phone: value })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await snapshot(client.id)).toEqual(before)
  })

  it('ignora email, rol, active y blocked enviados en el cuerpo', async () => {
    const client = await createClientUser()
    const before = await snapshot(client.id)

    const res = await patch(cookieFor(client), {
      name: 'Nombre Nuevo', email: 'otro@test.local', role: 'admin', active: false, blocked: true,
    })

    expect(res.status).toBe(200)
    const after = await snapshot(client.id)
    expect(after).toEqual({ ...before, name: 'Nombre Nuevo' })
  })

  it('sin sesión responde 401', async () => {
    const res = await request(app).patch('/api/client/profile').send({ name: 'Nombre Nuevo' })
    expect(res.status).toBe(401)
  })

  it('una profesional no puede usar el perfil de clienta (403)', async () => {
    const pro = await createProfessionalUser()
    const res = await patch(cookieFor(pro), { name: 'Nombre Nuevo' })
    expect(res.status).toBe(403)
  })
})

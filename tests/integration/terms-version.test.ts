import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { PRIVACY_POLICY_VERSION } from '../../src/app/constants/legal'
import { createClientUser, createProfessionalUser, createAdminUser, createService, tomorrowStr, TEST_PASSWORD } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-08 — junto con la fecha/hora de aceptación se graba la versión de la política.
describe('versión de la política aceptada', () => {
  it('el registro graba fecha y versión de la política', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Vera', lastName: 'Sion', phone: '1155550010', email: 'version@test.local',
      password: 'Password123', termsAccepted: true,
    })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'version@test.local' } })
    expect(user.termsAcceptedAt).not.toBeNull()
    expect(user.termsVersion).toBe(PRIVACY_POLICY_VERSION)
  })

  it('confirmar una reserva vuelve a grabar fecha y versión (cuentas viejas sin versión)', async () => {
    const client = await createClientUser()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: client.id } })).termsVersion).toBeNull()
    const pro = await createProfessionalUser()
    const svc = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: client.id } })
    expect(user.termsAcceptedAt).not.toBeNull()
    expect(user.termsVersion).toBe(PRIVACY_POLICY_VERSION)
  })

  it('si no acepta la política no se graba nada', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'No', lastName: 'Acepta', phone: '1155550011', email: 'noacepta@test.local',
      password: 'Password123', termsAccepted: false,
    })
    expect(res.status).toBe(422)
    expect(await prisma.user.count({ where: { email: 'noacepta@test.local' } })).toBe(0)
  })
})

// La versión de la política solo se graba: ningún flujo la compara, así que cambiarla (2026-09 → 2026-11) no
// bloquea a nadie ni obliga a volver a aceptar.
describe('cambio de versión de la política (2026-09 → 2026-11)', () => {
  it('la versión vigente es 2026-11', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('2026-11')
  })

  it('una clienta que aceptó 2026-09 inicia sesión sin que se le pida nada y no se le toca la versión', async () => {
    const client = await createClientUser({ email: 'vieja@test.local' })
    const accepted = new Date('2026-09-20T12:00:00Z')
    await prisma.user.update({ where: { id: client.id }, data: { termsAcceptedAt: accepted, termsVersion: '2026-09' } })

    const login = await request(app).post('/api/auth/login').send({ email: 'vieja@test.local', password: TEST_PASSWORD })
    expect(login.status).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: client.id } })
    expect(user.termsVersion).toBe('2026-09')
    expect(user.termsAcceptedAt?.getTime()).toBe(accepted.getTime())
  })

  it('al reservar, esa misma clienta queda con la versión nueva (solo se regraba lo que ya se acepta al confirmar)', async () => {
    const client = await createClientUser()
    await prisma.user.update({ where: { id: client.id }, data: { termsAcceptedAt: new Date('2026-09-20T12:00:00Z'), termsVersion: '2026-09' } })
    const pro = await createProfessionalUser()
    const svc = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: tomorrowStr(), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(201)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: client.id } })).termsVersion).toBe('2026-11')
  })

  it('la administradora y las profesionales (sin versión aceptada) siguen entrando y operando', async () => {
    const admin = await createAdminUser({ email: 'admin.version@test.local' })
    const pro   = await createProfessionalUser({ email: 'pro.version@test.local' })
    expect(admin.termsVersion).toBeNull()
    expect(pro.termsVersion).toBeNull()

    for (const email of ['admin.version@test.local', 'pro.version@test.local']) {
      const login = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })
      expect(login.status, email).toBe(200)
    }
    expect((await request(app).get('/api/admin/clients').set('Cookie', cookieFor(admin))).status).toBe(200)
    expect((await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))).status).toBe(200)
  })
})

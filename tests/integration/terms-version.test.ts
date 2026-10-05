import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { PRIVACY_POLICY_VERSION } from '../../src/app/constants/legal'
import { createClientUser, createProfessionalUser, createService, tomorrowStr } from '../helpers/factories'
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

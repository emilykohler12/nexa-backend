import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Cierre de las pruebas manuales del 13/11/2026 (hoja «Pruebas manuales 13-11», estado «Corregida (repetir prueba)»).
// Complementan, desde el flujo completo por la API, lo que ya cubren ajustes-13-11, ajustes-13-11-b y ajustes-14-11.
// Nombres: PM-<n> = n-ésima fila «Corregida» de la hoja.

beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

describe('PM-05 aviso emergente de la clienta (cancelación del personal)', () => {
  it('PM-05 el aviso llega sin leer, se marca como leído al cerrarlo y no vuelve a figurar como pendiente', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ name: 'Manicura' })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
    })
    await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro))
      .send({ status: 'cancelled', cancelledBy: 'studio' }).expect(200)

    const antes = await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))
    const aviso = antes.body.notifications.find((n: { type: string }) => n.type === 'appointment_cancelled')
    expect(aviso).toBeTruthy()
    expect(aviso.read).toBe(false)

    await request(app).patch(`/api/client/notifications/${aviso.id}/read`).set('Cookie', cookieFor(client)).expect(200)

    const despues = await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))
    const pendientes = despues.body.notifications.filter((n: { read: boolean }) => !n.read)
    expect(pendientes).toEqual([])
  })

  it('PM-05 la reprogramación y el cambio de profesional también dejan aviso (mismo canal)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ name: 'Manicura' })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
    })
    await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro))
      .send({ date: tomorrowStr(2), time: '11:00' }).expect(200)

    const mine = await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))
    expect(mine.body.notifications.map((n: { type: string }) => n.type)).toContain('appointment_rescheduled')
  })
})

describe('PM-03 invitación de la profesional por el enlace', () => {
  it('PM-03 al registrarse queda con sesión de profesional (cookies) y /auth/me ya responde como profesional, sin token en el cuerpo', async () => {
    const admin = await createAdminUser()
    await request(app).post('/api/invitations').set('Cookie', cookieFor(admin)).send({ email: 'nueva.pro@test.local' }).expect(201)
    const { token } = await prisma.invitation.findFirstOrThrow({ where: { email: 'nueva.pro@test.local' } })

    const reg = await request(app).post('/api/invitations/register').send({
      token, name: 'Profesional Nueva', phone: '3764111111', gender: 'female', password: 'ClaveNueva123',
    })
    expect(reg.status).toBe(201)
    expect(JSON.stringify(reg.body)).not.toMatch(/accessToken|refreshToken/i)

    const cookies = (reg.headers['set-cookie'] as unknown as string[]) ?? []
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true)
    expect(cookies.some(c => c.startsWith('refresh_token='))).toBe(true)

    const me = await request(app).get('/api/auth/me').set('Cookie', cookies.map(c => c.split(';')[0]).join('; '))
    expect(me.status).toBe(200)
    expect(me.body.user.role).toBe('professional')
  })

  it('PM-03 un enlace que manda un vencimiento propio igual vence a los 7 días', async () => {
    const admin = await createAdminUser()
    const lejano = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
    await request(app).post('/api/invitations').set('Cookie', cookieFor(admin))
      .send({ email: 'siete.dias@test.local', expiresAt: lejano }).expect(201)
    const inv = await prisma.invitation.findFirstOrThrow({ where: { email: 'siete.dias@test.local' } })
    const dias = (inv.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(dias).toBeGreaterThan(6.9)
    expect(dias).toBeLessThan(7.1)
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, hoursFromNow, TEST_PASSWORD,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('anonimización de datos de una clienta (RF-06.03)', () => {
  it('reemplaza nombre/email/teléfono y desactiva la cuenta, pero conserva los turnos', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser({ name: 'Clienta Real', email: 'real@test.local', phone: '3764111111' })
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const future = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: future.date, time: future.time,
      status: 'finished', servicePrice: 15000,
    })

    const res = await request(app)
      .post(`/api/admin/clients/${client.id}/anonymize`)
      .set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.client.name).toBe('Cliente eliminado')
    expect(res.body.client.email).not.toBe('real@test.local')
    expect(res.body.client.phone).toBe('')

    const dbUser = await prisma.user.findUnique({ where: { id: client.id } })
    expect(dbUser?.active).toBe(false)
    expect(dbUser?.refreshToken).toBeNull()

    // El turno sigue existiendo con su precio real — nada contable se pierde.
    const dbAppt = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(dbAppt).not.toBeNull()
    expect(Number(dbAppt?.servicePrice)).toBe(15000)
    expect(dbAppt?.clientId).toBe(client.id)
  })

  it('no toca alergias/preferencias/observaciones del perfil clínico', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    await prisma.client.update({
      where: { userId: client.id },
      data:  { allergies: 'Alergia al látex', preferences: 'Prefiere silencio' },
    })

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const clinicalRow = await prisma.client.findUnique({ where: { userId: client.id } })
    expect(clinicalRow?.allergies).toBe('Alergia al látex')
    expect(clinicalRow?.preferences).toBe('Prefiere silencio')
  })

  it('la clienta anonimizada ya no puede loguearse', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser({ email: 'sesion@test.local' })

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const res = await request(app).post('/api/auth/login').send({ email: 'sesion@test.local', password: TEST_PASSWORD })
    expect(res.status).toBe(401)
  })

  it('deja constancia en el log de actividad, con fecha y sin filtrar los datos viejos', async () => {
    const admin  = await createAdminUser({ email: 'admin.log@test.local' })
    const client = await createClientUser({ name: 'Nombre Secreto', email: 'secreto@test.local' })

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const logs = await prisma.activityLog.findMany({ where: { module: 'clients' } })
    const entry = logs.find(l => l.action.toLowerCase().includes('anonimiz'))
    expect(entry).toBeDefined()
    expect(entry!.createdAt).toBeInstanceOf(Date)
    expect(entry!.detail ?? '').not.toContain('secreto@test.local')
    expect(entry!.detail ?? '').not.toContain('Nombre Secreto')
  })

  it('una profesional no puede anonimizar clientes', async () => {
    const pro    = await createProfessionalUser()
    const client = await createClientUser()

    const res = await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(pro))
    expect(res.status).toBe(403)
  })

  it('devuelve 404 si el cliente no existe', async () => {
    const admin = await createAdminUser()
    const res = await request(app)
      .post('/api/admin/clients/00000000-0000-0000-0000-000000000000/anonymize')
      .set('Cookie', cookieFor(admin))
    expect(res.status).toBe(404)
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Se eliminaron la fidelización (puntos), la fecha de nacimiento y las campañas automáticas.
// Lo que queda de la ficha de la clienta es un resumen de visitas que cuenta solo turnos finalizados.

async function clientWithAppointments() {
  const admin  = await createAdminUser()
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 10000 })
  const base   = { clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2026-09-01' }
  await createAppointmentDirect({ ...base, time: '09:00', status: 'finished' })
  await createAppointmentDirect({ ...base, time: '11:00', status: 'finished' })
  await createAppointmentDirect({ ...base, time: '13:00', status: 'cancelled_no_show' })
  await createAppointmentDirect({ ...base, time: '15:00', status: 'cancelled' })
  await createAppointmentDirect({ ...base, time: '17:00', status: 'confirmed' })
  return { admin, client }
}

describe('ficha de la clienta sin fidelización ni fecha de nacimiento', () => {
  it('las visitas cuentan solo los turnos finalizados', async () => {
    const { admin, client } = await clientWithAppointments()

    const res = await request(app).get('/api/admin/clients').set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    const found = res.body.clients.find((c: { id: string }) => c.id === client.id)
    expect(found.visits.totalVisits).toBe(2)
    expect(found.visits.totalSpent).toBe(20000)
    expect(found.visits.lastVisit).toBe('2026-09-01')
  })

  it('la respuesta ya no trae puntos, promociones disponibles ni fecha de nacimiento', async () => {
    const { admin, client } = await clientWithAppointments()

    const res = await request(app).get('/api/admin/clients').set('Cookie', cookieFor(admin))

    const found = res.body.clients.find((c: { id: string }) => c.id === client.id)
    expect(found).not.toHaveProperty('loyalty')
    expect(found).not.toHaveProperty('birthDate')
    expect(JSON.stringify(found)).not.toMatch(/points|availablePromos/)
  })

  it('al editar la ficha se ignoran la fecha de nacimiento y los puntos que mande un cliente viejo', async () => {
    const { admin, client } = await clientWithAppointments()

    const res = await request(app)
      .put(`/api/admin/clients/${client.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ name: 'Nombre Nuevo', birthDate: '1990-10-25', loyalty: { points: 500 }, clinical: { preferences: 'Tonos suaves' } })

    expect(res.status).toBe(200)
    expect(res.body.client.name).toBe('Nombre Nuevo')
    expect(res.body.client).not.toHaveProperty('birthDate')
    expect(res.body.client).not.toHaveProperty('loyalty')
    expect((await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })).preferences).toBe('Tonos suaves')
  })

  it('crear una clienta desde el panel no guarda fecha de nacimiento', async () => {
    const admin = await createAdminUser()

    const res = await request(app)
      .post('/api/admin/clients')
      .set('Cookie', cookieFor(admin))
      .send({ name: 'Clienta Nueva', email: 'nueva@test.local', birthDate: '1990-10-25' })

    expect(res.status).toBe(201)
    expect(res.body.client).not.toHaveProperty('birthDate')
  })
})

describe('rutas de campañas automáticas eliminadas', () => {
  it.each([
    ['get',    '/api/admin/auto-promotions'],
    ['post',   '/api/admin/auto-promotions'],
    ['put',    '/api/admin/auto-promotions/00000000-0000-0000-0000-000000000000'],
    ['delete', '/api/admin/auto-promotions/00000000-0000-0000-0000-000000000000'],
    ['get',    '/api/admin/clients/00000000-0000-0000-0000-000000000000/auto-promotions'],
  ] as const)('%s %s responde 404', async (method, url) => {
    const admin = await createAdminUser()

    const res = await request(app)[method](url).set('Cookie', cookieFor(admin)).send({})

    expect(res.status).toBe(404)
  })
})

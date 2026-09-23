import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, todayStr } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('dashboard del admin — KPIs (period=day)', () => {
  it('cuenta turnos finalizados hoy como "atendidos" y con precio real', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 8000 })

    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: todayStr(), time: '10:00', status: 'finished', servicePrice: 8000,
    })
    // Este NO debería contar — está confirmado, no finalizado.
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: todayStr(), time: '11:00', status: 'confirmed',
    })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.dashboard.attendedAppointments).toBe(1)
  })

  it('cuenta los no_show de hoy', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()

    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: todayStr(), time: '09:00', status: 'no_show',
    })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    expect(res.body.dashboard.noShowAppointments).toBe(1)
  })

  it('limita el ranking de servicios más rentables a 10, ordenado por turnos realizados', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()

    // 11 servicios distintos, cada uno con una cantidad decreciente de turnos
    // finalizados hoy (11, 10, ..., 1) — el top 10 debe ser por cantidad, no
    // precio. Cada turno usa una profesional propia para no chocar con el
    // índice único (profesional + fecha + hora) — acá no importa quién lo hizo.
    for (let i = 11; i >= 1; i--) {
      const svc = await createService({ name: `Servicio ${i}`, price: 1000 })
      for (let n = 0; n < i; n++) {
        const pro = await createProfessionalUser()
        await createAppointmentDirect({
          clientId: client.id, professionalId: pro.id, serviceId: svc.id,
          date: todayStr(), time: '10:00',
          status: 'finished', servicePrice: 1000,
        })
      }
    }

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    const ranking = res.body.dashboard.serviceProfitability
    expect(ranking.length).toBeLessThanOrEqual(10)
    expect(ranking[0].name).toBe('Servicio 11')
  })

  it('una clienta no puede ver el dashboard del admin', async () => {
    const client = await createClientUser()
    const res = await request(app).get('/api/admin/dashboard').set('Cookie', cookieFor(client))
    expect(res.status).toBe(403)
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, todayStr } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('reglas de retiro de esmalte (configuración)', () => {
  it('el admin puede guardar y leer la lista de reglas', async () => {
    const admin = await createAdminUser()

    const save = await request(app)
      .patch('/api/settings/polish-removal-rules')
      .set('Cookie', cookieFor(admin))
      .send({ rules: [{ id: 'r1', label: 'Capping', price: 3000 }, { id: 'r2', label: 'Softgel', price: 5000 }] })

    expect(save.status).toBe(200)
    expect(save.body.rules).toHaveLength(2)

    const get = await request(app).get('/api/settings/polish-removal-rules').set('Cookie', cookieFor(admin))
    expect(get.status).toBe(200)
    expect(get.body.rules).toEqual([{ id: 'r1', label: 'Capping', price: 3000 }, { id: 'r2', label: 'Softgel', price: 5000 }])
  })

  it('una profesional no puede tocar las reglas', async () => {
    const pro = await createProfessionalUser()
    const res = await request(app)
      .patch('/api/settings/polish-removal-rules')
      .set('Cookie', cookieFor(pro))
      .send({ rules: [] })
    expect(res.status).toBe(403)
  })
})

describe('registro del retiro de esmalte en un turno (solo control, no suma a nada)', () => {
  it('el admin lo registra y queda visible en la vista admin del turno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}/polish-removal`)
      .set('Cookie', cookieFor(admin))
      .send({ label: 'Capping', price: 3000 })

    expect(res.status).toBe(200)
    expect(res.body.appointment.polishRemoval).toEqual({ label: 'Capping', price: 3000 })

    // No suma a servicePrice ni a nada — servicePrice queda intacto.
    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(Number(fresh?.servicePrice)).toBe(20000)
    expect(fresh?.polishRemovalLabel).toBe('Capping')
    expect(Number(fresh?.polishRemovalPrice)).toBe(3000)
  })

  it('deja constancia en el log de actividad', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
    })

    await request(app)
      .patch(`/api/admin/appointments/${appt.id}/polish-removal`)
      .set('Cookie', cookieFor(admin))
      .send({ label: 'Softgel', price: 5000 })

    const logs = await prisma.activityLog.findMany({ where: { action: 'Retiro de esmalte registrado' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].detail).toContain('Softgel')
  })

  it('no afecta el KPI de saldo pendiente del dashboard', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService({ price: 20000 })
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '10:00',
      paymentStatus: 'partial', depositAmount: 5000,
    })

    const before = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    await request(app)
      .patch(`/api/admin/appointments/${appt.id}/polish-removal`)
      .set('Cookie', cookieFor(admin))
      .send({ label: 'Capping', price: 3000 })

    const after = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))
    expect(after.body.dashboard.pendingBalance).toBe(before.body.dashboard.pendingBalance)
  })
})

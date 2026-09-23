import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('auditoría de cambios de estado de un turno', () => {
  it('la profesional marca "no asistió" y queda registrado en el log de actividad', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser({ name: 'Profesional Auditada' })
    const svc    = await createService()
    const past   = hoursFromNow(-2)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: past.date, time: past.time,
    })

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ status: 'no_show' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.status).toBe('no_show')

    const logs = await prisma.activityLog.findMany({ where: { module: 'appointments' } })
    const entry = logs.find(l => l.detail?.includes('"confirmed" → "no_show"'))
    expect(entry).toBeDefined()
    expect(entry!.userName).toBe('Profesional Auditada')
  })

  it('el admin marca "finalizado" y queda registrado con su identidad', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser({ email: 'auditor@test.local' })
    const svc    = await createService()
    const past   = hoursFromNow(-2)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: past.date, time: past.time,
    })

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ status: 'finished' })

    expect(res.status).toBe(200)

    const logs = await prisma.activityLog.findMany({ where: { module: 'appointments' } })
    const entry = logs.find(l => l.detail?.includes('"confirmed" → "finished"'))
    expect(entry).toBeDefined()
    expect(entry!.userName).toBe('auditor@test.local')
  })

  it('no duplica el log si se guarda sin cambiar el estado', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const past   = hoursFromNow(-2)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: past.date, time: past.time,
    })

    await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ status: 'confirmed', internalNotes: 'sin cambios de estado' })

    const logs = await prisma.activityLog.findMany({ where: { module: 'appointments' } })
    expect(logs.some(l => l.detail?.includes('→'))).toBe(false)
  })
})

describe('permisos cruzados entre profesionales', () => {
  it('una profesional no puede modificar el turno de otra', async () => {
    const client  = await createClientUser()
    const owner   = await createProfessionalUser()
    const stranger = await createProfessionalUser()
    const svc     = await createService()
    const future  = hoursFromNow(48)
    const appt    = await createAppointmentDirect({
      clientId: client.id, professionalId: owner.id, serviceId: svc.id, date: future.date, time: future.time,
    })

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(stranger))
      .send({ status: 'finished' })

    expect(res.status).toBe(404)
  })

  it('una clienta no puede crear turnos manuales (endpoint de profesional)', async () => {
    const client = await createClientUser()
    const res = await request(app)
      .post('/api/professional/appointments')
      .set('Cookie', cookieFor(client))
      .send({ clientName: 'Walk-in', serviceId: 'x', date: '2026-01-01', time: '10:00' })
    expect(res.status).toBe(403)
  })

  it('sin cookie, todo endpoint de turnos devuelve 401, no 403 ni 500', async () => {
    const res = await request(app).get('/api/professional/appointments')
    expect(res.status).toBe(401)
  })
})

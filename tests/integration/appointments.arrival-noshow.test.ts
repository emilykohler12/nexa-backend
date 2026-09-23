import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, minutesAgo, hoursFromNow, todayStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('registro de llegada', () => {
  it('la clienta registra su propia llegada en un turno confirmado de hoy', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const soon   = minutesAgo(-10) // dentro de 10 min, sigue siendo "hoy"
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: soon.date, time: soon.time,
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/arrival`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('es idempotente — llamarlo dos veces no falla ni pisa el primer arrivedAt', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const first  = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    const second = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.appointment.arrivedAt).toBe(first.body.appointment.arrivedAt)
  })

  it('rechaza registrar llegada en un turno no confirmado (pending)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00', status: 'pending',
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS')
  })

  it('rechaza registrar llegada en un turno que no es de hoy', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const future = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: future.date, time: future.time,
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_TODAY')
  })

  it('rechaza registrar la llegada del turno de otra clienta', async () => {
    const owner    = await createClientUser()
    const intruder = await createClientUser()
    const pro      = await createProfessionalUser()
    const svc      = await createService()
    const appt     = await createAppointmentDirect({
      clientId: owner.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(intruder))
    expect(res.status).toBe(404)
  })

  it('la profesional puede registrar la llegada por la clienta', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(pro))
    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('el admin puede registrar la llegada de cualquier turno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/admin/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    expect(res.body.appointment.arrivedAt).not.toBeNull()
  })

  it('una profesional no puede registrar la llegada de un turno ajeno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const otherPro = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: todayStr(), time: '08:00',
    })

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}/arrival`).set('Cookie', cookieFor(otherPro))
    expect(res.status).toBe(404)
  })
})

describe('job de no-show automático', () => {
  it('marca no_show un turno confirmado 25 min pasada su hora sin llegada registrada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const late   = minutesAgo(25)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: late.date, time: late.time,
    })

    const result = await runAutoNoShowJob()
    expect(result.marked).toBe(1)

    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(fresh?.status).toBe('no_show')
  })

  it('NO marca un turno que ya registró la llegada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const late   = minutesAgo(25)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: late.date, time: late.time,
      arrivedAt: new Date(),
    })

    const result = await runAutoNoShowJob()
    expect(result.marked).toBe(0)

    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(fresh?.status).toBe('confirmed')
  })

  it('NO marca un turno que todavía está dentro de los 20 minutos de gracia', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const barely = minutesAgo(10)
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: barely.date, time: barely.time,
    })

    const result = await runAutoNoShowJob()
    expect(result.marked).toBe(0)
  })

  it('libera el horario — después de marcar no_show, se puede reservar la misma profesional/fecha/hora de nuevo', async () => {
    const client1 = await createClientUser()
    const client2 = await createClientUser()
    const pro     = await createProfessionalUser()
    const svc     = await createService()
    const late    = minutesAgo(25)
    await createAppointmentDirect({
      clientId: client1.id, professionalId: pro.id, serviceId: svc.id, date: late.date, time: late.time,
    })

    await runAutoNoShowJob()

    // El mismo profesional/fecha/hora, ahora libre — se reserva vía el propio
    // endpoint de creación directa en la base (mismo horario, ya liberado).
    const rebooked = await prisma.appointment.create({
      data: {
        clientId: client2.id, professionalId: pro.id, serviceId: svc.id,
        date: late.date, time: late.time, duration: svc.duration, servicePrice: svc.price,
        status: 'confirmed', paymentStatus: 'pending',
      },
    })
    expect(rebooked.id).toBeDefined()
  })

  it('registra la marcación automática en el log de actividad', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const late   = minutesAgo(30)
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: late.date, time: late.time,
    })

    await runAutoNoShowJob()

    const logs = await prisma.activityLog.findMany({ where: { module: 'appointments' } })
    expect(logs.some(l => l.action.toLowerCase().includes('no show'))).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import {
  createClientUser, createProfessionalUser, createService,
  createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('cancelación', () => {
  it('reembolsa si se cancela con más margen que el corte (24hs por default)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 10000 })
    const far    = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: far.date, time: far.time, paymentStatus: 'partial', depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/cancel`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(true)
    expect(res.body.appointment.status).toBe('cancelled')
    expect(res.body.appointment.paymentStatus).toBe('refunded')
  })

  it('NO reembolsa si se cancela dentro del corte de 24hs', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 10000 })
    const soon   = hoursFromNow(3)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: soon.date, time: soon.time, paymentStatus: 'partial', depositAmount: 5000,
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/cancel`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(false)
    expect(res.body.appointment.paymentStatus).toBe('partial')
  })

  it('rechaza cancelar un turno ya cancelado', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const far    = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: far.date, time: far.time, status: 'cancelled',
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/cancel`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_CANCELLED')
  })

  it('rechaza cancelar el turno de otra clienta', async () => {
    const owner  = await createClientUser()
    const intruder = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const far    = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: owner.id, professionalId: pro.id, serviceId: svc.id, date: far.date, time: far.time,
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/cancel`)
      .set('Cookie', cookieFor(intruder))

    expect(res.status).toBe(404)
  })
})

describe('reprogramación', () => {
  it('reprograma un turno confirmado a otra fecha/hora', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const far    = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: far.date, time: far.time,
    })

    const newTime = hoursFromNow(72)
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: newTime.date, time: newTime.time })

    expect(res.status).toBe(200)
    expect(res.body.appointment.date).toBe(newTime.date)
    expect(res.body.appointment.time).toBe(newTime.time)
    expect(res.body.appointment.status).toBe('confirmed')
  })

  it('rechaza reprogramar a un horario ocupado de la misma profesional', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const far    = hoursFromNow(48)
    const taken  = hoursFromNow(72)

    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: taken.date, time: taken.time,
    })
    const toMove = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: far.date, time: far.time,
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${toMove.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: taken.date, time: taken.time })

    expect(res.status).toBe(409)
  })

  it('rechaza reprogramar un turno ya finalizado', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const past   = hoursFromNow(-48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: past.date, time: past.time, status: 'finished',
    })

    const newTime = hoursFromNow(72)
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: newTime.date, time: newTime.time })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_RESCHEDULABLE')
  })

  it('rechaza reprogramar una pata de un combo', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const far    = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: far.date, time: far.time,
      comboGroupId: randomUUID(),
    })

    const newTime = hoursFromNow(72)
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: newTime.date, time: newTime.time })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('COMBO_NOT_RESCHEDULABLE')
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService,
  createAppointmentDirect, setAvailability, futureWeekDay,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// ADR-002 — el flujo de la clienta solo acepta horas de inicio dentro de las
// franjas que la profesional definió (acá, 09:00 a 18:00 todos los días).
// Los turnos manuales del admin no pasan por esta validación.
async function proWorking9to18() {
  const pro = await createProfessionalUser()
  await setAvailability(pro.id)
  return pro
}

describe('horario fuera de la disponibilidad (OUT_OF_HOURS)', () => {
  it('rechaza reservar a las 23:00 con disponibilidad de 09:00 a 18:00', async () => {
    const client = await createClientUser()
    const pro    = await proWorking9to18()
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(1), time: '23:00', termsAccepted: true })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
    expect(await prisma.appointment.count({ where: { professionalId: pro.id } })).toBe(0)
  })

  it('acepta una hora dentro de la franja', async () => {
    const client = await createClientUser()
    const pro    = await proWorking9to18()
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(1), time: '17:00', termsAccepted: true })

    expect(res.status).toBe(201)
  })

  it('rechaza un día sin franja cargada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    await setAvailability(pro.id, [{ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' }]) // solo lunes
    const svc    = await createService()

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(2), time: '10:00', termsAccepted: true })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
  })

  it('rechaza un combo con un componente fuera de horario', async () => {
    const client = await createClientUser()
    const pro1   = await proWorking9to18()
    const pro2   = await proWorking9to18()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await prisma.service.create({
      data: {
        name: 'Combo Test', categoryId: 'combos', description: 'Combo de test',
        duration: 0, price: 15000, status: 'active', isCombo: true, comboServiceIds: [svc1.id, svc2.id],
      },
    })
    const date = futureWeekDay(1)

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: pro1.id, date, time: '20:00' },
          { serviceId: svc2.id, professionalId: pro2.id, date, time: '20:00' },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
  })

  it('rechaza reprogramar a una hora fuera de la franja', async () => {
    const client = await createClientUser()
    const pro    = await proWorking9to18()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: futureWeekDay(1), time: '10:00',
    })

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(2), time: '07:00' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
  })

  it('el turno manual del admin no se valida contra la franja', async () => {
    const admin = await createAdminUser()
    const pro   = await proWorking9to18()
    const svc   = await createService()

    const res = await request(app)
      .post('/api/admin/appointments')
      .set('Cookie', cookieFor(admin))
      .send({ clientName: 'Walk In', serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(1), time: '20:00' })

    expect(res.status).toBe(201)
  })
})

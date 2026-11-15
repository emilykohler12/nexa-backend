import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

async function createComboService(componentIds: string[]) {
  return prisma.service.create({
    data: {
      name: 'Combo Test', categoryId: 'combos', description: 'Combo de test',
      duration: 0, price: 15000, status: 'active', isCombo: true, comboServiceIds: componentIds,
    },
  })
}

// M-37 (RF-10, R-26, R-01): un combo se reserva todo o nada. Si una de las profesionales ya tiene ocupado el
// horario, la reserva entera se rechaza con 409 y no queda ningún turno del combo (ni siquiera el de la
// profesional libre).
describe('M-37 combo con una profesional ocupada: todo o nada', () => {
  async function escenario() {
    const client = await createClientUser()
    const otra   = await createClientUser({ email: 'otra.m37@test.local' })
    const libre  = await createProfessionalUser()
    const ocupada = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await createComboService([svc1.id, svc2.id])
    const date   = tomorrowStr()
    await createAppointmentDirect({ clientId: otra.id, professionalId: ocupada.id, serviceId: svc2.id, date, time: '10:00' })
    return { client, libre, ocupada, svc1, svc2, combo, date }
  }

  it('M-37 combo con profesional ocupada no crea ningún turno (la ocupada es la segunda pata)', async () => {
    const { client, libre, ocupada, svc1, svc2, combo, date } = await escenario()
    const antes = await prisma.appointment.count()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: libre.id,   date, time: '10:00' },
          { serviceId: svc2.id, professionalId: ocupada.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
    expect(await prisma.appointment.count()).toBe(antes)
    expect(await prisma.appointment.count({ where: { clientId: client.id } })).toBe(0)
    expect(await prisma.appointment.count({ where: { professionalId: libre.id } })).toBe(0)
  })

  it('M-37 combo con profesional ocupada no crea ningún turno (la ocupada es la primera pata)', async () => {
    const { client, libre, ocupada, svc1, svc2, combo, date } = await escenario()
    const antes = await prisma.appointment.count()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc2.id, professionalId: ocupada.id, date, time: '10:00' },
          { serviceId: svc1.id, professionalId: libre.id,   date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(409)
    expect(await prisma.appointment.count()).toBe(antes)
    expect(await prisma.appointment.count({ where: { professionalId: libre.id } })).toBe(0)
  })

  it('M-37 liberada la profesional, el mismo combo se puede reservar completo', async () => {
    const { client, libre, ocupada, svc1, svc2, combo, date } = await escenario()
    await prisma.appointment.updateMany({ where: { professionalId: ocupada.id }, data: { status: 'cancelled' } })

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: libre.id,   date, time: '10:00' },
          { serviceId: svc2.id, professionalId: ocupada.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(201)
    expect(await prisma.appointment.count({ where: { comboGroupId: res.body.comboGroupId } })).toBe(2)
  })
})

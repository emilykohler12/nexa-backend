import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createService, tomorrowStr } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

async function createComboService(componentIds: string[], price = 15000) {
  return prisma.service.create({
    data: {
      name: 'Combo Test', categoryId: 'combos', description: 'Combo de test',
      duration: 0, price, status: 'active', isCombo: true, comboServiceIds: componentIds,
    },
  })
}

describe('reserva de combos simultáneos', () => {
  it('crea una pata por componente, todas con el mismo comboGroupId, fecha y hora', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await createComboService([svc1.id, svc2.id])
    const date   = tomorrowStr()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: pro1.id, date, time: '10:00' },
          { serviceId: svc2.id, professionalId: pro2.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(201)
    const appointments = await prisma.appointment.findMany({ where: { comboGroupId: res.body.comboGroupId } })
    expect(appointments).toHaveLength(2)
    expect(new Set(appointments.map(a => a.comboGroupId)).size).toBe(1)
    expect(appointments.every(a => a.date === date && a.time === '10:00')).toBe(true)
    // El precio del combo se reparte entre las patas, no se suma el catálogo.
    const total = appointments.reduce((s, a) => s + Number(a.servicePrice), 0)
    expect(total).toBe(15000)
  })

  it('rechaza dos servicios simultáneos con la misma profesional', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await createComboService([svc1.id, svc2.id])
    const date   = tomorrowStr()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: pro.id, date, time: '10:00' },
          { serviceId: svc2.id, professionalId: pro.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SAME_PROFESSIONAL_SIMULTANEOUS')
  })

  it('rechaza componentes que no coinciden con la configuración del combo', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const other  = await createService({ name: 'Otro' })
    const combo  = await createComboService([svc1.id, svc2.id])
    const date   = tomorrowStr()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: pro1.id, date, time: '10:00' },
          { serviceId: other.id, professionalId: pro2.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('COMBO_MISMATCH')
  })

  it('cancelar una sola pata deja las demás en pie (sin reembolso)', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await createComboService([svc1.id, svc2.id])
    const date   = tomorrowStr()

    const created = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svc1.id, professionalId: pro1.id, date, time: '10:00' },
          { serviceId: svc2.id, professionalId: pro2.id, date, time: '10:00' },
        ],
      })
    const legs = await prisma.appointment.findMany({ where: { comboGroupId: created.body.comboGroupId } })

    const res = await request(app)
      .patch(`/api/client/appointments/${legs[0].id}/cancel`)
      .set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
    expect(res.body.partialCombo).toBe(true)

    const sibling = await prisma.appointment.findUnique({ where: { id: legs[1].id } })
    expect(sibling?.status).not.toBe('cancelled')
  })
})

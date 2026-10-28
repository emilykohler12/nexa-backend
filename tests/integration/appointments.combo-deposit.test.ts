import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createService, tomorrowStr } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-10 — "uñas + cejas" para el mismo horario con dos profesionales: turnos vinculados,
// mismo horario de inicio y una sola seña para todo el combo.
describe('combo con dos profesionales y una sola seña (RF-10)', () => {
  it('crea dos turnos vinculados, uno por profesional, con el mismo inicio y la seña registrada una sola vez', async () => {
    const client = await createClientUser()
    const unias  = await createProfessionalUser()
    const cejas  = await createProfessionalUser()
    const svcUnias = await createService({ name: 'Uñas', categoryId: 'unas' })
    const svcCejas = await createService({ name: 'Cejas', categoryId: 'rostro' })
    const combo = await prisma.service.create({
      data: {
        name: 'Uñas + cejas', categoryId: 'combos', description: 'Combo de test',
        duration: 0, price: 20000, status: 'active', isCombo: true,
        comboServiceIds: [svcUnias.id, svcCejas.id],
      },
    })
    // Seña fija de $5.000 (el valor que el catálogo da como ejemplo).
    await prisma.paymentSettings.create({ data: { depositAmount: 5000, depositPercent: false } })
    const date = tomorrowStr()

    const res = await request(app)
      .post('/api/client/appointments/combo')
      .set('Cookie', cookieFor(client))
      .send({
        comboServiceId: combo.id, simultaneous: true,
        components: [
          { serviceId: svcUnias.id, professionalId: unias.id, date, time: '10:00' },
          { serviceId: svcCejas.id, professionalId: cejas.id, date, time: '10:00' },
        ],
      })

    expect(res.status).toBe(201)

    const legs = await prisma.appointment.findMany({ where: { comboGroupId: res.body.comboGroupId } })
    // Dos turnos vinculados por el mismo grupo, uno por profesional.
    expect(legs).toHaveLength(2)
    expect(new Set(legs.map(l => l.professionalId))).toEqual(new Set([unias.id, cejas.id]))
    // Mismo horario de inicio.
    expect(legs.every(l => l.date === date && l.time === '10:00')).toBe(true)

    // Una sola seña: la que informa la respuesta, registrada en un único turno del grupo.
    expect(res.body.depositAmount).toBe(5000)
    const withDeposit = legs.filter(l => Number(l.depositAmount) > 0)
    expect(withDeposit).toHaveLength(1)
    expect(Number(withDeposit[0].depositAmount)).toBe(5000)
    const totalDeposit = legs.reduce((sum, l) => sum + Number(l.depositAmount), 0)
    expect(totalDeposit).toBe(5000)
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-12 — de quien acompaña solo se registra la condición y el vínculo (lista
// cerrada); nunca un nombre.
async function setup() {
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService()
  const at     = hoursFromNow(48)
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: at.date, time: at.time,
  })
  return { client, appt }
}

describe('acompañante del turno', () => {
  it('guarda hasCompanion y el vínculo de la lista', async () => {
    const { client, appt } = await setup()
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ hasCompanion: true, companionRelation: 'child', consentAlertas: true })

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.hasCompanion).toBe(true)
    expect(row.companionRelation).toBe('child')
  })

  it('ignora un nombre de acompañante si llega en el body (no hay dónde guardarlo)', async () => {
    const { client, appt } = await setup()
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ hasCompanion: true, companionRelation: 'child', companionName: 'Sofía', consentAlertas: true })

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('Sofía')
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(Object.keys(row)).not.toContain('companionName')
  })

  it('rechaza un vínculo fuera de la lista cerrada', async () => {
    const { client, appt } = await setup()
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ hasCompanion: true, companionRelation: 'Sofía', consentAlertas: true })

    expect(res.status).toBe(400)
  })

  it('sin acompañante no guarda vínculo', async () => {
    const { client, appt } = await setup()
    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ hasCompanion: false, companionRelation: 'partner', consentAlertas: true })

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.hasCompanion).toBe(false)
    expect(row.companionRelation).toBeNull()
  })
})

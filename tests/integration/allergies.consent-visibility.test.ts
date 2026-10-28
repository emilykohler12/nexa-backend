import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

const ALERGIA_TURNO  = 'Alergia al látex'
const ALERGIA_PERFIL = 'Alergia a la penicilina'

async function setup() {
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService()
  const at     = hoursFromNow(48)
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: at.date, time: at.time,
  })
  return { client, pro, appt }
}

// RF-07 — sin consentimiento diferenciado no se guarda ningún dato de alergias; con
// consentimiento se guarda y queda registrada la fecha y hora en que se otorgó.
describe('consentimiento para guardar alergias (RF-07)', () => {
  it('sin marcar el consentimiento no guarda la alergia ni registra consentimiento', async () => {
    const { client, appt } = await setup()

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ allergies: ALERGIA_TURNO, consentAlertas: false })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.allergies).toBeNull()
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.consents).toEqual([])
  })

  it('si el campo de consentimiento ni siquiera viene, tampoco guarda la alergia', async () => {
    const { client, appt } = await setup()

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ allergies: ALERGIA_TURNO })

    expect(res.status).toBe(400)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.allergies).toBeNull()
  })

  it('con el consentimiento guarda la alergia junto con la fecha y hora del consentimiento', async () => {
    const { client, appt } = await setup()
    const before = Date.now()

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/details`)
      .set('Cookie', cookieFor(client))
      .send({ allergies: ALERGIA_TURNO, consentAlertas: true })

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.allergies).toBe(ALERGIA_TURNO)

    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.consents).toHaveLength(1)
    // alertas_servicio:<id del turno>:<fecha y hora ISO>
    const prefix = `alertas_servicio:${appt.id}:`
    expect(profile.consents[0].startsWith(prefix)).toBe(true)
    const grantedAt = new Date(profile.consents[0].slice(prefix.length)).getTime()
    expect(Number.isNaN(grantedAt)).toBe(false)
    expect(grantedAt).toBeGreaterThanOrEqual(before)
    expect(grantedAt).toBeLessThanOrEqual(Date.now())
  })
})

// RNF-03 — la alergia solo aparece en la vista de la profesional asignada al turno.
describe('visibilidad de las alergias para las profesionales (RNF-03)', () => {
  async function setupWithAllergies() {
    const base = await setup()
    await prisma.appointment.update({ where: { id: base.appt.id }, data: { allergies: ALERGIA_TURNO } })
    await prisma.client.update({ where: { userId: base.client.id }, data: { allergies: ALERGIA_PERFIL } })
    const other = await createProfessionalUser()
    return { ...base, other }
  }

  it('la profesional asignada ve la alergia del turno y la del perfil de la clienta', async () => {
    const { pro } = await setupWithAllergies()

    const res = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))

    expect(res.status).toBe(200)
    expect(res.body.appointments).toHaveLength(1)
    const view = res.body.appointments[0]
    expect(view.details.allergies).toBe(ALERGIA_TURNO)
    expect(view.client.allergies).toBe(ALERGIA_PERFIL)
  })

  it('otra profesional no ve ni el turno ni ninguna de las dos alergias', async () => {
    const { other } = await setupWithAllergies()

    const agenda = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(other))
    expect(agenda.status).toBe(200)
    expect(agenda.body.appointments).toEqual([])
    expect(JSON.stringify(agenda.body)).not.toContain('látex')
    expect(JSON.stringify(agenda.body)).not.toContain('penicilina')

    const clients = await request(app).get('/api/professional/clients').set('Cookie', cookieFor(other))
    expect(clients.status).toBe(200)
    expect(JSON.stringify(clients.body)).not.toContain('penicilina')
  })

  it('otra profesional tampoco puede abrir el turno ajeno por su id', async () => {
    const { other, appt } = await setupWithAllergies()

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(other))
      .send({ internalNotes: 'nota' })

    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('látex')
  })
})

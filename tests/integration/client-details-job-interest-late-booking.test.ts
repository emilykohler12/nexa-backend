import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createService, createAppointmentDirect } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-31: la clienta carga los detalles del servicio en su turno (con consentimiento).
// RF-33: postulación de "Trabajá con nosotras" (POST /api/contact/job-interest).
// Reserva tardía (fase 2) en combos y en servicios especiales: hasta 15 minutos después de la hora de inicio.

type U = { id: string; email: string; role: string }
const DAY = '2026-11-03'

afterEach(() => { vi.useRealTimers() })

function setNowArt(hhmm: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${DAY}T${hhmm}:00-03:00`))
}

describe('RF-31: detalles del servicio cargados por la clienta', () => {
  async function myAppointment() {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ categoryId: 'unas' })
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2027-03-02', time: '10:00' })
    return { client, pro, appt }
  }
  const details = (client: U, id: string, body: object) =>
    request(app).patch(`/api/client/appointments/${id}/details`).set('Cookie', cookieFor(client)).send(body)

  it('guarda los detalles en el turno, deja constancia del consentimiento y los devuelve en la vista', async () => {
    const { client, appt } = await myAppointment()

    const res = await details(client, appt.id, {
      designPreference: { type: 'text', value: 'Francesitas con brillo' },
      hasOtherSalonPolish: true, isNailReconstruction: true, nailReconstructionCount: 2,
      hasCompanion: true, companionRelation: 'child', consentAlertas: true,
      companionName: 'no se guarda',
    })

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row).toMatchObject({
      designType: 'text', designValue: 'Francesitas con brillo', hasOtherSalonPolish: true,
      isNailReconstruction: true, nailReconstructionCount: 2, hasCompanion: true, companionRelation: 'child',
    })
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.consents.some(c => c.startsWith(`alertas_servicio:${appt.id}:`))).toBe(true)
    expect(JSON.stringify(res.body)).not.toContain('no se guarda')
  })

  it('sin consentimiento no guarda nada (400) y los valores fuera de rango se rechazan', async () => {
    const { client, appt } = await myAppointment()

    expect((await details(client, appt.id, { skinType: 'mixta' })).status).toBe(400)
    expect((await details(client, appt.id, { skinType: 'x'.repeat(21), consentAlertas: true })).status).toBe(400)
    expect((await details(client, appt.id, { nailReconstructionCount: -1, consentAlertas: true })).status).toBe(400)
    expect((await details(client, appt.id, { companionRelation: 'vecina', consentAlertas: true })).status).toBe(400)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).skinType).toBeNull()
  })

  it('una clienta no puede cargar detalles en el turno de otra', async () => {
    const { appt } = await myAppointment()
    const other = await createClientUser()

    const res = await details(other, appt.id, { skinType: 'seca', consentAlertas: true })

    expect(res.status).toBe(404)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).skinType).toBeNull()
  })
})

describe('RF-33: postulación', () => {
  const apply = (body: object) => request(app).post('/api/contact/job-interest').send(body)

  it('una postulación con datos responde 201 y queda en la actividad del administrador (módulo jobs)', async () => {
    const res = await apply({ name: 'Postulante Test', email: 'postulante@test.local', phone: '3764000111', message: 'Soy manicura' })

    expect(res.status).toBe(201)
    const log = await prisma.activityLog.findFirstOrThrow({ where: { module: 'jobs' } })
    expect(log.action).toBe('Nueva postulación')
    expect(log.detail).toBe('Nombre: Postulante Test — Email: postulante@test.local — Teléfono: 3764000111 — Mensaje: Soy manicura')
  })

  // Hallazgo de la fase 7 (reportado, sin corregir por decisión de Emily del 01/11/2026): el endpoint no exige
  // ningún campo y un cuerpo inválido no se rechaza, se registra como postulación vacía. Esta prueba describe el
  // comportamiento actual para que un cambio futuro sea visible.
  it('comportamiento actual: un cuerpo vacío o inválido igual responde 201 y deja "Postulación sin datos cargados"', async () => {
    const empty   = await apply({})
    const invalid = await apply({ email: 'x'.repeat(300) })

    expect(empty.status).toBe(201)
    expect(invalid.status).toBe(201)
    const logs = await prisma.activityLog.findMany({ where: { module: 'jobs' } })
    expect(logs.map(l => l.detail)).toEqual(['Postulación sin datos cargados', 'Postulación sin datos cargados'])
  })
})

describe('reserva tardía en combos y servicios especiales', () => {
  async function comboScenario() {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser()
    const pro2   = await createProfessionalUser()
    const svc1   = await createService({ name: 'Manicura' })
    const svc2   = await createService({ name: 'Pedicura' })
    const combo  = await prisma.service.create({
      data: { name: 'Manos y pies', categoryId: 'combo', description: 'Combo', duration: 0, price: 15000, status: 'active', isCombo: true, comboServiceIds: [svc1.id, svc2.id] },
    })
    const body = {
      comboServiceId: combo.id, simultaneous: true,
      components: [
        { serviceId: svc1.id, professionalId: pro1.id, date: DAY, time: '10:00' },
        { serviceId: svc2.id, professionalId: pro2.id, date: DAY, time: '10:00' },
      ],
    }
    return { client, body }
  }
  const bookCombo = (client: U, body: object) =>
    request(app).post('/api/client/appointments/combo').set('Cookie', cookieFor(client)).send(body)

  it('combo: a los 15 minutos exactos de la hora de inicio se reserva', async () => {
    const { client, body } = await comboScenario()
    setNowArt('10:15')

    const res = await bookCombo(client, body)

    expect(res.status).toBe(201)
    expect(await prisma.appointment.count()).toBe(2)
  })

  it('combo: a los 16 minutos responde 400 START_TIME_PASSED y no crea ninguna pata', async () => {
    const { client, body } = await comboScenario()
    setNowArt('10:16')

    const res = await bookCombo(client, body)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('START_TIME_PASSED')
    expect(await prisma.appointment.count()).toBe(0)
  })

  async function specialScenario() {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await prisma.service.create({
      data: {
        name: 'Jornada de depilación', categoryId: 'cuerpo', description: 'Jornada', duration: 0, price: 0, status: 'active',
        isSpecial: true, specialDate: DAY,
        zones: [{ id: 'z1', name: 'Axilas', duration: 20, price: 9000, active: true }], packages: [],
        specialSlots: [{ id: 's1', time: '10:00', professionalId: pro.id, active: true }],
      },
    })
    return { client, svc }
  }
  const bookSpecial = (client: U, serviceId: string) =>
    request(app).post('/api/client/appointments/special').set('Cookie', cookieFor(client)).send({ serviceId, time: '10:00', zoneIds: ['z1'] })

  it('servicio especial: a los 15 minutos exactos de la hora del horario se reserva', async () => {
    const { client, svc } = await specialScenario()
    setNowArt('10:15')

    const res = await bookSpecial(client, svc.id)

    expect(res.status).toBe(201)
  })

  it('servicio especial: a los 16 minutos responde 400 START_TIME_PASSED y el horario sigue libre', async () => {
    const { client, svc } = await specialScenario()
    setNowArt('10:16')

    const res = await bookSpecial(client, svc.id)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('START_TIME_PASSED')
    expect(await prisma.appointment.count()).toBe(0)
    const slots = (await prisma.service.findUniqueOrThrow({ where: { id: svc.id } })).specialSlots as { appointmentId?: string | null }[]
    expect(slots[0].appointmentId ?? null).toBeNull()
  })
})

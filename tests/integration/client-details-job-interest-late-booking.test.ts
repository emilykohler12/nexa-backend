import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { env } from '../../src/app/config/env'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
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

  beforeEach(() => { vi.mocked(mailProvider.send).mockReset().mockResolvedValue(undefined as any) })

  it('manda un mail al correo del estudio con los datos y la actividad NO guarda nombre, correo, teléfono ni mensaje', async () => {
    await prisma.businessSettings.create({ data: { email: 'estudio@test.local' } })
    const res = await apply({ name: 'Postulante <b>Test</b>', email: 'postulante@test.local', phone: '3764000111', message: 'Soy manicura' })

    expect(res.status).toBe(201)
    const calls = vi.mocked(mailProvider.send).mock.calls
    expect(calls).toHaveLength(1)
    const [to, subject, html] = calls[0]
    expect(to).toBe('estudio@test.local')
    expect(subject).toContain('postulación')
    expect(html).toContain('Postulante &lt;b&gt;Test&lt;/b&gt;')
    expect(html).toContain('postulante@test.local')
    expect(html).toContain('3764000111')
    expect(html).toContain('Soy manicura')

    const log = await prisma.activityLog.findFirstOrThrow({ where: { module: 'jobs' } })
    expect(log.action).toBe('Nueva postulación')
    expect(log.level).toBe('info')
    expect(log.detail).toBe('Postulación enviada por mail al estudio. Campos recibidos: nombre, correo, teléfono, mensaje.')
    for (const secret of ['Postulante', 'postulante@test.local', '3764000111', 'Soy manicura']) {
      expect(log.detail).not.toContain(secret)
    }
  })

  it('sin correo cargado en la configuración del negocio usa ADMIN_EMAIL', async () => {
    const res = await apply({ name: 'Ana' })
    expect(res.status).toBe(201)
    expect(vi.mocked(mailProvider.send).mock.calls[0][0]).toBe(env.ADMIN_EMAIL)
  })

  it('si el mail falla NO responde 201: devuelve error claro y deja una entrada de error sin datos personales', async () => {
    vi.mocked(mailProvider.send).mockRejectedValueOnce(new Error('SMTP caído'))
    const res = await apply({ name: 'Postulante Test', email: 'postulante@test.local', phone: '3764000111', message: 'Soy manicura' })

    expect(res.status).toBe(500)
    expect(res.body.code).toBe('JOB_INTEREST_MAIL_FAILED')
    expect(res.body.error).toContain('No pudimos enviar tu postulación')
    const logs = await prisma.activityLog.findMany({ where: { module: 'jobs' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].level).toBe('error')
    expect(logs[0].action).not.toBe('Nueva postulación')
    for (const secret of ['Postulante', 'postulante@test.local', '3764000111', 'Soy manicura', 'SMTP caído']) {
      expect(logs[0].detail).not.toContain(secret)
    }
  })

  // Fase 10 (hallazgo de la fase 7): el cuerpo se valida con zod y un cuerpo vacío o inválido se rechaza.
  it('un cuerpo vacío o con datos inválidos responde 400 VALIDATION_ERROR y no deja registro', async () => {
    const empty    = await apply({})
    const nulls    = await apply({ name: null, email: null, phone: null, message: null })
    const badMail  = await apply({ name: 'Ana', email: 'no-es-un-correo' })
    const badPhone = await apply({ name: 'Ana', phone: '123' })
    const tooLong  = await apply({ message: 'x'.repeat(2001) })

    for (const res of [empty, nulls, badMail, badPhone, tooLong]) {
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect(await prisma.activityLog.count({ where: { module: 'jobs' } })).toBe(0)
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

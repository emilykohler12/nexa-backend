import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, hoursFromNow,
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

// RF-07 — solo la clienta carga sus alergias (con consentimiento). El admin no puede cargarlas
// ni editarlas, y las profesionales tampoco.
describe('el admin y las profesionales no cargan ni editan alergias (RF-07)', () => {
  it('el admin no puede cargar alergias en el perfil de una clienta', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()

    const res = await request(app)
      .put(`/api/admin/clients/${client.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ clinical: { allergies: ALERGIA_PERFIL }, consentAlertas: true })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.allergies).toBeNull()
    expect(profile.consents).toEqual([])
  })

  it('el admin no puede cambiar ni borrar una alergia ya cargada', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    await prisma.client.update({ where: { userId: client.id }, data: { allergies: ALERGIA_PERFIL } })

    for (const allergies of ['Alergia al níquel', '']) {
      const res = await request(app)
        .put(`/api/admin/clients/${client.id}`)
        .set('Cookie', cookieFor(admin))
        .send({ clinical: { allergies } })
      expect(res.status).toBe(400)
    }
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.allergies).toBe(ALERGIA_PERFIL)
  })

  it('el admin puede guardar el resto del perfil si reenvía las alergias tal cual están', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    await prisma.client.update({ where: { userId: client.id }, data: { allergies: ALERGIA_PERFIL } })

    // El formulario del admin manda siempre todo el bloque clínico.
    const res = await request(app)
      .put(`/api/admin/clients/${client.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ phone: '3764000000', clinical: { allergies: ALERGIA_PERFIL, preferences: 'Prefiere silencio' } })

    expect(res.status).toBe(200)
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.allergies).toBe(ALERGIA_PERFIL)
    expect(profile.preferences).toBe('Prefiere silencio')
  })

  it('el admin tampoco puede crear una clienta con alergias, y no deja la cuenta a medias', async () => {
    const admin = await createAdminUser()

    const res = await request(app)
      .post('/api/admin/clients')
      .set('Cookie', cookieFor(admin))
      .send({ name: 'Nueva Clienta', email: 'nueva@test.local', clinical: { allergies: ALERGIA_PERFIL } })

    expect(res.status).toBe(400)
    expect(await prisma.user.findFirst({ where: { email: 'nueva@test.local' } })).toBeNull()
  })

  it('ni el admin ni la profesional cambian la alergia de un turno desde sus rutas de turnos', async () => {
    const { client, pro, appt } = await setup()
    await prisma.appointment.update({ where: { id: appt.id }, data: { allergies: ALERGIA_TURNO } })
    const admin = await createAdminUser()
    const body  = { allergies: 'Otra alergia', details: { allergies: 'Otra alergia' }, internalNotes: 'nota' }

    const byAdmin = await request(app)
      .patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin)).send(body)
    const byPro = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro)).send(body)
    expect(byAdmin.status).toBe(200)
    expect(byPro.status).toBe(200)

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.allergies).toBe(ALERGIA_TURNO)
    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.allergies).toBeNull()
  })
})

// RNF-03 — quién puede ver una alergia (criterio del catálogo: «una profesional distinta a
// la asignada» no la ve). En sentido estricto la ven, además de la profesional asignada:
// el admin, la propia clienta y cualquier profesional que haya atendido alguna vez a esa
// clienta (esta última solo la alergia del perfil, no la del turno de otra profesional).
describe('visibilidad de las alergias (RNF-03)', () => {
  async function setupWithAllergies() {
    const base = await setup()
    await prisma.appointment.update({ where: { id: base.appt.id }, data: { allergies: ALERGIA_TURNO } })
    await prisma.client.update({ where: { userId: base.client.id }, data: { allergies: ALERGIA_PERFIL } })
    const other = await createProfessionalUser()
    return { ...base, other }
  }

  it('la profesional asignada ve la alergia del turno, y la del perfil solo si ya atendió a la clienta', async () => {
    const { pro, client } = await setupWithAllergies()

    const res = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))

    expect(res.status).toBe(200)
    expect(res.body.appointments).toHaveLength(1)
    const view = res.body.appointments[0]
    expect(view.details.allergies).toBe(ALERGIA_TURNO)
    // Solo tiene un turno confirmado a futuro con ella: todavía no la atendió.
    expect(view.client.allergies).toBe('')

    const svc  = await createService()
    const past = hoursFromNow(-48)
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: past.date, time: past.time, status: 'finished',
    })
    const after = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))
    expect(after.body.appointments.every((a: any) => a.client.allergies === ALERGIA_PERFIL)).toBe(true)
    expect(after.body.appointments.find((a: any) => a.id === view.id).details.allergies).toBe(ALERGIA_TURNO)
  })

  it('la respuesta al editar un turno propio tampoco trae la alergia del perfil si no la atendió', async () => {
    const { pro, appt } = await setupWithAllergies()

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ internalNotes: 'nota' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.client.allergies).toBe('')
    expect(res.body.appointment.details.allergies).toBe(ALERGIA_TURNO)
    expect(JSON.stringify(res.body)).not.toContain('penicilina')
  })

  it('al finalizar el turno, la respuesta ya trae la alergia del perfil', async () => {
    const { pro, appt } = await setupWithAllergies()

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ status: 'finished' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.client.allergies).toBe(ALERGIA_PERFIL)
  })

  it('una profesional que nunca atendió a la clienta no ve ni el turno ni ninguna de las dos alergias', async () => {
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

  it('el admin y la propia clienta ven las alergias', async () => {
    const { client } = await setupWithAllergies()
    const admin = await createAdminUser()

    const adminRes = await request(app).get('/api/admin/clients').set('Cookie', cookieFor(admin))
    expect(adminRes.status).toBe(200)
    const row = adminRes.body.clients.find((c: any) => c.id === client.id)
    expect(row.clinical.allergies).toBe(ALERGIA_PERFIL)

    const own = await request(app).get('/api/client/appointments').set('Cookie', cookieFor(client))
    expect(own.status).toBe(200)
    expect(own.body.appointments[0].details.allergies).toBe(ALERGIA_TURNO)
  })

  it('una profesional que atendió antes a la clienta ve la alergia del perfil, pero no la del turno ajeno', async () => {
    const { client, other } = await setupWithAllergies()
    const svc  = await createService()
    const past = hoursFromNow(-48)
    await createAppointmentDirect({
      clientId: client.id, professionalId: other.id, serviceId: svc.id, date: past.date, time: past.time,
      status: 'finished',
    })

    const clients = await request(app).get('/api/professional/clients').set('Cookie', cookieFor(other))
    expect(clients.status).toBe(200)
    expect(JSON.stringify(clients.body)).toContain('penicilina')

    const agenda = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(other))
    expect(JSON.stringify(agenda.body)).not.toContain('látex')
  })

  describe('la alergia del perfil en la lista de clientas de la profesional', () => {
    async function profileAllergyFor(pro: { id: string; email: string; role: string }): Promise<string | undefined> {
      const res = await request(app).get('/api/professional/clients').set('Cookie', cookieFor(pro))
      expect(res.status).toBe(200)
      expect(res.body.clients).toHaveLength(1)
      return res.body.clients[0].allergies
    }

    // Una clienta con alergia en el perfil y un único turno, con el estado indicado, de la profesional.
    async function oneAppointmentWith(status: string, hours: number) {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const svc    = await createService()
      const at     = hoursFromNow(hours)
      await createAppointmentDirect({
        clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: at.date, time: at.time, status,
      })
      await prisma.client.update({ where: { userId: client.id }, data: { allergies: ALERGIA_PERFIL } })
      return pro
    }

    it('con un turno finalizado con la clienta, la profesional ve la alergia del perfil', async () => {
      const pro = await oneAppointmentWith('finished', -48)
      expect(await profileAllergyFor(pro)).toBe(ALERGIA_PERFIL)
    })

    it.each(['cancelled', 'cancelled_no_show', 'no_show_auto'])('con un turno %s no la ve', async status => {
      const pro = await oneAppointmentWith(status, -48)
      expect(await profileAllergyFor(pro)).toBe('')
    })

    it('con un turno confirmado a futuro no la ve', async () => {
      const pro = await oneAppointmentWith('confirmed', 48)
      expect(await profileAllergyFor(pro)).toBe('')
    })

    it('con un turno pendiente tampoco la ve', async () => {
      const pro = await oneAppointmentWith('pending', 48)
      expect(await profileAllergyFor(pro)).toBe('')
    })

    it('un turno finalizado con OTRA profesional no alcanza', async () => {
      const client = await createClientUser()
      const pro    = await createProfessionalUser()
      const other  = await createProfessionalUser()
      const svc    = await createService()
      const future = hoursFromNow(48)
      const past   = hoursFromNow(-48)
      await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: future.date, time: future.time })
      await createAppointmentDirect({ clientId: client.id, professionalId: other.id, serviceId: svc.id, date: past.date, time: past.time, status: 'finished' })
      await prisma.client.update({ where: { userId: client.id }, data: { allergies: ALERGIA_PERFIL } })

      expect(await profileAllergyFor(pro)).toBe('')
      expect(await profileAllergyFor(other)).toBe(ALERGIA_PERFIL)
    })

    it('la profesional asignada a un turno propio ve la alergia de ese turno, aunque no vea la del perfil', async () => {
      const pro = await oneAppointmentWith('confirmed', 48)
      await prisma.appointment.updateMany({ where: { professionalId: pro.id }, data: { allergies: ALERGIA_TURNO } })

      const agenda = await request(app).get('/api/professional/appointments').set('Cookie', cookieFor(pro))
      expect(agenda.status).toBe(200)
      expect(agenda.body.appointments[0].details.allergies).toBe(ALERGIA_TURNO)
      expect(await profileAllergyFor(pro)).toBe('')
    })
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

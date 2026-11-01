import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import { argentinaParts } from '../../src/app/utils/argentinaTime'
import { createAdminUser, createProfessionalUser, createService, linkProfessionalService, futureWeekDay } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// ─── RF-06: fecha de ingreso de la profesional y desempate por antigüedad ───────────────────────────

describe('RF-06: fecha de ingreso de la profesional', () => {
  async function adminAndPro() {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    return { admin, pro }
  }
  const patch = (admin: { id: string; email: string; role: string }, id: string, body: object) =>
    request(app).patch(`/api/professionals/${id}`).set('Cookie', cookieFor(admin)).send(body)

  it('sin fecha cargada se muestra la del alta de la cuenta y se avisa que es la de por defecto', async () => {
    const { admin, pro } = await adminAndPro()
    const res = await request(app).get(`/api/professionals/${pro.id}`).set('Cookie', cookieFor(admin))
    expect(res.status).toBe(200)
    expect(res.body.professional.joinedAt).toBe(argentinaParts(pro.createdAt).date)
    expect(res.body.professional.joinedAtIsDefault).toBe(true)
  })

  it('el administrador la edita y se guarda como fecha', async () => {
    const { admin, pro } = await adminAndPro()
    const res = await patch(admin, pro.id, { joinedAt: '2020-03-15' })
    expect(res.status).toBe(200)
    expect(res.body.professional.joinedAt).toBe('2020-03-15')
    expect(res.body.professional.joinedAtIsDefault).toBe(false)
    const row = await prisma.professional.findUniqueOrThrow({ where: { userId: pro.id } })
    expect(row.joinedAt?.toISOString().slice(0, 10)).toBe('2020-03-15')
  })

  it('con null vuelve a la fecha de alta, y no cambia si el campo no viene', async () => {
    const { admin, pro } = await adminAndPro()
    await patch(admin, pro.id, { joinedAt: '2020-03-15' })
    const sinCampo = await patch(admin, pro.id, { specialty: 'Uñas' })
    expect(sinCampo.body.professional.joinedAt).toBe('2020-03-15')
    const nula = await patch(admin, pro.id, { joinedAt: null })
    expect(nula.body.professional.joinedAtIsDefault).toBe(true)
  })

  it('rechaza una fecha inválida o futura', async () => {
    const { admin, pro } = await adminAndPro()
    for (const joinedAt of ['15/03/2020', '2026-02-30', 'ayer', 20200315, '2999-01-01']) {
      const res = await patch(admin, pro.id, { joinedAt })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
  })

  it('a igual carga semanal gana la más antigua según la fecha de ingreso, no según el alta de la cuenta', async () => {
    const svc  = await createService()
    const proA = await createProfessionalUser({ name: 'A (alta primero)' })
    const proB = await createProfessionalUser({ name: 'B (alta después)' })
    await linkProfessionalService(proA.id, svc.id)
    await linkProfessionalService(proB.id, svc.id)
    const slot = { date: futureWeekDay(2), time: '10:00' }

    // Sin fechas cargadas: gana A, que se dio de alta antes.
    expect((await appointmentService.previewAnyProfessional(svc.id, slot)).professionalId).toBe(proA.id)

    // B ingresó al estudio mucho antes que A, aunque su cuenta sea posterior.
    await prisma.professional.update({ where: { userId: proA.id }, data: { joinedAt: new Date('2025-06-01T00:00:00Z') } })
    await prisma.professional.update({ where: { userId: proB.id }, data: { joinedAt: new Date('2020-01-01T00:00:00Z') } })
    expect((await appointmentService.previewAnyProfessional(svc.id, slot)).professionalId).toBe(proB.id)
  })

  it('la carga semanal sigue mandando por encima de la antigüedad', async () => {
    const svc  = await createService()
    const proA = await createProfessionalUser()
    const proB = await createProfessionalUser()
    await linkProfessionalService(proA.id, svc.id)
    await linkProfessionalService(proB.id, svc.id)
    await prisma.professional.update({ where: { userId: proB.id }, data: { joinedAt: new Date('2020-01-01T00:00:00Z') } })
    const day = futureWeekDay(2)
    // B (la más antigua) ya tiene un turno esa semana: A tiene menos carga y gana.
    const client = await prisma.user.create({ data: { name: 'C', email: 'c-carga@test.local', passwordHash: 'x', role: 'client' } })
    await prisma.appointment.create({
      data: {
        clientId: client.id, professionalId: proB.id, serviceId: svc.id, date: day, time: '12:00',
        duration: 60, servicePrice: 1000, depositAmount: 0, status: 'confirmed',
      },
    })
    expect((await appointmentService.previewAnyProfessional(svc.id, { date: day, time: '10:00' })).professionalId).toBe(proA.id)
  })
})

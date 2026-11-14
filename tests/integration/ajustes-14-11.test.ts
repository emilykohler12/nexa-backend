import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, linkProfessionalService,
  createAppointmentDirect, minutesAgo, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('finalizar un turno: solo desde la hora de inicio', () => {
  async function scenario(when: { date: string; time: string }) {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const admin  = await createAdminUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, ...when, depositAmount: 5000, paymentStatus: 'partial' })
    return { pro, admin, appt }
  }

  it('el administrador no puede finalizar un turno que todavía no empezó (400 FINISH_BEFORE_START)', async () => {
    const { admin, appt } = await scenario(hoursFromNow(6))
    const res = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin)).send({ status: 'finished' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('FINISH_BEFORE_START')
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('la profesional tampoco', async () => {
    const { pro, appt } = await scenario(hoursFromNow(6))
    const res = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro)).send({ status: 'finished' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('FINISH_BEFORE_START')
  })

  it('una vez empezado, se puede finalizar', async () => {
    const { admin, appt } = await scenario(minutesAgo(10))
    const res = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin)).send({ status: 'finished' })
    expect(res.status).toBe(200)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('finished')
  })
})

describe('los servicios simultáneos (combos) no se asignan a una profesional', () => {
  async function combo() {
    return prisma.service.create({
      data: { name: 'Combo Test', categoryId: 'combo', description: 'Combo', duration: 90, price: 30000, isCombo: true, simultaneous: true },
    })
  }

  it('al guardar sus servicios, un combo nuevo se rechaza y un servicio común se acepta', async () => {
    const pro   = await createProfessionalUser()
    const plain = await createService({ name: 'Común' })
    const c     = await combo()

    const bad = await request(app).patch('/api/professional/services').set('Cookie', cookieFor(pro))
      .send({ services: [{ serviceId: plain.id, status: 'active' }, { serviceId: c.id, status: 'active' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('COMBO_NOT_ASSIGNABLE')
    expect(bad.body.error).toContain('Combo Test')
    // No se guardó nada de ese pedido.
    expect(await prisma.professionalService.count({ where: { service: { id: plain.id } } })).toBe(0)

    const ok = await request(app).patch('/api/professional/services').set('Cookie', cookieFor(pro))
      .send({ services: [{ serviceId: plain.id, status: 'active' }] })
    expect(ok.status).toBe(200)
  })

  it('un combo que ya tenía asignado no hace fallar el guardado de su lista (y se puede quitar)', async () => {
    const pro   = await createProfessionalUser()
    const plain = await createService({ name: 'Común' })
    const c     = await combo()
    await linkProfessionalService(pro.id, plain.id)
    await linkProfessionalService(pro.id, c.id)

    const keep = await request(app).patch('/api/professional/services').set('Cookie', cookieFor(pro))
      .send({ services: [{ serviceId: plain.id, status: 'active' }, { serviceId: c.id, status: 'inactive' }] })
    expect(keep.status).toBe(200)

    const remove = await request(app).patch('/api/professional/services').set('Cookie', cookieFor(pro))
      .send({ services: [{ serviceId: plain.id, status: 'active' }] })
    expect(remove.status).toBe(200)
    expect(remove.body.services.map((s: { serviceId: string }) => s.serviceId)).toEqual([plain.id])
  })

  it('el formulario de bienvenida rechaza un combo y no guarda nada', async () => {
    const pro = await createProfessionalUser()
    await prisma.user.update({ where: { id: pro.id }, data: { profileComplete: false } })
    const plain = await createService({ name: 'Común' })
    const c     = await combo()

    const res = await request(app).post('/api/professional/onboarding').set('Cookie', cookieFor(pro)).send({
      personal: { name: 'Pro Nueva', phone: '3764123456' }, work: { specialty: 'Uñas' },
      services: [{ serviceId: plain.id, ownPrice: 10000, ownDuration: 60 }, { serviceId: c.id, ownPrice: 30000, ownDuration: 90 }],
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('COMBO_NOT_ASSIGNABLE')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pro.id } })).profileComplete).toBe(false)
  })
})

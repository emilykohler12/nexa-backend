import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import { createClientUser, createProfessionalUser, createAdminUser, futureWeekDay } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-03 y RF-17: un servicio especial no puede nacer con la seña marcada como paga. Y si nunca se paga,
// el turno se cancela y el horario del día vuelve a quedar libre.
async function createSpecialService(professionalId: string, date = futureWeekDay(3)) {
  return prisma.service.create({
    data: {
      name: 'Depilación definitiva (jornada)', categoryId: 'cuerpo', description: 'Jornada especial',
      duration: 0, price: 0, status: 'active',
      isSpecial: true, specialDate: date,
      zones:    [{ id: 'z1', name: 'Axilas', duration: 30, price: 20000, active: true }],
      packages: [],
      specialSlots: [{ id: 's1', time: '10:00', professionalId, active: true }],
    },
  })
}

async function slotsOf(serviceId: string) {
  const s = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })
  return s.specialSlots as { time: string; appointmentId?: string | null; clientName?: string | null }[]
}

async function reservar(client: { id: string; email: string; role: string }, serviceId: string) {
  return request(app).post('/api/client/appointments/special').set('Cookie', cookieFor(client))
    .send({ serviceId, time: '10:00', zoneIds: ['z1'], packageIds: [] })
}

describe('servicio especial: la seña no nace paga', () => {
  it('el turno nace con paymentStatus pending y con la seña calculada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createSpecialService(pro.id)

    const res = await reservar(client, svc.id)
    expect(res.status).toBe(201)

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.appointment.id } })
    expect(row.paymentStatus).toBe('pending')
    expect(row.status).toBe('confirmed')
    expect(Number(row.depositAmount)).toBeGreaterThan(0)
    expect(row.mpPaymentId).toBeNull()
    expect((await slotsOf(svc.id))[0].appointmentId).toBe(row.id)
  })

  it('el job cancela el turno impago, libera el horario y deja una entrada de actividad del turno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createSpecialService(pro.id)
    const res    = await reservar(client, svc.id)
    const id     = res.body.appointment.id as string
    await prisma.appointment.update({ where: { id }, data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) } })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(1)

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('cancelled')
    expect(row.cancelledBy).toBe('system')
    expect(row.cancelReason).toBe('unpaid_expired')

    const slot = (await slotsOf(svc.id))[0]
    expect(slot.appointmentId).toBeNull()
    expect(slot.clientName).toBeNull()

    // El horario se puede reservar de nuevo.
    const otra = await createClientUser()
    expect((await reservar(otra, svc.id)).status).toBe(201)
  })

  it('un turno con la seña ya paga no se libera ni suelta el horario', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createSpecialService(pro.id)
    const res    = await reservar(client, svc.id)
    const id     = res.body.appointment.id as string
    await prisma.appointment.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - 30 * 60 * 1000), paymentStatus: 'partial', mpPaymentId: 'mp-1' },
    })

    expect((await runReleaseUnpaidAppointmentsJob()).released).toBe(0)
    expect((await slotsOf(svc.id))[0].appointmentId).toBe(id)
  })

  it('si la clienta cancela, el horario del servicio especial queda libre', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createSpecialService(pro.id)
    const id     = (await reservar(client, svc.id)).body.appointment.id as string

    const res = await request(app).patch(`/api/client/appointments/${id}/cancel`).set('Cookie', cookieFor(client))
    expect(res.status).toBe(200)
    expect((await slotsOf(svc.id))[0].appointmentId).toBeNull()
  })

  it('si el personal cancela, el horario del servicio especial queda libre', async () => {
    const client = await createClientUser()
    const admin  = await createAdminUser()
    const pro    = await createProfessionalUser()
    const svc    = await createSpecialService(pro.id)
    const id     = (await reservar(client, svc.id)).body.appointment.id as string

    const res = await request(app).patch(`/api/admin/appointments/${id}`).set('Cookie', cookieFor(admin))
      .send({ status: 'cancelled', cancelledBy: 'studio' })
    expect(res.status).toBe(200)
    expect((await slotsOf(svc.id))[0].appointmentId).toBeNull()
  })
})

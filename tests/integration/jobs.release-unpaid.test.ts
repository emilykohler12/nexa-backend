import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../../src/app/database/prisma'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import { createClientUser, createProfessionalUser, createService, hoursFromNow } from '../helpers/factories'

async function createStale(overrides: {
  clientId: string; professionalId: string; serviceId: string
  createdMinutesAgo: number
  depositAmount?: number; paymentStatus?: string; mpPaymentId?: string | null
  comboGroupId?: string | null
}) {
  const future = hoursFromNow(72)
  return prisma.appointment.create({
    data: {
      clientId: overrides.clientId, professionalId: overrides.professionalId, serviceId: overrides.serviceId,
      date: future.date, time: future.time, duration: 60, servicePrice: 10000,
      depositAmount:  overrides.depositAmount ?? 5000,
      status:         'confirmed',
      paymentStatus:  overrides.paymentStatus ?? 'pending',
      mpPaymentId:    overrides.mpPaymentId ?? null,
      comboGroupId:   overrides.comboGroupId ?? null,
      createdAt:      new Date(Date.now() - overrides.createdMinutesAgo * 60 * 1000),
    },
  })
}

describe('job de liberación de turnos con seña impaga', () => {
  it('cancela un turno con seña impaga hace más de 20 minutos', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createStale({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, createdMinutesAgo: 25 })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(1)

    const fresh = await prisma.appointment.findUnique({ where: { id: appt.id } })
    expect(fresh?.status).toBe('cancelled')
    expect(fresh?.cancelReason).toBe('unpaid_expired')
  })

  it('NO toca un turno creado hace menos de 20 minutos', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    await createStale({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, createdMinutesAgo: 5 })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(0)
  })

  it('NO toca un turno manual sin seña (depositAmount 0)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    await createStale({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, createdMinutesAgo: 30, depositAmount: 0 })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(0)
  })

  it('NO toca un pago en efectivo pendiente (ya tiene mpPaymentId)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    await createStale({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, createdMinutesAgo: 30,
      mpPaymentId: 'mp-123',
    })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(0)
  })

  it('NO toca una seña ya pagada', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    await createStale({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, createdMinutesAgo: 30,
      paymentStatus: 'partial',
    })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(0)
  })

  it('si la pata con seña de un combo queda impaga, cancela el grupo entero', async () => {
    const client  = await createClientUser()
    const pro1    = await createProfessionalUser()
    const pro2    = await createProfessionalUser()
    const svc     = await createService()
    const groupId = randomUUID()

    const leg1 = await createStale({
      clientId: client.id, professionalId: pro1.id, serviceId: svc.id, createdMinutesAgo: 30,
      depositAmount: 5000, comboGroupId: groupId,
    })
    const leg2 = await createStale({
      clientId: client.id, professionalId: pro2.id, serviceId: svc.id, createdMinutesAgo: 30,
      depositAmount: 0, comboGroupId: groupId,
    })

    const result = await runReleaseUnpaidAppointmentsJob()
    expect(result.released).toBe(2)

    const [fresh1, fresh2] = await Promise.all([
      prisma.appointment.findUnique({ where: { id: leg1.id } }),
      prisma.appointment.findUnique({ where: { id: leg2.id } }),
    ])
    expect(fresh1?.status).toBe('cancelled')
    expect(fresh2?.status).toBe('cancelled')
  })
})

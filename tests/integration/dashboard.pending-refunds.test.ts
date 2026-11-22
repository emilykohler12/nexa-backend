import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// «Señas por devolver (Mercado Pago)»: el sistema solo marca la seña como devuelta; el tablero lista las pagadas por
// Mercado Pago (mpPaymentId) que todavía no se marcaron como devueltas de verdad.
async function refundedAppointment(extra: { mpPaymentId?: string | null; depositMethod?: string | null; paymentStatus?: string } = {}) {
  const client = await createClientUser({ name: 'Ana', lastName: 'Pérez' } as never)
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 10000 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00',
    status: 'cancelled', paymentStatus: extra.paymentStatus ?? 'refunded', depositAmount: 3000, depositMethod: extra.depositMethod ?? null,
  })
  await prisma.appointment.update({ where: { id: appt.id }, data: { mpPaymentId: extra.mpPaymentId === undefined ? 'mp-123' : extra.mpPaymentId } })
  return { client, appt }
}

const dashboard = async (admin: { id: string }) =>
  (await request(app).get('/api/admin/dashboard').query({ period: 'month' }).set('Cookie', cookieFor(admin as never))).body.dashboard

describe('señas por devolver (Mercado Pago) en el tablero', () => {
  it('lista la seña devuelta pagada por Mercado Pago, con la clienta y el monto', async () => {
    const admin = await createAdminUser()
    const { appt } = await refundedAppointment()

    const { pendingRefunds } = await dashboard(admin)

    expect(pendingRefunds).toHaveLength(1)
    expect(pendingRefunds[0]).toMatchObject({ appointmentId: appt.id, amount: 3000, serviceName: expect.any(String) })
    expect(pendingRefunds[0].clientName).toContain('Ana')
  })

  it('no lista las señas por WhatsApp ni las que no se marcaron como devueltas', async () => {
    const admin = await createAdminUser()
    await refundedAppointment({ mpPaymentId: null, depositMethod: 'whatsapp' })
    await refundedAppointment({ paymentStatus: 'partial' })

    expect((await dashboard(admin)).pendingRefunds).toEqual([])
  })

  it('«marcar devuelta» la saca de la lista, deja actividad y es idempotente', async () => {
    const admin = await createAdminUser()
    const { appt } = await refundedAppointment()

    const first  = await request(app).patch(`/api/admin/appointments/${appt.id}/refund-done`).set('Cookie', cookieFor(admin))
    const stamp  = (await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).depositRefundedAt
    const second = await request(app).patch(`/api/admin/appointments/${appt.id}/refund-done`).set('Cookie', cookieFor(admin))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(stamp).not.toBeNull()
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).depositRefundedAt!.getTime()).toBe(stamp!.getTime())
    expect((await dashboard(admin)).pendingRefunds).toEqual([])
    expect(await prisma.activityLog.count({ where: { appointmentId: appt.id, action: 'Seña devuelta en Mercado Pago' } })).toBe(1)
  })

  it('rechaza marcar una seña que no tiene devolución pendiente de Mercado Pago', async () => {
    const admin = await createAdminUser()
    const { appt } = await refundedAppointment({ paymentStatus: 'partial' })

    const res = await request(app).patch(`/api/admin/appointments/${appt.id}/refund-done`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_REFUND_PENDING')
  })

  it('solo el administrador puede marcarla', async () => {
    const pro = await createProfessionalUser()
    const { appt } = await refundedAppointment()

    const res = await request(app).patch(`/api/admin/appointments/${appt.id}/refund-done`).set('Cookie', cookieFor(pro))

    expect(res.status).toBe(403)
  })
})

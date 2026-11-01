import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { computeDeposit } from '../../src/modules/settings/settings.service'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-03 y RF-32: la seña se configura como monto fijo o como porcentaje del precio, y la calcula el servidor.
// RF-04: devolución de la seña al cancelar (12 horas o más con la política "full"; "none" la retiene siempre),
// inasistencia con la seña paga y cancelación con la seña impaga.
// El reloj se fija en hora de Argentina; las cookies se firman después de fijarlo (el token dura 15 minutos).

type U = { id: string; email: string; role: string }
const DAY = '2026-11-03'

afterEach(() => { vi.useRealTimers() })

function setNowArt(day: string, hhmm: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${day}T${hhmm}:00-03:00`))
}

const patchPayments = (user: U, body: object) =>
  request(app).patch('/api/settings/payments').set('Cookie', cookieFor(user)).send(body)

const fresh = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } })

describe('RF-03 y RF-32: cálculo de la seña', () => {
  it('computeDeposit en porcentaje redondea al peso; en monto fijo nunca supera el precio', () => {
    expect(computeDeposit(10000, { depositAmount: 30, depositPercent: true })).toBe(3000)
    expect(computeDeposit(12345, { depositAmount: 15, depositPercent: true })).toBe(1852) // 1851,75
    expect(computeDeposit(10000, { depositAmount: 0, depositPercent: true })).toBe(0)
    expect(computeDeposit(10000, { depositAmount: 100, depositPercent: true })).toBe(10000)
    expect(computeDeposit(10000, { depositAmount: 2000, depositPercent: false })).toBe(2000)
    expect(computeDeposit(1500, { depositAmount: 2000, depositPercent: false })).toBe(1500)
  })

  it('el administrador pasa la seña a porcentaje y la reserva de la clienta toma ese porcentaje del precio', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 18000 })

    const patch = await patchPayments(admin, { depositPercent: true, depositAmount: 25 })
    expect(patch.status).toBe(200)
    expect(patch.body.settings).toMatchObject({ depositPercent: true, depositAmount: 25 })

    const publicSettings = await request(app).get('/api/business/payments/public')
    expect(publicSettings.body.settings).toMatchObject({ depositPercent: true, depositAmount: 25 })

    const res = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: '2027-03-02', time: '10:00', termsAccepted: true })
    expect(res.status).toBe(201)
    const row = await fresh(res.body.appointment.id)
    expect(Number(row.depositAmount)).toBe(4500)
    expect(row.paymentStatus).toBe('pending')
  })

  it('PATCH /settings/payments: valores válidos, inválidos (400 VALIDATION_ERROR) y sin permiso', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()

    const ok = await patchPayments(admin, { depositPercent: false, depositAmount: 3500, cancellationHours: 12, refundPolicy: 'full' })
    expect(ok.status).toBe(200)
    expect(ok.body.settings).toEqual({ depositPercent: false, depositAmount: 3500, cancellationHours: 12, refundPolicy: 'full' })

    // Pasar a porcentaje con el monto fijo guardado (3500) daría más de 100 %.
    const overPercent = await patchPayments(admin, { depositPercent: true })
    expect(overPercent.status).toBe(400)
    expect(overPercent.body.code).toBe('VALIDATION_ERROR')
    for (const body of [{ depositAmount: 'mucho' }, { depositAmount: 1000000 }, { cancellationHours: 721 }, { refundPolicy: 'partial' }]) {
      const res = await patchPayments(admin, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect((await prisma.paymentSettings.findFirstOrThrow()).depositPercent).toBe(false)

    expect((await patchPayments(client, { depositAmount: 1 })).status).toBe(403)
    expect((await patchPayments(pro, { depositAmount: 1 })).status).toBe(403)
    expect((await request(app).patch('/api/settings/payments').send({ depositAmount: 1 })).status).toBe(401)
    expect(Number((await prisma.paymentSettings.findFirstOrThrow()).depositAmount)).toBe(3500)
  })
})

describe('RF-04: devolución de la seña', () => {
  async function scenario(paymentStatus = 'partial', time = '22:00') {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time,
      paymentStatus, depositAmount: 3000,
    })
    return { client, pro, appt }
  }

  const cancelMine = (client: U, id: string) =>
    request(app).patch(`/api/client/appointments/${id}/cancel`).set('Cookie', cookieFor(client)).send({})

  it('límite exacto: con 12 horas justas se devuelve; con 11:59 queda retenida', async () => {
    const a = await scenario()
    const b = await scenario('partial', '22:30')

    setNowArt(DAY, '10:00') // 12:00 h antes de las 22:00
    const exacto = await cancelMine(a.client, a.appt.id)
    setNowArt(DAY, '10:31') // 11:59 h antes de las 22:30
    const corto = await cancelMine(b.client, b.appt.id)

    expect(exacto.status).toBe(200)
    expect(corto.status).toBe(200)
    expect((await fresh(a.appt.id)).paymentStatus).toBe('refunded')
    expect((await fresh(b.appt.id)).paymentStatus).toBe('partial')
  })

  it('con refundPolicy "none" la seña queda retenida aunque falten días', async () => {
    await prisma.paymentSettings.create({ data: { depositAmount: 3000, depositPercent: false, refundPolicy: 'none' } })
    const { client, appt } = await scenario('paid')
    setNowArt('2026-10-30', '10:00')

    const res = await cancelMine(client, appt.id)

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('cancelled')
    expect(row.paymentStatus).toBe('paid')
  })

  it('cancelación con la seña impaga: se cancela y no se marca ninguna devolución', async () => {
    const { client, appt } = await scenario('pending')
    setNowArt('2026-10-30', '10:00')

    const res = await cancelMine(client, appt.id)

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('cancelled')
    expect(row.paymentStatus).toBe('pending')
  })

  it('inasistencia con la seña paga: ni el job ni la marca del personal tocan la seña', async () => {
    const auto   = await scenario('partial', '16:00')
    const marked = await scenario('paid', '16:00')

    setNowArt(DAY, '16:31')
    await runAutoNoShowJob()
    const res = await request(app).patch(`/api/professional/appointments/${marked.appt.id}`)
      .set('Cookie', cookieFor(marked.pro)).send({ status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    const autoRow = await fresh(auto.appt.id)
    expect(autoRow.status).toBe('no_show_auto')
    expect(autoRow.paymentStatus).toBe('partial')
    const markedRow = await fresh(marked.appt.id)
    expect(markedRow.status).toBe('cancelled_no_show')
    expect(markedRow.paymentStatus).toBe('paid')
  })
})

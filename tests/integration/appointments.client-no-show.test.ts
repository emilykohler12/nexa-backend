import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// «No voy a asistir»: con el turno ya empezado la clienta no cancela, solo avisa que no va. El turno pasa a
// cancelled_no_show (horario original bloqueado, seña retenida), se abre el horario reabierto y se avisa a la
// profesional. Martes 2026-11-03; el reloj se fija en hora de Argentina.
const DATE = '2026-11-03'

function setNow(argentina: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${DATE}T${argentina}:00-03:00`))
}

async function setup(extra: Record<string, unknown> = {}) {
  const client = await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 10000 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DATE, time: '10:00',
    paymentStatus: 'partial', depositAmount: 3000, ...extra,
  })
  return { client, pro, svc, appt }
}

const noShow = (id: string, client: { id: string }) =>
  request(app).patch(`/api/client/appointments/${id}/no-show`).set('Cookie', cookieFor(client as never))

describe('la clienta avisa que no va a asistir', () => {
  afterEach(() => { vi.useRealTimers() })

  it('empezado el turno: pasa a cancelled_no_show, bloquea el horario, retiene la seña y avisa a la profesional', async () => {
    const { client, pro, appt } = await setup()
    setNow('10:05')

    const res = await noShow(appt.id, client)

    expect(res.status).toBe(200)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.status).toBe('cancelled_no_show')
    expect(row.slotLocked).toBe(true)
    expect(row.paymentStatus).toBe('partial')
    expect(await prisma.reopenedSlot.count({ where: { appointmentId: appt.id } })).toBe(1)
    const notices = await prisma.professionalNotification.findMany({ where: { professionalId: pro.id } })
    expect(notices.some(n => /no asistirá/.test(n.title))).toBe(true)
  })

  it('antes de la hora de inicio no se puede: se cancela', async () => {
    const { client, appt } = await setup()
    setNow('09:30')

    const res = await noShow(appt.id, client)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_SHOW_BEFORE_START')
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('si ya se registró la llegada no se puede avisar la inasistencia', async () => {
    const { client, appt } = await setup({ arrivedAt: new Date() })
    setNow('10:05')

    const res = await noShow(appt.id, client)

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_ARRIVED')
  })

  it('no puede marcar el turno de otra clienta', async () => {
    const { appt } = await setup()
    const intruder = await createClientUser()
    setNow('10:05')

    expect((await noShow(appt.id, intruder)).status).toBe(404)
  })

  it('con el turno ya empezado la clienta NO puede cancelarlo', async () => {
    const { client, appt } = await setup()
    setNow('10:05')

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('APPOINTMENT_STARTED')
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('confirmed')
  })

  it('antes de empezar sigue pudiendo cancelar', async () => {
    const { client, appt } = await setup()
    setNow('08:00')

    const res = await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client))

    expect(res.status).toBe(200)
  })
})

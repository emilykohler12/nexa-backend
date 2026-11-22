import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService,
  createAppointmentDirect, setAvailability, futureWeekDay,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// La clienta reprograma un combo ENTERO: todas las patas pasan al mismo día y hora, y el horario tiene que servirle a
// todas las profesionales del grupo (franja, vacaciones, turnos propios). Si una sola falla, no se mueve ninguna.
async function comboOfTwo(opts: { date?: string; time?: string } = {}) {
  const client = await createClientUser()
  const proA   = await createProfessionalUser()
  const proB   = await createProfessionalUser()
  await setAvailability(proA.id)   // 09:00 a 18:00 todos los días
  await setAvailability(proB.id)
  const svcA = await createService()
  const svcB = await createService()
  const date = opts.date ?? futureWeekDay(1)
  const time = opts.time ?? '10:00'
  const groupId = randomUUID()
  const legA = await createAppointmentDirect({ clientId: client.id, professionalId: proA.id, serviceId: svcA.id, date, time, comboGroupId: groupId })
  const legB = await createAppointmentDirect({ clientId: client.id, professionalId: proB.id, serviceId: svcB.id, date, time, comboGroupId: groupId })
  return { client, proA, proB, legA, legB, groupId }
}

const reschedule = (client: { id: string }, appointmentId: string, body: Record<string, unknown>) =>
  request(app)
    .patch(`/api/client/appointments/${appointmentId}/reschedule`)
    .set('Cookie', cookieFor(client as any))
    .send(body)

describe('reprogramar un combo', () => {
  it('mueve todas las patas al nuevo día y hora, y limpia la marca del recordatorio', async () => {
    const { client, legA, legB } = await comboOfTwo()
    await prisma.appointment.updateMany({ where: { id: { in: [legA.id, legB.id] } }, data: { reminderSentAt: new Date() } })
    const newDate = futureWeekDay(2)

    const res = await reschedule(client, legA.id, { date: newDate, time: '14:00' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.id).toBe(legA.id)
    expect(res.body.appointments).toHaveLength(2)
    for (const id of [legA.id, legB.id]) {
      const row = await prisma.appointment.findUniqueOrThrow({ where: { id } })
      expect(row.date).toBe(newDate)
      expect(row.time).toBe('14:00')
      expect(row.reminderSentAt).toBeNull()
    }
  })

  it('conserva la profesional, el servicio y la seña de cada pata', async () => {
    const { client, legA, legB } = await comboOfTwo()

    await reschedule(client, legB.id, { date: futureWeekDay(2), time: '11:00' })

    const [a, b] = await Promise.all([
      prisma.appointment.findUniqueOrThrow({ where: { id: legA.id } }),
      prisma.appointment.findUniqueOrThrow({ where: { id: legB.id } }),
    ])
    expect(a.professionalId).toBe(legA.professionalId)
    expect(b.professionalId).toBe(legB.professionalId)
    expect(a.comboGroupId).toBe(b.comboGroupId)
  })

  it('si una profesional no trabaja a esa hora, no se mueve ninguna pata', async () => {
    const { client, proB, legA, legB } = await comboOfTwo()
    // La segunda profesional trabaja solo hasta las 12:00.
    await setAvailability(proB.id, [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '12:00' })))
    const newDate = futureWeekDay(2)

    const res = await reschedule(client, legA.id, { date: newDate, time: '15:00' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
    for (const leg of [legA, legB]) {
      const row = await prisma.appointment.findUniqueOrThrow({ where: { id: leg.id } })
      expect(row.date).toBe(leg.date)
      expect(row.time).toBe(leg.time)
    }
  })

  it('si una profesional tiene vacaciones ese día, se rechaza', async () => {
    const { client, proB, legA } = await comboOfTwo()
    const newDate = futureWeekDay(2)
    await prisma.professional.update({
      where: { userId: proB.id },
      data:  { vacationFrom: new Date(`${newDate}T00:00:00Z`), vacationTo: new Date(`${newDate}T00:00:00Z`) },
    })

    const res = await reschedule(client, legA.id, { date: newDate, time: '10:00' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OUT_OF_HOURS')
  })

  it('si una profesional ya tiene un turno a esa hora, responde 409 y no mueve ninguna pata', async () => {
    const { client, proB, legA, legB } = await comboOfTwo()
    const newDate = futureWeekDay(2)
    const other = await createClientUser()
    await createAppointmentDirect({ clientId: other.id, professionalId: proB.id, serviceId: legB.serviceId, date: newDate, time: '16:00' })

    const res = await reschedule(client, legA.id, { date: newDate, time: '16:00' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
    for (const leg of [legA, legB]) {
      const row = await prisma.appointment.findUniqueOrThrow({ where: { id: leg.id } })
      expect(row.date).toBe(leg.date)
      expect(row.time).toBe(leg.time)
    }
  })

  it('rechaza el mismo día y hora que ya tiene', async () => {
    const { client, legA } = await comboOfTwo()

    const res = await reschedule(client, legA.id, { date: legA.date, time: legA.time })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SLOT_UNCHANGED')
  })

  it('una pata cancelada no se mueve: solo las activas', async () => {
    const { client, legA, legB } = await comboOfTwo()
    await prisma.appointment.update({ where: { id: legB.id }, data: { status: 'cancelled' } })
    const newDate = futureWeekDay(2)

    const res = await reschedule(client, legA.id, { date: newDate, time: '13:00' })

    expect(res.status).toBe(200)
    expect(res.body.appointments).toHaveLength(1)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: legB.id } })).date).toBe(legB.date)
  })

  it('no deja reprogramar el combo de otra clienta', async () => {
    const { legA } = await comboOfTwo()
    const stranger = await createClientUser()

    const res = await reschedule(stranger, legA.id, { date: futureWeekDay(2), time: '10:00' })

    expect(res.status).toBe(404)
  })

  it('avisa a cada profesional del grupo una sola vez', async () => {
    const { client, proA, proB, legA } = await comboOfTwo()

    await reschedule(client, legA.id, { date: futureWeekDay(2), time: '12:00' })

    for (const pro of [proA, proB]) {
      const notices = await prisma.professionalNotification.count({ where: { professionalId: pro.id, type: 'rescheduled_appointment' } })
      expect(notices).toBe(1)
    }
  })
})

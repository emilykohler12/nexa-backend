import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { runAutoNoShowJob } from '../../src/jobs/autoNoShow.job'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, setAvailability,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Fase 2 de la AE4: marca de "No asistió" por el personal, horario reabierto, horario original bloqueado,
// reserva tardía y corrección del estado. Ejemplo de las reglas: turno de las 16:00.
// El reloj se fija en hora de Argentina (UTC-3). Las cookies se crean DESPUÉS de fijar la hora, porque el
// token vence a los 15 minutos del reloj fijado.

const DAY = '2026-11-03' // martes

afterEach(() => { vi.useRealTimers() })

function setNowArt(hhmm: string, seconds = '00') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${DAY}T${hhmm}:${seconds}-03:00`))
}

const art = (hhmm: string) => new Date(`${DAY}T${hhmm}:00-03:00`)

async function scenario(over: { time?: string; status?: string; paymentStatus?: string; depositAmount?: number; duration?: number } = {}) {
  const client = await createClientUser()
  const pro    = await createProfessionalUser({ name: 'Profesional Marca' })
  const admin  = await createAdminUser({ email: `admin-${randomUUID().slice(0, 8)}@test.local` })
  const svc    = await createService({ duration: 60 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: over.time ?? '16:00',
    status: over.status ?? 'confirmed', paymentStatus: over.paymentStatus ?? 'partial',
    depositAmount: over.depositAmount ?? 5000,
  })
  return { client, pro, admin, svc, appt }
}

const patchAs = (who: 'professional' | 'admin', user: { id: string; email: string; role: string }, id: string, body: object) =>
  request(app).patch(`/api/${who}/appointments/${id}`).set('Cookie', cookieFor(user)).send(body)

const book = (client: { id: string; email: string; role: string }, serviceId: string, professionalId: string, time: string, date = DAY) =>
  request(app).post('/api/client/appointments').set('Cookie', cookieFor(client)).send({ serviceId, professionalId, date, time, termsAccepted: true })

const manualBooking = (pro: { id: string; email: string; role: string }, serviceId: string, time: string) =>
  request(app).post('/api/professional/appointments').set('Cookie', cookieFor(pro))
    .send({ clientName: 'Cliente de mostrador', clientPhone: '3764000000', clientEmail: '', serviceId, date: DAY, time })

const availability = (proId: string, serviceId?: string) =>
  request(app).get(`/api/professional/${proId}/availability`).query({ date: DAY, ...(serviceId ? { serviceId } : {}) })

const fresh = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } })

describe('el personal marca "No asistió" (cancelled_no_show)', () => {
  it('a los 32 minutos: se marca, la seña queda retenida y se reabre el horario desde el siguiente múltiplo de 5', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:32')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.status).toBe('cancelled_no_show')
    expect(res.body.appointment.statusLabel).toBe('No asistió')
    const row = await fresh(appt.id)
    expect(row.paymentStatus).toBe('partial')
    expect(Number(row.depositAmount)).toBe(5000)
    expect(row.slotLocked).toBe(true)

    const slot = await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })
    expect(slot.firstStart).toBe('16:35')
    expect(slot.opensAt.toISOString()).toBe(art('16:32').toISOString())
    expect(slot.closesAt.toISOString()).toBe(art('17:00').toISOString())
    expect(slot.originalTime).toBe('16:00')
    expect(slot.closedAt).toBeNull()
  })

  it('a los 40 minutos exactos genera el horario reabierto (primer inicio 16:45)', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:40')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    const slot = await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })
    expect(slot.firstStart).toBe('16:45')
  })

  it('a los 41 minutos se marca igual, la seña queda retenida y NO se genera horario reabierto', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:41')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('cancelled_no_show')
    expect(row.paymentStatus).toBe('partial')
    expect(row.slotLocked).toBe(true)
    expect(await prisma.reopenedSlot.count()).toBe(0)
  })

  it('antes de la hora de inicio se rechaza con 400 NO_SHOW_BEFORE_START', async () => {
    const { pro, appt } = await scenario()
    setNowArt('15:59')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_SHOW_BEFORE_START')
    expect((await fresh(appt.id)).status).toBe('confirmed')
  })

  it('se puede marcar un turno que el job ya había pasado a no_show_auto', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:31')
    expect((await runAutoNoShowJob()).marked).toBe(1)
    setNowArt('16:33')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    expect((await fresh(appt.id)).status).toBe('cancelled_no_show')
    expect((await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })).firstStart).toBe('16:35')
  })

  it('el administrador también puede marcarlo (a las 16:36 el primer inicio es 16:40)', async () => {
    const { admin, appt } = await scenario()
    setNowArt('16:36')

    const res = await patchAs('admin', admin, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(200)
    expect((await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })).firstStart).toBe('16:40')
  })

  it('no_show_auto no se asigna a mano: lo asigna solo el sistema', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:40')

    const res = await patchAs('professional', pro, appt.id, { status: 'no_show_auto' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('solo se marca un turno confirmado o no_show_auto: uno finalizado se rechaza', async () => {
    const { pro, appt } = await scenario({ status: 'finished' })
    setNowArt('17:00')

    const res = await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('el PATCH de la profesional valida el cuerpo (estado inválido, hora inválida)', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:40')

    const badStatus = await patchAs('professional', pro, appt.id, { status: 'inventado' })
    const badTime   = await patchAs('professional', pro, appt.id, { time: '25:99' })

    expect(badStatus.status).toBe(400)
    expect(badStatus.body.code).toBe('VALIDATION_ERROR')
    expect(badTime.status).toBe(400)
    expect(badTime.body.code).toBe('VALIDATION_ERROR')
  })

  it('queda en el registro de actividad con el id del turno, quién lo hizo, el cambio de estado y desde cuándo se reabre', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:32')

    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id } })
    expect(logs).toHaveLength(1)
    expect(logs[0].userName).toBe('Profesional Marca')
    expect(logs[0].detail).toContain('"confirmed" → "cancelled_no_show"')
    expect(logs[0].detail).toContain('se reabre el horario desde las 16:35')
  })

  it('el listado de actividad del administrador trae el id del turno', async () => {
    const { pro, admin, appt } = await scenario()
    setNowArt('16:32')
    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    const res = await request(app).get('/api/admin/activity').set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).toContain(appt.id)
  })
})

describe('el horario ORIGINAL nunca se reabre', () => {
  it('después de la marca, la clienta no puede reservar el horario original (dentro de la tolerancia de 15 minutos)', async () => {
    const { pro, svc, appt } = await scenario()
    setNowArt('16:10')
    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })
    const other = await createClientUser()
    setNowArt('16:12')

    const res = await book(other, svc.id, pro.id, '16:00')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('el personal tampoco puede cargar un turno manual en el horario original (lo corrige el administrador)', async () => {
    const { pro, svc, appt } = await scenario()
    setNowArt('16:35')
    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    const res = await manualBooking(pro, svc.id, '16:00')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('un no_show_auto del job también bloquea el horario para el turno manual del personal', async () => {
    const { pro, svc } = await scenario()
    setNowArt('16:31')
    await runAutoNoShowJob()

    const res = await manualBooking(pro, svc.id, '16:00')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
  })

  it('lo garantiza el índice de la base: un INSERT directo del mismo inicio falla', async () => {
    const { pro, svc, client, appt } = await scenario()
    setNowArt('16:35')
    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    await expect(createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '16:00',
    })).rejects.toThrow()
  })

  it('la disponibilidad pública sigue marcando el original como ocupado', async () => {
    const { pro, appt } = await scenario()
    setNowArt('16:35')
    await patchAs('professional', pro, appt.id, { status: 'cancelled_no_show' })

    const res = await availability(pro.id)

    expect(res.status).toBe(200)
    expect(res.body.bookedTimes).toContain('16:00')
  })

  it('una cancelación de la clienta con el turno ya empezado bloquea el original; antes de empezar lo libera', async () => {
    const started = await scenario()
    const early   = await scenario({ time: '18:00' })
    setNowArt('16:10')

    const cancelStarted = await request(app).patch(`/api/client/appointments/${started.appt.id}/cancel`).set('Cookie', cookieFor(started.client))
    const cancelEarly   = await request(app).patch(`/api/client/appointments/${early.appt.id}/cancel`).set('Cookie', cookieFor(early.client))

    expect(cancelStarted.status).toBe(200)
    expect(cancelEarly.status).toBe(200)
    expect((await fresh(started.appt.id)).slotLocked).toBe(true)
    expect((await fresh(early.appt.id)).slotLocked).toBe(false)
    await expect(createAppointmentDirect({
      clientId: started.client.id, professionalId: started.pro.id, serviceId: started.svc.id, date: DAY, time: '16:00',
    })).rejects.toThrow()
    const rebooked = await createAppointmentDirect({
      clientId: early.client.id, professionalId: early.pro.id, serviceId: early.svc.id, date: DAY, time: '18:00',
    })
    expect(rebooked.id).toBeDefined()
  })

  it('la liberación por falta de pago de un turno ya empezado también bloquea el original', async () => {
    const started = await scenario({ paymentStatus: 'pending' })
    const early   = await scenario({ time: '18:00', paymentStatus: 'pending' })
    setNowArt('16:25')
    const old = new Date(Date.now() - 30 * 60 * 1000)
    await prisma.appointment.updateMany({ where: { id: { in: [started.appt.id, early.appt.id] } }, data: { createdAt: old } })

    expect((await runReleaseUnpaidAppointmentsJob()).released).toBe(2)

    expect((await fresh(started.appt.id)).slotLocked).toBe(true)
    expect((await fresh(early.appt.id)).slotLocked).toBe(false)
    expect((await fresh(started.appt.id)).status).toBe('cancelled')
  })
})

describe('reservas en el horario reabierto', () => {
  // Turno de las 16:00 marcado como no asistido a las 16:32: primer inicio 16:35, hasta las 17:00 inclusive.
  async function reopened(over: Parameters<typeof scenario>[0] = {}) {
    const s = await scenario(over)
    setNowArt('16:32')
    const res = await patchAs('professional', s.pro, s.appt.id, { status: 'cancelled_no_show' })
    expect(res.status).toBe(200)
    const other = await createClientUser()
    setNowArt('16:33')
    return { ...s, other }
  }

  it('una reserva en un inicio ofrecido es un turno normal: confirmado, con seña y pendiente de pago', async () => {
    const { pro, svc, other } = await reopened()
    await prisma.paymentSettings.deleteMany()
    await prisma.paymentSettings.create({ data: { depositAmount: 2000, depositPercent: false } })

    const res = await book(other, svc.id, pro.id, '16:35')

    expect(res.status).toBe(201)
    expect(res.body.appointment.status).toBe('confirmed')
    expect(res.body.appointment.paymentStatus).toBe('pending')
    expect(res.body.appointment.depositAmount).toBe(2000)
    expect(res.body.appointment.displayStatus).toBe('pending_deposit')
  })

  it('el inicio de las 17:00 (60 minutos después de la hora original) se acepta hasta las 17:00 inclusive', async () => {
    const { pro, svc, other } = await reopened()
    setNowArt('17:00')

    const res = await book(other, svc.id, pro.id, '17:00')

    expect(res.status).toBe(201)
  })

  it('pasadas las 17:00 el horario reabierto ya no se acepta (a las 17:05 el inicio de las 17:00 se rechaza)', async () => {
    const { pro, svc, other } = await reopened()
    setNowArt('17:05')

    const res = await book(other, svc.id, pro.id, '17:00')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('REOPENED_SLOT_CLOSED')
  })

  it('el servidor ofrece inicios cada 5 minutos desde el 16:35 hasta las 17:00, sin el original', async () => {
    const { pro, svc } = await reopened()

    const res = await availability(pro.id, svc.id)

    expect(res.status).toBe(200)
    expect(res.body.reopenedStarts[0]).toBe('16:35')
    expect(res.body.reopenedStarts.at(-1)).toBe('17:00')
    expect(res.body.reopenedStarts).toHaveLength(6)
    expect(res.body.reopenedStarts).not.toContain('16:00')
    expect(res.body.reopenedStarts).not.toContain('17:05')
    // Reserva tardía: el primer inicio reservable es 15 minutos antes de la hora actual.
    expect(res.body.earliestStart).toBe('16:18')
  })

  it('no se ofrece ni se acepta un inicio anterior al primero ni fuera de los múltiplos de 5 minutos', async () => {
    const { pro, svc, other } = await reopened()

    const before    = await book(other, svc.id, pro.id, '16:30')
    const notMultiple = await book(other, svc.id, pro.id, '16:37')

    expect(before.status).toBe(409)
    expect(before.body.code).toBe('REOPENED_SLOT_UNAVAILABLE')
    expect(notMultiple.status).toBe(409)
    expect(notMultiple.body.code).toBe('REOPENED_SLOT_UNAVAILABLE')
  })

  it('un inicio ya pasado se acepta hasta 15 minutos después (16:35 a las 16:50) y no a las 16:51', async () => {
    const { pro, svc, other } = await reopened()
    const third = await createClientUser()

    setNowArt('16:50')
    const ok = await book(other, svc.id, pro.id, '16:35')
    setNowArt('16:51')
    const late = await book(third, svc.id, pro.id, '16:35')

    expect(ok.status).toBe(201)
    expect(late.status).toBe(400)
    expect(late.body.code).toBe('START_TIME_PASSED')
  })

  it('un servicio de 2 horas que no entra antes del siguiente turno se rechaza; uno de 30 minutos sí', async () => {
    const { pro, svc, other, client } = await reopened()
    await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '17:30' })
    const long  = await createService({ duration: 120, name: 'Servicio largo' })
    const short = await createService({ duration: 30,  name: 'Servicio corto' })

    const tooLong = await book(other, long.id, pro.id, '16:35')
    const fits    = await book(other, short.id, pro.id, '16:35')

    expect(tooLong.status).toBe(409)
    expect(tooLong.body.code).toBe('SERVICE_DOES_NOT_FIT')
    expect(fits.status).toBe(201)
    // La oferta del servidor respeta lo mismo: con el de 60 minutos, ningún inicio termina antes de las 17:30
    // salvo los que ya no entran.
    const offered = await availability(pro.id, svc.id)
    expect(offered.body.reopenedStarts).not.toContain('17:00')
  })

  it('el servicio tiene que terminar dentro de la franja de la profesional', async () => {
    const { pro, svc, other } = await reopened()
    await setAvailability(pro.id, [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:30' }]) // martes hasta las 17:30

    const res = await book(other, svc.id, pro.id, '16:35') // 60 minutos: terminaría 17:35

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SERVICE_DOES_NOT_FIT')
  })

  it('dos reservas simultáneas que se pisan (16:35 y 16:40, 60 minutos cada una): entra una sola', async () => {
    const { pro, svc, other } = await reopened()
    const third = await createClientUser()
    const cookieA = cookieFor(other)
    const cookieB = cookieFor(third)

    const [a, b] = await Promise.all([
      request(app).post('/api/client/appointments').set('Cookie', cookieA)
        .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:35', termsAccepted: true }),
      request(app).post('/api/client/appointments').set('Cookie', cookieB)
        .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:40', termsAccepted: true }),
    ])

    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await prisma.appointment.count({ where: { professionalId: pro.id, status: 'confirmed' } })).toBe(1)
  })

  it('una clienta puede reprogramar su turno hacia un inicio del horario reabierto', async () => {
    const { pro, svc, other } = await reopened()
    setNowArt('16:20')
    const mine = await createAppointmentDirect({ clientId: other.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '18:00' })
    setNowArt('16:33')

    const res = await request(app)
      .patch(`/api/client/appointments/${mine.id}/reschedule`)
      .set('Cookie', cookieFor(other))
      .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:45' })

    expect(res.status).toBe(200)
    expect(res.body.appointment.time).toBe('16:45')
  })

  it('fuera del rango del horario reabierto la reserva sigue siendo normal (18:00)', async () => {
    const { pro, svc, other } = await reopened()

    const res = await book(other, svc.id, pro.id, '18:00')

    expect(res.status).toBe(201)
  })
})

describe('reserva tardía (hasta 15 minutos después de la hora de inicio)', () => {
  async function free() {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    return { client, pro, svc }
  }

  it('a los 15 minutos exactos de la hora de inicio todavía se puede reservar', async () => {
    const { client, pro, svc } = await free()
    setNowArt('10:15')

    const res = await book(client, svc.id, pro.id, '10:00')

    expect(res.status).toBe(201)
  })

  it('a los 16 minutos responde 400 START_TIME_PASSED', async () => {
    const { client, pro, svc } = await free()
    setNowArt('10:16')

    const res = await book(client, svc.id, pro.id, '10:00')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('START_TIME_PASSED')
    expect(await prisma.appointment.count()).toBe(0)
  })

  it('también vale al reprogramar: 10:15 sí, 10:16 no', async () => {
    const { client, pro, svc } = await free()
    const mine = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '18:00' })
    const body = { serviceId: svc.id, professionalId: pro.id, date: DAY, time: '10:00' }

    setNowArt('10:16')
    const late = await request(app).patch(`/api/client/appointments/${mine.id}/reschedule`).set('Cookie', cookieFor(client)).send(body)
    setNowArt('10:15')
    const ok = await request(app).patch(`/api/client/appointments/${mine.id}/reschedule`).set('Cookie', cookieFor(client)).send(body)

    expect(late.status).toBe(400)
    expect(late.body.code).toBe('START_TIME_PASSED')
    expect(ok.status).toBe(200)
  })

  it('con la asignación "cualquiera" también responde START_TIME_PASSED', async () => {
    const { client, svc, pro } = await free()
    await prisma.professionalService.create({
      data: { professionalId: (await prisma.professional.findUniqueOrThrow({ where: { userId: pro.id } })).id, serviceId: svc.id, ownPrice: 1, ownDuration: 60 },
    })
    setNowArt('10:16')

    const res = await book(client, svc.id, 'any', '10:00')

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('START_TIME_PASSED')
  })

  it('el personal queda exento: puede cargar un turno manual con la hora ya pasada', async () => {
    const { pro, svc } = await free()
    setNowArt('10:16')

    const res = await manualBooking(pro, svc.id, '10:00')

    expect(res.status).toBe(201)
  })

  it('la disponibilidad dice desde qué hora se puede reservar, sin depender del reloj del navegador', async () => {
    const { pro } = await free()

    setNowArt('21:30')
    const night = await availability(pro.id)
    setNowArt('10:00')
    const morning = await availability(pro.id)

    expect(night.body.earliestStart).toBe('21:15')
    expect(morning.body.earliestStart).toBe('09:45')
  })
})

describe('corrección del estado por el personal (regla 2.7)', () => {
  async function noShow(kind: 'no_show_auto' | 'cancelled_no_show') {
    const s = await scenario()
    if (kind === 'no_show_auto') {
      setNowArt('16:31')
      await runAutoNoShowJob()
    } else {
      setNowArt('16:32')
      await patchAs('professional', s.pro, s.appt.id, { status: 'cancelled_no_show' })
    }
    setNowArt('17:10')
    return s
  }

  it.each(['no_show_auto', 'cancelled_no_show'] as const)('de %s a finished: siempre se puede, la seña no cambia y el horario reabierto se cierra', async (kind) => {
    const { pro, svc, appt } = await noShow(kind)

    const res = await patchAs('professional', pro, appt.id, { status: 'finished' })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('finished')
    expect(row.paymentStatus).toBe('partial')
    expect(row.slotLocked).toBe(false)
    const slot = await prisma.reopenedSlot.findUnique({ where: { appointmentId: appt.id } })
    if (kind === 'cancelled_no_show') {
      expect(slot?.closedReason).toBe('corrected')
      expect(slot?.closedAt).not.toBeNull()
    }
    expect((await availability(pro.id, svc.id)).body.reopenedStarts).toEqual([])
  })

  it('queda registrado quién, cuándo y de qué estado a cuál', async () => {
    const { admin, appt } = await noShow('cancelled_no_show')

    await patchAs('admin', admin, appt.id, { status: 'finished' })

    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id }, orderBy: { createdAt: 'asc' } })
    const entry = logs.find(l => l.detail?.includes('"cancelled_no_show" → "finished"'))
    expect(entry).toBeDefined()
    expect(entry!.userName).toBe(admin.email)
    expect(entry!.detail).toContain('corrección del personal')
    expect(entry!.createdAt).toBeInstanceOf(Date)
  })

  it('a confirmed sin superposición: se puede, queda la llegada registrada y el job no lo vuelve a marcar', async () => {
    const { pro, appt } = await noShow('no_show_auto')

    const res = await patchAs('professional', pro, appt.id, { status: 'confirmed' })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('confirmed')
    expect(row.arrivedAt).not.toBeNull()
    expect(row.paymentStatus).toBe('partial')
    setNowArt('18:30')
    expect((await runAutoNoShowJob()).marked).toBe(0)
  })

  it('a confirmed con superposición: 409 APPOINTMENT_OVERLAP y el estado no cambia', async () => {
    const { pro, svc, client, appt } = await noShow('cancelled_no_show')
    // Otro turno activo que pisa 16:00–17:00 (por ejemplo una reserva hecha en el horario reabierto).
    await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '16:35' })

    const res = await patchAs('professional', pro, appt.id, { status: 'confirmed' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('APPOINTMENT_OVERLAP')
    expect((await fresh(appt.id)).status).toBe('cancelled_no_show')
  })

  it('un turno marcado como no asistido no se puede pasar a cancelado ni a pendiente, ni reprogramar', async () => {
    const { pro, appt } = await noShow('cancelled_no_show')

    const cancel     = await patchAs('professional', pro, appt.id, { status: 'cancelled', cancelledBy: 'studio' })
    const pending    = await patchAs('professional', pro, appt.id, { status: 'pending' })
    const reschedule = await patchAs('professional', pro, appt.id, { time: '18:00' })

    for (const res of [cancel, pending, reschedule]) {
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION')
    }
    expect((await fresh(appt.id)).status).toBe('cancelled_no_show')
  })

  it('una profesional no puede corregir el turno de otra', async () => {
    const { appt } = await noShow('no_show_auto')
    const stranger = await createProfessionalUser()

    const res = await patchAs('professional', stranger, appt.id, { status: 'finished' })

    expect(res.status).toBe(404)
  })
})

describe('caso María: turno a las 8:00 que nadie registra', () => {
  it('el job lo marca a las 8:35, el horario sigue ocupado y a las 10:00 la profesional lo cierra como finished', async () => {
    const { pro, svc, appt } = await scenario({ time: '08:00' })

    setNowArt('08:35')
    expect((await runAutoNoShowJob()).marked).toBe(1)
    expect((await fresh(appt.id)).status).toBe('no_show_auto')
    expect((await manualBooking(pro, svc.id, '08:00')).status).toBe(409)

    setNowArt('10:00')
    const res = await patchAs('professional', pro, appt.id, { status: 'finished' })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.status).toBe('finished')
    expect(row.paymentStatus).toBe('partial')
    expect(Number(row.depositAmount)).toBe(5000)
    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id } })
    expect(logs.map(l => l.detail).join('\n')).toContain('"confirmed" → "no_show_auto"')
    expect(logs.map(l => l.detail).join('\n')).toContain('"no_show_auto" → "finished"')
  })
})

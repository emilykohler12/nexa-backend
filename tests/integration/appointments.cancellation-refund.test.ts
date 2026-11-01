import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Fase 3 de la AE4: cancelación y devolución de la seña con hora de aviso. Turno de ejemplo: martes 2026-11-03 a
// las 16:00. El corte es cancellationHours (12 por defecto): con 12 horas o más de aviso y la seña paga, la seña se
// marca 'refunded'; con menos, queda retenida. El sistema solo MARCA la devolución. Las cookies se crean DESPUÉS
// de fijar la hora porque el token vence a los 15 minutos del reloj fijado.

const DAY = '2026-11-03'
const HOUR = 60 * 60 * 1000

afterEach(() => { vi.useRealTimers() })
beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

function setNowArt(hhmm: string, date = DAY) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${date}T${hhmm}:00-03:00`))
}

const art = (hhmm: string) => new Date(`${DAY}T${hhmm}:00-03:00`)
// Hora de aviso: N horas antes del inicio del turno de las 16:00.
const noticeHoursBefore = (hours: number) => new Date(art('16:00').getTime() - hours * HOUR).toISOString()

async function scenario(over: { time?: string; paymentStatus?: string; depositAmount?: number } = {}) {
  const client = await createClientUser({ name: 'Clienta Aviso' })
  const pro    = await createProfessionalUser({ name: 'Profesional Aviso' })
  const admin  = await createAdminUser({ email: `admin-${randomUUID().slice(0, 8)}@test.local` })
  const svc    = await createService({ duration: 60 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: over.time ?? '16:00',
    paymentStatus: over.paymentStatus ?? 'partial', depositAmount: over.depositAmount ?? 5000,
  })
  return { client, pro, admin, svc, appt }
}

type U = { id: string; email: string; role: string }
const fresh = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } })

const clientCancel = (client: U, id: string) =>
  request(app).patch(`/api/client/appointments/${id}/cancel`).set('Cookie', cookieFor(client))

const staffCancel = (who: 'professional' | 'admin', user: U, id: string, body: object) =>
  request(app).patch(`/api/${who}/appointments/${id}`).set('Cookie', cookieFor(user)).send({ status: 'cancelled', ...body })

async function setPolicy(refundPolicy: string, cancellationHours = 12) {
  await prisma.paymentSettings.deleteMany()
  await prisma.paymentSettings.create({ data: { refundPolicy, cancellationHours } })
}

describe('cancelación de la clienta desde la app', () => {
  it('con 13 horas de anticipación y la seña paga: la seña se marca como devuelta', async () => {
    const { client, appt } = await scenario()
    setNowArt('03:00')

    const res = await clientCancel(client, appt.id)

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(true)
    expect(res.body.appointment.paymentStatus).toBe('refunded')
    const row = await fresh(appt.id)
    expect(row.cancelledBy).toBe('client')
    expect(row.slotLocked).toBe(false)
  })

  it('con 12 horas exactas todavía se devuelve (12 o más)', async () => {
    const { client, appt } = await scenario()
    setNowArt('04:00')

    const res = await clientCancel(client, appt.id)

    expect(res.body.refunded).toBe(true)
    expect((await fresh(appt.id)).paymentStatus).toBe('refunded')
  })

  it('con 11 horas la seña queda retenida', async () => {
    const { client, appt } = await scenario()
    setNowArt('05:00')

    const res = await clientCancel(client, appt.id)

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(false)
    expect((await fresh(appt.id)).paymentStatus).toBe('partial')
  })

  it('con la seña impaga no se marca nada, aunque falten muchas horas', async () => {
    const { client, appt } = await scenario({ paymentStatus: 'pending' })
    setNowArt('03:00')

    const res = await clientCancel(client, appt.id)

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(false)
    expect((await fresh(appt.id)).paymentStatus).toBe('pending')
  })

  it('con la política "none" la seña queda retenida aunque haya 13 horas', async () => {
    const { client, appt } = await scenario()
    await setPolicy('none')
    setNowArt('03:00')

    const res = await clientCancel(client, appt.id)

    expect(res.body.refunded).toBe(false)
    expect((await fresh(appt.id)).paymentStatus).toBe('partial')
  })

  it('el corte usa las horas de la configuración (cancellationHours = 24)', async () => {
    const { client, appt } = await scenario()
    await setPolicy('full', 24)
    setNowArt('03:00') // 13 horas: menos que 24

    const res = await clientCancel(client, appt.id)

    expect(res.body.refunded).toBe(false)
  })

  it('con el turno ya empezado: sin devolución, el original queda bloqueado y se abre el horario reabierto', async () => {
    const { client, appt } = await scenario()
    setNowArt('16:10')

    const res = await clientCancel(client, appt.id)

    expect(res.status).toBe(200)
    expect(res.body.refunded).toBe(false)
    const row = await fresh(appt.id)
    expect(row.paymentStatus).toBe('partial')
    expect(row.slotLocked).toBe(true)
    const slot = await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })
    expect(slot.firstStart).toBe('16:15')
    expect(slot.closesAt.toISOString()).toBe(art('17:00').toISOString())
  })

  it('cancelando a los 40 minutos exactos se abre el horario reabierto; a los 41 no', async () => {
    const at40 = await scenario()
    const at41 = await scenario()

    setNowArt('16:40')
    await clientCancel(at40.client, at40.appt.id)
    setNowArt('16:41')
    await clientCancel(at41.client, at41.appt.id)

    expect(await prisma.reopenedSlot.count({ where: { appointmentId: at40.appt.id } })).toBe(1)
    expect(await prisma.reopenedSlot.count({ where: { appointmentId: at41.appt.id } })).toBe(0)
    expect((await fresh(at41.appt.id)).slotLocked).toBe(true)
  })

  it('el horario original no se puede reservar después de cancelar un turno ya empezado', async () => {
    const { client, pro, svc, appt } = await scenario()
    setNowArt('16:10')
    await clientCancel(client, appt.id)
    const other = await createClientUser()
    setNowArt('16:12')

    const res = await request(app)
      .post('/api/client/appointments')
      .set('Cookie', cookieFor(other))
      .send({ serviceId: svc.id, professionalId: pro.id, date: DAY, time: '16:00', termsAccepted: true })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
    await expect(createAppointmentDirect({
      clientId: other.id, professionalId: pro.id, serviceId: svc.id, date: DAY, time: '16:00',
    })).rejects.toThrow()
  })

  it('su propia cancelación NO manda mail a la clienta', async () => {
    const { client, appt } = await scenario()
    setNowArt('03:00')

    await clientCancel(client, appt.id)

    expect(vi.mocked(mailProvider.send).mock.calls.some(c => c[0] === client.email)).toBe(false)
  })
})

describe('cancelación del personal con hora de aviso', () => {
  it.each([
    ['13 horas', 13, true],
    ['12 horas exactas', 12, true],
    ['11 horas', 11, false],
  ])('aviso de la clienta con %s: devolución = %s', async (_label, hours, refunded) => {
    const { pro, appt } = await scenario()
    setNowArt('14:00')

    const res = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(hours) })

    expect(res.status).toBe(200)
    expect(res.body.appointment.status).toBe('cancelled')
    expect((await fresh(appt.id)).paymentStatus).toBe(refunded ? 'refunded' : 'partial')
  })

  it('cancelación del estudio con solo 2 horas de anticipación: la seña paga se marca devuelta', async () => {
    const { pro, appt } = await scenario()
    setNowArt('14:00')

    const res = await staffCancel('professional', pro, appt.id, { cancelledBy: 'studio' })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.paymentStatus).toBe('refunded')
    expect(row.cancelledBy).toBe('studio')
  })

  it('el estudio devuelve aunque la política sea "none" (la política rige solo para la clienta)', async () => {
    const { admin, appt } = await scenario()
    await setPolicy('none')
    setNowArt('15:00')

    await staffCancel('admin', admin, appt.id, { cancelledBy: 'studio' })

    expect((await fresh(appt.id)).paymentStatus).toBe('refunded')
  })

  it('aviso cargado tarde con una hora anterior: cuenta la hora del aviso, no la de la carga', async () => {
    const { pro, appt } = await scenario()
    setNowArt('15:30') // faltan 30 minutos, pero la clienta avisó 14 horas antes

    const res = await staffCancel('professional', pro, appt.id, {
      cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(14), noticeChannel: 'whatsapp', noticeNote: 'Avisó por WhatsApp a la mañana',
    })

    expect(res.status).toBe(200)
    const row = await fresh(appt.id)
    expect(row.paymentStatus).toBe('refunded')
    expect(row.clientNoticeAt?.toISOString()).toBe(noticeHoursBefore(14))
    expect(row.noticeChannel).toBe('whatsapp')
    expect(row.noticeNote).toBe('Avisó por WhatsApp a la mañana')
    expect(row.noticeLoadedById).toBe(pro.id)
    expect(row.noticeLoadedAt?.toISOString()).toBe(art('15:30').toISOString())
  })

  it('un aviso de hora futura se rechaza y el turno no cambia', async () => {
    const { pro, appt } = await scenario()
    setNowArt('14:00')

    const res = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', clientNoticeAt: new Date(art('15:00')).toISOString() })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_NOTICE_TIME')
    expect((await fresh(appt.id)).status).toBe('confirmed')
  })

  it('un aviso posterior al inicio del turno se acepta y no se devuelve', async () => {
    const { admin, appt } = await scenario()
    setNowArt('16:20')

    const res = await staffCancel('admin', admin, appt.id, { cancelledBy: 'client', clientNoticeAt: art('16:10').toISOString() })

    expect(res.status).toBe(200)
    expect(res.body.appointment.cancellation.noticeHours).toBeLessThan(0)
    expect((await fresh(appt.id)).paymentStatus).toBe('partial')
  })

  it('sin hora de aviso se toma ahora', async () => {
    const { pro, appt } = await scenario()
    setNowArt('13:00') // 3 horas antes

    await staffCancel('professional', pro, appt.id, { cancelledBy: 'client' })

    const row = await fresh(appt.id)
    expect(row.clientNoticeAt?.toISOString()).toBe(art('13:00').toISOString())
    expect(row.paymentStatus).toBe('partial')
  })

  it('la profesional puede cargar un aviso de hace 47 horas, no de hace 49; el administrador sí', async () => {
    const ok  = await scenario()
    const old = await scenario()
    const adm = await scenario()
    setNowArt('14:00')
    const ago = (hours: number) => new Date(art('14:00').getTime() - hours * HOUR).toISOString()

    const at47  = await staffCancel('professional', ok.pro, ok.appt.id, { cancelledBy: 'client', clientNoticeAt: ago(47) })
    const at49  = await staffCancel('professional', old.pro, old.appt.id, { cancelledBy: 'client', clientNoticeAt: ago(49) })
    const admin = await staffCancel('admin', adm.admin, adm.appt.id, { cancelledBy: 'client', clientNoticeAt: ago(49) })

    expect(at47.status).toBe(200)
    expect(at49.status).toBe(403)
    expect(at49.body.code).toBe('NOTICE_TOO_OLD')
    expect((await fresh(old.appt.id)).status).toBe('confirmed')
    expect(admin.status).toBe(200)
    expect((await fresh(adm.appt.id)).paymentStatus).toBe('refunded')
  })

  it('con la seña impaga no se marca nada, ni cancelando el estudio ni por aviso', async () => {
    const byClient = await scenario({ paymentStatus: 'pending' })
    const byStudio = await scenario({ paymentStatus: 'pending' })
    setNowArt('10:00')

    await staffCancel('professional', byClient.pro, byClient.appt.id, { cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(20) })
    await staffCancel('professional', byStudio.pro, byStudio.appt.id, { cancelledBy: 'studio' })

    expect((await fresh(byClient.appt.id)).paymentStatus).toBe('pending')
    expect((await fresh(byStudio.appt.id)).paymentStatus).toBe('pending')
  })

  it('cancelledBy es obligatorio (400) y se validan el medio y la nota', async () => {
    const { pro, admin, appt } = await scenario()
    setNowArt('14:00')

    const missing  = await staffCancel('professional', pro, appt.id, {})
    const missingA = await staffCancel('admin', admin, appt.id, {})
    const badChan  = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', noticeChannel: 'paloma' })
    const longNote = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', noticeNote: 'x'.repeat(201) })
    const badDate  = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', clientNoticeAt: 'ayer' })

    for (const res of [missing, missingA, badChan, longNote, badDate]) {
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect((await fresh(appt.id)).status).toBe('confirmed')

    const maxNote = await staffCancel('professional', pro, appt.id, { cancelledBy: 'client', noticeNote: 'x'.repeat(200) })
    expect(maxNote.status).toBe(200)
  })

  it('un turno finalizado no se cancela', async () => {
    const { pro, appt } = await scenario()
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'finished' } })
    setNowArt('14:00')

    const res = await staffCancel('professional', pro, appt.id, { cancelledBy: 'studio' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION')
    expect((await fresh(appt.id)).paymentStatus).toBe('partial')
  })

  it('cancelando ya empezado: bloquea el original y abre el horario reabierto hasta 40 minutos; después no', async () => {
    const early = await scenario()
    const late  = await scenario()

    setNowArt('16:20')
    await staffCancel('professional', early.pro, early.appt.id, { cancelledBy: 'studio' })
    setNowArt('16:45')
    await staffCancel('professional', late.pro, late.appt.id, { cancelledBy: 'studio' })

    expect((await fresh(early.appt.id)).slotLocked).toBe(true)
    expect(await prisma.reopenedSlot.count({ where: { appointmentId: early.appt.id } })).toBe(1)
    expect((await fresh(late.appt.id)).slotLocked).toBe(true)
    expect(await prisma.reopenedSlot.count({ where: { appointmentId: late.appt.id } })).toBe(0)
  })

  it('el detalle del turno y el registro de actividad muestran quién, cuándo, el medio y la nota del aviso', async () => {
    const { admin, appt } = await scenario()
    setNowArt('15:00')

    const res = await staffCancel('admin', admin, appt.id, {
      cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(13), noticeChannel: 'call', noticeNote: 'Llamó al local',
    })

    expect(res.status).toBe(200)
    const detail = res.body.appointment.cancellation
    expect(detail.cancelledBy).toBe('client')
    expect(detail.refunded).toBe(true)
    expect(detail.noticeAt).toBe(noticeHoursBefore(13))
    expect(detail.noticeHours).toBe(13)
    expect(detail.noticeChannel).toBe('call')
    expect(detail.noticeNote).toBe('Llamó al local')
    expect(detail.noticeLoadedBy).toEqual({ id: admin.id, name: expect.any(String) })
    expect(detail.noticeLoadedAt).toBe(art('15:00').toISOString())

    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id, action: 'Turno cancelado' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].detail).toContain('cancela la clienta')
    expect(logs[0].detail).toContain('seña marcada como devuelta')
    expect(logs[0].detail).toContain('13.0 h de aviso')
    expect(logs[0].detail).toContain('por llamada')
    expect(logs[0].detail).toContain('Llamó al local')
    expect(logs[0].detail).toContain('cargado por')
  })

  it('el mail a la clienta se envía cuando cancela el personal, en los dos casos', async () => {
    const byClient = await scenario()
    const byStudio = await scenario()
    setNowArt('14:00')

    await staffCancel('professional', byClient.pro, byClient.appt.id, { cancelledBy: 'client' })
    await staffCancel('admin', byStudio.admin, byStudio.appt.id, { cancelledBy: 'studio' })

    const sentTo = vi.mocked(mailProvider.send).mock.calls.filter(c => String(c[1]).includes('cancelado')).map(c => c[0])
    expect(sentTo).toContain(byClient.client.email)
    expect(sentTo).toContain(byStudio.client.email)
  })
})

describe('combos: la devolución se evalúa una sola vez para el grupo', () => {
  async function combo() {
    const client = await createClientUser()
    const proA   = await createProfessionalUser({ name: 'Pro A' })
    const proB   = await createProfessionalUser({ name: 'Pro B' })
    const admin  = await createAdminUser({ email: `admin-${randomUUID().slice(0, 8)}@test.local` })
    const svc    = await createService({ duration: 60 })
    const groupId = randomUUID()
    const legA = await createAppointmentDirect({
      clientId: client.id, professionalId: proA.id, serviceId: svc.id, date: DAY, time: '16:00',
      comboGroupId: groupId, paymentStatus: 'partial', depositAmount: 5000,
    })
    const legB = await createAppointmentDirect({
      clientId: client.id, professionalId: proB.id, serviceId: svc.id, date: DAY, time: '16:00',
      comboGroupId: groupId, paymentStatus: 'partial', depositAmount: 0,
    })
    return { client, proA, proB, admin, legA, legB }
  }

  it('la clienta cancela una pata: no se evalúa nada; cancela la última con 13 horas: se marcan devueltas las dos', async () => {
    const { client, legA, legB } = await combo()
    setNowArt('03:00')

    const first = await clientCancel(client, legA.id)
    expect(first.status).toBe(200)
    expect(first.body.partialCombo).toBe(true)
    expect(first.body.refunded).toBe(false)
    expect((await fresh(legA.id)).paymentStatus).toBe('partial')
    expect((await fresh(legB.id)).status).toBe('confirmed')

    const second = await clientCancel(client, legB.id)
    expect(second.body.partialCombo).toBe(false)
    expect(second.body.refunded).toBe(true)
    expect((await fresh(legA.id)).paymentStatus).toBe('refunded')
    expect((await fresh(legB.id)).paymentStatus).toBe('refunded')
  })

  it('la última pata cancelada con menos de 12 horas: la seña del grupo queda retenida', async () => {
    const { client, legA, legB } = await combo()
    setNowArt('10:00')

    await clientCancel(client, legA.id)
    const last = await clientCancel(client, legB.id)

    expect(last.body.refunded).toBe(false)
    expect((await fresh(legA.id)).paymentStatus).toBe('partial')
    expect((await fresh(legB.id)).paymentStatus).toBe('partial')
  })

  it('el personal cancela todo el grupo por aviso de la clienta: una sola decisión con la misma hora de aviso', async () => {
    const accepted = await combo()
    const retained = await combo()
    setNowArt('14:00')

    await staffCancel('admin', accepted.admin, accepted.legB.id, { cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(13) })
    await staffCancel('admin', retained.admin, retained.legB.id, { cancelledBy: 'client', clientNoticeAt: noticeHoursBefore(11) })

    for (const leg of [accepted.legA, accepted.legB]) {
      const row = await fresh(leg.id)
      expect(row.status).toBe('cancelled')
      expect(row.paymentStatus).toBe('refunded')
      expect(row.clientNoticeAt?.toISOString()).toBe(noticeHoursBefore(13))
    }
    for (const leg of [retained.legA, retained.legB]) {
      const row = await fresh(leg.id)
      expect(row.status).toBe('cancelled')
      expect(row.paymentStatus).toBe('partial')
    }
  })

  it('el estudio cancela el grupo: la seña paga de todas las patas se marca devuelta', async () => {
    const { admin, legA, legB } = await combo()
    setNowArt('15:00')

    await staffCancel('admin', admin, legA.id, { cancelledBy: 'studio' })

    expect((await fresh(legA.id)).paymentStatus).toBe('refunded')
    expect((await fresh(legB.id)).paymentStatus).toBe('refunded')
  })
})

describe('liberación por falta de pago de un turno ya empezado', () => {
  it('cuenta como cancelación: bloquea el original, queda cancelledBy "system" y abre el horario reabierto', async () => {
    const { appt } = await scenario({ paymentStatus: 'pending' })
    setNowArt('16:25')
    await prisma.appointment.update({ where: { id: appt.id }, data: { createdAt: new Date(Date.now() - 30 * 60 * 1000) } })

    expect((await runReleaseUnpaidAppointmentsJob()).released).toBe(1)

    const row = await fresh(appt.id)
    expect(row.status).toBe('cancelled')
    expect(row.cancelledBy).toBe('system')
    expect(row.slotLocked).toBe(true)
    const slot = await prisma.reopenedSlot.findUniqueOrThrow({ where: { appointmentId: appt.id } })
    expect(slot.firstStart).toBe('16:30')
  })
})

describe('política de devolución: solo "full" o "none"', () => {
  const patchSettings = (user: U, body: object) =>
    request(app).patch('/api/settings/payments').set('Cookie', cookieFor(user)).send(body)

  it('acepta "full" y "none"', async () => {
    const admin = await createAdminUser()

    const none = await patchSettings(admin, { refundPolicy: 'none' })
    const full = await patchSettings(admin, { refundPolicy: 'full' })

    expect(none.status).toBe(200)
    expect(none.body.settings.refundPolicy).toBe('none')
    expect(full.body.settings.refundPolicy).toBe('full')
  })

  it('rechaza "partial" y cualquier otro valor con 400', async () => {
    const admin = await createAdminUser()

    for (const refundPolicy of ['partial', 'half', '']) {
      const res = await patchSettings(admin, { refundPolicy })
      expect(res.status, refundPolicy).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
  })

  it('valida el resto del cuerpo: horas, monto y porcentaje', async () => {
    const admin = await createAdminUser()

    expect((await patchSettings(admin, { cancellationHours: -1 })).status).toBe(400)
    expect((await patchSettings(admin, { cancellationHours: 1.5 })).status).toBe(400)
    expect((await patchSettings(admin, { depositAmount: -5 })).status).toBe(400)
    expect((await patchSettings(admin, { depositPercent: 'si' })).status).toBe(400)
    expect((await patchSettings(admin, { depositPercent: true, depositAmount: 150 })).status).toBe(400)
    const ok = await patchSettings(admin, { depositPercent: true, depositAmount: 30, cancellationHours: 24 })
    expect(ok.status).toBe(200)
    expect(ok.body.settings).toMatchObject({ depositPercent: true, depositAmount: 30, cancellationHours: 24 })
  })

  it('no la puede cambiar una clienta ni una profesional (403) ni un visitante (401)', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()

    expect((await patchSettings(client, { refundPolicy: 'none' })).status).toBe(403)
    expect((await patchSettings(pro, { refundPolicy: 'none' })).status).toBe(403)
    expect((await request(app).patch('/api/settings/payments').send({ refundPolicy: 'none' })).status).toBe(401)
  })

  it('la migración pasa los "partial" que había a "full" (y deja "none" como estaba)', async () => {
    const dir = path.resolve(__dirname, '../../prisma/migrations/20261031131000_politica_de_devolucion_full_o_none')
    const sql = fs.readFileSync(path.join(dir, 'migration.sql'), 'utf8')
      .split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()

    await prisma.paymentSettings.deleteMany()
    await prisma.paymentSettings.create({ data: { refundPolicy: 'partial' } })
    await prisma.$executeRawUnsafe(sql)
    expect((await prisma.paymentSettings.findFirstOrThrow()).refundPolicy).toBe('full')

    await prisma.paymentSettings.updateMany({ data: { refundPolicy: 'none' } })
    await prisma.$executeRawUnsafe(sql)
    expect((await prisma.paymentSettings.findFirstOrThrow()).refundPolicy).toBe('none')
  })

  it('un "partial" viejo que siga en la base se lee como "full"', async () => {
    const admin = await createAdminUser()
    await prisma.paymentSettings.deleteMany()
    await prisma.paymentSettings.create({ data: { refundPolicy: 'partial' } })

    const res = await request(app).get('/api/settings/payments').set('Cookie', cookieFor(admin))

    expect(res.body.settings.refundPolicy).toBe('full')
  })
})

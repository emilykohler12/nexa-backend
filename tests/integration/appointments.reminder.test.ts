import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { env } from '../../src/app/config/env'
import { appointmentInstant } from '../../src/app/utils/argentinaTime'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import { runAppointmentReminderJob } from '../../src/jobs/appointmentReminder.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Reloj inyectable: el job recibe "ahora" por parámetro. Turno de referencia: 10/11/2026 a las 15:00 de
// Argentina (18:00 UTC).
const DATE  = '2026-11-10'
const TIME  = '15:00'
const START = new Date('2026-11-10T18:00:00Z')
const CREATED_LONG_BEFORE = new Date('2026-11-01T12:00:00Z')

// "Ahora" a N horas (y M minutos) antes del inicio del turno de referencia.
const before = (hours: number, minutes = 0) => new Date(START.getTime() - (hours * 60 + minutes) * 60_000)

const sendMock = () => vi.mocked(mailProvider.send)
const sentMails = () => sendMock().mock.calls.map(([to, subject, html]) => ({ to, subject, html: String(html) }))

beforeEach(() => { sendMock().mockClear() })

async function makeAppointment(overrides: Partial<{
  status: string; paymentStatus: string; depositAmount: number; createdAt: Date
  date: string; time: string; comboGroupId: string | null
}> = {}, parties?: { client?: Awaited<ReturnType<typeof createClientUser>>; pro?: Awaited<ReturnType<typeof createProfessionalUser>> }) {
  const client  = parties?.client ?? await createClientUser({ name: 'Lucía', email: `lucia.${Math.random().toString(36).slice(2, 8)}@test.local` })
  const pro     = parties?.pro ?? await createProfessionalUser({ name: 'Marta Profesional' })
  const service = await createService({ name: 'Manicura Test', price: 10000, duration: 60 })
  const appt = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: service.id,
    date: overrides.date ?? DATE, time: overrides.time ?? TIME,
    status: overrides.status ?? 'confirmed',
    paymentStatus: overrides.paymentStatus ?? 'partial',
    depositAmount: overrides.depositAmount ?? 2000,
    comboGroupId: overrides.comboGroupId ?? null,
  })
  await prisma.appointment.update({ where: { id: appt.id }, data: { createdAt: overrides.createdAt ?? CREATED_LONG_BEFORE } })
  return { client, pro, service, appt }
}

const reminderSentAt = async (id: string) =>
  (await prisma.appointment.findUniqueOrThrow({ where: { id } })).reminderSentAt

describe('recordatorio de turno por mail: cuándo se manda', () => {
  it('manda a las 5 horas exactas, marca reminder_sent_at y deja una entrada de actividad con el turno', async () => {
    const { client, appt } = await makeAppointment()
    const now = before(5)

    const result = await runAppointmentReminderJob(now)

    expect(result).toEqual({ sent: 1, failed: 0 })
    const mails = sentMails()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe(client.email)
    expect(mails[0].subject).toContain('Recordatorio')
    expect((await reminderSentAt(appt.id))?.getTime()).toBe(now.getTime())

    const logs = await prisma.activityLog.findMany({ where: { appointmentId: appt.id } })
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('Recordatorio de turno enviado')
    // La actividad no guarda el email de la clienta.
    expect(logs[0].detail).not.toContain(client.email)
  })

  it('no manda a las 5 horas y 1 minuto', async () => {
    const { appt } = await makeAppointment()

    const result = await runAppointmentReminderJob(before(5, 1))

    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(sendMock()).not.toHaveBeenCalled()
    expect(await reminderSentAt(appt.id)).toBeNull()
  })

  it('manda en cualquier corrida entre las 5 horas y 1 hora antes (la primera que lo ve)', async () => {
    const { appt } = await makeAppointment()

    expect((await runAppointmentReminderJob(before(2, 30))).sent).toBe(1)
    expect(await reminderSentAt(appt.id)).not.toBeNull()
  })

  it('no manda dos veces el mismo recordatorio', async () => {
    await makeAppointment()

    await runAppointmentReminderJob(before(5))
    const again = await runAppointmentReminderJob(before(4, 55))
    const later = await runAppointmentReminderJob(before(2))

    expect(again.sent).toBe(0)
    expect(later.sent).toBe(0)
    expect(sendMock()).toHaveBeenCalledTimes(1)
  })

  it('dos corridas simultáneas mandan un solo mail', async () => {
    await makeAppointment()

    const [a, b] = await Promise.all([runAppointmentReminderJob(before(5)), runAppointmentReminderJob(before(5))])

    expect(a.sent + b.sent).toBe(1)
    expect(sendMock()).toHaveBeenCalledTimes(1)
  })

  it('1 hora antes todavía manda; con menos de 1 hora ya no', async () => {
    const { appt: onTime } = await makeAppointment()
    expect((await runAppointmentReminderJob(before(1))).sent).toBe(1)
    expect(await reminderSentAt(onTime.id)).not.toBeNull()

    sendMock().mockClear()
    const { appt: late } = await makeAppointment()
    expect((await runAppointmentReminderJob(before(0, 59))).sent).toBe(0)
    expect(await reminderSentAt(late.id)).toBeNull()
    expect(sendMock()).not.toHaveBeenCalled()
  })

  it('no manda si el turno ya empezó', async () => {
    await makeAppointment()
    expect((await runAppointmentReminderJob(new Date(START.getTime() + 60_000))).sent).toBe(0)
  })

  it('manda un turno de madrugada cuando la ventana de 5 horas cruza la medianoche de Argentina', async () => {
    // Turno del 11/11 a las 02:00 (05:00 UTC); ahora son las 22:00 del 10/11 en Argentina (01:00 UTC del 11/11).
    await makeAppointment({ date: '2026-11-11', time: '02:00' })

    const result = await runAppointmentReminderJob(new Date('2026-11-11T01:00:00Z'))

    expect(result.sent).toBe(1)
  })

  it('manda un turno sin seña requerida aunque paymentStatus siga pendiente', async () => {
    await makeAppointment({ paymentStatus: 'pending', depositAmount: 0 })
    expect((await runAppointmentReminderJob(before(5))).sent).toBe(1)
  })

  it('manda un turno con todo pago', async () => {
    await makeAppointment({ paymentStatus: 'paid' })
    expect((await runAppointmentReminderJob(before(5))).sent).toBe(1)
  })
})

describe('recordatorio de turno por mail: casos excluidos', () => {
  it.each([
    ['pendiente de seña (seña requerida sin pagar)', { paymentStatus: 'pending', depositAmount: 2000 }],
    ['en estado pending',                              { status: 'pending' }],
    ['cancelado',                                      { status: 'cancelled' }],
    ['no asistido (automático)',                       { status: 'no_show_auto' }],
    ['no asistido',                                    { status: 'cancelled_no_show' }],
    ['finalizado',                                     { status: 'finished' }],
  ])('no manda si el turno está %s', async (_label, overrides) => {
    const { appt } = await makeAppointment(overrides)

    const result = await runAppointmentReminderJob(before(5))

    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(sendMock()).not.toHaveBeenCalled()
    expect(await reminderSentAt(appt.id)).toBeNull()
  })

  it('no manda si la reserva se creó con menos de 5 horas de anticipación', async () => {
    // Reservado 4 h 59 min antes del inicio; a las 3 horas antes el job lo ve pero no corresponde.
    const { appt } = await makeAppointment({ createdAt: before(4, 59) })

    expect((await runAppointmentReminderJob(before(3))).sent).toBe(0)
    expect(await reminderSentAt(appt.id)).toBeNull()
  })

  it('manda si la reserva se creó con exactamente 5 horas de anticipación', async () => {
    await makeAppointment({ createdAt: before(5) })
    expect((await runAppointmentReminderJob(before(5))).sent).toBe(1)
  })

  it('no manda si el correo de la clienta no está verificado', async () => {
    const client = await createClientUser()
    await prisma.user.update({ where: { id: client.id }, data: { emailVerified: false } })
    await makeAppointment({}, { client })

    expect((await runAppointmentReminderJob(before(5))).sent).toBe(0)
    expect(sendMock()).not.toHaveBeenCalled()
  })

  it('no manda si la clienta está bloqueada', async () => {
    const client = await createClientUser({ blocked: true })
    await makeAppointment({}, { client })

    expect((await runAppointmentReminderJob(before(5))).sent).toBe(0)
    expect(sendMock()).not.toHaveBeenCalled()
  })

  it('no manda si la clienta está anonimizada (cuenta desactivada con el email anonimizado)', async () => {
    const client = await createClientUser()
    await prisma.user.update({
      where: { id: client.id },
      data:  { name: 'Cliente eliminado', email: `anonimo_${client.id}@borrado.com`, active: false },
    })
    await makeAppointment({}, { client })

    expect((await runAppointmentReminderJob(before(5))).sent).toBe(0)
    expect(sendMock()).not.toHaveBeenCalled()
  })

  it('no manda si la cuenta de la clienta está desactivada', async () => {
    const client = await createClientUser({ active: false })
    await makeAppointment({}, { client })

    expect((await runAppointmentReminderJob(before(5))).sent).toBe(0)
  })
})

describe('recordatorio de turno por mail: combos', () => {
  it('manda un solo mail por grupo con todos los servicios y marca todas las patas', async () => {
    const client = await createClientUser({ name: 'Lucía' })
    const proA = await createProfessionalUser({ name: 'Ana Pro' })
    const proB = await createProfessionalUser({ name: 'Beatriz Pro' })
    const svcA = await createService({ name: 'Manicura Combo', price: 8000, duration: 60 })
    const svcB = await createService({ name: 'Pedicura Combo', price: 12000, duration: 90 })
    const groupId = '5f1d3c52-8a8e-4a4e-9a63-1d4c8d1f7e11'

    const legs = []
    for (const [pro, svc] of [[proA, svcA], [proB, svcB]] as const) {
      const leg = await createAppointmentDirect({
        clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DATE, time: TIME,
        status: 'confirmed', paymentStatus: 'partial', depositAmount: 2000, comboGroupId: groupId,
      })
      await prisma.appointment.update({ where: { id: leg.id }, data: { createdAt: CREATED_LONG_BEFORE } })
      legs.push(leg)
    }

    const result = await runAppointmentReminderJob(before(5))

    expect(result).toEqual({ sent: 1, failed: 0 })
    const [mail] = sentMails()
    expect(sentMails()).toHaveLength(1)
    expect(mail.html).toContain('Manicura Combo')
    expect(mail.html).toContain('Pedicura Combo')
    expect(mail.html).toContain('Ana Pro')
    expect(mail.html).toContain('Beatriz Pro')
    // Totales del grupo: 8.000 + 12.000, seña 2.000 + 2.000.
    expect(mail.html).toContain('$ 20.000')
    expect(mail.html).toContain('$ 4.000')
    expect(mail.html).toContain('$ 16.000')
    for (const leg of legs) expect(await reminderSentAt(leg.id)).not.toBeNull()
    expect(await prisma.activityLog.count({ where: { action: 'Recordatorio de turno enviado' } })).toBe(1)
  })

  it('con una pata cancelada, el mail lista solo la pata que sigue confirmada', async () => {
    const client = await createClientUser()
    const pro = await createProfessionalUser()
    const svcA = await createService({ name: 'Servicio Vigente', price: 5000, duration: 30 })
    const svcB = await createService({ name: 'Servicio Cancelado', price: 5000, duration: 30 })
    const groupId = '0b6c1d5e-3c1f-4c2f-8e43-6f2f5b1e9a22'
    for (const [svc, status] of [[svcA, 'confirmed'], [svcB, 'cancelled']] as const) {
      const leg = await createAppointmentDirect({
        clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: DATE, time: TIME,
        status, paymentStatus: 'partial', depositAmount: 1000, comboGroupId: groupId,
      })
      await prisma.appointment.update({ where: { id: leg.id }, data: { createdAt: CREATED_LONG_BEFORE } })
    }

    expect((await runAppointmentReminderJob(before(5))).sent).toBe(1)
    const [mail] = sentMails()
    expect(mail.html).toContain('Servicio Vigente')
    expect(mail.html).not.toContain('Servicio Cancelado')
  })
})

describe('recordatorio de turno por mail: errores y reintentos', () => {
  it('si el envío falla no marca reminder_sent_at, registra el error y no corta el job; reintenta en la corrida siguiente', async () => {
    const { appt: failing } = await makeAppointment()
    sendMock().mockRejectedValueOnce(new Error('Brevo respondió 503'))

    const first = await runAppointmentReminderJob(before(5))

    expect(first).toEqual({ sent: 0, failed: 1 })
    expect(await reminderSentAt(failing.id)).toBeNull()
    const errors = await prisma.activityLog.findMany({ where: { appointmentId: failing.id } })
    expect(errors).toHaveLength(1)
    expect(errors[0].level).toBe('warning')
    expect(errors[0].detail).toContain('Brevo respondió 503')

    const retry = await runAppointmentReminderJob(before(4, 55))

    expect(retry).toEqual({ sent: 1, failed: 0 })
    expect(await reminderSentAt(failing.id)).not.toBeNull()
  })

  it('un fallo no impide enviar los recordatorios de las demás clientas', async () => {
    const { appt: first } = await makeAppointment()
    const { appt: second } = await makeAppointment()
    sendMock().mockRejectedValueOnce(new Error('timeout'))

    const result = await runAppointmentReminderJob(before(5))

    expect(result).toEqual({ sent: 1, failed: 1 })
    const marked = [await reminderSentAt(first.id), await reminderSentAt(second.id)].filter(Boolean)
    expect(marked).toHaveLength(1)
  })

  it('reintenta hasta 1 hora antes del turno y después deja de intentar', async () => {
    const { appt } = await makeAppointment()
    sendMock().mockRejectedValue(new Error('Brevo caído'))

    try {
      expect((await runAppointmentReminderJob(before(5))).failed).toBe(1)
      expect((await runAppointmentReminderJob(before(3))).failed).toBe(1)
      expect((await runAppointmentReminderJob(before(1))).failed).toBe(1)
      const tooLate = await runAppointmentReminderJob(before(0, 55))

      expect(tooLate).toEqual({ sent: 0, failed: 0 })
      expect(sendMock()).toHaveBeenCalledTimes(3)
      expect(await reminderSentAt(appt.id)).toBeNull()
      // Con el mail caído no se llena la actividad: una sola entrada de error por turno.
      expect(await prisma.activityLog.count({ where: { appointmentId: appt.id } })).toBe(1)
    } finally {
      sendMock().mockReset()
      sendMock().mockResolvedValue(undefined)
    }
  })
})

describe('recordatorio de turno por mail: contenido', () => {
  it('incluye saludo, fecha, hora, profesional, servicio, duración, precio, seña, saldo, aviso de la seña y los tres enlaces', async () => {
    const { appt } = await makeAppointment()

    await runAppointmentReminderJob(before(5))
    const [{ html }] = sentMails()

    expect(html).not.toContain('{{')   // no quedó ningún marcador sin reemplazar
    expect(html).toContain('Hola Lucía')
    expect(html).toContain('Martes, 10 de noviembre de 2026')
    expect(html).toContain('15:00 hs')
    expect(html).toContain('Marta Profesional')
    expect(html).toContain('Manicura Test')
    expect(html).toContain('60 min')
    expect(html).toContain('$ 10.000')       // precio
    expect(html).toContain('$ 2.000')        // seña ya paga
    expect(html).toContain('$ 8.000')        // saldo
    expect(html).toContain('Si cancelás ahora (con menos de 12 horas), la seña no se devuelve')

    const base = `${env.FRONTEND_URL}/mis-turnos?turno=${appt.id}`
    expect(html).toContain(`${base}&amp;accion=ver"`)
    expect(html).toContain(`${base}&amp;accion=reprogramar"`)
    expect(html).toContain(`${base}&amp;accion=cancelar"`)
    // En el enlace solo va el id del turno: ningún dato de la clienta.
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs).toHaveLength(3)
    for (const href of hrefs) expect(href).not.toMatch(/@|token|email/i)
  })

  it('el aviso usa las horas configuradas para la cancelación', async () => {
    await prisma.paymentSettings.create({ data: { cancellationHours: 24 } })
    await makeAppointment()

    await runAppointmentReminderJob(before(5))

    expect(sentMails()[0].html).toContain('Si cancelás ahora (con menos de 24 horas), la seña no se devuelve')
  })

  it('con la devolución desactivada el aviso dice que la seña no se devuelve', async () => {
    await prisma.paymentSettings.create({ data: { refundPolicy: 'none' } })
    await makeAppointment()

    await runAppointmentReminderJob(before(5))

    expect(sentMails()[0].html).toContain('Si cancelás, la seña no se devuelve.')
  })

  it('en un turno sin seña pagada no aparece el aviso de la seña', async () => {
    await makeAppointment({ paymentStatus: 'pending', depositAmount: 0 })

    await runAppointmentReminderJob(before(5))
    const [{ html }] = sentMails()

    expect(html).not.toContain('la seña no se devuelve')
    expect(html).not.toContain('Seña ya paga')
    expect(html).toContain('Saldo a pagar en el local')
  })

  it('muestra la dirección del estudio solo si está en la configuración', async () => {
    await makeAppointment()
    await runAppointmentReminderJob(before(5))
    expect(sentMails()[0].html).not.toContain('Dirección')

    sendMock().mockClear()
    await prisma.businessSettings.create({ data: { address: 'Calle Falsa 123, Posadas' } })
    await makeAppointment()
    await runAppointmentReminderJob(before(5))
    expect(sentMails()[0].html).toContain('Dirección')
    expect(sentMails()[0].html).toContain('Calle Falsa 123, Posadas')
  })

  it('escapa los textos cargados por personas antes de ponerlos en el HTML', async () => {
    const client = await createClientUser({ name: '<script>alert(1)</script>' })
    await makeAppointment({}, { client })

    await runAppointmentReminderJob(before(5))
    const [{ html }] = sentMails()

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('recordatorio de turno por mail: reprogramación', () => {
  type Slot = { date: string; time: string }
  const hoursBefore = (slot: Slot, hours: number) => new Date(appointmentInstant(slot.date, slot.time).getTime() - hours * 3_600_000)

  // Turno a 3 días que ya recibió su recordatorio; después se lo pasa a otro día y a otra hora (10:30).
  async function remindedAppointment() {
    const first: Slot = { date: hoursFromNow(72).date, time: '16:00' }
    const moved: Slot = { date: hoursFromNow(96).date, time: '10:30' }
    const ctx = await makeAppointment({ ...first, createdAt: new Date(Date.now() - 10 * 86_400_000) })
    expect((await runAppointmentReminderJob(hoursBefore(first, 5))).sent).toBe(1)
    expect(await reminderSentAt(ctx.appt.id)).not.toBeNull()
    return { ...ctx, first, moved }
  }

  // Tras reprogramar, la marca quedó limpia y el nuevo horario recibe su propio recordatorio.
  async function expectReminderForNewSlot(id: string, moved: Slot) {
    expect(await reminderSentAt(id)).toBeNull()
    sendMock().mockClear()   // descarta el aviso de reprogramación que sale hacia la clienta

    const result = await runAppointmentReminderJob(hoursBefore(moved, 5))

    expect(result).toEqual({ sent: 1, failed: 0 })
    const mails = sentMails()
    expect(mails).toHaveLength(1)
    expect(mails[0].subject).toContain('Recordatorio')
    expect(mails[0].html).toContain('10:30 hs')
    expect(mails[0].html).not.toContain('16:00 hs')
    expect(await reminderSentAt(id)).not.toBeNull()
  }

  it('cuando la clienta reprograma un turno ya recordado, el nuevo horario recibe su recordatorio', async () => {
    const { client, pro, service, appt, moved } = await remindedAppointment()

    const res = await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: service.id, professionalId: pro.id, date: moved.date, time: moved.time })

    expect(res.status).toBe(200)
    await expectReminderForNewSlot(appt.id, moved)
  })

  it('cuando la profesional reprograma un turno ya recordado, el nuevo horario recibe su recordatorio', async () => {
    const { pro, appt, moved } = await remindedAppointment()

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ date: moved.date, time: moved.time })

    expect(res.status).toBe(200)
    await expectReminderForNewSlot(appt.id, moved)
  })

  it('cuando el administrador reprograma un turno ya recordado, el nuevo horario recibe su recordatorio', async () => {
    const { appt, moved } = await remindedAppointment()
    const admin = await createAdminUser()

    const res = await request(app)
      .patch(`/api/admin/appointments/${appt.id}`)
      .set('Cookie', cookieFor(admin))
      .send({ date: moved.date, time: moved.time })

    expect(res.status).toBe(200)
    await expectReminderForNewSlot(appt.id, moved)
  })

  it('un cambio del personal que no mueve el horario (notas internas) no limpia la marca ni reenvía el recordatorio', async () => {
    const { pro, appt, first } = await remindedAppointment()
    const marked = await reminderSentAt(appt.id)
    sendMock().mockClear()

    const res = await request(app)
      .patch(`/api/professional/appointments/${appt.id}`)
      .set('Cookie', cookieFor(pro))
      .send({ internalNotes: 'Trae su propio esmalte', date: first.date, time: first.time })

    expect(res.status).toBe(200)
    expect((await reminderSentAt(appt.id))?.getTime()).toBe(marked?.getTime())
    expect((await runAppointmentReminderJob(hoursBefore(first, 4))).sent).toBe(0)
    expect(sendMock()).not.toHaveBeenCalled()
  })

  it('el nuevo horario sigue sujeto a las reglas: si ya pasó la ventana de 5 horas no se manda hasta que entre', async () => {
    const { client, pro, service, appt, moved } = await remindedAppointment()

    await request(app)
      .patch(`/api/client/appointments/${appt.id}/reschedule`)
      .set('Cookie', cookieFor(client))
      .send({ serviceId: service.id, professionalId: pro.id, date: moved.date, time: moved.time })
    sendMock().mockClear()

    expect((await runAppointmentReminderJob(hoursBefore(moved, 6))).sent).toBe(0)
    expect((await runAppointmentReminderJob(hoursBefore(moved, 5))).sent).toBe(1)
  })
})

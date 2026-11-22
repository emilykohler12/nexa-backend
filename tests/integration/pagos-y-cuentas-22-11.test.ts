import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'crypto'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import { activityService } from '../../src/modules/activity/activity.service'
import { adminService } from '../../src/modules/admin/admin.service'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import { runReleaseUnpaidAppointmentsJob } from '../../src/jobs/releaseUnpaidAppointments.job'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// ── Cuentas sin activar ───────────────────────────────────────────────────────────────────────────────────────────
// El administrador (o un turno manual con correo) crea la ficha de la clienta SIN contraseña. Si después ella se registra
// con ese correo recibe un código para activar la cuenta, en vez de «email ya registrado», y conserva su historial.

const register = (email: string) => request(app).post('/api/auth/register').send({
  name: 'Lucía', lastName: 'Gómez', phone: '1155550000', email, password: 'Password123', termsAccepted: true,
})

describe('cuentas creadas por el personal (sin activar)', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('el administrador no elige contraseña: la cuenta nace sin activar, aunque el formulario mande una', async () => {
    const admin = await createAdminUser()
    const res = await request(app).post('/api/admin/clients').set('Cookie', cookieFor(admin))
      .send({ name: 'Lucía Gómez', email: 'lucia@test.local', password: 'LaDelAdmin123' })

    expect(res.status).toBe(201)
    expect(res.body.client.pendingActivation).toBe(true)
    const login = await request(app).post('/api/auth/login').send({ email: 'lucia@test.local', password: 'LaDelAdmin123' })
    expect(login.status).toBe(401)
  })

  it('si la clienta se registra con ese correo: no se crea otra cuenta, recibe un código y al usarlo activa la suya', async () => {
    const admin = await createAdminUser()
    await request(app).post('/api/admin/clients').set('Cookie', cookieFor(admin)).send({ name: 'Lucía Gómez', email: 'lucia@test.local' })
    const before = await prisma.user.findUniqueOrThrow({ where: { email: 'lucia@test.local' } })
    const pro = await createProfessionalUser()
    const svc = await createService()
    const appt = await createAppointmentDirect({ clientId: before.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00' })

    const res = await register('lucia@test.local')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ACCOUNT_PENDING_ACTIVATION')
    expect(await prisma.user.count({ where: { role: 'client' } })).toBe(1)
    expect(vi.mocked(mailProvider.send)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(mailProvider.send).mock.calls[0][0]).toBe('lucia@test.local')
    expect(vi.mocked(mailProvider.send).mock.calls[0][1]).toBe('Activá tu cuenta — Nexa')

    const { token } = await prisma.passwordReset.findFirstOrThrow({ where: { userId: before.id, used: false } })
    const activate = await request(app).post('/api/auth/reset-password').send({ email: 'lucia@test.local', token, password: 'MiClave12345' })
    expect(activate.status).toBe(200)

    const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.pendingActivation).toBe(false)
    const login = await request(app).post('/api/auth/login').send({ email: 'lucia@test.local', password: 'MiClave12345' })
    expect(login.status).toBe(200)
    // conserva su historial
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).clientId).toBe(before.id)
    // y ahora que ya la activó, registrarse con ese correo es «email ya registrado»
    const again = await register('lucia@test.local')
    expect(again.body.code).toBe('EMAIL_TAKEN')
  })

  it('una cuenta que se registró sola NUNCA pide activación: el registro con su correo sigue dando EMAIL_TAKEN y no manda mail', async () => {
    expect((await register('sola@test.local')).status).toBe(201)
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'sola@test.local' } })).pendingActivation).toBe(false)
    vi.mocked(mailProvider.send).mockClear()

    const res = await register('sola@test.local')

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('EMAIL_TAKEN')
    expect(vi.mocked(mailProvider.send)).not.toHaveBeenCalled()
  })

  it('un turno manual con correo deja la cuenta sin activar; sin correo no (no hay nada que activar)', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const body  = { professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), clientPhone: '1155550000' }
    await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin))
      .send({ ...body, time: '10:00', clientName: 'Con Correo', clientEmail: 'concorreo@test.local' })
    await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin))
      .send({ ...body, time: '12:00', clientName: 'Sin Correo', clientEmail: '' })

    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'concorreo@test.local' } })).pendingActivation).toBe(true)
    const sin = await prisma.user.findFirstOrThrow({ where: { email: { startsWith: 'walkin-' } } })
    expect(sin.pendingActivation).toBe(false)
  })
})

// ── Pagos de Mercado Pago ─────────────────────────────────────────────────────────────────────────────────────────

const ARS = 'ARS'
const logs = (action: string) => prisma.activityLog.findMany({ where: { action } })
const adminMails = () => vi.mocked(mailProvider.send).mock.calls.filter(c => c[1] === 'Hay un pago para devolver — Nexa')

async function staleAppointment(opts: { deposit?: number; createdMinutesAgo?: number } = {}) {
  const client = await createClientUser({ name: 'Ana' } as never)
  await prisma.user.update({ where: { id: client.id }, data: { lastName: 'Pérez' } })
  const pro    = await createProfessionalUser()
  const svc    = await createService({ price: 20000 })
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id,
    date: tomorrowStr(5), time: '10:00', depositAmount: opts.deposit ?? 5000,
  })
  if (opts.createdMinutesAgo) {
    await prisma.appointment.update({ where: { id: appt.id }, data: { createdAt: new Date(Date.now() - opts.createdMinutesAgo * 60_000) } })
  }
  return { client, pro, appt }
}

const clientView = async (client: { id: string }, id: string) => {
  const res = await request(app).get('/api/client/appointments').set('Cookie', cookieFor(client as never))
  return (res.body.appointments as { id: string; paymentNote: string | null; displayStatus: string; status: string }[]).find(a => a.id === id)!
}

describe('pago de menos o en otra moneda', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('no reserva nada, guarda el motivo, avisa en Actividad y por mail, y queda en «Pagos para devolver»', async () => {
    const { client, appt } = await staleAppointment({ createdMinutesAgo: 25 })

    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.paymentStatus).toBe('pending')
    expect(row.paymentNote).toBe('Pago rechazado: monto menor a la seña')
    const rec = await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-1' } })
    expect(rec).toMatchObject({ outcome: 'underpaid', needsRefund: true, kind: 'appointment', refId: appt.id })
    expect(Number(rec.paidAmount)).toBe(1000)
    expect(Number(rec.expectedAmount)).toBe(5000)
    expect(await logs('Pago con monto distinto al esperado')).toHaveLength(1)
    expect(adminMails()).toHaveLength(1)

    // A los 20 minutos se libera y la clienta ve el motivo, en una frase corta.
    await runReleaseUnpaidAppointmentsJob()
    const view = await clientView(client, appt.id)
    expect(view.status).toBe('cancelled')
    expect(view.paymentNote).toBe('Pago rechazado: monto menor a la seña')
  })

  it('en otra moneda: motivo «moneda distinta a pesos»', async () => {
    const { appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-2', 'approved', { amount: 5000, currency: 'USD' })

    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).paymentNote).toBe('Pago rechazado: moneda distinta a pesos')
    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-2' } }))).toMatchObject({ outcome: 'wrong_currency', needsRefund: true })
    expect(adminMails()).toHaveLength(1)
  })

  it('el mismo aviso repetido (Mercado Pago reintenta) no duplica el registro, la entrada ni el mail', async () => {
    const { appt } = await staleAppointment()
    for (let i = 0; i < 3; i++) await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })

    expect(await prisma.paymentRecord.count()).toBe(1)
    expect(await logs('Pago con monto distinto al esperado')).toHaveLength(1)
    expect(adminMails()).toHaveLength(1)
  })

  it('aparece en el tablero con el motivo y el administrador lo marca como devuelto', async () => {
    const admin = await createAdminUser()
    const { appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-1', 'approved', { amount: 1000, currency: ARS })

    const dash = async () => (await request(app).get('/api/admin/dashboard').query({ period: 'month' }).set('Cookie', cookieFor(admin))).body.dashboard
    const { paymentsToRefund } = await dash()
    expect(paymentsToRefund).toHaveLength(1)
    expect(paymentsToRefund[0]).toMatchObject({ outcome: 'underpaid', reason: 'Monto menor a la seña', paidAmount: 1000, expectedAmount: 5000, appointmentId: appt.id })
    expect(paymentsToRefund[0].clientName).toContain('Ana')

    const done = await request(app).patch(`/api/admin/payments/${paymentsToRefund[0].id}/refund-done`).set('Cookie', cookieFor(admin))
    expect(done.status).toBe(200)
    expect((await dash()).paymentsToRefund).toEqual([])
    expect(await logs('Pago devuelto en Mercado Pago')).toHaveLength(1)
    // marcarlo de nuevo no cambia nada ni duplica la entrada
    expect((await request(app).patch(`/api/admin/payments/${paymentsToRefund[0].id}/refund-done`).set('Cookie', cookieFor(admin))).status).toBe(200)
    expect(await logs('Pago devuelto en Mercado Pago')).toHaveLength(1)
  })

  it('solo el administrador puede marcar un pago como devuelto', async () => {
    const pro = await createProfessionalUser()
    const res = await request(app).patch(`/api/admin/payments/${randomUUID()}/refund-done`).set('Cookie', cookieFor(pro))
    expect(res.status).toBe(403)
  })
})

describe('pago rechazado (tarjeta, fondos…)', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('la clienta sigue viendo «esperando pago»; guarda el motivo y avisa en Actividad pero NO por mail', async () => {
    const { client, appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-3', 'rejected', { amount: 5000, currency: ARS, statusDetail: 'cc_rejected_insufficient_amount' })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.paymentStatus).toBe('rejected')
    expect(row.paymentNote).toBe('Pago rechazado: fondos insuficientes')
    const view = await clientView(client, appt.id)
    expect(view.displayStatus).toBe('pending_deposit')
    expect(view.paymentNote).toBeNull() // el motivo se muestra recién cuando el turno se libera
    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-3' } }))).toMatchObject({ outcome: 'rejected', needsRefund: false })
    expect(await logs('Pago rechazado')).toHaveLength(1)
    expect(adminMails()).toHaveLength(0)
  })

  it('después de los 20 minutos el detalle dice por qué; si nunca intentó pagar, «No se pagó la seña a tiempo»', async () => {
    const a = await staleAppointment({ createdMinutesAgo: 25 })
    await appointmentService.applyPaymentResult(a.appt.id, 'mp-3', 'rejected', { amount: 5000, currency: ARS, statusDetail: 'cc_rejected_insufficient_amount' })
    const b = await staleAppointment({ createdMinutesAgo: 25 })

    await runReleaseUnpaidAppointmentsJob()

    expect((await clientView(a.client, a.appt.id)).paymentNote).toBe('Pago rechazado: fondos insuficientes')
    expect((await clientView(b.client, b.appt.id)).paymentNote).toBe('No se pagó la seña a tiempo')
  })

  it('si después paga bien, se limpia el motivo y queda confirmada', async () => {
    const { appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-3', 'rejected', { amount: 5000, currency: ARS, statusDetail: 'cc_rejected_other_reason' })
    await appointmentService.applyPaymentResult(appt.id, 'mp-4', 'approved', { amount: 5000, currency: ARS })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.paymentStatus).toBe('partial')
    expect(row.paymentNote).toBeNull()
  })
})

describe('pago de más', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('se acepta, la seña y el saldo siguen igual, se guarda lo cobrado y se avisa en Actividad (sin mail)', async () => {
    const admin = await createAdminUser()
    const { appt } = await staleAppointment({ deposit: 5000 })

    await appointmentService.applyPaymentResult(appt.id, 'mp-5', 'approved', { amount: 8000, currency: ARS })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.paymentStatus).toBe('partial')
    expect(Number(row.depositAmount)).toBe(5000)
    expect(Number(row.depositPaidAmount)).toBe(8000)
    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-5' } }))).toMatchObject({ outcome: 'overpaid', needsRefund: false })
    const [log] = await logs('Seña pagada de más')
    expect(log.detail).toContain('$8.000')
    expect(adminMails()).toHaveLength(0)

    const list = await request(app).get('/api/admin/appointments').set('Cookie', cookieFor(admin))
    const view = (list.body.appointments as { id: string; depositAmount: number; depositPaidAmount: number | null }[]).find(a => a.id === appt.id)!
    expect(view.depositAmount).toBe(5000)
    expect(view.depositPaidAmount).toBe(8000)
  })

  it('con la seña exacta NO guarda nada extra ni avisa', async () => {
    const { appt } = await staleAppointment({ deposit: 5000 })
    await appointmentService.applyPaymentResult(appt.id, 'mp-6', 'approved', { amount: 5000, currency: ARS })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.depositPaidAmount).toBeNull()
    expect(await logs('Seña pagada de más')).toHaveLength(0)
    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-6' } })).outcome).toBe('accepted')
  })

  it('en un combo el monto cobrado queda en la pata que lleva la seña', async () => {
    const client = await createClientUser()
    const proA = await createProfessionalUser()
    const proB = await createProfessionalUser()
    const svc  = await createService({ price: 20000 })
    const groupId = randomUUID()
    const base = { clientId: client.id, serviceId: svc.id, date: tomorrowStr(), time: '11:00', comboGroupId: groupId }
    const first  = await createAppointmentDirect({ ...base, professionalId: proA.id, depositAmount: 6000 })
    const second = await createAppointmentDirect({ ...base, professionalId: proB.id, depositAmount: 0 })

    await appointmentService.applyGroupPaymentResult(groupId, 'mp-7', 'approved', { amount: 9000, currency: ARS })

    expect(Number((await prisma.appointment.findUniqueOrThrow({ where: { id: first.id } })).depositPaidAmount)).toBe(9000)
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: second.id } })).depositPaidAmount).toBeNull()
  })
})

describe('pago que llega después de liberarse el turno', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('el turno NO se reactiva ni se marca pagado; queda para devolver, con aviso en Actividad y por mail (una sola vez)', async () => {
    const { appt } = await staleAppointment({ createdMinutesAgo: 25 })
    await runReleaseUnpaidAppointmentsJob()
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('cancelled')

    for (let i = 0; i < 2; i++) await appointmentService.applyPaymentResult(appt.id, 'mp-8', 'approved', { amount: 5000, currency: ARS })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(row.status).toBe('cancelled')
    expect(row.paymentStatus).toBe('pending')
    expect(await prisma.paymentRecord.findMany()).toHaveLength(1)
    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-8' } }))).toMatchObject({ outcome: 'late', needsRefund: true })
    expect(await logs('Pago recibido después de liberarse el turno')).toHaveLength(1)
    expect(adminMails()).toHaveLength(1)
  })

  it('un combo liberado también registra el pago tarde (antes solo salía un aviso en la consola del servidor)', async () => {
    const client = await createClientUser()
    const pro = await createProfessionalUser()
    const svc = await createService({ price: 20000 })
    const groupId = randomUUID()
    await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '11:00',
      depositAmount: 6000, comboGroupId: groupId, status: 'cancelled' })

    await appointmentService.applyGroupPaymentResult(groupId, 'mp-9', 'approved', { amount: 6000, currency: ARS })

    expect((await prisma.paymentRecord.findUniqueOrThrow({ where: { mpPaymentId: 'mp-9' } }))).toMatchObject({ outcome: 'late', kind: 'combo', needsRefund: true })
    expect(adminMails()).toHaveLength(1)
  })

  it('repetir el aviso de un pago YA aplicado a un turno cancelado después NO lo toma como tarde', async () => {
    const { client, appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-10', 'approved', { amount: 5000, currency: ARS })
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled', paymentStatus: 'refunded' } })

    await appointmentService.applyPaymentResult(appt.id, 'mp-10', 'approved', { amount: 5000, currency: ARS })

    expect(await prisma.paymentRecord.count({ where: { needsRefund: true } })).toBe(0)
    expect(client.id).toBeTruthy()
  })
})

// ── Actividad con el id de la clienta en vez del nombre ───────────────────────────────────────────────────────────

describe('Actividad: el nombre de la clienta se resuelve al mostrar', () => {
  async function paid() {
    const { client, appt } = await staleAppointment()
    await appointmentService.applyPaymentResult(appt.id, 'mp-11', 'approved', { amount: 5000, currency: ARS })
    return { client, appt }
  }

  it('lo guardado lleva una marca con el id; al listar, el administrador ve el nombre de siempre', async () => {
    const { client } = await paid()

    const raw = await prisma.activityLog.findFirstOrThrow({ where: { action: 'Pago de seña recibido' } })
    const rawNew = await prisma.activityLog.findMany({ where: { detail: { contains: 'Ana Pérez' } } })
    expect(rawNew).toHaveLength(0)
    expect(raw).toBeTruthy()

    await activityService.log({ action: 'Prueba', module: 'appointments', clientId: client.id, detail: 'Turno liberado — Ana Pérez con Loren el 25/11/2026 14:00' })
    const stored = await prisma.activityLog.findFirstOrThrow({ where: { action: 'Prueba' } })
    expect(stored.detail).toBe(`Turno liberado — {{c:${client.id}}} con Loren el 25/11/2026 14:00`)
    const listed = (await activityService.getAll()).find(l => l.action === 'Prueba')!
    expect(listed.detail).toBe('Turno liberado — Ana Pérez con Loren el 25/11/2026 14:00')
  })

  it('si la clienta se anonimiza, las entradas nuevas pasan solas a «Cliente eliminado»', async () => {
    const { client } = await paid()
    await activityService.log({ action: 'Prueba', module: 'appointments', clientId: client.id, detail: 'Turno liberado — Ana Pérez con Loren el 25/11/2026 14:00' })

    await adminService.anonymizeClient(client.id, 'Admin')

    const listed = (await activityService.getAll()).find(l => l.action === 'Prueba')!
    expect(listed.detail).toBe('Turno liberado — Cliente eliminado con Loren el 25/11/2026 14:00')
  })

  it('las entradas VIEJAS (con el nombre escrito) ligadas a sus turnos también se limpian, solo en palabras completas', async () => {
    const { client, appt } = await paid()
    await prisma.activityLog.create({
      data: { userName: 'Ana Pérez', action: 'Vieja', module: 'appointments', appointmentId: appt.id,
              detail: 'Manicura — Ana Pérez con Loren; Ana Pérezosa no es ella' },
    })
    await prisma.activityLog.create({ data: { userName: 'Sistema', action: 'De otra', module: 'appointments', detail: 'Ana Pérez (otra clienta, sin turno ligado)' } })

    await adminService.anonymizeClient(client.id, 'Admin')

    const vieja = await prisma.activityLog.findFirstOrThrow({ where: { action: 'Vieja' } })
    expect(vieja.userName).toBe('Cliente eliminado')
    expect(vieja.detail).toBe('Manicura — Cliente eliminado con Loren; Ana Pérezosa no es ella')
    // lo que no está ligado a la clienta no se toca
    expect((await prisma.activityLog.findFirstOrThrow({ where: { action: 'De otra' } })).detail).toContain('Ana Pérez')
  })
})

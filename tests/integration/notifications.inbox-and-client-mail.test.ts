import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-24: bandejas de avisos de la profesional y de la clienta (lectura y marcado como leída), y los mails que
// recibe la clienta. Regla (decisión de Emily del 01/11/2026): el sistema le escribe a la clienta por un turno solo
// cuando el PERSONAL lo cancela o lo reprograma. Excepciones explícitas, fuera de esta regla: el recordatorio del
// turno (jobs/appointmentReminder.job.ts, ver appointments.reminder.test.ts) y los mails de cuenta que pide la
// propia clienta (verificación del correo y código para recuperar la contraseña).

type U = { id: string; email: string; role: string }

beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

const mailsTo = (email: string) => vi.mocked(mailProvider.send).mock.calls.filter(([to]) => to === email)

describe('RF-24: bandeja de avisos de la profesional', () => {
  it('lee sus avisos (los más nuevos primero), marca uno y marca todos como leídos', async () => {
    const pro = await createProfessionalUser()
    const older = await prisma.professionalNotification.create({
      data: { professionalId: pro.id, type: 'new_appointment', title: 'Nuevo turno', body: 'Turno 1', createdAt: new Date(Date.now() - 60_000) },
    })
    const newer = await prisma.professionalNotification.create({
      data: { professionalId: pro.id, type: 'cancelled_appointment', title: 'Turno cancelado', body: 'Turno 2' },
    })

    const list = await request(app).get('/api/professional/notifications').set('Cookie', cookieFor(pro))
    expect(list.status).toBe(200)
    expect(list.body.notifications.map((n: { id: string }) => n.id)).toEqual([newer.id, older.id])
    expect(list.body.notifications.every((n: { read: boolean }) => !n.read)).toBe(true)

    expect((await request(app).patch(`/api/professional/notifications/${older.id}/read`).set('Cookie', cookieFor(pro))).status).toBe(200)
    expect((await prisma.professionalNotification.findUniqueOrThrow({ where: { id: older.id } })).read).toBe(true)
    expect((await prisma.professionalNotification.findUniqueOrThrow({ where: { id: newer.id } })).read).toBe(false)

    expect((await request(app).patch('/api/professional/notifications/read-all').set('Cookie', cookieFor(pro))).status).toBe(200)
    expect(await prisma.professionalNotification.count({ where: { read: false } })).toBe(0)
  })

  it('no ve ni marca los avisos de otra profesional', async () => {
    const pro   = await createProfessionalUser()
    const other = await createProfessionalUser()
    const notif = await prisma.professionalNotification.create({
      data: { professionalId: other.id, type: 'new_appointment', title: 'Nuevo turno', body: 'Ajeno' },
    })

    const list = await request(app).get('/api/professional/notifications').set('Cookie', cookieFor(pro))
    const mark = await request(app).patch(`/api/professional/notifications/${notif.id}/read`).set('Cookie', cookieFor(pro))
    await request(app).patch('/api/professional/notifications/read-all').set('Cookie', cookieFor(pro))

    expect(list.body.notifications).toEqual([])
    expect(mark.status).toBe(404)
    expect((await prisma.professionalNotification.findUniqueOrThrow({ where: { id: notif.id } })).read).toBe(false)
  })

  it('recibe el aviso cuando la clienta cancela su turno', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2027-03-02', time: '10:00' })

    await request(app).patch(`/api/client/appointments/${appt.id}/cancel`).set('Cookie', cookieFor(client)).send({})

    const list = await request(app).get('/api/professional/notifications').set('Cookie', cookieFor(pro))
    expect(list.body.notifications).toHaveLength(1)
    expect(list.body.notifications[0]).toMatchObject({ type: 'cancelled_appointment', read: false })
  })

  it('la bandeja es solo de la profesional', async () => {
    const client = await createClientUser()
    expect((await request(app).get('/api/professional/notifications').set('Cookie', cookieFor(client))).status).toBe(403)
    expect((await request(app).get('/api/professional/notifications')).status).toBe(401)
  })
})

describe('RF-24: bandeja de avisos de la clienta', () => {
  it('una promoción nueva le llega como aviso; lo lee y lo marca como leído', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const product = await prisma.product.create({ data: { name: 'Sérum de prueba', price: 4000, stock: 3 } })

    await request(app).post('/api/admin/promotions').set('Cookie', cookieFor(admin)).send({
      type: 'product', kind: 'discount', title: 'Sérum en oferta', price: 3000, status: 'active',
      items: [{ id: product.id, name: product.name, price: 4000 }],
    })
    // El aviso masivo no bloquea la respuesta del administrador (fire-and-forget).
    await vi.waitFor(async () => expect(await prisma.clientNotification.count()).toBe(1))

    const list = await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))
    expect(list.status).toBe(200)
    expect(list.body.notifications).toHaveLength(1)
    expect(list.body.notifications[0]).toMatchObject({ type: 'new_promotion', read: false })

    const id = list.body.notifications[0].id
    expect((await request(app).patch(`/api/client/notifications/${id}/read`).set('Cookie', cookieFor(client))).status).toBe(200)
    expect((await prisma.clientNotification.findUniqueOrThrow({ where: { id } })).read).toBe(true)
  })

  it('marca todos como leídos y no toca los de otra clienta', async () => {
    const client = await createClientUser()
    const other  = await createClientUser()
    await prisma.clientNotification.createMany({
      data: [
        { clientId: client.id, type: 'new_service', title: 'Nuevo servicio', body: 'A' },
        { clientId: client.id, type: 'new_product', title: 'Nuevo producto', body: 'B' },
        { clientId: other.id, type: 'new_product', title: 'Nuevo producto', body: 'C' },
      ],
    })
    const ajeno = await prisma.clientNotification.findFirstOrThrow({ where: { clientId: other.id } })

    await request(app).patch('/api/client/notifications/read-all').set('Cookie', cookieFor(client))
    const mark = await request(app).patch(`/api/client/notifications/${ajeno.id}/read`).set('Cookie', cookieFor(client))

    expect(await prisma.clientNotification.count({ where: { clientId: client.id, read: false } })).toBe(0)
    expect(mark.status).toBe(404)
    expect((await prisma.clientNotification.findUniqueOrThrow({ where: { id: ajeno.id } })).read).toBe(false)
    expect((await request(app).get('/api/client/notifications').set('Cookie', cookieFor(client))).body.notifications).toHaveLength(2)
  })
})

describe('RF-24: mails a la clienta por un turno', () => {
  async function scenario() {
    const client = await createClientUser({ email: `clienta.${randomUUID().slice(0, 8)}@test.local` })
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2027-03-02', time: '10:00', depositAmount: 2000,
    })
    return { client, pro, svc, appt }
  }

  it('reservar, pagar la seña, cancelar o reprogramar ella misma: ningún mail a la clienta', async () => {
    const { client, pro, svc, appt } = await scenario()

    const booked = await request(app).post('/api/client/appointments').set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: '2027-03-03', time: '11:00', termsAccepted: true })
    expect(booked.status).toBe(201)
    await appointmentService.applyPaymentResult(appt.id, 'mp-test-1', 'approved', { amount: 2000, currency: 'ARS' })
    const rescheduled = await request(app).patch(`/api/client/appointments/${appt.id}/reschedule`).set('Cookie', cookieFor(client))
      .send({ serviceId: svc.id, professionalId: pro.id, date: '2027-03-04', time: '12:00' })
    expect(rescheduled.status).toBe(200)
    const cancelled = await request(app).patch(`/api/client/appointments/${booked.body.appointment.id}/cancel`).set('Cookie', cookieFor(client)).send({})
    expect(cancelled.status).toBe(200)

    expect(mailsTo(client.email)).toEqual([])
    // A la profesional sí le llegan (nuevo turno pagado y reprogramación).
    expect(mailsTo(pro.email).length).toBeGreaterThan(0)
  })

  it('cuando el personal cancela, la clienta recibe el mail', async () => {
    const { client, pro, appt } = await scenario()

    const res = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro))
      .send({ status: 'cancelled', cancelledBy: 'studio' })

    expect(res.status).toBe(200)
    expect(mailsTo(client.email).map(([, subject]) => subject)).toEqual(['Tu turno fue cancelado — Nexa'])
  })

  it('cuando el personal reprograma, la clienta recibe el mail; si el cambio no mueve fecha ni hora, no', async () => {
    const { client, pro, appt } = await scenario()
    const admin = await createAdminUser()

    const notes = await request(app).patch(`/api/professional/appointments/${appt.id}`).set('Cookie', cookieFor(pro))
      .send({ internalNotes: 'Traer fotos de referencia' })
    expect(notes.status).toBe(200)
    expect(mailsTo(client.email)).toEqual([])

    const moved = await request(app).patch(`/api/admin/appointments/${appt.id}`).set('Cookie', cookieFor(admin))
      .send({ date: '2027-03-05', time: '15:00' })
    expect(moved.status).toBe(200)
    expect(mailsTo(client.email).map(([, subject]) => subject)).toEqual(['Tu turno fue reprogramado — Nexa'])
  })

  it('en el código, los únicos envíos de mail son los permitidos (personal, recordatorio, cuenta e invitación)', () => {
    const root = path.resolve(__dirname, '../../src')
    const sends: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { if (entry.name !== 'generated') walk(full); continue }
        if (!entry.name.endsWith('.ts')) continue
        const lines = fs.readFileSync(full, 'utf8').split('\n')
        lines.forEach((line, i) => {
          if (line.includes('mailProvider.send(')) {
            const subject = lines.slice(i, i + 3).join(' ').match(/'([^']*— Nexa)'/)?.[1] ?? '(sin asunto literal)'
            sends.push(`${path.relative(root, full).replace(/\\/g, '/')}: ${subject}`)
          }
        })
      }
    }
    walk(root)

    expect(sends.sort()).toEqual([
      'jobs/appointmentReminder.job.ts: (sin asunto literal)',            // recordatorio del turno (excepción)
      'modules/appointments/appointment.service.ts: Nuevo turno agendado — Nexa',   // a la profesional
      'modules/appointments/appointment.service.ts: Tu turno fue cancelado — Nexa', // a la clienta, solo con emailClient (personal)
      'modules/appointments/appointment.service.ts: Tu turno fue reprogramado — Nexa', // a la clienta, reprogramación del personal
      'modules/appointments/appointment.service.ts: Turno reprogramado — Nexa',     // a la profesional
      'modules/auth/auth.service.ts: Código para recuperar tu contraseña — Nexa',   // de cuenta, lo pide la clienta (excepción)
      'modules/auth/auth.service.ts: Verificá tu email — Nexa',                     // de cuenta, lo pide la clienta (excepción)
      'modules/invitations/invitation.service.ts: Invitación para unirte como profesional — Nexa', // a una profesional
    ].sort())
  })
})

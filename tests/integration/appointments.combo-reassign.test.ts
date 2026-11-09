import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, linkProfessionalService,
  createAppointmentDirect, setAvailability, tomorrowStr,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Cambio de profesional en un servicio de un combo: administrador (cualquier pata) y profesional (solo las suyas).
async function makeCombo() {
  const client = await createClientUser()
  const pro1   = await createProfessionalUser({ name: 'Pro Uno', email: 'pro1@test.local' })
  const pro2   = await createProfessionalUser({ name: 'Pro Dos', email: 'pro2@test.local' })
  const pro3   = await createProfessionalUser({ name: 'Pro Tres', email: 'pro3@test.local' })
  const svc1   = await createService({ name: 'Manicura' })
  const svc2   = await createService({ name: 'Pedicura' })
  for (const p of [pro1, pro2, pro3]) { await linkProfessionalService(p.id, svc1.id); await linkProfessionalService(p.id, svc2.id) }
  const date    = tomorrowStr()
  const groupId = randomUUID()
  // La seña única vive en la primera pata.
  const leg1 = await createAppointmentDirect({
    clientId: client.id, professionalId: pro1.id, serviceId: svc1.id, date, time: '10:00',
    depositAmount: 5000, paymentStatus: 'partial', servicePrice: 8000, comboGroupId: groupId,
  })
  const leg2 = await createAppointmentDirect({
    clientId: client.id, professionalId: pro2.id, serviceId: svc2.id, date, time: '10:00',
    depositAmount: 0, paymentStatus: 'pending', servicePrice: 7000, comboGroupId: groupId,
  })
  return { client, pro1, pro2, pro3, svc1, svc2, leg1, leg2, groupId, date }
}

const adminPatch = (admin: { id: string; email: string; role: string }, id: string, body: object) =>
  request(app).patch(`/api/admin/appointments/${id}`).set('Cookie', cookieFor(admin)).send(body)
const proPatch = (pro: { id: string; email: string; role: string }, id: string, body: object) =>
  request(app).patch(`/api/professional/appointments/${id}`).set('Cookie', cookieFor(pro)).send(body)

describe('cambio de profesional en un combo', () => {
  it('el administrador cambia la profesional de una pata: mismo comboGroupId, precio y seña intactos, con avisos', async () => {
    vi.mocked(mailProvider.send).mockClear()
    const { pro1, pro2, pro3, leg1, leg2, groupId } = await makeCombo()
    const admin = await createAdminUser()

    const res = await adminPatch(admin, leg2.id, { professionalId: pro3.id })

    expect(res.status).toBe(200)
    expect(res.body.appointment.professionalId).toBe(pro3.id)
    const legs = await prisma.appointment.findMany({ where: { comboGroupId: groupId }, orderBy: { servicePrice: 'desc' } })
    expect(legs).toHaveLength(2)
    expect(legs.find(l => l.id === leg2.id)?.professionalId).toBe(pro3.id)
    expect(Number(legs.find(l => l.id === leg2.id)?.servicePrice)).toBe(7000)
    // Seña única: sigue entera en la primera pata y la segunda en 0.
    expect(Number(legs.find(l => l.id === leg1.id)?.depositAmount)).toBe(5000)
    expect(Number(legs.find(l => l.id === leg2.id)?.depositAmount)).toBe(0)
    expect(legs.find(l => l.id === leg1.id)?.professionalId).toBe(pro1.id)

    // Avisos: la que sale, la que entra (aviso + mail) y Actividad.
    const out = await prisma.professionalNotification.findMany({ where: { professionalId: pro2.id } })
    expect(out.map(n => n.title)).toContain('Turno reasignado')
    const inn = await prisma.professionalNotification.findMany({ where: { professionalId: pro3.id } })
    expect(inn).toHaveLength(1)
    expect(inn[0].type).toBe('new_appointment')
    expect(vi.mocked(mailProvider.send).mock.calls.filter(([to]) => to === 'pro3@test.local')).toHaveLength(1)
    const log = await prisma.activityLog.findFirst({ where: { action: 'Profesional cambiada en un combo' } })
    expect(log?.appointmentId).toBe(leg2.id)
  })

  it('la profesional de la pata la pasa a otra; no puede tocar la de otra profesional', async () => {
    const { pro1, pro2, pro3, leg1, leg2 } = await makeCombo()

    const ok = await proPatch(pro2, leg2.id, { professionalId: pro3.id })
    expect(ok.status).toBe(200)
    expect((await prisma.appointment.findUnique({ where: { id: leg2.id } }))?.professionalId).toBe(pro3.id)

    // pro1 no es dueña de la pata 2 (ahora de pro3): 404 y nada cambia.
    const denied = await proPatch(pro1, leg2.id, { professionalId: pro1.id })
    expect(denied.status).toBe(404)
    expect((await prisma.appointment.findUnique({ where: { id: leg1.id } }))?.professionalId).toBe(pro1.id)
    expect((await prisma.appointment.findUnique({ where: { id: leg2.id } }))?.professionalId).toBe(pro3.id)
  })

  it('en un turno que no es de combo la profesional no puede cambiar de profesional', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const other  = await createProfessionalUser()
    const svc    = await createService()
    await linkProfessionalService(other.id, svc.id)
    const appt = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00' })

    const res = await proPatch(pro, appt.id, { professionalId: other.id })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NOT_A_COMBO')
    expect((await prisma.appointment.findUnique({ where: { id: appt.id } }))?.professionalId).toBe(pro.id)
  })

  it('rechaza a una profesional que no hace el servicio, está inactiva o está fuera de su franja', async () => {
    const { pro1, leg2, svc2 } = await makeCombo()
    const admin = await createAdminUser()

    const noService = await createProfessionalUser()
    const r1 = await adminPatch(admin, leg2.id, { professionalId: noService.id })
    expect(r1.status).toBe(400)
    expect(r1.body.code).toBe('PROFESSIONAL_NOT_ALLOWED')

    const inactive = await createProfessionalUser({ active: false })
    await linkProfessionalService(inactive.id, svc2.id)
    const r2 = await adminPatch(admin, leg2.id, { professionalId: inactive.id })
    expect(r2.status).toBe(400)
    expect(r2.body.code).toBe('PROFESSIONAL_NOT_FOUND')

    const noHours = await createProfessionalUser()
    await linkProfessionalService(noHours.id, svc2.id)
    await setAvailability(noHours.id, [])
    const r3 = await adminPatch(admin, leg2.id, { professionalId: noHours.id })
    expect(r3.status).toBe(400)
    expect(r3.body.code).toBe('OUT_OF_HOURS')

    expect((await prisma.appointment.findUnique({ where: { id: leg2.id } }))?.professionalId).not.toBe(pro1.id)
  })

  it('en un simultáneo no se puede repetir profesional (409) y el índice de no superposición sigue protegiendo', async () => {
    const { pro1, pro2, leg2, svc2, date, client } = await makeCombo()
    const admin = await createAdminUser()

    // pro1 ya tiene la pata 1 a esa hora en el mismo combo.
    const same = await adminPatch(admin, leg2.id, { professionalId: pro1.id })
    expect(same.status).toBe(409)
    expect(same.body.code).toBe('SAME_PROFESSIONAL_SIMULTANEOUS')

    // pro3 está ocupada a esa hora con OTRO turno: lo frena el índice único parcial.
    const busy = await createProfessionalUser()
    await linkProfessionalService(busy.id, svc2.id)
    await createAppointmentDirect({ clientId: client.id, professionalId: busy.id, serviceId: svc2.id, date, time: '10:00' })
    const taken = await adminPatch(admin, leg2.id, { professionalId: busy.id })
    expect(taken.status).toBe(409)
    expect(taken.body.code).toBe('PROFESSIONAL_SLOT_TAKEN')
    expect((await prisma.appointment.findUnique({ where: { id: leg2.id } }))?.professionalId).toBe(pro2.id)
  })

  it('una profesional que ya tiene otra pata del combo no recibe un segundo aviso ni un segundo mail', async () => {
    vi.mocked(mailProvider.send).mockClear()
    const { client, pro1, pro2, svc2, groupId, date } = await makeCombo()
    // Tercera pata de pro1, a otra hora (combo no simultáneo).
    await createAppointmentDirect({ clientId: client.id, professionalId: pro1.id, serviceId: svc2.id, date, time: '12:00', comboGroupId: groupId })
    const admin = await createAdminUser()
    const leg2 = await prisma.appointment.findFirstOrThrow({ where: { comboGroupId: groupId, professionalId: pro2.id } })
    // Mover la pata de pro2 a las 14:00 y pasarla a pro1 (que ya tiene dos patas del grupo).
    const res = await adminPatch(admin, leg2.id, { professionalId: pro1.id, time: '14:00' })
    expect(res.status).toBe(200)

    const toPro1 = await prisma.professionalNotification.findMany({ where: { professionalId: pro1.id, type: 'new_appointment' } })
    expect(toPro1).toHaveLength(0)
    expect(vi.mocked(mailProvider.send).mock.calls.filter(([to]) => to === 'pro1@test.local')).toHaveLength(0)
  })

  it('el administrador sigue pudiendo reasignar un turno suelto como siempre', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const other  = await createProfessionalUser()
    const svc    = await createService()
    const admin  = await createAdminUser()
    const appt = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: tomorrowStr(), time: '10:00' })

    const res = await adminPatch(admin, appt.id, { professionalId: other.id })
    expect(res.status).toBe(200)
    expect((await prisma.appointment.findUnique({ where: { id: appt.id } }))?.professionalId).toBe(other.id)
  })
})

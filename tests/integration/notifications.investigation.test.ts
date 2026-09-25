import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../../src/app/database/prisma'
import { appointmentService } from '../../src/modules/appointments/appointment.service'
import { createClientUser, createProfessionalUser, createService, createAppointmentDirect, tomorrowStr } from '../helpers/factories'

describe('investigación: notificaciones al confirmarse el pago', () => {
  it('turno SOLO: la profesional recibe la notificación de nuevo turno al aprobarse el pago', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000, paymentStatus: 'pending',
    })

    await appointmentService.applyPaymentResult(appt.id, 'mp-payment-1', 'approved')

    const notifs = await prisma.professionalNotification.findMany({ where: { professionalId: pro.id } })
    expect(notifs).toHaveLength(1)
    expect(notifs[0].type).toBe('new_appointment')
  })

  it('combo/simultáneo: AMBAS profesionales reciben la notificación al aprobarse el pago', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser({ name: 'Profesional Uno' })
    const pro2   = await createProfessionalUser({ name: 'Profesional Dos' })
    const svc1   = await createService({ name: 'Servicio Uno' })
    const svc2   = await createService({ name: 'Servicio Dos' })
    const groupId = randomUUID()

    await createAppointmentDirect({
      clientId: client.id, professionalId: pro1.id, serviceId: svc1.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000, paymentStatus: 'pending', comboGroupId: groupId,
    })
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro2.id, serviceId: svc2.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 0, paymentStatus: 'pending', comboGroupId: groupId,
    })

    await appointmentService.applyGroupPaymentResult(groupId, 'mp-payment-2', 'approved')

    const notifs1 = await prisma.professionalNotification.findMany({ where: { professionalId: pro1.id } })
    const notifs2 = await prisma.professionalNotification.findMany({ where: { professionalId: pro2.id } })
    expect(notifs1).toHaveLength(1)
    expect(notifs2).toHaveLength(1)
  })

  it('combo/simultáneo: en Actividad del admin queda UN solo registro de "nuevo turno", no uno por servicio', async () => {
    const client = await createClientUser()
    const pro1   = await createProfessionalUser({ name: 'Profesional Uno' })
    const pro2   = await createProfessionalUser({ name: 'Profesional Dos' })
    const svc1   = await createService({ name: 'Servicio Uno' })
    const svc2   = await createService({ name: 'Servicio Dos' })
    const groupId = randomUUID()

    await createAppointmentDirect({
      clientId: client.id, professionalId: pro1.id, serviceId: svc1.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 5000, paymentStatus: 'pending', comboGroupId: groupId,
    })
    await createAppointmentDirect({
      clientId: client.id, professionalId: pro2.id, serviceId: svc2.id,
      date: tomorrowStr(), time: '10:00', depositAmount: 0, paymentStatus: 'pending', comboGroupId: groupId,
    })

    await appointmentService.applyGroupPaymentResult(groupId, 'mp-payment-3', 'approved')

    const logs = await prisma.activityLog.findMany({
      where: { module: 'appointments', action: { in: ['Nuevo turno', 'Nuevo turno simultáneo'] } },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('Nuevo turno simultáneo')
    expect(logs[0].detail).toContain('Servicio Uno')
    expect(logs[0].detail).toContain('Servicio Dos')
  })
})

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import {
  createClientUser, createProfessionalUser, createService, createAppointmentDirect,
  setAvailability, futureWeekDay, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Matriz de pruebas (matriz_pruebas_nexa, hoja Matriz): casos de valores límite que figuraban como «Prueba nueva a escribir».

describe('M-04 un turno empieza exactamente cuando termina el anterior (RF-01, R-01)', () => {
  it('M-04 martes 08:00, 10:00 y 12:00 con servicios de 120 minutos: se aceptan los tres', async () => {
    const pro = await createProfessionalUser()
    await setAvailability(pro.id, [{ dayOfWeek: 1, startTime: '08:00', endTime: '14:00' }]) // martes (0 = lunes)
    const svc = await createService({ name: 'Servicio de 120 min', duration: 120 })
    const martes = futureWeekDay(1)

    const resultados: { time: string; status: number }[] = []
    for (const time of ['08:00', '10:00', '12:00']) {
      const clienta = await createClientUser({ email: `m04-${time.slice(0, 2)}@test.local` })
      const res = await request(app)
        .post('/api/client/appointments')
        .set('Cookie', cookieFor(clienta))
        .send({ serviceId: svc.id, professionalId: pro.id, date: martes, time, termsAccepted: true })
      resultados.push({ time, status: res.status })
    }

    expect(resultados).toEqual([
      { time: '08:00', status: 201 },
      { time: '10:00', status: 201 },
      { time: '12:00', status: 201 },
    ])
    const activos = await prisma.appointment.findMany({
      where: { professionalId: pro.id, date: martes, status: { notIn: ['cancelled', 'cancelled_no_show'] } },
      orderBy: { time: 'asc' },
    })
    expect(activos.map(a => a.time)).toEqual(['08:00', '10:00', '12:00'])
  })
})

describe('M-10 reprogramación sin límite de intentos (RF-13)', () => {
  it('M-10 reprogramar el mismo turno 3 veces seguidas: las 3 se aceptan', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()
    const inicio = hoursFromNow(48)
    const appt   = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: inicio.date, time: inicio.time,
    })

    const destinos = [hoursFromNow(72), hoursFromNow(96), hoursFromNow(120)]
    for (const [i, destino] of destinos.entries()) {
      const res = await request(app)
        .patch(`/api/client/appointments/${appt.id}/reschedule`)
        .set('Cookie', cookieFor(client))
        .send({ serviceId: svc.id, professionalId: pro.id, date: destino.date, time: destino.time })

      expect(res.status, `intento ${i + 1}`).toBe(200)
      expect(res.body.appointment.date).toBe(destino.date)
      expect(res.body.appointment.time).toBe(destino.time)
      expect(res.body.appointment.status).toBe('confirmed')
    }

    const fresh = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(fresh.date).toBe(destinos[2].date)
    expect(fresh.status).toBe('confirmed')
  })
})

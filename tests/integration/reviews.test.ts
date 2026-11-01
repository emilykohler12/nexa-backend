import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-25: la clienta reseña un turno finalizado propio, una sola vez por turno (409 ALREADY_REVIEWED). El puntaje
// cuenta enseguida para el promedio público; el comentario queda pendiente hasta que el administrador lo aprueba.

type U = { id: string; email: string; role: string }

async function finishedAppointment(clientId?: string, status = 'finished') {
  const client = clientId ? { id: clientId } : await createClientUser()
  const pro    = await createProfessionalUser()
  const svc    = await createService({ name: 'Lifting de pestañas' })
  const appt   = await createAppointmentDirect({ clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2026-10-20', time: '10:00', status })
  return { pro, appt }
}

const review = (client: U, body: object) => request(app).post('/api/client/reviews').set('Cookie', cookieFor(client)).send(body)

describe('RF-25: reseñas', () => {
  it('la clienta reseña un turno finalizado propio; con comentario nace pendiente, sin comentario aprobada', async () => {
    const client = await createClientUser()
    const a = await finishedAppointment(client.id)
    const b = await finishedAppointment(client.id)

    const withMessage = await review(client, { appointmentId: a.appt.id, rating: 5, message: 'Excelente atención' })
    const onlyRating  = await review(client, { appointmentId: b.appt.id, rating: 3 })

    expect(withMessage.status).toBe(201)
    expect(withMessage.body.review).toMatchObject({ rating: 5, message: 'Excelente atención', status: 'pending', serviceName: 'Lifting de pestañas' })
    expect(onlyRating.body.review).toMatchObject({ rating: 3, message: null, status: 'approved' })
    // Solo el comentario genera una entrada para que el administrador lo apruebe.
    expect(await prisma.activityLog.count({ where: { module: 'reviews' } })).toBe(1)
  })

  it('una sola reseña por turno: la segunda responde 409 ALREADY_REVIEWED', async () => {
    const client = await createClientUser()
    const { appt } = await finishedAppointment(client.id)

    await review(client, { appointmentId: appt.id, rating: 4 })
    const again = await review(client, { appointmentId: appt.id, rating: 1, message: 'Cambié de opinión' })

    expect(again.status).toBe(409)
    expect(again.body.code).toBe('ALREADY_REVIEWED')
    expect(await prisma.review.count()).toBe(1)
  })

  it('solo turnos finalizados y propios: uno confirmado da 400 y uno ajeno 404', async () => {
    const client = await createClientUser()
    const mineConfirmed = await finishedAppointment(client.id, 'confirmed')
    const notMine       = await finishedAppointment()

    const pending = await review(client, { appointmentId: mineConfirmed.appt.id, rating: 5 })
    const ajeno   = await review(client, { appointmentId: notMine.appt.id, rating: 5 })

    expect(pending.status).toBe(400)
    expect(ajeno.status).toBe(404)
    expect(await prisma.review.count()).toBe(0)
  })

  it('valida el puntaje entre 1 y 5', async () => {
    const client = await createClientUser()
    const { appt } = await finishedAppointment(client.id)

    for (const rating of [0, 6, 2.5, 'cinco']) {
      const res = await review(client, { appointmentId: appt.id, rating })
      expect(res.status, String(rating)).toBe(400)
    }
  })

  it('el comentario se publica recién cuando el administrador lo aprueba; uno rechazado no aparece', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser({ name: 'Clienta Reseña' })
    const a = await finishedAppointment(client.id)
    const b = await finishedAppointment(client.id)
    const first  = (await review(client, { appointmentId: a.appt.id, rating: 5, message: 'Me encantó' })).body.review
    const second = (await review(client, { appointmentId: b.appt.id, rating: 2, message: 'Comentario a rechazar' })).body.review

    expect((await request(app).get('/api/reviews/public')).body.reviews).toEqual([])

    expect((await request(app).patch(`/api/admin/reviews/${first.id}/approve`).set('Cookie', cookieFor(admin))).status).toBe(200)
    expect((await request(app).patch(`/api/admin/reviews/${second.id}/reject`).set('Cookie', cookieFor(admin))).status).toBe(200)

    const pub = await request(app).get('/api/reviews/public')
    expect(pub.body.reviews).toEqual([{ id: first.id, clientName: 'Clienta Reseña', rating: 5, message: 'Me encantó' }])
    expect((await request(app).patch(`/api/admin/reviews/${first.id}/reject`).set('Cookie', cookieFor(client))).status).toBe(403)
  })

  it('el promedio público cuenta todos los puntajes, también los de comentarios pendientes o rechazados', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const a = await finishedAppointment(client.id)
    const b = await finishedAppointment(client.id)
    const c = await finishedAppointment(client.id)
    await review(client, { appointmentId: a.appt.id, rating: 5 })
    await review(client, { appointmentId: b.appt.id, rating: 4, message: 'Pendiente' })
    const rejected = (await review(client, { appointmentId: c.appt.id, rating: 2, message: 'Rechazado' })).body.review
    await request(app).patch(`/api/admin/reviews/${rejected.id}/reject`).set('Cookie', cookieFor(admin))

    const summary = await request(app).get('/api/reviews/public/summary')

    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({ count: 3 })
    expect(summary.body.average).toBeCloseTo(11 / 3, 5)
  })

  it('el promedio por profesional sale en el listado público de profesionales', async () => {
    const client = await createClientUser()
    const { pro, appt } = await finishedAppointment(client.id)
    const second = await createAppointmentDirect({
      clientId: client.id, professionalId: pro.id, serviceId: appt.serviceId, date: '2026-10-21', time: '10:00', status: 'finished',
    })
    await review(client, { appointmentId: appt.id, rating: 5 })
    await review(client, { appointmentId: second.id, rating: 4 })

    const res = await request(app).get('/api/professionals/public')

    const mine = res.body.professionals.find((p: { id: string }) => p.id === pro.id)
    expect(mine).toMatchObject({ rating: 4.5, reviewCount: 2 })
  })
})

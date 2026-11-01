import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createAdminUser, createService } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// ─── RF-11: categorías de servicio ──────────────────────────────────────────────────────────────

describe('RF-11: categoría del servicio', () => {
  const body = (over: object = {}) => ({ name: 'Servicio de prueba', categoryId: 'unas', duration: 60, price: 10000, ...over })
  const crear = async (over: object) => {
    const admin = await createAdminUser()
    return request(app).post('/api/services').set('Cookie', cookieFor(admin)).send(body(over))
  }

  it.each(['unas', 'cabello', 'cuerpo', 'rostro'])('acepta la categoría %s', async (categoryId) => {
    expect((await crear({ categoryId })).status).toBe(201)
  })

  it.each(['peluqueria', 'Uñas', '', 'combo', 'combos'])('rechaza %j en un servicio común', async (categoryId) => {
    const res = await crear({ categoryId })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await prisma.service.count()).toBe(0)
  })

  it('un servicio simultáneo puede ir en la categoría combo o en una de las cuatro', async () => {
    const a = await createService({ name: 'Manos' })
    const b = await createService({ name: 'Pies' })
    const combo = { isCombo: true, simultaneous: true, comboServiceIds: [a.id, b.id], name: 'Manos y pies' }
    expect((await crear({ ...combo, categoryId: 'combo' })).status).toBe(201)
    expect((await crear({ ...combo, categoryId: 'unas', name: 'Manos y pies 2' })).status).toBe(201)
    expect((await crear({ ...combo, categoryId: 'peluqueria', name: 'Manos y pies 3' })).status).toBe(400)
  })

  it('al editar solo se revisa la categoría si la edición la toca', async () => {
    const admin = await createAdminUser()
    const viejo = await prisma.service.create({
      data: { name: 'Viejo', categoryId: 'categoria-vieja', description: '', duration: 30, price: 1000, status: 'active' },
    })
    const sinTocar = await request(app).put(`/api/services/${viejo.id}`).set('Cookie', cookieFor(admin)).send({ name: 'Viejo renombrado' })
    expect(sinTocar.status).toBe(200)
    const tocando = await request(app).put(`/api/services/${viejo.id}`).set('Cookie', cookieFor(admin)).send({ categoryId: 'otra-vieja' })
    expect(tocando.status).toBe(400)
    const corrigiendo = await request(app).put(`/api/services/${viejo.id}`).set('Cookie', cookieFor(admin)).send({ categoryId: 'cabello' })
    expect(corrigiendo.status).toBe(200)
  })
})

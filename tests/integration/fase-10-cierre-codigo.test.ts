import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { uploadProvider } from '../../src/modules/uploads/upload.provider'
import { buildJobInterestLimiter } from '../../src/modules/contact/contact.routes'
import { looseBoolean } from '../../src/app/validators/boolean'
import {
  createClientUser, createProfessionalUser, createAdminUser, createService, createAppointmentDirect,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Fase 10: correcciones de los hallazgos de la fase 7. Una prueba (o grupo corto) por corrección.
// El punto 5 (postulaciones) y el 7 (clave de servicio) tienen además sus pruebas en
// client-details-job-interest-late-booking.test.ts y uploads.delete-images.test.ts.

vi.mock('../../src/modules/uploads/upload.provider', async (orig) => {
  const real = await orig<typeof import('../../src/modules/uploads/upload.provider')>()
  return { ...real, uploadProvider: { ...real.uploadProvider, deleteImages: vi.fn() } }
})

afterEach(() => { vi.useRealTimers() })

const UUID_NOPE = '00000000-0000-4000-8000-000000000000'

describe('1. profesional: validación del perfil, las franjas y el onboarding', () => {
  it('rechaza una franja de 20:00 a 08:00 y valores que no son hora, y no toca la base', async () => {
    const pro = await createProfessionalUser()
    const put = (availability: object) =>
      request(app).patch('/api/professional/schedule').set('Cookie', cookieFor(pro)).send({ availability })

    const inverted = await put({ monday: { start: '20:00', end: '08:00' } })
    const notTime  = await put({ monday: [{ start: 'abc', end: '25:99' }] })

    for (const res of [inverted, notTime]) {
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    const ok = await put({ monday: [{ start: '09:00', end: '13:00' }, { start: '15:00', end: '20:00' }] })
    expect(ok.status).toBe(200)
  })

  it('el onboarding también valida las franjas', async () => {
    const pro = await createProfessionalUser()
    const res = await request(app).post('/api/professional/onboarding').set('Cookie', cookieFor(pro))
      .send({ availability: { tuesday: { start: '18:00', end: '09:00' } } })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('un PATCH de un solo campo no borra la bio ni el resto del perfil', async () => {
    const pro = await createProfessionalUser()
    const patch = (body: object) => request(app).patch('/api/professional/profile').set('Cookie', cookieFor(pro)).send(body)

    await patch({ bio: 'Manicura con diez años de experiencia', specialty: 'Uñas', yearsExperience: 10 })
    const res = await patch({ instagram: '@loren' })

    expect(res.status).toBe(200)
    const row = await prisma.professional.findFirstOrThrow({ where: { userId: pro.id } })
    expect(row).toMatchObject({ bio: 'Manicura con diez años de experiencia', specialty: 'Uñas', yearsExperience: 10, instagram: '@loren' })

    expect((await patch({ yearsExperience: 'muchos' })).status).toBe(400)
  })
})

describe('2. id inexistente responde 404 y no 500', () => {
  it('servicios, promociones y eventos especiales', async () => {
    const admin = await createAdminUser()
    const as = (m: 'put' | 'delete' | 'patch', url: string, body: object = {}) =>
      request(app)[m](url).set('Cookie', cookieFor(admin)).send(body)

    const results = await Promise.all([
      as('put',    `/api/services/${UUID_NOPE}`, { name: 'Nuevo nombre' }),
      as('patch',  `/api/services/${UUID_NOPE}/status`),
      as('delete', `/api/services/${UUID_NOPE}`),
      as('put',    `/api/admin/promotions/${UUID_NOPE}`, { title: 'Otro título' }),
      as('delete', `/api/admin/promotions/${UUID_NOPE}`),
      as('put',    `/api/admin/special-events/${UUID_NOPE}`, { title: 'Otro' }),
      as('delete', `/api/admin/special-events/${UUID_NOPE}`),
    ])
    results.forEach(res => {
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('NOT_FOUND')
    })
  })
})

describe('3. PUT parcial y booleanos', () => {
  it('un PUT parcial de un servicio no pisa isCombo, status ni simultaneous con sus valores por defecto', async () => {
    const admin = await createAdminUser()
    const svc = await prisma.service.create({
      data: { name: 'Combo Test', categoryId: 'combo', description: 'd', duration: 60, price: 1000, status: 'inactive', isCombo: true, simultaneous: true },
    })

    const res = await request(app).put(`/api/services/${svc.id}`).set('Cookie', cookieFor(admin)).send({ price: 2000 })

    expect(res.status).toBe(200)
    const row = await prisma.service.findUniqueOrThrow({ where: { id: svc.id } })
    expect(row).toMatchObject({ price: expect.anything(), status: 'inactive', isCombo: true, simultaneous: true })
    expect(Number(row.price)).toBe(2000)
  })

  it('un PUT parcial de una promoción no pisa su estado', async () => {
    const admin = await createAdminUser()
    const promo = await prisma.promotion.create({
      data: { type: 'service', kind: 'discount', title: 'Promo inactiva', price: 100, status: 'inactive', items: [] as any },
    })
    const res = await request(app).put(`/api/admin/promotions/${promo.id}`).set('Cookie', cookieFor(admin)).send({ price: 200 })
    expect(res.status).toBe(200)
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } })).status).toBe('inactive')
  })

  it('active "false" como texto se lee como falso (y "true" como verdadero)', async () => {
    expect(looseBoolean.parse('false')).toBe(false)
    expect(looseBoolean.parse('FALSE')).toBe(false)
    expect(looseBoolean.parse('0')).toBe(false)
    expect(looseBoolean.parse('true')).toBe(true)
    expect(looseBoolean.parse(false)).toBe(false)
    expect(looseBoolean.safeParse('quizás').success).toBe(false)

    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const svc   = await createService()
    const created = await request(app).post('/api/admin/special-events').set('Cookie', cookieFor(admin))
      .send({ serviceId: svc.id, professionalId: pro.id, date: '2030-01-10', active: 'false' })
    expect(created.status).toBe(201)
    expect(created.body.specialEvent.active).toBe(false)
  })
})

describe('4. stock: borrar una entrada ya vendida', () => {
  it('no deja el stock negativo (400 INSUFFICIENT_STOCK) y el movimiento sigue en el libro', async () => {
    const admin = await createAdminUser()
    const item  = await prisma.product.create({ data: { name: 'Crema', price: 1000, stock: 0 } })
    const entry = (await request(app).post('/api/store/movements').set('Cookie', cookieFor(admin))
      .send({ productId: item.id, type: 'entry', quantity: 5, note: 'Reposición', date: '2026-11-03' })).body.movement
    await request(app).post('/api/store/movements').set('Cookie', cookieFor(admin))
      .send({ productId: item.id, type: 'exit', quantity: 4, note: 'Venta', date: '2026-11-04' })

    const res = await request(app).delete(`/api/store/movements/${entry.id}`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INSUFFICIENT_STOCK')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: item.id } })).stock).toBe(1)
    expect(await prisma.inventoryMovement.count()).toBe(2)
  })
})

describe('5. postulaciones: limitador propio', () => {
  it('después de N envíos seguidos de la misma IP responde 429', async () => {
    const { contactController } = await import('../../src/modules/contact/contact.controller')
    const mini = express()
    mini.use(express.json())
    mini.post('/job-interest', buildJobInterestLimiter(2), contactController.jobInterest)

    const send = () => request(mini).post('/job-interest').send({ message: 'Hola' })
    expect((await send()).status).toBe(201)
    expect((await send()).status).toBe(201)
    expect((await send()).status).toBe(429)
  })
})

describe('6. galería: categoría y archivo del bucket', () => {
  it('rechaza una categoría inválida al crear y al editar', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const bad = await request(app).post(`/api/admin/clients/${client.id}/gallery`).set('Cookie', cookieFor(admin))
      .send({ url: 'https://storage.test.local/a.jpg', category: 'durante' })
    expect(bad.status).toBe(400)

    const photo = await prisma.clientGalleryPhoto.create({ data: { clientId: client.id, url: 'https://storage.test.local/b.jpg', category: 'before' } })
    const edit = await request(app).patch(`/api/admin/clients/${client.id}/gallery/${photo.id}`).set('Cookie', cookieFor(admin))
      .send({ category: 'durante' })
    expect(edit.status).toBe(400)
    expect((await prisma.clientGalleryPhoto.findUniqueOrThrow({ where: { id: photo.id } })).category).toBe('before')
  })

  it('al borrar la foto también se borra el archivo del bucket; si falla queda una entrada de error', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const photo = await prisma.clientGalleryPhoto.create({ data: { clientId: client.id, url: 'https://storage.test.local/c.jpg', category: 'after' } })
    vi.mocked(uploadProvider.deleteImages).mockResolvedValueOnce({ deleted: [], failed: [photo.url] })

    const res = await request(app).delete(`/api/admin/clients/${client.id}/gallery/${photo.id}`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(uploadProvider.deleteImages).toHaveBeenCalledWith([photo.url])
    expect(await prisma.clientGalleryPhoto.count()).toBe(0)
    const log = await prisma.activityLog.findFirstOrThrow({ where: { level: 'error' } })
    expect(log.detail).toContain(photo.url)
  })
})

describe('8. panel: pendingBalance descuenta el saldo ya cobrado en el local', () => {
  it('seña parcial de 3000 sobre 10000 y 4000 cobrados en el local deja 3000 pendientes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-03T20:00:00-03:00'))
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService({ price: 10000, duration: 60 })
    const base   = { clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: '2026-11-03' }
    await createAppointmentDirect({ ...base, time: '09:00', status: 'finished', paymentStatus: 'partial', depositAmount: 3000 })
    const charged = await createAppointmentDirect({ ...base, time: '11:00', status: 'finished', paymentStatus: 'partial', depositAmount: 3000 })
    await prisma.appointment.update({ where: { id: charged.id }, data: { balancePaidAmount: 4000 } })

    const res = await request(app).get('/api/admin/dashboard').query({ period: 'day' }).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.dashboard.pendingBalance).toBe(7000 + 3000)
  })
})

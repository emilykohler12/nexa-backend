import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { uploadProvider } from '../../src/modules/uploads/upload.provider'
import {
  createClientUser, createAdminUser, createProfessionalUser, createService, createAppointmentDirect, hoursFromNow,
} from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Los tests nunca le pegan al almacenamiento real: se simula qué archivos "se borraron".
vi.mock('../../src/modules/uploads/upload.provider', () => ({
  uploadProvider: { uploadImage: vi.fn(), deleteImages: vi.fn() },
}))

const URL_A = 'https://storage.test/storage/v1/object/public/images/galeria/a.jpg'
const URL_B = 'https://storage.test/storage/v1/object/public/images/galeria/b.jpg'

beforeEach(() => {
  vi.mocked(uploadProvider.deleteImages).mockReset()
  vi.mocked(uploadProvider.deleteImages).mockImplementation(async urls => ({ deleted: [...urls], failed: [] }))
})

async function setupClientWithPersonalData() {
  const admin  = await createAdminUser({ email: 'admin.fase5@test.local' })
  const client = await createClientUser({ name: 'Nombre Real', email: 'real.fase5@test.local' })
  const pro    = await createProfessionalUser()
  const svc    = await createService()
  const at     = hoursFromNow(-48)
  const appt   = await createAppointmentDirect({
    clientId: client.id, professionalId: pro.id, serviceId: svc.id, date: at.date, time: at.time,
    status: 'finished', servicePrice: 15000,
  })
  await prisma.client.update({
    where: { userId: client.id },
    data:  { allergies: 'Alergia al látex', preferences: 'Prefiere silencio', observations: 'Piel sensible', notes: 'Nota interna' },
  })
  await prisma.clientGalleryPhoto.createMany({
    data: [
      { clientId: client.id, url: URL_A, category: 'before' },
      { clientId: client.id, url: URL_B, category: 'after' },
    ],
  })
  const order = await prisma.order.create({
    data: {
      clientId: client.id, deliveryType: 'delivery', deliveryAddress: 'Calle Falsa 123', phone: '3764111111',
      notes: 'Dejar con la vecina', totalPrice: 8000, status: 'delivered', paymentStatus: 'paid',
    },
  })
  const review = await prisma.review.create({
    data: { clientId: client.id, appointmentId: appt.id, rating: 4, message: 'Muy buena atención de Nombre Real', status: 'approved' },
  })
  const expiresAt = new Date(Date.now() + 86_400_000)
  await prisma.refreshSession.createMany({
    data: [
      { userId: client.id, tokenHash: 'a'.repeat(64), expiresAt },
      { userId: client.id, tokenHash: 'b'.repeat(64), expiresAt },
    ],
  })
  return { admin, client, appt, order, review }
}

describe('anonimización de una clienta: datos personales (Fase 5)', () => {
  it('borra las fotos de la galería (filas y archivos)', async () => {
    const { admin, client } = await setupClientWithPersonalData()

    const res = await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(await prisma.clientGalleryPhoto.count({ where: { clientId: client.id } })).toBe(0)
    expect(uploadProvider.deleteImages).toHaveBeenCalledTimes(1)
    expect([...vi.mocked(uploadProvider.deleteImages).mock.calls[0][0]].sort()).toEqual([URL_A, URL_B])
  })

  it('vacía teléfono, dirección y notas de los pedidos, pero conserva monto, estado y pago', async () => {
    const { admin, client, order } = await setupClientWithPersonalData()

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(row.phone).toBeNull()
    expect(row.deliveryAddress).toBeNull()
    expect(row.notes).toBeNull()
    expect(Number(row.totalPrice)).toBe(8000)
    expect(row.status).toBe('delivered')
    expect(row.paymentStatus).toBe('paid')
    expect(row.clientId).toBe(client.id)
  })

  it('vacía el texto de las reseñas y conserva el puntaje', async () => {
    const { admin, client, review } = await setupClientWithPersonalData()

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const row = await prisma.review.findUniqueOrThrow({ where: { id: review.id } })
    expect(row.message).toBeNull()
    expect(row.rating).toBe(4)
  })

  it('conserva turnos, alergias, preferencias, observaciones y notas', async () => {
    const { admin, client, appt } = await setupClientWithPersonalData()

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const profile = await prisma.client.findUniqueOrThrow({ where: { userId: client.id } })
    expect(profile.allergies).toBe('Alergia al látex')
    expect(profile.preferences).toBe('Prefiere silencio')
    expect(profile.observations).toBe('Piel sensible')
    expect(profile.notes).toBe('Nota interna')
    const dbAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(Number(dbAppt.servicePrice)).toBe(15000)
    expect(dbAppt.status).toBe('finished')
  })

  it('después de anonimizar no queda ninguna sesión (RefreshSession) de la clienta', async () => {
    const { admin, client } = await setupClientWithPersonalData()
    expect(await prisma.refreshSession.count({ where: { userId: client.id } })).toBe(2)

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    expect(await prisma.refreshSession.count({ where: { userId: client.id } })).toBe(0)
  })

  it('el registro de actividad enumera los campos tocados con cantidades y quién la ejecutó', async () => {
    const { admin, client } = await setupClientWithPersonalData()

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    const entries = await prisma.activityLog.findMany({ where: { module: 'clients' } })
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.level).toBe('warning')
    expect(entry.userName).toBe('admin.fase5@test.local')
    const detail = entry.detail ?? ''
    expect(detail).toContain(client.id)
    expect(detail).toContain('admin.fase5@test.local')
    expect(detail).toContain('Sesiones cerradas: 2')
    expect(detail).toContain('Fotos de la galería eliminadas: 2')
    expect(detail).toContain('Pedidos con teléfono, dirección y notas vaciados: 1')
    expect(detail).toContain('Reseñas con el texto vaciado (se conserva el puntaje): 1')
    // Nada de lo que se borró queda copiado en el registro.
    for (const secreto of ['real.fase5@test.local', 'Nombre Real', 'Calle Falsa', '3764111111', 'vecina', 'Muy buena atención', 'a.jpg']) {
      expect(detail).not.toContain(secreto)
    }
  })

  it('si falla el borrado de un archivo no corta: anonimiza igual y deja un aviso de error con la lista', async () => {
    const { admin, client } = await setupClientWithPersonalData()
    vi.mocked(uploadProvider.deleteImages).mockResolvedValue({ deleted: [URL_A], failed: [URL_B] })

    const res = await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    expect(res.body.client.name).toBe('Cliente eliminado')
    expect(await prisma.clientGalleryPhoto.count({ where: { clientId: client.id } })).toBe(0)

    const errors = await prisma.activityLog.findMany({ where: { module: 'clients', level: 'error' } })
    expect(errors).toHaveLength(1)
    expect(errors[0].detail).toContain(URL_B)
    expect(errors[0].detail).not.toContain(URL_A)
    expect(errors[0].detail).toContain('1 de 2')
    // El aviso principal sigue existiendo y cuenta solo los archivos que sí se borraron.
    const main = await prisma.activityLog.findFirstOrThrow({ where: { module: 'clients', level: 'warning' } })
    expect(main.detail).toContain('archivos borrados del almacenamiento: 1')
  })

  it('una clienta sin fotos, pedidos ni reseñas se anonimiza igual y no llama al almacenamiento', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()

    const res = await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    expect(res.status).toBe(200)
    const entry = await prisma.activityLog.findFirstOrThrow({ where: { module: 'clients' } })
    expect(entry.detail).toContain('Fotos de la galería eliminadas: 0')
    expect(entry.detail).toContain('Pedidos con teléfono, dirección y notas vaciados: 0')
    expect(await prisma.activityLog.count({ where: { level: 'error' } })).toBe(0)
  })

  it('no toca las fotos, pedidos ni reseñas de otra clienta', async () => {
    const { admin, client } = await setupClientWithPersonalData()
    const otra = await createClientUser()
    await prisma.clientGalleryPhoto.create({ data: { clientId: otra.id, url: URL_A, category: 'before' } })
    await prisma.order.create({
      data: { clientId: otra.id, deliveryType: 'pickup', phone: '3764222222', notes: 'Pasa a las 18', totalPrice: 1000 },
    })

    await request(app).post(`/api/admin/clients/${client.id}/anonymize`).set('Cookie', cookieFor(admin))

    expect(await prisma.clientGalleryPhoto.count({ where: { clientId: otra.id } })).toBe(1)
    const orden = await prisma.order.findFirstOrThrow({ where: { clientId: otra.id } })
    expect(orden.phone).toBe('3764222222')
    expect(orden.notes).toBe('Pasa a las 18')
  })
})

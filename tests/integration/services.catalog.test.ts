import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createAdminUser, createService, futureWeekDay } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-11: alta, edición y listado público de servicios. RF-17: reserva de un servicio especial (precio y duración
// calculados por el servidor; el horario tomado da 409 SLOT_TAKEN).

type U = { id: string; email: string; role: string }

const fullService = (over: object = {}) => ({
  name: 'Kapping gel', categoryId: 'unas', description: 'Capa de gel sobre la uña natural',
  duration: 75, price: 14000, status: 'active', image: null,
  isCombo: false, comboServiceIds: [], simultaneous: false, comboProfessionals: {},
  isSpecial: false, specialDate: null, specialSlots: [], zones: [], packages: [],
  ...over,
})

const post = (user: U, body: object) => request(app).post('/api/services').set('Cookie', cookieFor(user)).send(body)
const put  = (user: U, id: string, body: object) => request(app).put(`/api/services/${id}`).set('Cookie', cookieFor(user)).send(body)

describe('RF-11: alta, edición y listado público de servicios', () => {
  it('el administrador da de alta un servicio con nombre, categoría, duración y precio', async () => {
    const admin = await createAdminUser()

    const res = await post(admin, fullService())

    expect(res.status).toBe(201)
    expect(res.body.service).toMatchObject({ name: 'Kapping gel', categoryId: 'unas', duration: 75, status: 'active' })
    expect(Number(res.body.service.price)).toBe(14000)
  })

  it('el alta valida el cuerpo: nombre corto, duración menor a 5 minutos, precio negativo', async () => {
    const admin = await createAdminUser()

    for (const over of [{ name: 'K' }, { duration: 3 }, { price: -1 }, { categoryId: '' }]) {
      const res = await post(admin, fullService(over))
      expect(res.status, JSON.stringify(over)).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    expect(await prisma.service.count()).toBe(0)
  })

  it('el administrador edita el servicio enviando el formulario completo', async () => {
    const admin = await createAdminUser()
    const created = (await post(admin, fullService())).body.service

    const res = await put(admin, created.id, fullService({ name: 'Kapping gel con diseño', price: 16500, duration: 90 }))

    expect(res.status).toBe(200)
    const row = await prisma.service.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.name).toBe('Kapping gel con diseño')
    expect(Number(row.price)).toBe(16500)
    expect(row.duration).toBe(90)
  })

  it('el listado público muestra solo los servicios activos y no exige sesión', async () => {
    await createService({ name: 'Manicura activa' })
    await createService({ name: 'Pedicura inactiva', status: 'inactive' })

    const res = await request(app).get('/api/services')

    expect(res.status).toBe(200)
    expect(res.body.services.map((s: { name: string }) => s.name)).toEqual(['Manicura activa'])
  })

  it('el listado completo, el alta y la edición quedan cerrados para clienta y profesional', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await createService()

    for (const user of [client, pro]) {
      expect((await post(user, fullService())).status).toBe(403)
      expect((await put(user, svc.id, fullService())).status).toBe(403)
      expect((await request(app).get('/api/services/all').set('Cookie', cookieFor(user))).status).toBe(403)
    }
    expect((await request(app).post('/api/services').send(fullService())).status).toBe(401)
  })
})

describe('RF-17: reserva de un servicio especial', () => {
  async function specialService(proId: string) {
    return prisma.service.create({
      data: {
        name: 'Depilación definitiva (jornada)', categoryId: 'cuerpo', description: 'Jornada especial',
        duration: 0, price: 0, status: 'active', isSpecial: true, specialDate: futureWeekDay(2),
        zones: [
          { id: 'z1', name: 'Axilas', duration: 20, price: 9000, active: true },
          { id: 'z2', name: 'Piernas', duration: 40, price: 21000, active: true },
          { id: 'z3', name: 'Rostro', duration: 15, price: 7000, active: false },
        ],
        packages: [{ id: 'p1', name: 'Bikini', zoneIds: [], duration: 25, price: 11000, active: true }],
        specialSlots: [{ id: 's1', time: '11:00', professionalId: proId, active: true }],
      },
    })
  }

  const book = (client: U, body: object) =>
    request(app).post('/api/client/appointments/special').set('Cookie', cookieFor(client)).send(body)

  it('el precio y la duración salen de las zonas y paquetes del servidor, no de lo que mande el navegador', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await specialService(pro.id)

    const res = await book(client, {
      serviceId: svc.id, time: '11:00', zoneIds: ['z1', 'z2'], packageIds: ['p1'],
      price: 1, servicePrice: 1, duration: 5, depositAmount: 0,
    })

    expect(res.status).toBe(201)
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.appointment.id } })
    expect(Number(row.servicePrice)).toBe(41000)
    expect(row.duration).toBe(85)
    expect(row.professionalId).toBe(pro.id)
    expect(row.date).toBe(svc.specialDate)
  })

  it('una zona inactiva o inexistente se rechaza', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await specialService(pro.id)

    const inactive = await book(client, { serviceId: svc.id, time: '11:00', zoneIds: ['z3'] })
    const missing  = await book(client, { serviceId: svc.id, time: '11:00', zoneIds: ['nope'] })

    expect(inactive.status).toBe(400)
    expect(inactive.body.code).toBe('ZONE_NOT_FOUND')
    expect(missing.body.code).toBe('ZONE_NOT_FOUND')
    expect(await prisma.appointment.count()).toBe(0)
  })

  it('el horario ya tomado responde 409 SLOT_TAKEN y no crea un segundo turno', async () => {
    const first  = await createClientUser()
    const second = await createClientUser()
    const pro    = await createProfessionalUser()
    const svc    = await specialService(pro.id)

    const ok    = await book(first, { serviceId: svc.id, time: '11:00', zoneIds: ['z1'] })
    const taken = await book(second, { serviceId: svc.id, time: '11:00', zoneIds: ['z2'] })

    expect(ok.status).toBe(201)
    expect(taken.status).toBe(409)
    expect(taken.body.code).toBe('SLOT_TAKEN')
    expect(await prisma.appointment.count()).toBe(1)
  })

  it('el listado público no expone quién reservó el horario, solo que está tomado', async () => {
    const client = await createClientUser({ name: 'Nombre De Prueba' })
    const pro    = await createProfessionalUser()
    const svc    = await specialService(pro.id)
    await book(client, { serviceId: svc.id, time: '11:00', zoneIds: ['z1'] })

    const res = await request(app).get('/api/services')

    const pub = res.body.services.find((s: { id: string }) => s.id === svc.id)
    expect(pub.specialSlots).toEqual([{ time: '11:00', professionalId: pro.id, professionalName: null, active: true, booked: true }])
    expect(pub.zones.map((z: { id: string }) => z.id)).toEqual(['z1', 'z2'])
    expect(JSON.stringify(pub)).not.toContain('Nombre De Prueba')
  })
})

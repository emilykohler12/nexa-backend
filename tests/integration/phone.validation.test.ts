import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { isArgentineMobile } from '../../src/app/validators/phone'
import { createClientUser, createAdminUser, createProfessionalUser, createService, setAvailability, futureWeekDay } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-02 — celular argentino. La expresión validada con la autora es
// /^(?:\+?54)?9?0?[1-3]\d{1,3}(?:15)?\d{6,8}$/ sobre el valor sin espacios, guiones ni paréntesis, más el control
// de 10 dígitos de código de área + número.
describe('isArgentineMobile', () => {
  it.each([
    '+54 9 11 2345-6789',
    '+5491123456789',
    '011 15 2345-6789',
    '11 2345 6789',
    '1123456789',
    '(11) 2345-6789',
    '3764 15-123456',
    '3764111111',
    '0376 15 4123456',
    '+54 376 411-1111',
  ])('acepta %s', (phone) => {
    expect(isArgentineMobile(phone)).toBe(true)
  })

  it.each([
    '', '1', '12345', '112345678', '11234567890123', 'abcdefghij', '11 2345 678a', '+54 9 0 0000 0000',
    '5112345678', '9112345678', '0112345678', '11-2345', '+1 555 123 4567',
  ])('rechaza %j', (phone) => {
    expect(isArgentineMobile(phone)).toBe(false)
  })
})

describe('teléfono en el registro y el perfil', () => {
  const registro = (phone: unknown) => request(app).post('/api/auth/register').send({
    name: 'Ana', lastName: 'Pérez', email: `ana${Math.random().toString(36).slice(2)}@test.local`,
    password: 'Clave1234!', phone, termsAccepted: true,
  })

  it('el registro rechaza un teléfono que no es un celular argentino', async () => {
    for (const phone of ['123456', 'no es un telefono', '+1 555 123 4567']) {
      const res = await registro(phone)
      expect(res.status).toBe(422)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
  })

  it('el registro acepta un celular argentino y lo guarda como lo escribió', async () => {
    const res = await registro('+54 9 11 2345-6789')
    expect(res.status).toBe(201)
    const user = await prisma.user.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
    expect(user.phone).toBe('+54 9 11 2345-6789')
  })

  it('el perfil de la clienta rechaza un teléfono inválido con 400, no con 500', async () => {
    const client = await createClientUser()
    for (const phone of ['123', { a: 1 }, ['3764'], 3764111111, 'x'.repeat(21)]) {
      const res = await request(app).patch('/api/client/profile').set('Cookie', cookieFor(client)).send({ phone })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    }
    const after = await prisma.user.findUniqueOrThrow({ where: { id: client.id } })
    expect(after.phone).toBe('3764000000')
  })

  it('el perfil de la clienta acepta un celular válido y el vacío', async () => {
    const client = await createClientUser()
    const ok = await request(app).patch('/api/client/profile').set('Cookie', cookieFor(client)).send({ phone: '11 5555-0123' })
    expect(ok.status).toBe(200)
    expect(ok.body.user.phone).toBe('11 5555-0123')
    const vacio = await request(app).patch('/api/client/profile').set('Cookie', cookieFor(client)).send({ name: 'Nuevo', phone: '' })
    expect(vacio.status).toBe(200)
  })
})

describe('teléfono en las altas y ediciones del personal', () => {
  it('el administrador no puede crear ni editar una clienta con un teléfono inválido', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()

    const crear = await request(app).post('/api/admin/clients').set('Cookie', cookieFor(admin))
      .send({ name: 'Sin Cel', email: 'sincel@test.local', phone: '12345' })
    expect(crear.status).toBe(400)
    expect(crear.body.code).toBe('VALIDATION_ERROR')

    const editar = await request(app).put(`/api/admin/clients/${client.id}`).set('Cookie', cookieFor(admin)).send({ phone: 'abc' })
    expect(editar.status).toBe(400)
    expect(await prisma.user.count({ where: { email: 'sincel@test.local' } })).toBe(0)
  })

  it('el administrador puede crear una clienta con un celular válido o sin teléfono', async () => {
    const admin = await createAdminUser()
    const a = await request(app).post('/api/admin/clients').set('Cookie', cookieFor(admin))
      .send({ name: 'Con Cel', email: 'concel@test.local', phone: '3764 15-123456' })
    expect(a.status).toBeLessThan(300)
    const b = await request(app).post('/api/admin/clients').set('Cookie', cookieFor(admin))
      .send({ name: 'Sin Dato', email: 'sindato@test.local' })
    expect(b.status).toBeLessThan(300)
  })

  it('el administrador no puede guardar un teléfono inválido en una profesional', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const res = await request(app).patch(`/api/professionals/${pro.id}`).set('Cookie', cookieFor(admin)).send({ phone: '999' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('un turno manual con un teléfono inválido no crea la clienta ni el turno', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    await setAvailability(pro.id)
    const svc   = await createService()
    const res = await request(app).post('/api/admin/appointments').set('Cookie', cookieFor(admin)).send({
      clientName: 'Walk In', clientPhone: 'no-es-un-numero', clientEmail: 'walkin1@test.local',
      serviceId: svc.id, professionalId: pro.id, date: futureWeekDay(1), time: '10:00',
    })
    expect(res.status).toBe(400)
    expect(await prisma.appointment.count()).toBe(0)
    expect(await prisma.user.count({ where: { email: 'walkin1@test.local' } })).toBe(0)
  })
})

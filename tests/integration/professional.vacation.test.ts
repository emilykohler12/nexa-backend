import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createAdminUser, createProfessionalUser, createClientUser } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// ─── RF-29: la profesional carga y edita sus propias vacaciones ─────────────────────────────────────

describe('RF-29: vacaciones de la profesional', () => {
  const patchMine = (pro: { id: string; email: string; role: string }, body: object) =>
    request(app).patch('/api/professionals/profile').set('Cookie', cookieFor(pro)).send(body)
  const vacationOf = async (userId: string) => {
    const row = await prisma.professional.findUnique({ where: { userId } })
    return { from: row?.vacationFrom?.toISOString().slice(0, 10) ?? null, to: row?.vacationTo?.toISOString().slice(0, 10) ?? null }
  }

  it('la profesional carga sus vacaciones y las ve en su perfil', async () => {
    const pro = await createProfessionalUser()
    const res = await patchMine(pro, { vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    expect(res.status).toBe(200)
    expect(res.body.profile.vacationFrom).toBe('2027-01-10')
    expect(res.body.profile.vacationTo).toBe('2027-01-24')
    expect(await vacationOf(pro.id)).toEqual({ from: '2027-01-10', to: '2027-01-24' })

    const mine = await request(app).get('/api/professionals/profile').set('Cookie', cookieFor(pro))
    expect(mine.body.profile.vacationFrom).toBe('2027-01-10')
  })

  it('las edita y las borra con null', async () => {
    const pro = await createProfessionalUser()
    await patchMine(pro, { vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    await patchMine(pro, { vacationTo: '2027-02-01' })
    expect(await vacationOf(pro.id)).toEqual({ from: '2027-01-10', to: '2027-02-01' })

    const cleared = await patchMine(pro, { vacationFrom: null, vacationTo: null })
    expect(cleared.status).toBe(200)
    expect(await vacationOf(pro.id)).toEqual({ from: null, to: null })
  })

  it('un PATCH sin vacaciones no las toca', async () => {
    const pro = await createProfessionalUser()
    await patchMine(pro, { vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    await patchMine(pro, { bio: 'Hola' })
    expect(await vacationOf(pro.id)).toEqual({ from: '2027-01-10', to: '2027-01-24' })
  })

  it('rechaza un inicio posterior al fin (400 VALIDATION_ERROR) y no guarda nada', async () => {
    const pro = await createProfessionalUser()
    const res = await patchMine(pro, { vacationFrom: '2027-02-10', vacationTo: '2027-02-01' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await vacationOf(pro.id)).toEqual({ from: null, to: null })
  })

  it('valida contra lo ya guardado cuando solo viene una de las dos fechas', async () => {
    const pro = await createProfessionalUser()
    await patchMine(pro, { vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    const res = await patchMine(pro, { vacationFrom: '2027-03-01' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(await vacationOf(pro.id)).toEqual({ from: '2027-01-10', to: '2027-01-24' })
  })

  it('rechaza una sola fecha y un formato inválido', async () => {
    const pro = await createProfessionalUser()
    const one = await patchMine(pro, { vacationFrom: '2027-01-10' })
    expect(one.status).toBe(400)
    expect(one.body.code).toBe('VALIDATION_ERROR')
    const bad = await patchMine(pro, { vacationFrom: '10/01/2027', vacationTo: '2027-01-24' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('VALIDATION_ERROR')
  })

  it('nunca toca las de otra profesional: el id de la sesión manda, aunque el pedido traiga otro', async () => {
    const mine  = await createProfessionalUser()
    const other = await createProfessionalUser()
    await prisma.professional.upsert({
      where: { userId: other.id }, create: { userId: other.id, vacationFrom: new Date('2027-05-01'), vacationTo: new Date('2027-05-10') },
      update: { vacationFrom: new Date('2027-05-01'), vacationTo: new Date('2027-05-10') },
    })
    const res = await patchMine(mine, { userId: other.id, id: other.id, vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    expect(res.status).toBe(200)
    expect(await vacationOf(other.id)).toEqual({ from: '2027-05-01', to: '2027-05-10' })
    expect(await vacationOf(mine.id)).toEqual({ from: '2027-01-10', to: '2027-01-24' })
  })

  it('una clienta no puede usar la ruta, y el administrador sigue editándolas con la misma validación', async () => {
    const client = await createClientUser()
    const denied = await request(app).patch('/api/professionals/profile').set('Cookie', cookieFor(client)).send({ vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    expect(denied.status).toBe(403)

    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()
    const ok = await request(app).patch(`/api/professionals/${pro.id}`).set('Cookie', cookieFor(admin)).send({ vacationFrom: '2027-01-10', vacationTo: '2027-01-24' })
    expect(ok.status).toBe(200)
    expect(ok.body.professional.vacationFrom).toBe('2027-01-10')
    const bad = await request(app).patch(`/api/professionals/${pro.id}`).set('Cookie', cookieFor(admin)).send({ vacationFrom: '2027-02-10', vacationTo: '2027-02-01' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('VALIDATION_ERROR')
  })
})

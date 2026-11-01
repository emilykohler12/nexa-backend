import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { mailProvider } from '../../src/modules/auth/providers/mail.provider'
import { createClientUser, createProfessionalUser, createAdminUser, createService } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// RF-28: galería de fotos antes/después de cada clienta (alta, edición y baja del administrador) y fotos públicas
// de la home, sin datos de la clienta. RF-29: perfil, servicios, franjas y onboarding de la profesional, y el envío
// de la invitación del administrador.

type U = { id: string; email: string; role: string }

const photoUrl = (n: number) => `https://storage.test.local/galeria/foto-${n}.jpg`

describe('RF-28: galería', () => {
  const add = (admin: U, clientId: string, body: object) =>
    request(app).post(`/api/admin/clients/${clientId}/gallery`).set('Cookie', cookieFor(admin)).send(body)

  it('el administrador agrega, edita y borra fotos de una clienta', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()

    const created = await add(admin, client.id, { url: photoUrl(1), category: 'before' })
    expect(created.status).toBe(201)
    expect(created.body.photo).toMatchObject({ url: photoUrl(1), category: 'before', showOnHome: false })

    const id = created.body.photo.id
    const edited = await request(app).patch(`/api/admin/clients/${client.id}/gallery/${id}`).set('Cookie', cookieFor(admin))
      .send({ category: 'after', showOnHome: true })
    expect(edited.status).toBe(200)
    expect(edited.body.photo).toMatchObject({ category: 'after', showOnHome: true })

    const list = await request(app).get(`/api/admin/clients/${client.id}/gallery`).set('Cookie', cookieFor(admin))
    expect(list.body.photos).toHaveLength(1)

    const removed = await request(app).delete(`/api/admin/clients/${client.id}/gallery/${id}`).set('Cookie', cookieFor(admin))
    expect(removed.status).toBe(200)
    expect(await prisma.clientGalleryPhoto.count()).toBe(0)
  })

  it('el alta valida la URL y la categoría, y la foto tiene que ser de esa clienta', async () => {
    const admin  = await createAdminUser()
    const client = await createClientUser()
    const other  = await createClientUser()
    const pro    = await createProfessionalUser()

    expect((await add(admin, client.id, { url: '', category: 'before' })).status).toBe(400)
    expect((await add(admin, client.id, { url: photoUrl(1), category: 'durante' })).status).toBe(400)
    expect((await add(admin, pro.id, { url: photoUrl(1), category: 'before' })).status).toBe(404)

    const photo = (await add(admin, client.id, { url: photoUrl(2), category: 'before' })).body.photo
    const wrongOwner = await request(app).delete(`/api/admin/clients/${other.id}/gallery/${photo.id}`).set('Cookie', cookieFor(admin))
    expect(wrongOwner.status).toBe(404)
    expect(await prisma.clientGalleryPhoto.count()).toBe(1)
  })

  it('las fotos públicas son solo las marcadas para la home, en pares antes/después y sin datos de la clienta', async () => {
    const a = await createClientUser({ name: 'Nombre Privado' })
    const b = await createClientUser()
    const at = (s: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, s))
    await prisma.clientGalleryPhoto.createMany({
      data: [
        { clientId: a.id, url: photoUrl(1), category: 'before', showOnHome: true, createdAt: at(1) },
        { clientId: a.id, url: photoUrl(2), category: 'after', showOnHome: true, createdAt: at(2) },
        { clientId: a.id, url: photoUrl(3), category: 'after', showOnHome: false, createdAt: at(3) },
        { clientId: b.id, url: photoUrl(4), category: 'after', showOnHome: true, createdAt: at(4) },
      ],
    })

    const res = await request(app).get('/api/gallery/public')

    expect(res.status).toBe(200)
    expect(res.body.pairs).toHaveLength(2)
    expect(res.body.pairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ before: photoUrl(1), after: photoUrl(2) }),
      expect.objectContaining({ before: null, after: photoUrl(4) }),
    ]))
    const body = JSON.stringify(res.body)
    expect(body).not.toContain(photoUrl(3))
    expect(body).not.toContain(a.id)
    expect(body).not.toContain('Nombre Privado')
  })

  it('la gestión de la galería es solo del administrador', async () => {
    const client = await createClientUser()
    const pro    = await createProfessionalUser()

    expect((await add(pro, client.id, { url: photoUrl(1), category: 'before' })).status).toBe(403)
    expect((await add(client, client.id, { url: photoUrl(1), category: 'before' })).status).toBe(403)
    expect((await request(app).get(`/api/admin/clients/${client.id}/gallery`).set('Cookie', cookieFor(pro))).status).toBe(403)
  })
})

describe('RF-29: autogestión de la profesional', () => {
  it('lee y actualiza su perfil', async () => {
    const pro = await createProfessionalUser({ name: 'Profesional Perfil' })

    const updated = await request(app).patch('/api/professional/profile').set('Cookie', cookieFor(pro)).send({
      name: 'Profesional Perfil Editado', phone: '3764123456', bio: 'Especialista en uñas', specialty: 'Uñas',
      yearsExperience: 6, languages: 'Español, Portugués', instagram: '@perfil.test', toleranceMinutes: 10,
    })
    expect(updated.status).toBe(200)

    const res = await request(app).get('/api/professional/profile').set('Cookie', cookieFor(pro))
    expect(res.body.profile).toMatchObject({
      name: 'Profesional Perfil Editado', phone: '3764123456', bio: 'Especialista en uñas', specialty: 'Uñas',
      yearsExperience: 6, languages: 'Español, Portugués', instagram: '@perfil.test', toleranceMinutes: 10,
    })
  })

  it('un teléfono que no es un celular argentino se rechaza y no cambia nada', async () => {
    const pro = await createProfessionalUser({ name: 'Profesional Teléfono' })

    const res = await request(app).patch('/api/professional/profile').set('Cookie', cookieFor(pro)).send({ name: 'Otro nombre', phone: '123' })

    expect(res.status).toBe(400)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pro.id } })).name).toBe('Profesional Teléfono')
  })

  it('elige los servicios que hace: activa, pausa y quita', async () => {
    const pro = await createProfessionalUser()
    const a   = await createService({ name: 'Manicura', price: 9000, duration: 45 })
    const b   = await createService({ name: 'Pedicura' })
    const patch = (services: object[]) => request(app).patch('/api/professional/services').set('Cookie', cookieFor(pro)).send({ services })

    const both = await patch([{ serviceId: a.id, status: 'active' }, { serviceId: b.id, status: 'inactive' }])
    expect(both.status).toBe(200)
    expect(both.body.services).toEqual(expect.arrayContaining([
      { serviceId: a.id, status: 'active', ownPrice: 9000, ownDuration: 45 },
      expect.objectContaining({ serviceId: b.id, status: 'inactive' }),
    ]))

    const onlyA = await patch([{ serviceId: a.id, status: 'active' }])
    expect(onlyA.body.services.map((s: { serviceId: string }) => s.serviceId)).toEqual([a.id])
    const pub = await request(app).get('/api/professionals/public').query({ serviceId: a.id })
    expect(pub.body.professionals.map((p: { id: string }) => p.id)).toEqual([pro.id])
  })

  it('carga sus franjas (más de una por día) y un día sin franja queda sin atención', async () => {
    const pro = await createProfessionalUser()

    const res = await request(app).patch('/api/professional/schedule').set('Cookie', cookieFor(pro)).send({
      availability: { monday: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }], tuesday: null },
    })

    expect(res.status).toBe(200)
    const professional = await prisma.professional.findUniqueOrThrow({ where: { userId: pro.id }, include: { availability: true } })
    const byDay = (d: number) => professional.availability.filter(a => a.dayOfWeek === d).map(a => `${a.startTime}-${a.endTime}`).sort()
    expect(byDay(0)).toEqual(['08:00-12:00', '14:00-20:00'])
    expect(byDay(1)).toEqual([])
    expect(byDay(2)).toEqual(['00:00-24:00']) // los días que no vienen no se tocan
  })

  it('completa el onboarding: guarda perfil, franjas y servicios, y queda marcado como completo', async () => {
    const pro = await createProfessionalUser()
    const svc = await createService({ name: 'Peinado' })
    expect((await request(app).get('/api/professional/onboarding/status').set('Cookie', cookieFor(pro))).body).toEqual({ profileComplete: false })

    const res = await request(app).post('/api/professional/onboarding').set('Cookie', cookieFor(pro)).send({
      personal: { name: 'Profesional Onboarding', phone: '3764555666', bio: 'Peinados de fiesta' },
      work: { specialty: 'Cabello', yearsExperience: 3, languages: 'Español' },
      availability: { friday: [{ start: '10:00', end: '18:00' }] },
      services: [{ serviceId: svc.id, ownPrice: 15000, ownDuration: 50 }],
      policies: { toleranceMinutes: 15, cancellationPolicy: 'Avisar con 24 horas' },
    })

    expect(res.status).toBe(200)
    expect((await request(app).get('/api/professional/onboarding/status').set('Cookie', cookieFor(pro))).body).toEqual({ profileComplete: true })
    const profile = (await request(app).get('/api/professional/profile').set('Cookie', cookieFor(pro))).body.profile
    expect(profile).toMatchObject({ name: 'Profesional Onboarding', specialty: 'Cabello', yearsExperience: 3, toleranceMinutes: 15, cancellationPolicy: 'Avisar con 24 horas' })
    expect(profile.availability).toEqual(expect.arrayContaining([{ dayOfWeek: 4, startTime: '10:00', endTime: '18:00' }]))
    const link = await prisma.professionalService.findFirstOrThrow({ where: { serviceId: svc.id } })
    expect(Number(link.ownPrice)).toBe(15000)
    expect(link.ownDuration).toBe(50)
  })

  it('perfil, servicios, franjas y onboarding son solo de la profesional', async () => {
    const client = await createClientUser()
    for (const [method, url] of [['get', '/api/professional/profile'], ['patch', '/api/professional/services'], ['patch', '/api/professional/schedule'], ['post', '/api/professional/onboarding']] as const) {
      expect((await request(app)[method](url).set('Cookie', cookieFor(client)).send({})).status, url).toBe(403)
    }
  })
})

describe('RF-29: envío de la invitación', () => {
  beforeEach(() => { vi.mocked(mailProvider.send).mockClear() })

  it('el administrador invita por mail: se guarda la invitación y sale el mail con el link de registro', async () => {
    const admin = await createAdminUser()

    const res = await request(app).post('/api/invitations').set('Cookie', cookieFor(admin)).send({ email: 'nueva.profesional@test.local' })

    expect(res.status).toBe(201)
    expect(typeof res.body.token).toBe('string')
    const invitation = await prisma.invitation.findFirstOrThrow()
    expect(invitation).toMatchObject({ email: 'nueva.profesional@test.local', used: false, sentById: admin.id })
    expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now())
    const [to, subject, html] = vi.mocked(mailProvider.send).mock.calls[0]
    expect(to).toBe('nueva.profesional@test.local')
    expect(subject).toBe('Invitación para unirte como profesional — Nexa')
    expect(html).toContain(`/registro-profesional?token=${res.body.token}`)

    const valid = await request(app).get('/api/invitations/validate').query({ token: res.body.token })
    expect(valid.body).toMatchObject({ email: 'nueva.profesional@test.local' })
  })

  it('valida el email y es solo del administrador', async () => {
    const admin = await createAdminUser()
    const pro   = await createProfessionalUser()

    const invalid = await request(app).post('/api/invitations').set('Cookie', cookieFor(admin)).send({ email: 'no-es-un-mail' })
    expect(invalid.status).toBe(400)
    expect(invalid.body.code).toBe('VALIDATION_ERROR')
    expect((await request(app).post('/api/invitations').set('Cookie', cookieFor(pro)).send({ email: 'x@test.local' })).status).toBe(403)
    expect(await prisma.invitation.count()).toBe(0)
    expect(mailProvider.send).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { socialProvider } from '../../src/modules/auth/providers/social.provider'
import { createClientUser, createProfessionalUser } from '../helpers/factories'

describe('login social (Google/Facebook)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea una cuenta nueva en modo registro si aceptó los términos', async () => {
    vi.mocked(socialProvider.verifyGoogle).mockResolvedValue({
      email: 'nueva.social@test.local', name: 'Nueva Social', picture: 'https://x/foto.jpg',
    })

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'google', accessToken: 'token-valido-de-google', mode: 'register', termsAccepted: true,
    })

    expect(res.status).toBe(201)
    expect(res.body.created).toBe(true)
    expect(res.body.user.email).toBe('nueva.social@test.local')
    expect(res.body.user.role).toBe('client')

    const dbUser = await prisma.user.findUnique({ where: { email: 'nueva.social@test.local' } })
    expect(dbUser?.emailVerified).toBe(true) // ya lo verificó Google, no hace falta mail
  })

  it('rechaza crear una cuenta nueva sin haber aceptado los términos', async () => {
    vi.mocked(socialProvider.verifyGoogle).mockResolvedValue({
      email: 'sinaceptar@test.local', name: 'Sin Aceptar', picture: null,
    })

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'google', accessToken: 'token-valido', mode: 'register', termsAccepted: false,
    })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TERMS_NOT_ACCEPTED')
  })

  it('en modo login, si no existe la cuenta, no la crea — pide que se registre', async () => {
    vi.mocked(socialProvider.verifyGoogle).mockResolvedValue({
      email: 'no.existe.aun@test.local', name: 'Nadie', picture: null,
    })

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'google', accessToken: 'token-valido', mode: 'login',
    })

    expect(res.status).toBe(404)
    expect(res.body.code).toBe('SOCIAL_ACCOUNT_NOT_FOUND')
    const dbUser = await prisma.user.findUnique({ where: { email: 'no.existe.aun@test.local' } })
    expect(dbUser).toBeNull()
  })

  it('si ya existe una cuenta con ese email, loguea en vez de crear otra', async () => {
    const existing = await createClientUser({ email: 'ya.existe@test.local', name: 'Ya Existe' })
    vi.mocked(socialProvider.verifyFacebook).mockResolvedValue({
      email: 'ya.existe@test.local', name: 'Nombre distinto en Facebook', picture: null,
    })

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'facebook', accessToken: 'token-valido-de-facebook', mode: 'register', termsAccepted: true,
    })

    expect(res.status).toBe(200)
    expect(res.body.created).toBe(false)
    expect(res.body.user.id).toBe(existing.id)
    // No pisa el nombre real de la cuenta con lo que vino de Facebook.
    expect(res.body.user.name).toBe('Ya Existe')
  })

  it('rechaza el login social de una cuenta que no es de clienta (profesional/admin)', async () => {
    const pro = await createProfessionalUser({ email: 'pro.social@test.local' })
    vi.mocked(socialProvider.verifyGoogle).mockResolvedValue({
      email: 'pro.social@test.local', name: pro.name, picture: null,
    })

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'google', accessToken: 'token-valido', mode: 'login',
    })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('SOCIAL_LOGIN_WRONG_ROLE')
  })

  it('devuelve 401 (no 500) si el token es inválido/expiró', async () => {
    vi.mocked(socialProvider.verifyGoogle).mockRejectedValue(new Error('Token de Google inválido o expirado'))

    const res = await request(app).post('/api/auth/social-login').send({
      provider: 'google', accessToken: 'token-basura', mode: 'login',
    })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('SOCIAL_TOKEN_INVALID')
  })

  it('rechaza el body si falta el accessToken', async () => {
    const res = await request(app).post('/api/auth/social-login').send({ provider: 'google', mode: 'login' })
    expect(res.status).toBe(422)
  })
})

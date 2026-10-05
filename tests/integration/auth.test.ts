import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, TEST_PASSWORD } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

describe('auth', () => {
  it('registra una clienta nueva y devuelve cookies de sesión', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name:     'Nueva',
      lastName: 'Clienta',
      phone:    '1155550000',
      email:    'nueva@test.local',
      password: 'Password123',
      termsAccepted: true,
    })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('nueva@test.local')
    expect(res.body.user.name).toBe('Nueva')
    expect(res.body.user.lastName).toBe('Clienta')
    expect(res.body.user.role).toBe('client')
    expect(res.headers['set-cookie']).toBeDefined()
    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true)
  })

  it('rechaza el registro con un email ya usado', async () => {
    await createClientUser({ email: 'repetido@test.local' })
    const res = await request(app).post('/api/auth/register').send({
      name: 'Otra', lastName: 'Persona', phone: '1155550001', email: 'repetido@test.local', password: 'Password123', termsAccepted: true,
    })
    expect(res.status).toBe(409)
  })

  // RF-02 — el alta exige nombre, apellido y teléfono celular por separado.
  it('rechaza el registro sin apellido', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sin', phone: '1155550002', email: 'sinapellido@test.local', password: 'Password123', termsAccepted: true,
    })
    expect(res.status).toBe(422)
    expect(await prisma.user.count({ where: { email: 'sinapellido@test.local' } })).toBe(0)
  })

  it('rechaza el registro sin teléfono', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sin', lastName: 'Telefono', email: 'sintelefono@test.local', password: 'Password123', termsAccepted: true,
    })
    expect(res.status).toBe(422)
    expect(await prisma.user.count({ where: { email: 'sintelefono@test.local' } })).toBe(0)
  })

  it('guarda nombre y apellido en columnas separadas', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ana', lastName: 'Pérez', phone: '1155550003', email: 'ana@test.local', password: 'Password123', termsAccepted: true,
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@test.local' } })
    expect(user.name).toBe('Ana')
    expect(user.lastName).toBe('Pérez')
    expect(user.phone).toBe('1155550003')
  })

  it('rechaza el registro sin aceptar términos', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sin', lastName: 'Terminos', phone: '1155550004', email: 'sinterminos@test.local', password: 'Password123', termsAccepted: false,
    })
    expect(res.status).toBe(422)
  })

  it('loguea con credenciales correctas', async () => {
    await createClientUser({ email: 'login@test.local' })
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.local', password: TEST_PASSWORD,
    })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('login@test.local')
  })

  it('rechaza login con contraseña incorrecta', async () => {
    await createClientUser({ email: 'malapass@test.local' })
    const res = await request(app).post('/api/auth/login').send({
      email: 'malapass@test.local', password: 'ContraseñaMala1',
    })
    expect(res.status).toBe(401)
  })

  it('rechaza login de un usuario inexistente', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'noexiste@test.local', password: 'Password123',
    })
    expect(res.status).toBe(401)
  })

  it('/me devuelve 401 sin cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('/me devuelve el usuario autenticado con una cookie válida', async () => {
    const client = await createClientUser({ email: 'yo@test.local' })
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor(client))
    expect(res.status).toBe(200)
    expect(res.body.user.id).toBe(client.id)
  })

  it('/me devuelve 401 con un token inválido', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'access_token=esto-no-es-un-jwt')
    expect(res.status).toBe(401)
  })

  it('una clienta no puede entrar a rutas de admin', async () => {
    const client = await createClientUser()
    const res = await request(app).get('/api/admin/clients').set('Cookie', cookieFor(client))
    expect(res.status).toBe(403)
  })

  it('una profesional no puede entrar a rutas de admin', async () => {
    const pro = await createProfessionalUser()
    const res = await request(app).get('/api/admin/clients').set('Cookie', cookieFor(pro))
    expect(res.status).toBe(403)
  })

  it('un usuario inactivo no puede loguearse', async () => {
    await createClientUser({ email: 'inactiva@test.local', active: false })
    const res = await request(app).post('/api/auth/login').send({
      email: 'inactiva@test.local', password: TEST_PASSWORD,
    })
    expect(res.status).toBe(401)
  })
})

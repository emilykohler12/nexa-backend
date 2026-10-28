import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { app } from '../../src/app/app'
import { createClientUser, createAdminUser, TEST_PASSWORD } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// Endurecimiento: límite de intentos de login por cuenta y validación del contenido de las
// imágenes subidas (no alcanza con el tipo que declara el cliente).

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password })

describe('límite de intentos fallidos de login por cuenta', () => {
  it('bloquea con 429 después de 10 contraseñas incorrectas, aunque la correcta ya no entre', async () => {
    const client = await createClientUser({ email: `lock.${randomUUID().slice(0, 8)}@test.local` })

    for (let i = 0; i < 10; i++) {
      expect((await login(client.email, 'incorrecta')).status).toBe(401)
    }

    const blocked = await login(client.email, TEST_PASSWORD)
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS')
  })

  it('no afecta a otra cuenta', async () => {
    const a = await createClientUser({ email: `a.${randomUUID().slice(0, 8)}@test.local` })
    const b = await createClientUser({ email: `b.${randomUUID().slice(0, 8)}@test.local` })

    for (let i = 0; i < 10; i++) await login(a.email, 'incorrecta')

    expect((await login(b.email, TEST_PASSWORD)).status).toBe(200)
  })

  it('los logins exitosos no cuentan', async () => {
    const client = await createClientUser({ email: `ok.${randomUUID().slice(0, 8)}@test.local` })
    for (let i = 0; i < 12; i++) {
      expect((await login(client.email, TEST_PASSWORD)).status).toBe(200)
    }
  })
})

describe('subida de imágenes', () => {
  const upload = (cookie: string, buffer: Buffer, mimetype: string, filename = 'a.bin') =>
    request(app)
      .post('/api/uploads/image')
      .set('Cookie', cookie)
      .attach('file', buffer, { filename, contentType: mimetype })

  it('rechaza un archivo que dice ser PNG pero no lo es', async () => {
    const client = await createClientUser()
    const res = await upload(cookieFor(client), Buffer.from('<html><script>alert(1)</script></html>'), 'image/png', 'a.png')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE_CONTENT')
  })

  it('rechaza un ejecutable disfrazado de JPG', async () => {
    const client = await createClientUser()
    const res = await upload(cookieFor(client), Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'image/jpeg', 'a.jpg')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE_CONTENT')
  })

  it('rechaza un tipo que no es imagen', async () => {
    const client = await createClientUser()
    const res = await upload(cookieFor(client), Buffer.from('hola'), 'text/html', 'a.html')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('UNSUPPORTED_IMAGE_TYPE')
  })

  it('una clienta no puede subir SVG', async () => {
    const client = await createClientUser()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')
    const res = await upload(cookieFor(client), svg, 'image/svg+xml', 'a.svg')
    expect(res.status).toBe(403)
  })

  it('el admin no puede subir un SVG con script', async () => {
    const admin = await createAdminUser()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const res = await upload(cookieFor(admin), svg, 'image/svg+xml', 'a.svg')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_IMAGE_CONTENT')
  })

  it('el admin no puede subir un SVG con manejador de eventos', async () => {
    const admin = await createAdminUser()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')
    const res = await upload(cookieFor(admin), svg, 'image/svg+xml', 'a.svg')
    expect(res.status).toBe(400)
  })

  it('sin sesión no se puede subir nada', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'a.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(401)
  })
})

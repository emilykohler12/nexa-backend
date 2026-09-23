import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'

describe('checklist de seguridad', () => {
  it('GET /api/health confirma que la app y la base de datos están arriba', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('GET /health (sin /api) redirige al health check real', async () => {
    const res = await request(app).get('/health')
    expect([200, 307]).toContain(res.status)
  })

  it('toda respuesta trae las cabeceras de seguridad esperadas', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['content-security-policy']).toBeDefined()
    expect(res.headers['strict-transport-security']).toBeDefined()
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('un error no controlado nunca expone el mensaje crudo ni el stack al cliente', async () => {
    // No hay forma linda de forzar un 500 real desde afuera sin acoplarse a
    // implementación — se prueba el contrato directo del middleware.
    const { errorHandler } = await import('../../src/app/middlewares/errorHandler')
    const req: any = {}
    let statusCode = 0
    let body: any = null
    const res: any = {
      status(code: number) { statusCode = code; return this },
      json(payload: any) { body = payload; return this },
    }
    const dbError = new Error('password authentication failed for user "kologic" at /app/src/foo.ts:42')
    errorHandler(dbError, req, res, () => {})

    expect(statusCode).toBe(500)
    expect(body.error).toBe('Error interno del servidor')
    expect(JSON.stringify(body)).not.toContain('kologic')
    expect(JSON.stringify(body)).not.toContain('foo.ts')
  })

  it('una ruta que no existe da 404 genérico, sin filtrar rutas internas', async () => {
    const res = await request(app).get('/api/esto-no-existe-nunca')
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|node_modules|\.ts:\d+/i)
  })
})

describe('sanity: helper de conexión a la base sigue vivo después de estos tests', () => {
  it('la app puede seguir consultando la base normalmente', async () => {
    const count = await prisma.user.count()
    expect(typeof count).toBe('number')
  })
})

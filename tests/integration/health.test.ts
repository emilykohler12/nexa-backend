import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'

// Prueba de failover: qué pasa si la base de datos deja de responder mientras
// el servidor ya está arriba (no al arrancar, eso ya lo prueba el startup real
// — acá el proceso sigue vivo y cada request individual falla prolijo).
describe('health check ante una caída de la base de datos', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('responde 200 con la base arriba', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('responde 503 (no 500 ni cuelgue) si la base no responde, y el proceso sigue vivo', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))

    const res = await request(app).get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ status: 'error', database: 'down' })

    // El siguiente request (base ya recuperada) vuelve a andar solo, sin
    // reiniciar nada — confirma que un blip de conexión no tira el proceso.
    const recovered = await request(app).get('/api/health')
    expect(recovered.status).toBe(200)
  })
})

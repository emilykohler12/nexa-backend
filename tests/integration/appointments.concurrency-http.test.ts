import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import { app } from '../../src/app/app'
import { prisma } from '../../src/app/database/prisma'
import { createClientUser, createProfessionalUser, createService, tomorrowStr } from '../helpers/factories'
import { cookieFor } from '../helpers/auth'

// R-01 / RF-01 a nivel API: el índice único parcial appointments_professional_date_time_active_key es la garantía
// (no hay consulta previa). El ensayo del 14/11/2026 lo probó con dos sesiones SQL; este lo prueba con dos pedidos
// HTTP reales (sockets, no supertest en memoria) que llegan a la vez al mismo servidor Express.
const RONDAS = 20

let server: http.Server
let baseUrl: string

beforeAll(async () => {
  server = http.createServer(app)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()))
})

function reservar(cookie: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/client/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: (await r.json().catch(() => ({}))) as any }))
}

describe('R-01 concurrencia a nivel API (dos pedidos HTTP a la vez)', () => {
  it(`R-01 dos clientas reservan a la vez la misma profesional, fecha y hora: ${RONDAS} rondas, siempre un turno y un 409, sin 500`, async () => {
    const [{ v: pgVersion }] = await prisma.$queryRawUnsafe<{ v: string }[]>('select version() as v')
    const pro = await createProfessionalUser()
    const svc = await createService({ price: 12000 })
    const ana = await createClientUser({ name: 'Ana Concurrente', email: 'ana.conc@test.local' })
    const bea = await createClientUser({ name: 'Bea Concurrente', email: 'bea.conc@test.local' })

    const resultados: { ronda: number; fecha: string; estados: number[]; codigos: string[]; activas: number; ok: boolean }[] = []

    for (let i = 1; i <= RONDAS; i++) {
      const fecha = tomorrowStr(i)
      const payload = { serviceId: svc.id, professionalId: pro.id, date: fecha, time: '10:00', termsAccepted: true }
      const [a, b] = await Promise.all([reservar(cookieFor(ana), payload), reservar(cookieFor(bea), payload)])

      const estados = [a.status, b.status].sort((x, y) => x - y)
      const perdedora = a.status === 201 ? b : a
      const activas = await prisma.appointment.count({
        where: { professionalId: pro.id, date: fecha, time: '10:00', status: { notIn: ['cancelled', 'cancelled_no_show'] } },
      })
      const ok = estados[0] === 201 && estados[1] === 409 && perdedora.body.code === 'PROFESSIONAL_SLOT_TAKEN' && activas === 1
      resultados.push({ ronda: i, fecha, estados, codigos: [a.body.code ?? '-', b.body.code ?? '-'], activas, ok })
    }

    const salio_bien = resultados.filter(r => r.ok).length
    const con500 = resultados.filter(r => r.estados.some(s => s >= 500)).length
    const resumen = { postgres: pgVersion, rondas: RONDAS, salio_bien, con500, resultados }
    if (process.env.ENSAYO_OUT) fs.writeFileSync(process.env.ENSAYO_OUT, JSON.stringify(resumen, null, 2))
    console.log(`[ensayo-http] ${pgVersion.split(',')[0]} · ${salio_bien}/${RONDAS} rondas bien · rondas con 500: ${con500}`)

    expect(con500).toBe(0)
    expect(resultados.filter(r => !r.ok)).toEqual([])
    expect(salio_bien).toBe(RONDAS)
    const total = await prisma.appointment.count({ where: { professionalId: pro.id } })
    expect(total).toBe(RONDAS)
  })
})

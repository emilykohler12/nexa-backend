# Ensayo de concurrencia a nivel API (dos pedidos HTTP simultáneos)

- **Fecha de ejecución:** 15/11/2026
- **Base:** PostgreSQL 16.16 (contenedor Docker `postgres:16`, descartable, puerto 5444; mismo major que el CI), con el esquema real: `prisma migrate deploy` aplicó las **63 migraciones** y el índice parcial `appointments_professional_date_time_active_key` existe. No se usó Supabase ni producción.
- **Backend:** rama `test/cierre-pruebas-ae4` (código de producción sin cambios), Express levantado en un puerto real (`http.createServer(app)`, no supertest en memoria), pedidos con `fetch` en `Promise.all`.
- **Ruta ensayada:** `POST /api/client/appointments` (la ruta de reserva de la clienta; `/api/appointments` no existe como ruta del backend). Misma profesional, misma fecha y misma hora, dos clientas distintas, `termsAccepted: true`.
- **Diferencia con el ensayo del 14/11/2026:** aquel fue de dos sesiones SQL sobre el índice; este pasa por el controlador, el servicio y `isSlotConflict()`.

## Resultado

| Dato | Valor |
|---|---|
| Rondas | 20 (una fecha distinta por ronda, misma hora 10:00) |
| Rondas que salieron bien | **20 de 20** |
| Combinación de respuestas | siempre una `201` y una `409 PROFESSIONAL_SLOT_TAKEN` |
| Respuestas 500 | 0 |
| Filas activas por ronda | 1 en las 20 |
| Filas totales de la profesional | 20 (ni una de más) |

«Salió bien» = exactamente un 201 + un 409 con `code = PROFESSIONAL_SLOT_TAKEN` + una sola fila activa en la base para ese horario.

Salida de la prueba (`ENSAYO_OUT`):

```
postgres: PostgreSQL 16.16 (Debian 16.16-1.pgdg13+1) on x86_64-pc-linux-gnu
rondas: 20 · salio_bien: 20 · con500: 0
ronda  1  2026-11-16  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  2  2026-11-17  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  3  2026-11-18  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  4  2026-11-19  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  5  2026-11-20  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  6  2026-11-21  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  7  2026-11-22  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda  8  2026-11-23  estados=201+409  codigos=PROFESSIONAL_SLOT_TAKEN,-  activas=1  ok=true
ronda  9  2026-11-24  estados=201+409  codigos=PROFESSIONAL_SLOT_TAKEN,-  activas=1  ok=true
ronda 10  2026-11-25  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 11  2026-11-26  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 12  2026-11-27  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 13  2026-11-28  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 14  2026-11-29  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 15  2026-11-30  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 16  2026-12-01  estados=201+409  codigos=PROFESSIONAL_SLOT_TAKEN,-  activas=1  ok=true
ronda 17  2026-12-02  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 18  2026-12-03  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 19  2026-12-04  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
ronda 20  2026-12-05  estados=201+409  codigos=-,PROFESSIONAL_SLOT_TAKEN  activas=1  ok=true
```

## Cómo repetirlo

La prueba está en el repositorio y corre en el CI con el resto de la suite (`postgres:16`, ver `.github/workflows/ci.yml`):

```bash
npx cross-env NODE_ENV=test vitest run tests/integration/appointments.concurrency-http.test.ts
```

## Script (`tests/integration/appointments.concurrency-http.test.ts`)

```ts
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
```

## Límite

Que 20 de 20 rondas salgan bien es evidencia de que el índice resuelve la carrera, no una prueba exhaustiva: la garantía es el índice, no el orden de llegada. No cubre solapamientos por duración (limitación conocida de R-01, RF-01).

// src/app/utils/partial.ts
//
// Ayudas para los PUT/PATCH parciales y los 404 de los módulos del catálogo.
import { AppError } from '../middlewares/errorHandler'
import { HTTP } from '../constants/http'

/**
 * Deja solo las claves que el pedido trajo de verdad. En zod 4, `schema.partial()`
 * igual completa los `.default(...)` de los campos ausentes, así que un PUT parcial
 * pisaba (por ejemplo) status o isCombo con su valor por defecto.
 */
export function pickPresent<T extends Record<string, any>>(parsed: T, body: unknown): Partial<T> {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const out: Partial<T> = {}
  for (const key of Object.keys(parsed) as (keyof T)[]) {
    if (raw[key as string] !== undefined) out[key] = parsed[key]
  }
  return out
}

/** Prisma P2025: el registro a actualizar o borrar no existe. */
export function isRecordNotFound(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2025'
}

/** Ejecuta una escritura de Prisma y traduce P2025 a 404 en vez de dejar que salga un 500. */
export async function orNotFound<T>(op: Promise<T>, message: string): Promise<T> {
  try {
    return await op
  } catch (err) {
    if (isRecordNotFound(err)) throw new AppError(HTTP.NOT_FOUND, message, 'NOT_FOUND')
    throw err
  }
}

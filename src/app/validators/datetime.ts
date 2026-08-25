// src/app/validators/datetime.ts
import { z } from 'zod'

// Rechaza fechas con formato correcto pero calendario inválido (ej. 2026-02-30),
// sin pasar por Date#toISOString (que desplaza por zona horaria).
function isValidCalendarDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato esperado: YYYY-MM-DD)')
  .refine(isValidCalendarDate, 'Fecha inválida')

export const timeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato esperado: HH:mm)')

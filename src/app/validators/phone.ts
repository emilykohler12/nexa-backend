// src/app/validators/phone.ts
import { z } from 'zod'
import { AppError } from '../middlewares/errorHandler'
import { HTTP } from '../constants/http'

// RF-02: celular argentino. Se acepta con o sin +54, con o sin el 9 de los celulares, con o sin el 0 del
// código de área y con o sin el 15, y con espacios, guiones o paréntesis. El código de área empieza con
// 1, 2 o 3 (11, 2xx, 3xx), así que el 54, el 9 y el 0 de adelante no se pueden confundir con él.
const MOBILE_SHAPE = /^(?:\+?54)?9?0?[1-3]\d{1,3}(?:15)?\d{6,8}$/

export const PHONE_MESSAGE = 'Ingresá un celular argentino válido, por ejemplo 11 2345-6789'

// Se guarda tal cual lo escribió la persona (solo trim): acá solo se valida.
export function isArgentineMobile(value: string): boolean {
  const cleaned = value.replace(/[\s().-]/g, '')
  if (!MOBILE_SHAPE.test(cleaned)) return false
  // Sin prefijo del país, 9 ni 0 tienen que quedar código de área + número = 10 dígitos
  // (o 12 si trae el 15 pegado al código de área).
  const national = cleaned.replace(/^\+?54/, '').replace(/^9/, '').replace(/^0/, '')
  if (national.length === 10) return true
  return national.length === 12 && [2, 3, 4].some(area => national.slice(area, area + 2) === '15')
}

// La base guarda el teléfono en VarChar(20).
export const phoneSchema = z
  .string('El teléfono debe ser texto')
  .trim()
  .max(20, 'El teléfono es demasiado largo (máximo 20 caracteres)')
  .refine(isArgentineMobile, PHONE_MESSAGE)

// Para los lugares que no pasan por zod (alta y edición del admin, turnos manuales): vacío o ausente
// no se valida (así se puede dejar sin teléfono a quien no lo tiene), cualquier otra cosa tiene que ser un celular.
export function assertValidPhone(value: unknown): void {
  if (value === undefined || value === null || value === '') return
  const result = phoneSchema.safeParse(value)
  if (!result.success) {
    throw new AppError(HTTP.BAD_REQUEST, result.error.issues[0]?.message ?? PHONE_MESSAGE, 'VALIDATION_ERROR')
  }
}

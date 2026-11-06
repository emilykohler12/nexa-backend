// src/app/validators/boolean.ts
import { z } from 'zod'

// `z.coerce.boolean()` convierte cualquier texto no vacío en true, así que "false"
// (como llega en JSON mal armado o en formularios) se leía como verdadero.
export const looseBoolean = z.preprocess((v) => {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'false' || s === '0' || s === '') return false
    if (s === 'true' || s === '1') return true
  }
  if (v === 0) return false
  if (v === 1) return true
  return v
}, z.boolean())

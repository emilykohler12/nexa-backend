// src/modules/professionals/dto/professional.dto.ts
//
// Validación en el borde del perfil, las franjas y el onboarding de la profesional.
import { z } from 'zod'
import { timeSchema, dateSchema } from '../../../app/validators/datetime'
import { AppError } from '../../../app/middlewares/errorHandler'
import { HTTP } from '../../../app/constants/http'

const text = (max: number) => z.string().trim().max(max).nullable().optional()

export const dayRangeSchema = z.object({
  start: timeSchema,
  end:   timeSchema,
}).refine(r => r.start < r.end, { message: 'La hora de inicio tiene que ser anterior a la de fin' })

export const availabilitySchema = z.record(
  z.string(),
  z.union([dayRangeSchema, z.array(dayRangeSchema), z.null()]),
)

// La profesional solo carga recomendaciones previas y cuidados posteriores. Tolerancia, llegadas tarde, cancelación,
// reprogramación, seña y métodos de pago los define el administrador para todo el negocio: si un pedido viejo los manda,
// se ignoran (zod descarta las claves que no conoce).
const policiesShape = {
  priorRecommendations: text(1000),
  afterCare:            text(1000),
}

export const profileSchema = z.object({
  name:      z.string().trim().min(1).max(150).optional(),
  phone:     z.string().trim().max(30).nullable().optional(),
  bio:       text(2000),
  photo:     text(1000),
  specialty: text(150),
  instagram: text(150),
  facebook:  text(150),
  tiktok:    text(150),
  twitter:   text(150),
  yearsExperience: z.number().int().min(0).max(80).optional(),
  certifications:  text(1000),
  // RF-29: la profesional carga y edita sus propias vacaciones (null/'' las borra). El orden se valida en el servicio.
  vacationFrom: z.union([dateSchema, z.literal(''), z.null()]).optional(),
  vacationTo:   z.union([dateSchema, z.literal(''), z.null()]).optional(),
  ...policiesShape,
})

export const scheduleSchema = z.object({ availability: availabilitySchema })

export const onboardingSchema = z.object({
  personal: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    gender: z.string().trim().max(30).nullable().optional(),
    bio: text(2000), photo: text(1000),
    instagram: text(150), facebook: text(150), tiktok: text(150), twitter: text(150),
  }).optional(),
  work: z.object({
    specialty: text(150),
    yearsExperience: z.number().int().min(0).max(80).optional(),
    certifications: text(1000),
  }).optional(),
  availability: availabilitySchema.optional(),
  // Solo se eligen los servicios: el precio y la duración son los del catálogo (los carga el administrador).
  services: z.array(z.object({
    serviceId: z.string().min(1),
  })).max(200).optional(),
  policies: z.object(policiesShape).optional(),
})

// Nombre con el que se le habla a la usuaria de cada campo (el último tramo de la ruta del error).
const FIELD_LABEL: Record<string, string> = {
  name: 'Nombre', phone: 'Teléfono', gender: 'Género', bio: 'Presentación', photo: 'Foto',
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', twitter: 'Twitter / X',
  specialty: 'Especialidad', yearsExperience: 'Años de experiencia', certifications: 'Certificaciones',
  priorRecommendations: 'Recomendaciones previas', afterCare: 'Cuidados posteriores',
  serviceId: 'Servicio', vacationFrom: 'Vacaciones: desde', vacationTo: 'Vacaciones: hasta',
}

// Mensaje en español y sin jerga para el primer problema de validación. Los textos de zod por defecto están en inglés y
// la pantalla los oculta (quedaba un «datos inválidos» que no decía qué corregir): acá se arma uno que nombra el campo.
// Los mensajes propios de los esquemas (ya en español) se respetan.
function friendlyIssue(issue: z.core.$ZodIssue): string {
  const field = String(issue.path[issue.path.length - 1] ?? '')
  const label = FIELD_LABEL[field] ?? (field && Number.isNaN(Number(field)) ? field : 'Uno de los datos')
  const anyIssue = issue as unknown as { origin?: string; maximum?: number | bigint; minimum?: number | bigint; message: string }
  switch (issue.code) {
    case 'too_big':
      return anyIssue.origin === 'string'
        ? `«${label}» es demasiado largo (máximo ${anyIssue.maximum} caracteres).`
        : `«${label}» no puede ser mayor a ${anyIssue.maximum}.`
    case 'too_small':
      return anyIssue.origin === 'string'
        ? `«${label}» es obligatorio.`
        : `«${label}» no puede ser menor a ${anyIssue.minimum}.`
    case 'invalid_type':
      return `«${label}» no tiene un valor válido.`
    default:
      // Si el esquema ya trae un texto en español se usa; si es el de zod (inglés), se nombra el campo.
      return /^(invalid|required|expected|too (small|big)|string must|number must|unrecognized)/i.test(anyIssue.message)
        ? `«${label}» no tiene un valor válido.`
        : anyIssue.message
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new AppError(HTTP.BAD_REQUEST, first ? friendlyIssue(first) : 'Datos inválidos', 'VALIDATION_ERROR')
  }
  return parsed.data
}

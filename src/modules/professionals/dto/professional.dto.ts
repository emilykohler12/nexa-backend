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

const policiesShape = {
  toleranceMinutes:     z.number().int().min(0).max(240).nullable().optional(),
  latePenalty:          text(500),
  cancellationPolicy:   text(1000),
  reschedulePolicy:     text(1000),
  depositPolicy:        text(1000),
  priorRecommendations: text(1000),
  afterCare:            text(1000),
  paymentMethods:       z.array(z.string().trim().max(50)).max(20).optional(),
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
  languages: z.union([z.string().max(300), z.array(z.string().max(50)).max(20)]).optional(),
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
    languages: z.string().max(300).nullable().optional(),
  }).optional(),
  availability: availabilitySchema.optional(),
  services: z.array(z.object({
    serviceId: z.string().min(1),
    ownPrice: z.number().min(0),
    ownDuration: z.number().int().min(1).max(1440),
  })).max(200).optional(),
  policies: z.object(policiesShape).optional(),
})

export function parseOrThrow<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path.length ? ` (${first.path.join('.')})` : ''
    throw new AppError(HTTP.BAD_REQUEST, `${first?.message ?? 'Datos inválidos'}${where}`, 'VALIDATION_ERROR')
  }
  return parsed.data
}

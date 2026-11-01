//src/modules/invitations/dto/register-professional.dto.ts

import { z } from 'zod'
import { phoneSchema } from '../../../app/validators/phone'

export const registerProfessionalSchema = z.object({
  token:    z.string().min(1, 'Token requerido'),
  name:     z.string().min(2, 'Nombre muy corto').max(100),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  phone:    phoneSchema.or(z.literal('')).optional().nullable(),
  gender:   z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
})

export type RegisterProfessionalDto = z.infer<typeof registerProfessionalSchema>
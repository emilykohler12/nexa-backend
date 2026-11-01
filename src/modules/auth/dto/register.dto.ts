import { z } from 'zod'
import { phoneSchema } from '../../../app/validators/phone'

export const registerDto = z.object({
  // RF-02 — nombre y apellido por separado, y teléfono celular argentino obligatorio.
  name:     z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email:    z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72),
  phone:    phoneSchema,
  gender:   z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  // RF-08 — checkbox obligatorio de Términos de Servicio y Política de Privacidad.
  termsAccepted: z.boolean().refine(v => v === true, {
    message: 'Tenés que aceptar los Términos de Servicio y la Política de Privacidad',
  }),
})

export type RegisterDto = z.infer<typeof registerDto>
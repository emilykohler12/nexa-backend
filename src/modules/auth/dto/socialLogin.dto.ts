import { z } from 'zod'

export const socialLoginDto = z.object({
  provider:    z.enum(['google', 'facebook']),
  accessToken: z.string().min(10, 'Token inválido'),
  // 'login': solo entra si ya existe una cuenta con ese email.
  // 'register': si no existe, la crea (requiere termsAccepted).
  mode:            z.enum(['login', 'register']),
  termsAccepted:   z.boolean().optional(),
})

export type SocialLoginDto = z.infer<typeof socialLoginDto>

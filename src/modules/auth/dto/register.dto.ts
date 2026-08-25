import { z } from 'zod'

export const registerDto = z.object({
  name:     z.string().trim().min(2).max(100),
  email:    z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72),
  phone:    z.string().trim().min(6).max(20).optional(),
  gender:   z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
})

export type RegisterDto = z.infer<typeof registerDto>
//src/modules/auth/dto/resetPassword.dto.ts

import { z } from 'zod'

export const resetPasswordDto = z.object({
  token:    z.string().min(1),
  password: z.string().min(8).max(72),
})

export type ResetPasswordDto = z.infer<typeof resetPasswordDto>
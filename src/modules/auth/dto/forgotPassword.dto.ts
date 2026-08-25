//src/modules/auth/dto/forgotPassword.dto.ts

import { z } from 'zod'

export const forgotPasswordDto = z.object({
  email: z.string().trim().email().toLowerCase(),
})

export type ForgotPasswordDto = z.infer<typeof forgotPasswordDto>
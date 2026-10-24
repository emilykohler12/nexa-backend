//src/modules/auth/dto/resetPassword.dto.ts

import { z } from 'zod'

// El código de 6 dígitos se valida junto con el email de la cuenta: sin el email, un
// código vigente de cualquier usuaria serviría para cambiar la contraseña de su dueña.
export const resetPasswordDto = z.object({
  email:    z.string().trim().email().toLowerCase(),
  token:    z.string().min(1),
  password: z.string().min(8).max(72),
})

export type ResetPasswordDto = z.infer<typeof resetPasswordDto>

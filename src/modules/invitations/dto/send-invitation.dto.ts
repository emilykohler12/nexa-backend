// src/modules/invitations/dto/send-invitation.dto.ts
import { z } from 'zod'

export const sendInvitationSchema = z.object({
  email: z.string().email('Email inválido'),
  // El link vence siempre a los 7 días: ya no se acepta una fecha de vencimiento.
})

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>
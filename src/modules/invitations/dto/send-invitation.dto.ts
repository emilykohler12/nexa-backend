// src/modules/invitations/dto/send-invitation.dto.ts
import { z } from 'zod'

export const sendInvitationSchema = z.object({
  email:     z.string().email('Email inválido'),
  expiresAt: z.string().optional(), // fecha ISO opcional — si no viene, el repo usa 7 días
})

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>
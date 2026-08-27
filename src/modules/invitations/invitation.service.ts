// src/modules/invitations/invitation.service.ts
import crypto                   from 'crypto'
import { invitationRepository } from './invitation.repository'
import { authRepository }       from '../auth/auth.repository'
import { bcryptProvider }       from '../auth/providers/bcrypt.provider'
import { mailProvider }         from '../auth/providers/mail.provider'
import { generateTokens }       from '../auth/utils/generateTokens'
import { AppError }             from '../../app/middlewares/errorHandler'
import { HTTP }                 from '../../app/constants/http'
import { env }                  from '../../app/config/env'
import type { SendInvitationDto }       from './dto/send-invitation.dto'
import type { RegisterProfessionalDto } from './dto/register-professional.dto'
import type { AuthUser, TokenPair }     from '../auth/types/auth.types'

export const invitationService = {

  send: async (
    dto: SendInvitationDto,
    adminId: string
  ): Promise<{ token: string; expiresAt: Date }> => {
    await invitationRepository.invalidatePrevious(dto.email)

    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await invitationRepository.create({
      email:    dto.email,
      token,
      sentById: adminId,
      expiresAt,
    })

    // Envío del email con el link de invitación
    const link = `${env.FRONTEND_URL}/registro-profesional?token=${token}`
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:40px 0;margin:0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <tr><td style="background:linear-gradient(135deg,#069494,#047a7a);padding:32px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">Nexa</h1>
              </td></tr>
              <tr><td style="padding:40px 48px;">
                <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Fuiste invitado/a a unirte como profesional</h2>
                <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px;">
                  El administrador te invitó a registrarte en el sistema. Hacé clic en el botón para crear tu cuenta:
                </p>
                <a href="${link}" style="display:inline-block;padding:14px 32px;background:#069494;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
                  Crear mi cuenta
                </a>
                <p style="color:#888;font-size:13px;margin:28px 0 0;">
                  Este link vence el ${expiresAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  Si no esperabas este email, ignoralo.
                </p>
              </td></tr>
              <tr><td style="background:#f9f9f9;padding:20px 48px;border-top:1px solid #eee;text-align:center;">
                <p style="color:#bbb;font-size:12px;margin:0;">© 2026 Nexa · Email automático, no respondas a este mensaje.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `

    try {
      await mailProvider.send(dto.email, 'Invitación para unirte como profesional — Nexa', html)
      console.log(`[mail] ✅ Invitación enviada a ${dto.email}`)
    } catch (err: any) {
      console.error('[mail] ❌ Error enviando invitación:', err.message)
      // No bloqueamos si el email falla — el admin puede copiar el link manualmente
    }

    return { token, expiresAt }
  },

  validate: async (token: string): Promise<{ email: string }> => {
    const invitation = await invitationRepository.findByToken(token)
    if (!invitation)              throw new AppError(HTTP.BAD_REQUEST, 'Invitación inválida',      'INVALID_TOKEN')
    if (invitation.used)          throw new AppError(HTTP.BAD_REQUEST, 'Esta invitación ya fue usada', 'TOKEN_USED')
    if (new Date() > invitation.expiresAt) throw new AppError(HTTP.BAD_REQUEST, 'Esta invitación expiró', 'TOKEN_EXPIRED')
    return { email: invitation.email }
  },

  registerProfessional: async (
    dto: RegisterProfessionalDto
  ): Promise<{ user: AuthUser; tokens: TokenPair }> => {
    const invitation = await invitationRepository.findByToken(dto.token)
    if (!invitation)              throw new AppError(HTTP.BAD_REQUEST, 'Invitación inválida',      'INVALID_TOKEN')
    if (invitation.used)          throw new AppError(HTTP.BAD_REQUEST, 'Esta invitación ya fue usada', 'TOKEN_USED')
    if (new Date() > invitation.expiresAt) throw new AppError(HTTP.BAD_REQUEST, 'Esta invitación expiró', 'TOKEN_EXPIRED')

    const passwordHash = await bcryptProvider.hash(dto.password)
    const existing     = await authRepository.findByEmail(invitation.email)

    let dbUser

    if (existing) {
      await authRepository.updatePassword(existing.id, passwordHash)
      dbUser = await authRepository.updateRole(existing.id, 'professional')
    } else {
      dbUser = await authRepository.createVerified({
        name:         dto.name,
        email:        invitation.email,
        passwordHash,
        role:         'professional',
        phone:        dto.phone  ?? null,
        gender:       dto.gender ?? null,
      })
    }

    if (!dbUser) throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Error al crear el usuario')

    await invitationRepository.markUsed(dto.token)

    const user: AuthUser = {
      id:              dbUser.id,
      name:            dbUser.name,
      email:           dbUser.email,
      role:            dbUser.role as AuthUser['role'],
      phone:           dbUser.phone ?? null,
      gender:          dbUser.gender ?? null,
      profileComplete: dbUser.profileComplete,
    }

    const tokens = generateTokens(user)
    await authRepository.saveRefreshToken(user.id, tokens.refreshToken)

    return { user, tokens }
  },
}
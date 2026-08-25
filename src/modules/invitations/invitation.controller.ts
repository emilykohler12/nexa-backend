// src/modules/invitations/invitation.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { invitationService }          from './invitation.service'
import { sendInvitationSchema }       from './dto/send-invitation.dto'
import { registerProfessionalSchema } from './dto/register-professional.dto'
import { AppError }                   from '../../app/middlewares/errorHandler'
import { HTTP }                       from '../../app/constants/http'
import type { AuthUser }              from '../auth/types/auth.types'

export const invitationController = {

  // POST /api/invitations — admin envía invitación
  // Devuelve token y expiresAt para que el frontend construya el link
  send: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = sendInvitationSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }

      const admin = (req as Request & { user?: AuthUser }).user
      if (!admin) throw new AppError(HTTP.UNAUTHORIZED, 'No autorizado', 'UNAUTHORIZED')

      const result = await invitationService.send(parsed.data, admin.id)

      // Devolvemos token y expiresAt para que el frontend construya el link
      res.status(HTTP.CREATED).json({
        message:   'Invitación creada correctamente',
        token:     result.token,
        expiresAt: result.expiresAt,
      })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/invitations/validate?token=xxx
  validate: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query['token']
      if (!token || typeof token !== 'string') {
        throw new AppError(HTTP.BAD_REQUEST, 'Token requerido', 'TOKEN_MISSING')
      }
      const result = await invitationService.validate(token)
      res.json({ valid: true, email: result.email })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/invitations/register
  register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerProfessionalSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }

      const { user, tokens } = await invitationService.registerProfessional(parsed.data)

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure:   process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/api/auth/refresh',
      })

      res.status(HTTP.CREATED).json({ user, accessToken: tokens.accessToken })
    } catch (err) {
      next(err)
    }
  },
}
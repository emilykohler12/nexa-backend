// src/modules/auth/auth.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z }                   from 'zod'
import { authService }         from './auth.service'
import { bcryptProvider }      from './providers/bcrypt.provider'
import { jwtProvider }         from './providers/jwt.provider'
import { authRepository }      from './auth.repository'
import { registerDto }         from './dto/register.dto'
import { loginDto }            from './dto/login.dto'
import { forgotPasswordDto }   from './dto/forgotPassword.dto'
import { resetPasswordDto }    from './dto/resetPassword.dto'
import { AppError }            from '../../app/middlewares/errorHandler'
import { HTTP }                from '../../app/constants/http'
import { env }                 from '../../app/config/env'

// En producción, frontend (Vercel) y backend (Render) viven en dominios
// distintos — la cookie es "cross-site" y el navegador solo la manda en ese
// caso con SameSite=None (que además exige Secure=true, por eso van atados).
// En desarrollo (mismo origen, sin HTTPS) 'lax' + sin secure es lo correcto.
const COOKIE_BASE = {
  httpOnly: true,
  secure:   env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
}

function setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  res.cookie('access_token',  tokens.accessToken,  { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path:   '/api/auth/refresh',
  })
}

function clearTokenCookies(res: Response): void {
  res.clearCookie('access_token',  { ...COOKIE_BASE })
  res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/api/auth/refresh' })
}

function userIdFromExpiredAccessToken(token: unknown): string | null {
  if (typeof token !== 'string' || !token) return null
  try {
    return jwtProvider.verifyAccessEvenIfExpired(token).sub
  } catch {
    return null
  }
}

function validate<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new AppError(
      HTTP.UNPROCESSABLE_ENTITY,
      result.error.issues[0]?.message ?? 'Datos inválidos',
      'VALIDATION_ERROR',
    )
  }
  return result.data
}

export const authController = {

  register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validate(registerDto, req.body)
      const { user, tokens } = await authService.register(dto)
      setTokenCookies(res, tokens)
      res.status(HTTP.CREATED).json({ user })
    } catch (err) { next(err) }
  },

  login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validate(loginDto, req.body)
      const { user, tokens } = await authService.login(dto)
      setTokenCookies(res, tokens)
      res.status(HTTP.OK).json({ user })
    } catch (err) { next(err) }
  },

  me: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError(HTTP.UNAUTHORIZED, 'No autenticado')
      const user = await authService.me(req.user.id)
      res.status(HTTP.OK).json({ user })
    } catch (err) { next(err) }
  },

  logout: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // La ruta no exige sesión vigente: si el access token venció (15 min) igual hay que
      // cerrar la sesión. Se identifica a la usuaria por la firma del token, aunque esté
      // vencido; un token falso o ausente no cierra la sesión de nadie.
      const userId = req.user?.id ?? userIdFromExpiredAccessToken(req.cookies?.access_token)
      if (userId) await authService.logout(userId)
      clearTokenCookies(res)
      res.status(HTTP.OK).json({ success: true })
    } catch (err) { next(err) }
  },

  refresh: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.refresh_token
      if (!token) throw new AppError(HTTP.UNAUTHORIZED, 'Sin refresh token', 'NO_REFRESH_TOKEN')
      const { user, tokens } = await authService.refresh(token)
      setTokenCookies(res, tokens)
      res.status(HTTP.OK).json({ user })
    } catch (err) { next(err) }
  },

  verifyEmail: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.query
      if (typeof token !== 'string') throw new AppError(HTTP.BAD_REQUEST, 'Token requerido')
      await authService.verifyEmail(token)
      res.status(HTTP.OK).json({ success: true })
    } catch (err) { next(err) }
  },

  forgotPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validate(forgotPasswordDto, req.body)
      await authService.forgotPassword(dto)
      res.status(HTTP.OK).json({
        success: true,
        message: 'Si el email está registrado, recibirás un código en los próximos minutos.',
      })
    } catch (err) { next(err) }
  },

  resetPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validate(resetPasswordDto, req.body)
      await authService.resetPassword(dto)
      res.status(HTTP.OK).json({ success: true, message: 'Contraseña actualizada correctamente.' })
    } catch (err) { next(err) }
  },

  // Cambia la contraseña del usuario autenticado (no necesita token por email)
  changePassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new AppError(HTTP.UNAUTHORIZED, 'No autenticado')

      const { password, currentPassword } = req.body ?? {}

      // Con una sesión robada o abierta en una compu compartida no alcanza para cambiar la
      // contraseña: hay que conocer la actual. Si es incorrecta se responde 400 y no 401,
      // porque el frontend desloguea ante cualquier 401.
      if (!currentPassword || typeof currentPassword !== 'string') {
        throw new AppError(HTTP.BAD_REQUEST, 'Ingresá tu contraseña actual', 'VALIDATION_ERROR')
      }
      const account = await authRepository.findById(req.user.id)
      if (!account) throw new AppError(HTTP.UNAUTHORIZED, 'Sesión inválida', 'SESSION_INVALID')
      if (!(await bcryptProvider.compare(currentPassword, account.passwordHash))) {
        throw new AppError(HTTP.BAD_REQUEST, 'La contraseña actual no es correcta', 'INVALID_CURRENT_PASSWORD')
      }

      if (!password || typeof password !== 'string') {
        throw new AppError(HTTP.BAD_REQUEST, 'La contraseña es requerida', 'VALIDATION_ERROR')
      }
      if (password.length < 8) {
        throw new AppError(HTTP.BAD_REQUEST, 'La contraseña debe tener al menos 8 caracteres', 'VALIDATION_ERROR')
      }
      if (password.length > 72) {
        throw new AppError(HTTP.BAD_REQUEST, 'La contraseña es demasiado larga', 'VALIDATION_ERROR')
      }

      const passwordHash = await bcryptProvider.hash(password)
      await authRepository.updatePassword(req.user.id, passwordHash)

      res.status(HTTP.OK).json({ success: true, message: 'Contraseña actualizada.' })
    } catch (err) { next(err) }
  },
}
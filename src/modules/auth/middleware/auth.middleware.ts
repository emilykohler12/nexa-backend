// src/modules/auth/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express'
import { jwtProvider } from '../providers/jwt.provider'
import { AppError }    from '../../../app/middlewares/errorHandler'
import { HTTP }        from '../../../app/constants/http'
import type { UserRole } from '../types/auth.types'

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token
  if (!token) return next(new AppError(HTTP.UNAUTHORIZED, 'No autenticado', 'NO_TOKEN'))

  try {
    const payload = jwtProvider.verifyAccess(token)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
    next()
  } catch {
    next(new AppError(HTTP.UNAUTHORIZED, 'Token inválido o expirado', 'INVALID_TOKEN'))
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError(HTTP.UNAUTHORIZED, 'No autenticado', 'NO_TOKEN'))
    if (!roles.includes(req.user.role)) {
      return next(new AppError(HTTP.FORBIDDEN, 'Sin permiso para esta acción', 'FORBIDDEN'))
    }
    next()
  }
}

// Alias para compatibilidad con invitation.routes.ts
export const authMiddleware = authenticate
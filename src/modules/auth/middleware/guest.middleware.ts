// src/modules/auth/middleware/guest.middleware.ts
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../../app/middlewares/errorHandler'
import { HTTP }     from '../../../app/constants/http'
import type { UserRole } from '../types/auth.types'

// Bloquea el acceso si ya hay sesión activa
export function guestOnly(req: Request, _res: Response, next: NextFunction): void {
  if (req.cookies?.access_token) {
    return next(new AppError(HTTP.BAD_REQUEST, 'Ya estás autenticado', 'ALREADY_AUTHENTICATED'))
  }
  next()
}

// Verifica que el usuario tenga el rol requerido
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AppError(HTTP.UNAUTHORIZED, 'No autenticado', 'NO_TOKEN'))
    if (!roles.includes(req.user.role)) {
      return next(new AppError(HTTP.FORBIDDEN, 'Sin permiso para esta acción', 'FORBIDDEN'))
    }
    next()
  }
}
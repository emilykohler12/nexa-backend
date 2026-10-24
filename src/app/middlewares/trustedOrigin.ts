// src/app/middlewares/trustedOrigin.ts
//
// Defensa contra CSRF. En producción las cookies de sesión llevan SameSite=None (el
// frontend y el backend están en dominios distintos), así que el navegador las manda
// también cuando un POST lo dispara otro sitio (por ejemplo un formulario escondido).
// CORS no lo evita: impide que ese sitio LEA la respuesta, no que ENVÍE el pedido.
//
// Los navegadores siempre agregan la cabecera Origin a un pedido que cambia datos y viene
// de otro sitio, y un sitio no puede falsearla. Si está presente y no es la del frontend,
// se rechaza. Si no está (webhook de Mercado Pago, curl, tests, servidor a servidor) se
// deja pasar: esos pedidos no arrastran la sesión de un navegador.
import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'
import { AppError } from './errorHandler'
import { HTTP } from '../constants/http'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function originOf(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null // por ejemplo el literal "null" que mandan las páginas en sandbox
  }
}

const allowedOrigin = originOf(env.FRONTEND_URL)

export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next()

  const origin = req.headers.origin
  if (origin === undefined) return next()
  if (allowedOrigin !== null && originOf(origin) === allowedOrigin) return next()

  next(new AppError(HTTP.FORBIDDEN, 'Origen no permitido', 'FORBIDDEN_ORIGIN'))
}

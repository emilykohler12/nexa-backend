import type { Request, Response, NextFunction } from 'express'
import { HTTP } from '../constants/http'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Cualquier error no controlado (Prisma, drivers, lo que sea) se loguea completo
// server-side, pero al cliente SIEMPRE se le manda un mensaje genérico — nunca
// err.message ni nada que pueda traer texto de una query, un stack trace, o
// detalles de la base de datos, sin importar el entorno (antes esto solo se
// filtraba en producción, y el mensaje crudo se filtraba en dev).
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }
  console.error('[ERROR]', err)
  res.status(HTTP.INTERNAL_SERVER_ERROR).json({
    error: 'Error interno del servidor',
  })
}
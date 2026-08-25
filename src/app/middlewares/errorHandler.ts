import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'
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

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }
  console.error('[ERROR]', err)
  res.status(HTTP.INTERNAL_SERVER_ERROR).json({
    error: env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  })
}
import type { Request, Response } from 'express'
import { HTTP } from '../constants/http'

export function notFound(_req: Request, res: Response): void {
  res.status(HTTP.NOT_FOUND).json({ error: 'Ruta no encontrada' })
}
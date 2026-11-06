// src/modules/contact/contact.routes.ts
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { contactController } from './contact.controller'
import { env } from '../../app/config/env'

const router = Router()

// Endpoint público sin login: límite propio y más corto que el global (en test no hay límite, ver app.ts).
export const buildJobInterestLimiter = (limit = 5) => rateLimit({
  windowMs: 60 * 60 * 1000,
  limit,
  message: { error: 'Enviaste demasiadas postulaciones. Probá de nuevo en un rato.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const jobInterestLimiter = env.NODE_ENV === 'test'
  ? (_req: any, _res: any, next: any) => next()
  : buildJobInterestLimiter()

router.post('/job-interest', jobInterestLimiter, contactController.jobInterest)

export { router as contactRoutes }

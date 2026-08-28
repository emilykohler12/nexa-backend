// src/modules/reviews/review.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { reviewService } from './review.service'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'

const createReviewSchema = z.object({
  appointmentId: z.string().uuid('ID de turno inválido'),
  rating:        z.coerce.number().int().min(1, 'Calificación mínima: 1').max(5, 'Calificación máxima: 5'),
  message:       z.string().max(2000).nullable().optional(),
})

const dismissReviewSchema = z.object({
  appointmentId: z.string().uuid('ID de turno inválido'),
})

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
  }
  return parsed.data
}

function getId(req: Request): string {
  const { id } = req.params
  if (!id || Array.isArray(id)) throw new AppError(HTTP.BAD_REQUEST, 'ID requerido', 'MISSING_ID')
  return id
}

export const reviewController = {

  // Cliente
  getPendingMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pending = await reviewService.getPendingForClient(req.user!.id)
      res.json({ pending })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(createReviewSchema, req.body)
      const review = await reviewService.createForClient(req.user!.id, { ...input, message: input.message ?? null })
      res.status(HTTP.CREATED).json({ review })
    } catch (err) { next(err) }
  },

  dismiss: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseBody(dismissReviewSchema, req.body)
      await reviewService.dismissForClient(req.user!.id, input.appointmentId)
      res.json({ success: true })
    } catch (err) { next(err) }
  },

  getMine: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviews = await reviewService.getMineForClient(req.user!.id)
      res.json({ reviews })
    } catch (err) { next(err) }
  },

  // Admin
  getForClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviews = await reviewService.getForAdminClient(getId(req))
      res.json({ reviews })
    } catch (err) { next(err) }
  },

  approve: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await reviewService.setStatus(getId(req), 'approved')
      res.json({ review })
    } catch (err) { next(err) }
  },

  reject: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await reviewService.setStatus(getId(req), 'rejected')
      res.json({ review })
    } catch (err) { next(err) }
  },

  // Pública
  getPublicSummary: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await reviewService.getPublicSummary()
      res.json(summary)
    } catch (err) { next(err) }
  },

  getPublicList: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviews = await reviewService.getPublicList()
      res.json({ reviews })
    } catch (err) { next(err) }
  },
}

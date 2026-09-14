// src/modules/specialEvents/specialEvent.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { specialEventModel } from './specialEvent.model'
import { AppError }      from '../../app/middlewares/errorHandler'
import { HTTP }          from '../../app/constants/http'
import { dateSchema }    from '../../app/validators/datetime'

const specialEventSchema = z.object({
  serviceId:      z.string().uuid('Elegí un servicio'),
  professionalId: z.string().uuid('Elegí una profesional'),
  date:           dateSchema,
  title:          z.string().trim().max(150).nullable().optional(),
  description:    z.string().trim().max(2000).nullable().optional(),
  active:         z.coerce.boolean().default(true),
})

function getId(req: Request): string {
  const { id } = req.params
  if (!id || typeof id !== 'string' || id.length > 100) {
    throw new AppError(HTTP.BAD_REQUEST, 'ID inválido')
  }
  return id
}

interface RawSpecialEvent {
  id: string; date: string; title: string | null; description: string | null; active: boolean
  createdAt: Date
  service: { id: string; name: string; description: string; price: { toString(): string }; duration: number; image: string | null }
  professional: { id: string; name: string; professional: { photo: string | null; specialty: string | null } | null }
}

function toResponse(e: RawSpecialEvent) {
  return {
    id:          e.id,
    date:        e.date,
    title:       e.title,
    description: e.description,
    active:      e.active,
    createdAt:   e.createdAt.toISOString(),
    service: {
      id:          e.service.id,
      name:        e.service.name,
      description: e.service.description,
      price:       Number(e.service.price),
      duration:    e.service.duration,
      image:       e.service.image,
    },
    professional: {
      id:        e.professional.id,
      name:      e.professional.name,
      photo:     e.professional.professional?.photo ?? null,
      specialty: e.professional.professional?.specialty ?? null,
    },
  }
}

export const specialEventController = {

  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await specialEventModel.findAll()
      res.json({ specialEvents: items.map(toResponse) })
    } catch (err) { next(err) }
  },

  getActive: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await specialEventModel.findActive()
      res.json({ specialEvents: items.map(toResponse) })
    } catch (err) { next(err) }
  },

  create: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = specialEventSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const created = await specialEventModel.create({
        ...parsed.data,
        title:       parsed.data.title ?? null,
        description: parsed.data.description ?? null,
      })
      res.status(HTTP.CREATED).json({ specialEvent: toResponse(created) })
    } catch (err) { next(err) }
  },

  update: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id     = getId(req)
      const parsed = specialEventSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0].message, 'VALIDATION_ERROR')
      }
      const updated = await specialEventModel.update(id, parsed.data)
      res.json({ specialEvent: toResponse(updated) })
    } catch (err) { next(err) }
  },

  delete: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getId(req)
      await specialEventModel.delete(id)
      res.json({ success: true })
    } catch (err) { next(err) }
  },
}

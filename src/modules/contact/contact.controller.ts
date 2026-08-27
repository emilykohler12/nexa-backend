// src/modules/contact/contact.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { activityService } from '../activity/activity.service'

const jobInterestSchema = z.object({
  name:    z.string().trim().max(150).nullable().optional(),
  email:   z.string().trim().max(255).nullable().optional(),
  phone:   z.string().trim().max(30).nullable().optional(),
  message: z.string().trim().max(2000).nullable().optional(),
})

export const contactController = {

  jobInterest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = jobInterestSchema.safeParse(req.body)
      const data = parsed.success ? parsed.data : {}

      const parts = [
        data.name    && `Nombre: ${data.name}`,
        data.email   && `Email: ${data.email}`,
        data.phone   && `Teléfono: ${data.phone}`,
        data.message && `Mensaje: ${data.message}`,
      ].filter(Boolean)

      await activityService.log({
        action: 'Nueva postulación', module: 'jobs',
        detail: parts.length ? parts.join(' — ') : 'Postulación sin datos cargados',
      })

      res.status(201).json({ success: true })
    } catch (err) { next(err) }
  },
}

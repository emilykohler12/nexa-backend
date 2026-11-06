// src/modules/contact/contact.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { activityService } from '../activity/activity.service'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'
import { phoneSchema } from '../../app/validators/phone'

// El formulario manda null en lo que la persona deja vacío.
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform(v => (v ? v : null))

const jobInterestSchema = z.object({
  name:    optionalText(150),
  email:   z.string().trim().max(255).nullish().transform(v => (v ? v : null))
             .pipe(z.string().email('Ingresá un correo válido').nullable()),
  phone:   z.string().trim().nullish().transform(v => (v ? v : null))
             .pipe(phoneSchema.nullable()),
  message: optionalText(2000),
}).refine(d => d.name || d.email || d.phone || d.message, { message: 'Completá al menos un dato de la postulación' })

export const contactController = {

  jobInterest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = jobInterestSchema.safeParse(req.body)
      if (!parsed.success) {
        throw new AppError(HTTP.BAD_REQUEST, parsed.error.issues[0]?.message ?? 'Datos inválidos', 'VALIDATION_ERROR')
      }
      const data = parsed.data

      // Datos personales: el nombre, el correo y el teléfono NO se guardan en el registro de actividad
      // (lo ve cualquier administradora y no tiene vencimiento). Solo queda qué campos vinieron.
      const received = [
        data.name  && 'nombre',
        data.email && 'correo',
        data.phone && 'teléfono',
      ].filter(Boolean)

      await activityService.log({
        action: 'Nueva postulación', module: 'jobs',
        detail: [
          `Datos recibidos: ${received.length ? received.join(', ') : 'ninguno de contacto'}.`,
          data.message && `Mensaje: ${data.message}`,
        ].filter(Boolean).join(' '),
      })

      res.status(201).json({ success: true })
    } catch (err) { next(err) }
  },
}

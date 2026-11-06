// src/modules/contact/contact.controller.ts
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { activityService } from '../activity/activity.service'
import { AppError } from '../../app/middlewares/errorHandler'
import { HTTP } from '../../app/constants/http'
import { contactService } from './contact.service'
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

      // Datos personales: la postulación NO se guarda en la base. Va por mail al correo del estudio y en el
      // registro de actividad (lo ve cualquier administradora y no tiene vencimiento) solo queda qué
      // campos vinieron, sin nombre, correo, teléfono ni mensaje.
      const received = [
        data.name    && 'nombre',
        data.email   && 'correo',
        data.phone   && 'teléfono',
        data.message && 'mensaje',
      ].filter(Boolean).join(', ')

      try {
        await contactService.sendJobInterest(data)
      } catch {
        // El detalle del error ya queda en el log del servidor (mailProvider); acá no se copia nada
        // de la postulación.
        await activityService.log({
          action: 'No se pudo enviar una postulación', module: 'jobs', level: 'error',
          detail: `Falló el envío del mail al estudio. Campos recibidos: ${received || 'ninguno'}.`,
        })
        throw new AppError(
          HTTP.INTERNAL_SERVER_ERROR,
          'No pudimos enviar tu postulación. Probá de nuevo en un rato.',
          'JOB_INTEREST_MAIL_FAILED',
        )
      }

      await activityService.log({
        action: 'Nueva postulación', module: 'jobs',
        detail: `Postulación enviada por mail al estudio. Campos recibidos: ${received || 'ninguno'}.`,
      })

      res.status(201).json({ success: true })
    } catch (err) { next(err) }
  },
}
